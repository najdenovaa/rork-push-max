"""MKS Push — Flask backend for push-notification companion app."""

import io
import uuid
from dataclasses import dataclass, field
from typing import Optional

import qrcode
import requests
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
    pairing_url = f"mkspush://pair?user_id={user_id}"
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
    """Return a PNG QR code encoding mkspush://pair?user_id=<userId>."""
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


@app.route("/api/send/<userId>", methods=["POST"])
def send_push(userId: str):
    """Send a push notification to the user via Expo Push API."""
    session = _sessions.get(userId)
    if session is None:
        return jsonify({"error": "unknown user"}), 404

    body = request.get_json(silent=True) or {}
    title = body.get("title")
    message = body.get("body")

    if not title or not message:
        return jsonify({"error": "missing title or body"}), 400

    payload = {
        "to": session.token,
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


@app.route("/api/disconnect/<userId>", methods=["POST"])
def disconnect(userId: str):
    """Remove the session."""
    if userId in _sessions:
        del _sessions[userId]
    return jsonify({"status": "disconnected"})


# ---------------------------------------------------------------------------
# Test panel (HTML)
# ---------------------------------------------------------------------------

_PANEL_HTML = """
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>MKS Push · Панель</title>
<style>
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
  h1 { font-size: 24px; font-weight: 700; margin-bottom: 4px; color: #16A34A; }
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
</style>
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
async function send() {
  const uid = document.getElementById("uid").value.trim();
  const title = document.getElementById("t").value.trim();
  const body = document.getElementById("b").value.trim();
  const res = document.getElementById("result");

  if (!uid) { show("Введите User ID", false); return; }
  if (!title || !body) { show("Заполните заголовок и текст", false); return; }

  try {
    const r = await fetch(`/api/send/${uid}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, body }),
    });
    const data = await r.json();
    if (r.ok && data.data?.status === "ok") {
      show("Пуш отправлен ✓", true);
    } else if (r.ok) {
      show("Ответ Expo: " + JSON.stringify(data), true);
    } else {
      show(data.error || "Ошибка", false);
    }
  } catch (e) {
    show("Сеть: " + e.message, false);
  }
}

function show(msg, ok) {
  const el = document.getElementById("result");
  el.textContent = msg;
  el.className = ok ? "success" : "error";
  el.style.display = "block";
}
</script>
</body>
</html>
"""


@app.route("/panel")
def panel():
    """Simple HTML form to test push sending from a phone browser."""
    return _PANEL_HTML


# ---------------------------------------------------------------------------
# Public pages
# ---------------------------------------------------------------------------

_INDEX_HTML = """
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>MKS Push</title>
<style>
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
    padding: 40px 28px;
    width: 100%; max-width: 400px;
    box-shadow: 0 4px 24px rgba(22,163,74,.12);
    text-align: center;
  }
  h1 { font-size: 28px; font-weight: 700; color: #16A34A; margin-bottom: 8px; }
  p { font-size: 16px; color: #5A7D65; line-height: 1.5; }
  .links { margin-top: 24px; display: flex; gap: 16px; justify-content: center; flex-wrap: wrap; }
  .links a {
    font-size: 15px; font-weight: 500;
    color: #16A34A; text-decoration: none;
    padding: 8px 16px; border-radius: 10px;
    background: #DCFCE7;
    transition: background .15s;
  }
  .links a:active { background: #D1E8D6; }
</style>
</head>
<body>
<div class="card">
  <h1>MKS Push</h1>
  <p>Push-уведомления на ваш iPhone</p>
  <div class="links">
    <a href="/panel">Панель тестирования</a>
    <a href="/privacy">Приватность</a>
  </div>
</div>
</body>
</html>
"""

_PRIVACY_HTML = """
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>MKS Push · Приватность</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif;
    background: #DCFCE7;
    color: #0A1F12;
    display: flex; justify-content: center;
    min-height: 100vh; padding: 16px;
  }
  .card {
    background: #fff;
    border-radius: 20px;
    padding: 40px 28px;
    width: 100%; max-width: 540px;
    box-shadow: 0 4px 24px rgba(22,163,74,.12);
    margin: 24px 0;
  }
  h1 { font-size: 24px; font-weight: 700; color: #16A34A; margin-bottom: 20px; }
  h2 { font-size: 18px; font-weight: 600; color: #0A1F12; margin: 20px 0 8px; }
  p, li { font-size: 15px; color: #5A7D65; line-height: 1.6; }
  ul { padding-left: 20px; margin: 8px 0 16px; }
  a { color: #16A34A; }
  .back { display: inline-block; margin-top: 24px; font-size: 15px; font-weight: 500; color: #16A34A; text-decoration: none; padding: 8px 16px; border-radius: 10px; background: #DCFCE7; }
  .back:active { background: #D1E8D6; }
</style>
</head>
<body>
<div class="card">
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
</html>
"""


@app.route("/")
def index():
    """Landing page."""
    return _INDEX_HTML


@app.route("/privacy")
def privacy():
    """Privacy policy page."""
    return _PRIVACY_HTML


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
