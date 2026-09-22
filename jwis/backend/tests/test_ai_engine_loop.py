import os
import time
import unittest
from unittest import mock

from app.ai.engine_loop import AiEngine, maybe_start_engine


class AiEngineTickTests(unittest.TestCase):
    def test_tick_once_runs_registered_modules(self):
        engine = AiEngine(tick_seconds=999)
        calls = []
        engine.register("mod_a", lambda source: calls.append("a"))
        engine.register("mod_b", lambda source: calls.append("b"))
        result = engine.tick_once()
        self.assertEqual(calls, ["a", "b"])
        self.assertEqual(result, {"mod_a": "ok", "mod_b": "ok"})

    def test_failing_module_does_not_kill_others(self):
        engine = AiEngine(tick_seconds=999)
        engine.register("bad", lambda source: 1 / 0)
        ok_called = []
        engine.register("good", lambda source: ok_called.append(True))
        result = engine.tick_once()
        self.assertTrue(result["bad"].startswith("error"))
        self.assertEqual(result["good"], "ok")
        self.assertEqual(ok_called, [True])

    def test_modules_receive_gps_source(self):
        engine = AiEngine(tick_seconds=999)
        received = []
        engine.register("spy", lambda source: received.append(source))
        engine.tick_once()
        self.assertEqual(len(received), 1)
        self.assertTrue(hasattr(received[0], "current_positions"))

    def test_start_stop_loop_ticks_repeatedly(self):
        engine = AiEngine(tick_seconds=0.05)
        counter = {"n": 0}

        def count(source):
            counter["n"] += 1

        engine.register("counter", count)
        engine.start()
        time.sleep(0.16)
        engine.stop()
        self.assertGreaterEqual(counter["n"], 2)
        self.assertFalse(engine.is_running())


class MaybeStartEngineTests(unittest.TestCase):
    def test_engine_off_by_default(self):
        with mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop("JWIS_AI_ENGINE", None)
            self.assertIsNone(maybe_start_engine())

    def test_engine_off_explicit(self):
        with mock.patch.dict(os.environ, {"JWIS_AI_ENGINE": "off"}):
            self.assertIsNone(maybe_start_engine())

    def test_engine_on_starts_and_stops(self):
        with mock.patch.dict(os.environ, {"JWIS_AI_ENGINE": "on"}):
            engine = maybe_start_engine()
        try:
            self.assertIsNotNone(engine)
            self.assertTrue(engine.is_running())
        finally:
            engine.stop()


if __name__ == "__main__":
    unittest.main()
