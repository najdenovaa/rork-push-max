from flask import Flask, jsonify
app = Flask(__name__)

@app.route('/api/register', methods=['POST'])
def register():
    return jsonify({"status": "ok"})

@app.route('/api/status/<userId>', methods=['GET'])
def status(userId):
    return jsonify({"status": "active"})

@app.route('/api/qr/<userId>', methods=['GET'])
def qr(userId):
    return jsonify({"qr": "data"})

@app.route('/api/test-auth/<userId>', methods=['GET'])
def test_auth(userId):
    return jsonify({"auth": "ok"})

@app.route('/api/disconnect/<userId>', methods=['POST'])
def disconnect(userId):
    return jsonify({"status": "disconnected"})

if __name__ == '__main__':
    app.run()
