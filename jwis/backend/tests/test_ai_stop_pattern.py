import unittest
from unittest import mock

from app.ai.detectors.stop_pattern import StopPatternDetector

TPS = [{"name": "TPS A", "kecamatan": "X", "kelurahan": "Y",
        "lat": -6.2000, "lng": 106.8000}]
WR = [{"name": "WR B", "jns": "R", "almt": "", "kec": "X", "kel": "Y",
       "lat": -6.2100, "lng": 106.8100}]

# ~1.7 km dari situs resmi terdekat
FAR_LAT, FAR_LNG = -6.2150, 106.8000


class StopPatternTests(unittest.TestCase):
    def _detector(self, rounds, now_start=1000.0):
        """rounds: list of observation-rounds; each round list of {plate, lat, lng}.
        Clock advances 120s per scan."""
        clock = {"t": now_start}
        remaining = list(rounds)

        def now_fn():
            return clock["t"]

        def observer():
            clock["t"] += 120.0
            return remaining.pop(0) if remaining else []

        return StopPatternDetector(stop_minutes=10.0, observer=observer,
                                   now_fn=now_fn)

    def _patch_sites(self):
        return mock.patch.multiple(
            "app.ai.detectors.stop_pattern",
            load_real_tps_coordinates=mock.Mock(return_value=TPS),
            load_real_wr_coordinates=mock.Mock(return_value=WR),
        )

    def test_stationary_far_from_sites_gets_flagged(self):
        rounds = [[{"plate": "B1234XX", "lat": FAR_LAT, "lng": FAR_LNG}]
                  for _ in range(6)]
        det = self._detector(rounds)
        with self._patch_sites():
            for _ in range(6):
                det.scan()
        flags = det.flags()
        self.assertEqual(len(flags), 1)
        self.assertEqual(flags[0]["collector_id"], "B1234XX")
        self.assertGreater(flags[0]["nearest_site_m"], 300.0)
        self.assertGreaterEqual(flags[0]["duration_min"], 10.0)
        self.assertEqual(flags[0]["classification"], "simulated")
        self.assertGreater(flags[0]["confidence"], 0.5)

    def test_moving_collector_never_flagged(self):
        rounds = [[{"plate": "B1234XX", "lat": FAR_LAT + i * 0.01, "lng": FAR_LNG}]
                  for i in range(6)]
        det = self._detector(rounds)
        with self._patch_sites():
            for _ in range(6):
                det.scan()
        self.assertEqual(det.flags(), [])

    def test_stationary_near_official_site_not_flagged(self):
        rounds = [[{"plate": "B1234XX", "lat": -6.2001, "lng": 106.8001}]
                  for _ in range(6)]
        det = self._detector(rounds)
        with self._patch_sites():
            for _ in range(6):
                det.scan()
        self.assertEqual(det.flags(), [])  # ~15m dari TPS A -> resmi

    def test_short_stop_not_flagged(self):
        rounds = [[{"plate": "B1234XX", "lat": FAR_LAT, "lng": FAR_LNG}]
                  for _ in range(3)]
        det = self._detector(rounds)
        with self._patch_sites():
            for _ in range(3):
                det.scan()
        self.assertEqual(det.flags(), [])  # hanya ~4 menit

    def test_dedup_one_flag_per_plate(self):
        rounds = [[{"plate": "B1234XX", "lat": FAR_LAT, "lng": FAR_LNG}]
                  for _ in range(12)]
        det = self._detector(rounds)
        with self._patch_sites():
            for _ in range(12):
                det.scan()
        self.assertEqual(len(det.flags()), 1)


if __name__ == "__main__":
    unittest.main()
