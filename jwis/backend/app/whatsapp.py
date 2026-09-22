from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Any
from urllib.error import HTTPError
from urllib.request import Request, urlopen


def build_alert_message(truck_code: str, issue: str, recommendation: str) -> str:
    return (
        "JWIS ALERT\n"
        f"Truck: {truck_code}\n"
        f"Issue: {issue}\n"
        f"Recommended action: {recommendation}\n"
        "Please confirm field response in the JWIS Field App."
    )


@dataclass
class OpenWAClient:
    base_url: str = ""
    api_key: str = ""
    session_id: str = ""
    timeout_seconds: float = 8.0

    @classmethod
    def from_env(cls) -> "OpenWAClient":
        return cls(
            base_url=os.getenv("OPENWA_BASE_URL", "http://127.0.0.1:2785/api").rstrip("/"),
            api_key=os.getenv("OPENWA_API_KEY", ""),
            session_id=os.getenv("OPENWA_SESSION_ID", "default"),
            timeout_seconds=float(os.getenv("OPENWA_TIMEOUT_SECONDS", "3")),
        )

    def is_configured(self) -> bool:
        return bool(self.base_url and self.session_id)

    def health(self) -> dict[str, Any]:
        if not self.is_configured():
            return {
                "provider": "openwa",
                "configured": False,
                "connected": False,
                "message": "WhatsApp gateway is not configured.",
            }
        try:
            with urlopen(f"{self.base_url}/health", timeout=self.timeout_seconds) as response:
                body = response.read().decode("utf-8")
            payload = json.loads(body) if body else {}
            return {
                "provider": payload.get("provider", "baileys"),
                "configured": True,
                "connected": bool(payload.get("connected")),
                "message": payload.get("message", "WhatsApp gateway is reachable."),
                "state": payload.get("state"),
            }
        except Exception as error:
            return {
                "provider": "baileys",
                "configured": True,
                "connected": False,
                "message": f"WhatsApp gateway is offline: {error}",
            }

    def qr(self) -> dict[str, Any]:
        """Fetch the pairing QR as a PNG data URL from the gateway."""
        if not self.is_configured():
            return {
                "provider": "baileys",
                "configured": False,
                "state": "unconfigured",
                "qr": None,
                "message": "WhatsApp gateway is not configured.",
            }
        try:
            with urlopen(f"{self.base_url}/qr", timeout=self.timeout_seconds) as response:
                body = response.read().decode("utf-8")
            payload = json.loads(body) if body else {}
            return {
                "provider": "baileys",
                "configured": True,
                "state": payload.get("state", "unknown"),
                "qr": payload.get("qr"),
                "message": payload.get("message"),
            }
        except Exception as error:
            return {
                "provider": "baileys",
                "configured": True,
                "state": "gateway_offline",
                "qr": None,
                "message": f"WhatsApp gateway is offline: {error}",
            }

    def groups(self) -> dict[str, Any]:
        """Fetch participating group chats (JID + subject) from the gateway."""
        if not self.is_configured():
            return {
                "provider": "baileys",
                "configured": False,
                "groups": [],
                "message": "WhatsApp gateway is not configured.",
            }
        try:
            with urlopen(f"{self.base_url}/groups", timeout=self.timeout_seconds) as response:
                body = response.read().decode("utf-8")
            payload = json.loads(body) if body else {}
            return {
                "provider": "baileys",
                "configured": True,
                "connected": bool(payload.get("connected")),
                "groups": payload.get("groups", []),
                "message": payload.get("message", ""),
            }
        except Exception as error:
            return {
                "provider": "baileys",
                "configured": True,
                "connected": False,
                "groups": [],
                "message": f"WhatsApp gateway is offline: {error}",
            }

    def logout(self) -> dict[str, Any]:
        """End the current session so the dashboard can pair a fresh QR."""
        if not self.is_configured():
            return {
                "provider": "baileys",
                "configured": False,
                "logged_out": False,
                "message": "WhatsApp gateway is not configured.",
            }
        request = Request(f"{self.base_url}/logout", method="POST")
        try:
            with urlopen(request, timeout=self.timeout_seconds) as response:
                body = response.read().decode("utf-8")
            payload = json.loads(body) if body else {}
            return {
                "provider": "baileys",
                "configured": True,
                "logged_out": bool(payload.get("logged_out")),
                "state": payload.get("state"),
                "message": "WhatsApp session ended. Scan the new QR to re-link.",
            }
        except HTTPError as error:
            return {
                "provider": "baileys",
                "configured": True,
                "logged_out": False,
                "status_code": error.code,
                "message": f"Logout failed: {error}",
            }
        except Exception as error:
            return {
                "provider": "baileys",
                "configured": True,
                "logged_out": False,
                "message": str(error),
            }

    def send_text(self, chat_id: str, text: str) -> dict[str, Any]:
        if not self.is_configured():
            return {
                "provider": "openwa",
                "sent": False,
                "message": "OpenWA is not configured. Set OPENWA_BASE_URL, OPENWA_API_KEY, and OPENWA_SESSION_ID.",
            }
        if not chat_id:
            return {"provider": "openwa", "sent": False, "message": "Missing WhatsApp chat_id."}

        url = f"{self.base_url}/sessions/{self.session_id}/messages/send-text"
        payload = {"chatId": chat_id, "text": text}
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["X-API-Key"] = self.api_key

        request = Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        try:
            with urlopen(request, timeout=self.timeout_seconds) as response:
                body = response.read().decode("utf-8")
            response_payload = json.loads(body) if body else {}
            sent = bool(response_payload.get("sent", 200 <= response.status < 300))
            return {
                "provider": response_payload.get("provider", "baileys"),
                "sent": sent,
                "status_code": response.status,
                "message": response_payload.get("message") or response_payload.get("error") or (
                    "WhatsApp message sent." if sent else "WhatsApp gateway rejected the message."
                ),
                "response": response_payload,
            }
        except HTTPError as error:
            body = error.read().decode("utf-8", errors="replace")
            try:
                payload = json.loads(body) if body else {}
            except json.JSONDecodeError:
                payload = {"error": body}
            return {
                "provider": payload.get("provider", "baileys"),
                "sent": False,
                "status_code": error.code,
                "message": payload.get("message") or payload.get("error") or str(error),
                "response": payload,
            }
        except Exception as error:
            return {
                "provider": "baileys",
                "sent": False,
                "message": str(error),
            }
