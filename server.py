"""MaxNotify — Flask backend for push-notification companion app."""

import io
import uuid
from dataclasses import dataclass, field
from typing import Optional

import qrcode
from flask import Flask, jsonify, request, send_file

app = Flask(__name__)

# ---------------------------------------------------------------------------
# In-memory storage
# ---------------------------------------------------------------------------

@dataclass
class Session:
    token: str
    status: str = "pending"  # "pending" | "active"

_sessions: dict[str, Session] = {}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _new_user_id() -> str:
    return uuid.uuid4().hex  # 32-char, no dashes — cleaner for URLs


def _qr_png(user_id: str) -> io.BytesIO:
    """Return a PNG QR code encoding the pairing deep-link."""
    pairing_url = f"maxnotify://pair?user_id={user_id}"
    img = qrcode.make(pairing_url, error_correction=qrcode.constants.ERROR_CORRECT_M)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.route("/api/register", methods=["POST"])
def register():
    """Accept an Expo push token, create a session, return user_id."""
    body = request.get_json(silent=True) or {}
    token: Optional[str] = body.get("token")

    if not token:
        return jsonify({"error": "missing token"}), 400

    user_id = _new_user_id()
    _sessions[user_id] = Session(token=token, status="pending")
    return jsonify({"user_id": user_id})


@app.route("/api/status/<userId>", methods=["GET"])
def status(userId: str):
    """Return pairing status for the given user."""
    session = _sessions.get(userId)
    if session is None:
        return jsonify({"status": "pending"}), 404
    return jsonify({"status": session.status})


@app.route("/api/qr/<userId>", methods=["GET"])
def qr(userId: str):
    """Return a PNG QR code encoding maxnotify://pair?user_id=<userId>."""
    if userId not in _sessions:
        return jsonify({"error": "unknown user"}), 404

    buf = _qr_png(userId)
    return send_file(
        buf,
        mimetype="image/png",
        as_attachment=False,
        download_name=f"qr-{userId}.png",
    )


@app.route("/api/test-auth/<userId>", methods=["POST"])
def test_auth(userId: str):
    """Force the session into 'active' (5-tap easter-egg on QR)."""
    session = _sessions.get(userId)
    if session is None:
        return jsonify({"error": "unknown user"}), 404

    session.status = "active"
    return jsonify({"status": "active"})


@app.route("/api/disconnect/<userId>", methods=["POST"])
def disconnect(userId: str):
    """Remove the session."""
    if userId in _sessions:
        del _sessions[userId]
    return jsonify({"status": "disconnected"})


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
