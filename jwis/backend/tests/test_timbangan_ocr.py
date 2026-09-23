import os
import unittest
from unittest import mock

from app.timbangan_ocr import read_weight_from_photo


def _vision_response(weight):
    import json as _json
    content = _json.dumps({"weight_kg": weight})
    return {"choices": [{"message": {"content": content}}]}


class TimbanganOcrTests(unittest.TestCase):
    def test_success_high_confidence_sends_guts_vision_request(self):
        calls = []

        def post(**kwargs):
            calls.append(kwargs)
            return _vision_response(12340)

        with mock.patch.dict(os.environ, {
            "GUTS_API_KEY": "example-key",
            "GUTS_BASE_URL": "https://vision.example/v1/",
            "GUTS_VISION_MODEL": "gemini-3.8-flash",
        }):
            result = read_weight_from_photo(
                "data:image/jpeg;base64,AA", http_post=post)
        self.assertEqual(result["weight_kg"], 12340)
        self.assertEqual(result["confidence"], "high")
        self.assertIn("gutsai-vision", result["source"])
        self.assertEqual(calls[0]["url"], "https://vision.example/v1/chat/completions")
        self.assertEqual(calls[0]["headers"]["Authorization"], "Bearer example-key")
        self.assertEqual(calls[0]["json_body"]["model"], "gemini-3.8-flash")
        self.assertEqual(
            calls[0]["json_body"]["messages"][1]["content"][1]["image_url"]["url"],
            "data:image/jpeg;base64,AA")

    def test_out_of_range_is_low(self):
        with mock.patch.dict(os.environ, {"GUTS_API_KEY": "k"}):
            result = read_weight_from_photo("data:image/jpeg;base64,AA",
                                            http_post=lambda **kw: _vision_response(999999999))
        self.assertIsNone(result["weight_kg"])
        self.assertEqual(result["confidence"], "low")

    def test_null_reading_is_low(self):
        with mock.patch.dict(os.environ, {"GUTS_API_KEY": "k"}):
            result = read_weight_from_photo("data:image/jpeg;base64,AA",
                                            http_post=lambda **kw: _vision_response(None))
        self.assertIsNone(result["weight_kg"])
        self.assertEqual(result["confidence"], "low")

    def test_malformed_reading_is_low(self):
        with mock.patch.dict(os.environ, {"GUTS_API_KEY": "k"}):
            result = read_weight_from_photo(
                "data:image/jpeg;base64,AA",
                http_post=lambda **kw: {"choices": [{"message": {"content": "tidak terbaca sama sekali"}}]})
        self.assertIsNone(result["weight_kg"])
        self.assertEqual(result["confidence"], "low")

    def test_boolean_is_not_a_weight(self):
        with mock.patch.dict(os.environ, {"GUTS_API_KEY": "k"}):
            result = read_weight_from_photo("data:image/jpeg;base64,AA",
                                            http_post=lambda **kw: _vision_response(True))
        self.assertIsNone(result["weight_kg"])

    def test_http_failure_is_failed(self):
        def boom(**kw):
            raise TimeoutError("timeout")

        with mock.patch.dict(os.environ, {"GUTS_API_KEY": "k"}):
            result = read_weight_from_photo("data:image/jpeg;base64,AA", http_post=boom)
        self.assertIsNone(result["weight_kg"])
        self.assertEqual(result["confidence"], "failed")

    def test_missing_api_key_does_not_call_provider(self):
        with mock.patch.dict(os.environ, {"GUTS_API_KEY": ""}):
            result = read_weight_from_photo(
                "data:image/jpeg;base64,AA",
                http_post=lambda **kw: self.fail("OCR must not call provider without a key"))
        self.assertIsNone(result["weight_kg"])
        self.assertEqual(result["confidence"], "failed")
        self.assertIn("GUTS_API_KEY", result["raw_text"])


if __name__ == "__main__":
    unittest.main()
