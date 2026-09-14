import os
import unittest
from unittest import mock

from app.timbangan_ocr import read_weight_from_photo


def _openai_response(weight):
    import json as _json
    content = _json.dumps({"weight_kg": weight})
    return {"choices": [{"message": {"content": content}}]}


class TimbanganOcrTests(unittest.TestCase):
    def test_success_high_confidence(self):
        with mock.patch.dict(os.environ, {"OPENAI_API_KEY": "k", "OPENAI_BASE_URL": "http://x", "OPENAI_MODEL": "m"}):
            result = read_weight_from_photo("data:image/jpeg;base64,AA",
                                            http_post=lambda **kw: _openai_response(37.24))
        self.assertEqual(result["weight_kg"], 37.24)
        self.assertEqual(result["confidence"], "high")

    def test_out_of_range_is_low(self):
        with mock.patch.dict(os.environ, {"OPENAI_API_KEY": "k", "OPENAI_BASE_URL": "http://x", "OPENAI_MODEL": "m"}):
            result = read_weight_from_photo("data:image/jpeg;base64,AA",
                                            http_post=lambda **kw: _openai_response(999999999))
        self.assertIsNone(result["weight_kg"])
        self.assertEqual(result["confidence"], "low")

    def test_null_reading_is_low(self):
        with mock.patch.dict(os.environ, {"OPENAI_API_KEY": "k", "OPENAI_BASE_URL": "http://x", "OPENAI_MODEL": "m"}):
            result = read_weight_from_photo("data:image/jpeg;base64,AA",
                                            http_post=lambda **kw: _openai_response(None))
        self.assertIsNone(result["weight_kg"])
        self.assertEqual(result["confidence"], "low")

    def test_malformed_response_is_low(self):
        with mock.patch.dict(os.environ, {"OPENAI_API_KEY": "k", "OPENAI_BASE_URL": "http://x", "OPENAI_MODEL": "m"}):
            result = read_weight_from_photo("data:image/jpeg;base64,AA",
                                            http_post=lambda **kw: {"choices": [{"message": {"content": "tidak terbaca sama sekali"}}]})
        self.assertIsNone(result["weight_kg"])
        self.assertEqual(result["confidence"], "low")

    def test_http_failure_is_failed(self):
        def boom(**kw):
            raise TimeoutError("timeout")
        with mock.patch.dict(os.environ, {"OPENAI_API_KEY": "k", "OPENAI_BASE_URL": "http://x", "OPENAI_MODEL": "m"}):
            result = read_weight_from_photo("data:image/jpeg;base64,AA", http_post=boom)
        self.assertIsNone(result["weight_kg"])
        self.assertEqual(result["confidence"], "failed")

    def test_missing_api_key_is_failed(self):
        with mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop("OPENAI_API_KEY", None)
            result = read_weight_from_photo("data:image/jpeg;base64,AA",
                                            http_post=lambda **kw: _openai_response(1.0))
        self.assertIsNone(result["weight_kg"])
        self.assertEqual(result["confidence"], "failed")
        self.assertIn("OPENAI_API_KEY", result["raw_text"])


if __name__ == "__main__":
    unittest.main()
