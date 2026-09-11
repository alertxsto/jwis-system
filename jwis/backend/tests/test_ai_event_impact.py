import unittest

from app.ai.actions.auto_state import EventFeed
from app.ai.forecasters.event_impact import EventImpactForecaster


def _weather(days):
    return {"source": "open-meteo", "forecast": days}


def _day(date, rain, impact, prob=40):
    return {"date": date, "rainfall_mm": rain, "precipitation_probability": prob,
            "risk_level": "watch" if rain > 20 else "normal",
            "waste_impact_percent": impact,
            "operational_advice": f"advice-{date}"}


WEEK = [_day(f"2026-09-{10 + i:02d}", rain=float(i * 5), impact=float(i * 2))
        for i in range(7)]

EVENTS = [{"date_raw": "2026-09-12", "name": "Konser GBK", "location": "GBK",
           "time": "19:00", "expected_attendance": 50000}]


class EventImpactTests(unittest.TestCase):
    def _forecaster(self, weather=None, events=None, holidays=frozenset()):
        feed = EventFeed(maxlen=20)
        fc = EventImpactForecaster(
            feed=feed,
            weather_fn=lambda: weather if weather is not None else _weather(WEEK),
            events_fn=lambda: events if events is not None else EVENTS,
            holidays_fn=lambda: holidays,
        )
        return fc, feed

    def test_outlook_covers_seven_days_with_schema(self):
        fc, _ = self._forecaster()
        outlook = fc.refresh()
        self.assertEqual(len(outlook), 7)
        day = outlook[0]
        for key in ["date", "rainfall_mm", "precipitation_probability",
                    "risk_level", "events", "is_holiday", "volume_delta_pct",
                    "operational_advice", "source", "stale"]:
            self.assertIn(key, day)
        self.assertFalse(day["stale"])

    def test_event_attendance_raises_volume_delta(self):
        fc, _ = self._forecaster()
        outlook = fc.refresh()
        day12 = next(d for d in outlook if d["date"] == "2026-09-12")
        day11 = next(d for d in outlook if d["date"] == "2026-09-11")
        self.assertEqual(day12["events"][0]["name"], "Konser GBK")
        # impact 4.0 + 50000/5000 = 14.0 vs day11 impact 2.0
        self.assertEqual(day12["volume_delta_pct"], 14.0)
        self.assertEqual(day11["volume_delta_pct"], 2.0)

    def test_holiday_adds_delta(self):
        fc, _ = self._forecaster(events=[], holidays=frozenset({"2026-09-10"}))
        outlook = fc.refresh()
        self.assertTrue(outlook[0]["is_holiday"])
        self.assertEqual(outlook[0]["volume_delta_pct"], 0.0 + 5.0)

    def test_material_change_emits_forecast_event(self):
        fc, feed = self._forecaster()
        fc.refresh()
        self.assertEqual(feed.snapshot(), [])
        bigger = [_day(d["date"], d["rainfall_mm"],
                       d["waste_impact_percent"] + 15.0) for d in WEEK]
        fc._weather_fn = lambda: _weather(bigger)
        fc.refresh()
        events = [e for e in feed.snapshot() if e["event_type"] == "forecast_update"]
        self.assertGreaterEqual(len(events), 1)

    def test_weather_failure_returns_stale_previous(self):
        fc, _ = self._forecaster()
        good = fc.refresh()

        def boom():
            raise RuntimeError("open-meteo down")

        fc._weather_fn = boom
        stale = fc.refresh()
        self.assertEqual([d["date"] for d in stale], [d["date"] for d in good])
        self.assertTrue(all(d["stale"] for d in stale))

    def test_weather_failure_before_first_success_returns_empty(self):
        fc, _ = self._forecaster()

        def boom():
            raise RuntimeError("down")

        fc._weather_fn = boom
        self.assertEqual(fc.refresh(), [])
        self.assertEqual(fc.latest(), [])

    def test_unparseable_event_dates_skipped(self):
        bad = [{"date_raw": "akhir bulan", "name": "X",
                "expected_attendance": 99999}]
        fc, _ = self._forecaster(events=bad)
        outlook = fc.refresh()
        self.assertTrue(all(d["events"] == [] for d in outlook))


if __name__ == "__main__":
    unittest.main()
