"""Multi-process and in-process concurrency checks for SpjStore (issue #62).

Two API workers must allocate unique daily SPJ numbers, preserve every
record, and keep the one-active-SPJ-per-truck invariant under concurrent
create/activate/complete attempts.
"""

from __future__ import annotations

import concurrent.futures
import json
import os
import subprocess
import sys
import tempfile
import unittest

with_open = None


def _db_path(name: str) -> str:
    path = os.path.join(tempfile.gettempdir(), name)
    if os.path.exists(path):
        os.remove(path)
    return path


# Script run by each worker process: create N SPJs for distinct trucks.
_WORKER_SRC = r"""
import sys
sys.path.insert(0, {backend_dir!r})
import os
os.environ["JWIS_SPJ_SEED"] = "off"
from app.spj import SpjStore

store = SpjStore(persist_path={db!r})
results = []
for i in range({count}):
    spj = store.create(driver_name="W", truck_code=f"T-{{i}}", destination="TPST Bantargebang",
                       weigh_on_site=True, priority="normal", note="", created_by="worker")
    results.append(spj.spj_number)
print(json.dumps(results))
import json
"""


class MultiProcessConcurrencyTests(unittest.TestCase):
    def test_concurrent_creates_two_processes_unique_numbers_and_full_records(self):
        backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        db = _db_path("test_spj_mp.db")
        per_worker = 25
        script = _WORKER_SRC.format(backend_dir=backend_dir, db=db, count=per_worker)
        script = "import json\n" + script
        procs = [
            subprocess.Popen([sys.executable, "-c", script],
                             stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            for _ in range(2)
        ]
        outputs = []
        for p in procs:
            out, err = p.communicate(timeout=120)
            self.assertEqual(p.returncode, 0, f"worker failed: {err}")
            outputs.append(json.loads(out.strip().splitlines()[-1]))
        all_numbers = outputs[0] + outputs[1]
        self.assertEqual(len(all_numbers), 2 * per_worker)
        self.assertEqual(len(set(all_numbers)), len(all_numbers), "duplicate daily SPJ numbers across workers")
        # Every record must survive: reload and count.
        script_check = (
            "import json,sys\n"
            f"sys.path.insert(0, {backend_dir!r})\n"
            "import os\nos.environ['JWIS_SPJ_SEED']='off'\n"
            "from app.spj import SpjStore\n"
            f"store = SpjStore(persist_path={db!r})\n"
            f"print(json.dumps([s.spj_number for s in store.list()]))\n"
        )
        out = subprocess.run([sys.executable, "-c", script_check],
                             capture_output=True, text=True, timeout=60)
        self.assertEqual(out.returncode, 0, out.stderr)
        stored = json.loads(out.stdout.strip().splitlines()[-1])
        self.assertEqual(len(stored), 2 * per_worker, "records lost across workers")
        self.assertEqual(set(stored), set(all_numbers))

    def test_concurrent_activate_only_one_active_per_truck(self):
        backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        db = _db_path("test_spj_mp_activate.db")
        # Seed: two drafts for the SAME truck, from separate writer processes.
        seed_script = (
            "import json,sys\n"
            f"sys.path.insert(0, {backend_dir!r})\n"
            "import os\nos.environ['JWIS_SPJ_SEED']='off'\n"
            "from app.spj import SpjStore\n"
            f"store = SpjStore(persist_path={db!r})\n"
            "ids=[]\n"
            "for i in range(2):\n"
            "    spj = store.create(driver_name='W', truck_code='T-SHARED', destination='TPST Bantargebang',"
            " weigh_on_site=True, priority='normal', note='', created_by='worker')\n"
            "    store.add_stop(spj.spj_id, name='S', kecamatan='K', address='A', lat=-6.2, lng=106.8)\n"
            "    ids.append(spj.spj_id)\n"
            "print(json.dumps(ids))\n"
        )
        out = subprocess.run([sys.executable, "-c", seed_script],
                             capture_output=True, text=True, timeout=60)
        self.assertEqual(out.returncode, 0, out.stderr)
        ids = json.loads(out.stdout.strip().splitlines()[-1])

        activate_script = (
            "import sys\n"
            f"sys.path.insert(0, {backend_dir!r})\n"
            "import os\nos.environ['JWIS_SPJ_SEED']='off'\n"
            "from app.spj import SpjStore\n"
            f"store = SpjStore(persist_path={db!r})\n"
            "import sys\n"
            f"try:\n    store.activate({ids!r}[0] if int(sys.argv[1])==0 else {ids!r}[1])\n"
            "    print('OK')\n"
            "except ValueError as e:\n    print('CONFLICT')\n"
        )
        procs = [
            subprocess.Popen([sys.executable, "-c", activate_script, str(w)],
                             stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            for w in range(2)
        ]
        statuses = [p.communicate(timeout=60)[0].strip().splitlines()[-1] for p in procs]
        for p in procs:
            self.assertEqual(p.returncode, 0)
        # Exactly one activation must succeed.
        self.assertEqual(sorted(statuses), ["CONFLICT", "OK"],
                         f"expected one OK and one CONFLICT, got {statuses}")

        check_script = (
            "import json,sys\n"
            f"sys.path.insert(0, {backend_dir!r})\n"
            "import os\nos.environ['JWIS_SPJ_SEED']='off'\n"
            "from app.spj import SpjStore\n"
            f"store = SpjStore(persist_path={db!r})\n"
            "active = store.active_for_truck('T-SHARED')\n"
            "print(json.dumps(1 if active else 0))\n"
        )
        out = subprocess.run([sys.executable, "-c", check_script],
                             capture_output=True, text=True, timeout=60)
        self.assertEqual(out.returncode, 0, out.stderr)
        self.assertEqual(json.loads(out.stdout.strip()), 1, "truck must have exactly one active SPJ")


class InProcessConcurrencyTests(unittest.TestCase):
    def test_threaded_creates_unique_numbers(self):
        with_open = os.environ.get
        os.environ["JWIS_SPJ_SEED"] = "off"
        try:
            from app.spj import SpjStore
        finally:
            pass
        db = _db_path("test_spj_threads.db")
        store = SpjStore(persist_path=db)
        # New connections per thread exercise SQLite-level contention.
        def worker(n: int):
            s = SpjStore(persist_path=db)
            return s.create(driver_name="W", truck_code=f"T-{n}", destination="TPST Bantargebang",
                            weigh_on_site=True, priority="normal", note="",
                            created_by="thread").spj_number

        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
            numbers = list(ex.map(worker, range(8)))
        self.assertEqual(len(numbers), 8)
        self.assertEqual(len(set(numbers)), 8, "duplicate numbers across threads")


if __name__ == "__main__":
    unittest.main()
