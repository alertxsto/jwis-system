import unittest

from app.whatsapp import OpenWAClient, build_alert_message
from app.main import normalize_phone_number, normalize_group_jid


class WhatsAppTests(unittest.TestCase):
    def test_build_alert_message_contains_priority_context(self):
        message = build_alert_message(
            truck_code="T-047",
            issue="Route deviation 3448m from assigned corridor",
            recommendation="Use Route B - Daan Mogot Recovery",
        )

        self.assertIn("JWIS ALERT", message)
        self.assertIn("T-047", message)
        self.assertIn("Route B", message)

    def test_openwa_client_reports_unconfigured_without_network_call(self):
        client = OpenWAClient(base_url="", api_key="", session_id="")

        result = client.send_text(chat_id="628123456789@c.us", text="test")

        self.assertFalse(result["sent"])
        self.assertEqual(result["provider"], "openwa")
        self.assertIn("not configured", result["message"].lower())

    def test_qr_reports_unconfigured_without_network_call(self):
        client = OpenWAClient(base_url="", api_key="", session_id="")

        result = client.qr()

        self.assertFalse(result["configured"])
        self.assertEqual(result["state"], "unconfigured")
        self.assertIsNone(result["qr"])

    def test_logout_reports_unconfigured_without_network_call(self):
        client = OpenWAClient(base_url="", api_key="", session_id="")

        result = client.logout()

        self.assertFalse(result["configured"])
        self.assertFalse(result["logged_out"])
        self.assertIn("not configured", result["message"].lower())

    def test_normalize_phone_number_local_format(self):
        self.assertEqual(normalize_phone_number("081234567890"), "6281234567890@c.us")

    def test_normalize_phone_number_international_format(self):
        self.assertEqual(normalize_phone_number("6281234567890"), "6281234567890@c.us")
        self.assertEqual(normalize_phone_number("+62812-3456-7890"), "6281234567890@c.us")

    def test_normalize_phone_number_full_jid_unchanged(self):
        self.assertEqual(normalize_phone_number("6281234567890@c.us"), "6281234567890@c.us")

    def test_normalize_group_jid_phone_input(self):
        self.assertEqual(normalize_group_jid("081234567890"), "6281234567890@g.us")

    def test_normalize_group_jid_full_jid_unchanged(self):
        self.assertEqual(normalize_group_jid("6281234567890-1620000000@g.us"), "6281234567890-1620000000@g.us")

    def test_normalize_phone_number_empty(self):
        self.assertEqual(normalize_phone_number(""), "")
        self.assertEqual(normalize_phone_number("   "), "")


if __name__ == "__main__":
    unittest.main()
