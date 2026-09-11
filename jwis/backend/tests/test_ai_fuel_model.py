import unittest

from app.ai.forecasters.fuel_model import CarbonCalculator
from app.gps_feed import GpsBreadcrumb


def _crumb(code, lat, lng, speed, sec):
    return GpsBreadcrumb(truck_code=code, lat=lat, lng=lng,
                         timestamp=f"2026-09-10T00:00:{sec:02d}",
                         speed_kmh=speed)


class FakeSource:
    def __init__(self, trails):
        self._trails = trails  # truck_code -> list[GpsBreadcrumb]

    def current_positions(self):
        return [{"truck_code": c} for c in self._trails]

    def breadcrumbs(self, truck_code, points):
        return self._trails[truck_code][-points:]


class TripFuelFormulaTests(unittest.TestCase):
    def test_full_load_no_idle(self):
        fuel = CarbonCalculator.trip_fuel_l(100.0, load_ratio=1.0,
                                            idle_h=0.0, stopgo_km=0.0)
        self.assertAlmostEqual(fuel, 55.0)

    def test_empty_load(self):
        fuel = CarbonCalculator.trip_fuel_l(100.0, load_ratio=0.0,
                                            idle_h=0.0, stopgo_km=0.0)
        self.assertAlmostEqual(fuel, 35.0)

    def test_stopgo_penalty_applies(self):
        # 80 km cruise + 20 km stop-go at full load
        fuel = CarbonCalculator.trip_fuel_l(100.0, load_ratio=1.0,
                                            idle_h=0.0, stopgo_km=20.0)
        self.assertAlmostEqual(fuel, 44.0 + 12.65, places=2)

    def test_idle_rate_applies(self):
        fuel = CarbonCalculator.trip_fuel_l(0.0, load_ratio=0.5,
                                            idle_h=2.0, stopgo_km=0.0)
        self.assertAlmostEqual(fuel, 2.4)

    def test_load_ratio_clamped(self):
        fuel = CarbonCalculator.trip_fuel_l(100.0, load_ratio=5.0,
                                            idle_h=0.0, stopgo_km=0.0)
        self.assertAlmostEqual(fuel, 55.0)


class CarbonCalculatorUpdateTests(unittest.TestCase):
    def test_latest_no_data(self):
        calc = CarbonCalculator()
        self.assertEqual(calc.latest(), {"status": "no_data"})

    def test_update_aggregates_fleet(self):
        trails = {
            # T-001: 2 segmen ~111m each, cepat
            "T-001": [_crumb("T-001", -6.2000, 106.8000, 40.0, 0),
                      _crumb("T-001", -6.2010, 106.8000, 40.0, 6),
                      _crumb("T-001", -6.2020, 106.8000, 40.0, 12)],
            # T-002: diam -> idle
            "T-002": [_crumb("T-002", -6.3000, 106.9000, 0.0, 0),
                      _crumb("T-002", -6.3000, 106.9000, 0.0, 6),
                      _crumb("T-002", -6.3000, 106.9000, 0.0, 12)],
        }
        calc = CarbonCalculator()
        snap = calc.update(FakeSource(trails))
        self.assertEqual(snap["trips"], 2)
        self.assertAlmostEqual(snap["total_distance_km"], 0.222, places=2)
        per = {t["truck_code"]: t for t in snap["per_truck"]}
        self.assertGreater(per["T-001"]["fuel_l"], 0.0)
        # T-002: 2 interval idle * 6s = 12s = 0.00333h -> ~0.004 L
        self.assertAlmostEqual(per["T-002"]["fuel_l"], 0.004, places=3)
        self.assertAlmostEqual(snap["co2_kg"],
                               round(snap["fuel_l"] * 2.68, 2), places=2)
        self.assertEqual(snap["classification"], "reference")
        self.assertGreater(snap["baseline_fuel_l"], 0.0)

    def test_truck_with_single_breadcrumb_skipped(self):
        trails = {"T-009": [_crumb("T-009", -6.2, 106.8, 30.0, 0)]}
        calc = CarbonCalculator()
        snap = calc.update(FakeSource(trails))
        self.assertEqual(snap["trips"], 0)
        self.assertEqual(snap["per_truck"], [])


if __name__ == "__main__":
    unittest.main()
