"""MKS Push — Flask backend: GREEN-API multi-tenant push notifications."""

import base64
import io
import os
import sqlite3
import uuid

import requests
from flask import Flask, Response, jsonify, request, send_file

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

app = Flask(__name__)

DB_PATH = os.environ.get("DB_PATH", "mkspush.db")
GREEN_WEBHOOK_TOKEN = os.environ.get("GREEN_WEBHOOK_TOKEN", "changeme")

# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------


def _db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def _init_db() -> None:
    with _db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS green_instances (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                instance_id TEXT NOT NULL UNIQUE,
                api_token TEXT NOT NULL,
                api_url TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'free'
                    CHECK(status IN ('free','assigned')),
                assigned_user_id TEXT
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                user_id TEXT PRIMARY KEY,
                push_token TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending'
                    CHECK(status IN ('pending','active')),
                green_instance_id TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (green_instance_id)
                    REFERENCES green_instances(instance_id)
            )
        """)
        conn.commit()


_init_db()


# ---------------------------------------------------------------------------
# GREEN-API helpers
# ---------------------------------------------------------------------------


def _green_qr(api_url: str, instance_id: str, api_token: str) -> bytes | None:
    """Fetch a fresh QR code from GREEN-API. Returns raw PNG bytes or None.

    GREEN-API returns JSON: {"type":"qrCode","message":"<base64 PNG>"}
    We parse the JSON, decode the base64 message, and return raw PNG bytes.
    """
    url = f"{api_url.rstrip('/')}/waInstance{instance_id}/qr/{api_token}"
    try:
        r = requests.get(url, timeout=15)
        if r.status_code != 200:
            return None

        # Check content-type first: GREEN-API may return raw PNG or JSON
        ct: str = r.headers.get("content-type", "")
        if ct.startswith("image/"):
            return r.content

        # Standard path: JSON with base64-encoded PNG in the "message" field
        data = r.json()
        if isinstance(data, dict) and data.get("type") == "qrCode":
            b64: str = data.get("message", "")
            if b64:
                return base64.b64decode(b64)
    except requests.RequestException:
        pass
    return None


def _green_logout(api_url: str, instance_id: str, api_token: str) -> bool:
    """Logout a GREEN-API instance (release for next user)."""
    url = f"{api_url.rstrip('/')}/waInstance{instance_id}/logout/{api_token}"
    try:
        r = requests.get(url, timeout=10)
        return r.status_code == 200
    except requests.RequestException:
        return False


def _send_expo_push(token: str, title: str, body: str, data: dict | None = None) -> None:
    """Send a push notification via Expo Push API."""
    payload: dict = {
        "to": token,
        "title": title,
        "body": body,
    }
    if data:
        payload["data"] = data
    try:
        requests.post(
            "https://exp.host/--/api/v2/push/send",
            json=payload,
            timeout=10,
        )
    except requests.RequestException:
        pass  # best-effort delivery


# ---------------------------------------------------------------------------
# Routes — Registration & device management
# ---------------------------------------------------------------------------


@app.route("/api/register", methods=["POST"])
def register():
    """Register a device, assign a free GREEN-API instance.

    Request:  { token: string }          – Expo push token
    Success:  200 { user_id: string }
    No slots: 503 { error: "no_slots", message: string }
    """
    body = request.get_json(silent=True) or {}
    token: str | None = body.get("token")

    if not token or not isinstance(token, str) or len(token.strip()) == 0:
        return jsonify({"error": "missing token"}), 400

    with _db() as conn:
        # Grab one free instance
        row = conn.execute(
            "SELECT instance_id, api_token, api_url FROM green_instances "
            "WHERE status = 'free' LIMIT 1"
        ).fetchone()

        if row is None:
            return jsonify({
                "error": "no_slots",
                "message": "Сейчас все места заняты. Попробуйте позже.",
            }), 503

        user_id = uuid.uuid4().hex

        # Assign the instance
        conn.execute(
            "UPDATE green_instances SET status = 'assigned', assigned_user_id = ? "
            "WHERE instance_id = ?",
            (user_id, row["instance_id"]),
        )

        # Create user
        conn.execute(
            "INSERT INTO users (user_id, push_token, status, green_instance_id) "
            "VALUES (?, ?, 'pending', ?)",
            (user_id, token.strip(), row["instance_id"]),
        )

        conn.commit()

    return jsonify({"user_id": user_id})


@app.route("/api/token/<userId>", methods=["POST"])
def update_token(userId: str):
    """Update the Expo push token for an existing user.

    Used by the app to deliver the real token in standalone (TestFlight)
    builds where it may not have been ready at registration time.
    Request: { token: string }
    """
    body = request.get_json(silent=True) or {}
    token: str | None = body.get("token")

    if not token or not isinstance(token, str) or len(token.strip()) == 0:
        return jsonify({"error": "missing token"}), 400

    # Ignore placeholder tokens that aren't yet real device tokens.
    if "pending" in token:
        return jsonify({"status": "ignored"}), 200

    with _db() as conn:
        row = conn.execute(
            "SELECT user_id FROM users WHERE user_id = ?", (userId,)
        ).fetchone()
        if row is None:
            return jsonify({"error": "not_found"}), 404
        conn.execute(
            "UPDATE users SET push_token = ? WHERE user_id = ?",
            (token.strip(), userId),
        )
        conn.commit()

    return jsonify({"status": "updated"})


@app.route("/api/status/<userId>", methods=["GET"])
def status(userId: str):
    """Return pairing status for the given user."""
    with _db() as conn:
        row = conn.execute(
            "SELECT status FROM users WHERE user_id = ?", (userId,)
        ).fetchone()
        if row is None:
            return jsonify({"status": "pending"}), 404
        return jsonify({"status": row["status"]})


@app.route("/api/max-qr/<userId>", methods=["GET"])
def max_qr(userId: str):
    """Proxy a QR code from GREEN-API for the user's assigned instance.

    The GREEN-API token is never exposed to the client.
    ?v=  query param is accepted for cache busting (ignored server-side).
    """
    with _db() as conn:
        user = conn.execute(
            "SELECT green_instance_id FROM users WHERE user_id = ?", (userId,)
        ).fetchone()
        if user is None:
            return jsonify({"error": "unknown user"}), 404

        inst = conn.execute(
            "SELECT instance_id, api_token, api_url FROM green_instances "
            "WHERE instance_id = ?",
            (user["green_instance_id"],),
        ).fetchone()
        if inst is None:
            return jsonify({"error": "no instance assigned"}), 500

    png = _green_qr(inst["api_url"], inst["instance_id"], inst["api_token"])
    if png is None:
        return jsonify({"error": "failed to fetch QR from GREEN-API"}), 502

    return send_file(
        io.BytesIO(png),
        mimetype="image/png",
        as_attachment=False,
        download_name=f"qr-{userId}.png",
    )


@app.route("/api/disconnect/<userId>", methods=["POST"])
def disconnect(userId: str):
    """Disconnect user: logout GREEN-API instance, free the slot, delete user."""
    with _db() as conn:
        user = conn.execute(
            "SELECT green_instance_id FROM users WHERE user_id = ?", (userId,)
        ).fetchone()
        if user is None:
            return jsonify({"error": "unknown user"}), 404

        inst = conn.execute(
            "SELECT instance_id, api_token, api_url FROM green_instances "
            "WHERE instance_id = ?",
            (user["green_instance_id"],),
        ).fetchone()

        if inst is not None:
            # Best-effort logout — don't block on failure
            _green_logout(inst["api_url"], inst["instance_id"], inst["api_token"])

            conn.execute(
                "UPDATE green_instances SET status = 'free', assigned_user_id = NULL "
                "WHERE instance_id = ?",
                (inst["instance_id"],),
            )

        conn.execute("DELETE FROM users WHERE user_id = ?", (userId,))
        conn.commit()

    return jsonify({"status": "disconnected"})


# ---------------------------------------------------------------------------
# GREEN-API webhook
# ---------------------------------------------------------------------------


@app.route("/api/green/webhook", methods=["POST"])
def green_webhook():
    """Handle GREEN-API webhooks.

    Expected query param: ?token=GREEN_WEBHOOK_TOKEN
    Webhook types handled:
      - stateInstanceChanged: mark user active when Max authorized
      - incomingMessageReceived: forward as push notification
    """
    # Verify token
    if request.args.get("token") != GREEN_WEBHOOK_TOKEN:
        return jsonify({"error": "unauthorized"}), 401

    body = request.get_json(silent=True) or {}
    webhook_type: str = body.get("typeWebhook", "")
    instance_data: dict = body.get("instanceData", {})
    instance_id: str | None = instance_data.get("idInstance")

    if not instance_id:
        return Response("OK"), 200

    # Normalize: GREEN-API sometimes sends int, sometimes str
    instance_id = str(instance_id)

    with _db() as conn:
        inst = conn.execute(
            "SELECT assigned_user_id FROM green_instances WHERE instance_id = ?",
            (instance_id,),
        ).fetchone()

        if inst is None:
            return Response("OK"), 200

        assigned_user_id: str | None = inst["assigned_user_id"]

        # --- stateInstanceChanged ---
        if webhook_type == "stateInstanceChanged":
            state: str = instance_data.get("stateInstance", "")
            if state == "authorized" and assigned_user_id:
                conn.execute(
                    "UPDATE users SET status = 'active' WHERE user_id = ?",
                    (assigned_user_id,),
                )
                conn.commit()

        # --- incomingMessageReceived ---
        elif webhook_type == "incomingMessageReceived" and assigned_user_id:
            user = conn.execute(
                "SELECT push_token FROM users WHERE user_id = ?",
                (assigned_user_id,),
            ).fetchone()

            if user:
                sender_data: dict = body.get("senderData", {})
                sender_name: str = sender_data.get("senderName", "Контакт")
                sender: str = sender_data.get("sender", "")

                message_data: dict = body.get("messageData", {})
                text_data: dict = message_data.get("textMessageData", {})
                text: str = text_data.get("textMessage", "")

                if text:
                    _send_expo_push(
                        user["push_token"],
                        title=sender_name,
                        body=text,
                        data={
                            "sender": sender,
                            "senderName": sender_name,
                            "instance_id": instance_id,
                        },
                    )

    return Response("OK"), 200


# ---------------------------------------------------------------------------
# Manual push send (for /panel testing)
# ---------------------------------------------------------------------------


@app.route("/api/send/<userId>", methods=["POST"])
def send_push(userId: str):
    """Send a push notification to a user via Expo Push API (manual test)."""
    with _db() as conn:
        user = conn.execute(
            "SELECT push_token FROM users WHERE user_id = ?", (userId,)
        ).fetchone()
        if user is None:
            return jsonify({"error": "unknown user"}), 404

    body = request.get_json(silent=True) or {}
    title = body.get("title")
    message = body.get("body")

    if not title or not message:
        return jsonify({"error": "missing title or body"}), 400

    payload = {
        "to": user["push_token"],
        "title": title,
        "body": message,
        "data": body.get("data", {}),
    }

    try:
        r = requests.post(
            "https://exp.host/--/api/v2/push/send",
            json=payload,
            timeout=10,
        )
        return jsonify(r.json()), r.status_code
    except requests.RequestException as e:
        return jsonify({"error": str(e)}), 502


# ---------------------------------------------------------------------------
# HTML pages — public & test panel
# ---------------------------------------------------------------------------

_PAGE_CSS = """
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif;
    background: #DCFCE7;
    color: #0A1F12;
    display: flex; justify-content: center; align-items: center;
    min-height: 100vh; padding: 16px;
  }
  .card {
    background: #fff;
    border-radius: 20px;
    padding: 32px 24px;
    width: 100%; max-width: 400px;
    box-shadow: 0 4px 24px rgba(22,163,74,.12);
  }
  .card-wide { max-width: 540px; margin: 24px 0; }
  h1 { font-size: 24px; font-weight: 700; color: #16A34A; margin-bottom: 4px; }
  h2 { font-size: 18px; font-weight: 600; color: #0A1F12; margin: 20px 0 8px; }
  .sub { font-size: 15px; color: #5A7D65; margin-bottom: 24px; }
  label { display: block; font-size: 14px; font-weight: 600; margin-bottom: 6px; color: #0A1F12; }
  input, textarea {
    width: 100%;
    font-size: 17px;
    padding: 12px 14px;
    border: 1px solid #D1E8D6;
    border-radius: 12px;
    margin-bottom: 16px;
    font-family: inherit;
    -webkit-appearance: none;
  }
  input:focus, textarea:focus { outline: none; border-color: #16A34A; box-shadow: 0 0 0 3px rgba(22,163,74,.15); }
  textarea { resize: vertical; min-height: 80px; }
  button {
    width: 100%;
    font-size: 18px; font-weight: 600;
    padding: 14px 0;
    background: #16A34A;
    color: #fff;
    border: none;
    border-radius: 14px;
    cursor: pointer;
    transition: background .15s;
  }
  button:active { background: #0B5D2A; }
  #result {
    margin-top: 16px;
    padding: 12px;
    border-radius: 12px;
    font-size: 14px;
    display: none;
  }
  #result.success { display: block; background: #DCFCE7; color: #0B5D2A; }
  #result.error   { display: block; background: #FEF2F2; color: #991B1B; }
  p, li { font-size: 15px; color: #5A7D65; line-height: 1.6; }
  ul { padding-left: 20px; margin: 8px 0 16px; }
  a { color: #16A34A; }
  .links { margin-top: 24px; display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; }
  .links a {
    font-size: 15px; font-weight: 500;
    color: #16A34A; text-decoration: none;
    padding: 8px 16px; border-radius: 10px;
    background: #DCFCE7;
    transition: background .15s;
  }
  .links a:active, .back:active { background: #D1E8D6; }
  .back { display: inline-block; margin-top: 24px; font-size: 15px; font-weight: 500; color: #16A34A; text-decoration: none; padding: 8px 16px; border-radius: 10px; background: #DCFCE7; }
  .center-text { text-align: center; }
"""

_PANEL_HTML = f"""<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>MKS Push · Панель</title>
<style>{_PAGE_CSS}</style>
</head>
<body>
<div class="card">
  <h1>MKS Push</h1>
  <p class="sub">Тестовая отправка push-уведомления</p>

  <label for="uid">User ID</label>
  <input id="uid" type="text" placeholder="abc123…" autocomplete="off">

  <label for="t">Заголовок</label>
  <input id="t" type="text" placeholder="Привет!" autocomplete="off">

  <label for="b">Текст</label>
  <textarea id="b" placeholder="Ваше уведомление…"></textarea>

  <button onclick="send()">Отправить</button>
  <div id="result"></div>
</div>

<script>
async function send() {{
  const uid = document.getElementById("uid").value.trim();
  const title = document.getElementById("t").value.trim();
  const body = document.getElementById("b").value.trim();
  const res = document.getElementById("result");

  if (!uid) {{ show("Введите User ID", false); return; }}
  if (!title || !body) {{ show("Заполните заголовок и текст", false); return; }}

  try {{
    const r = await fetch(`/api/send/${{uid}}`, {{
      method: "POST",
      headers: {{ "Content-Type": "application/json" }},
      body: JSON.stringify({{ title, body }}),
    }});
    const data = await r.json();
    if (r.ok && data.data?.status === "ok") {{
      show("Пуш отправлен ✓", true);
    }} else if (r.ok) {{
      show("Ответ Expo: " + JSON.stringify(data), true);
    }} else {{
      show(data.error || "Ошибка", false);
    }}
  }} catch (e) {{
    show("Сеть: " + e.message, false);
  }}
}}

function show(msg, ok) {{
  const el = document.getElementById("result");
  el.textContent = msg;
  el.className = ok ? "success" : "error";
  el.style.display = "block";
}}
</script>
</body>
</html>"""

_INDEX_HTML = f"""<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>MKS Push</title>
<style>{_PAGE_CSS}</style>
</head>
<body>
<div class="card center-text">
  <h1>MKS Push</h1>
  <p>Push-уведомления на ваш iPhone</p>
  <div class="links">
    <a href="/panel">Панель тестирования</a>
    <a href="/privacy">Приватность</a>
  </div>
</div>
</body>
</html>"""

_PRIVACY_HTML = f"""<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>MKS Push · Приватность</title>
<style>{_PAGE_CSS}</style>
</head>
<body>
<div class="card card-wide">
  <h1>Политика конфиденциальности</h1>

  <h2>Какие данные мы собираем</h2>
  <p>Приложение собирает:</p>
  <ul>
    <li>Push-токен устройства (Expo Push Token) — для доставки уведомлений</li>
    <li>Уникальный идентификатор пользователя (user_id) — для привязки устройства</li>
  </ul>

  <h2>Как мы используем данные</h2>
  <p>Данные отправляются на сервер <code>https://mkspush.ru</code> и используются исключительно для отправки push-уведомлений на ваше устройство.</p>

  <h2>Что мы НЕ делаем</h2>
  <ul>
    <li>Не читаем содержимое ваших сообщений</li>
    <li>Не передаём данные третьим лицам</li>
    <li>Не используем данные для рекламы или трекинга</li>
  </ul>

  <h2>Удаление данных</h2>
  <p>При отключении устройства данные удаляются с сервера. Вы можете запросить удаление, написав на <a href="mailto:support@mkspush.ru">support@mkspush.ru</a>.</p>

  <a class="back" href="/">← Назад</a>
</div>
</body>
</html>"""


@app.route("/")
def index():
    """Landing page."""
    return _INDEX_HTML


@app.route("/panel")
def panel():
    """Test panel for manual push sending."""
    return _PANEL_HTML


@app.route("/privacy")
def privacy():
    """Privacy policy page (Russian)."""
    return _PRIVACY_HTML


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
