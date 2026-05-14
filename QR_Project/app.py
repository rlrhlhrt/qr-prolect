import base64
import datetime
import io
import json
import os
import sqlite3

import qrcode
from flask import Flask, jsonify, render_template, request, Response

APP_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(APP_DIR, "users.db")

app = Flask(__name__)


def _connect():
    return sqlite3.connect(DB_PATH)


def ensure_table():
    with _connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY,
                item_name TEXT,
                full_name TEXT,
                address TEXT,
                phone TEXT,
                created_at TIMESTAMP
            )
            """
        )


def add_record(item_name, full_name, address, phone):
    created_at = datetime.datetime.now().isoformat(sep=" ", timespec="seconds")
    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO users (item_name, full_name, address, phone, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (item_name, full_name, address, phone, created_at),
        )


def get_all_records():
    with _connect() as conn:
        conn.row_factory = sqlite3.Row
        cur = conn.execute(
            """
            SELECT id, item_name, full_name, address, phone, created_at
            FROM users
            ORDER BY id DESC
            """
        )
        return [dict(row) for row in cur.fetchall()]


def delete_record(record_id):
    with _connect() as conn:
        conn.execute("DELETE FROM users WHERE id = ?", (record_id,))


def build_secure_qr_payload(item_name, phone):
    return (
        "ВНИМАНИЕ! Найден предмет: {item_name}. "
        "Пожалуйста, свяжитесь по телефону: {phone} для возврата."
    ).format(item_name=item_name, phone=phone)


def generate_qr_png_base64(item_name, phone):
    payload = build_secure_qr_payload(item_name, phone)
    img = qrcode.make(payload)
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)
    return base64.b64encode(buffer.read()).decode("ascii")


ensure_table()


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/add", methods=["POST"])
def api_add():
    data = request.get_json(silent=True) or {}
    item_name = (data.get("item_name") or "").strip()
    full_name = (data.get("full_name") or "").strip()
    address = (data.get("address") or "").strip()
    phone = (data.get("phone") or "").strip()

    if not item_name or not phone:
        return (
            jsonify(
                {
                    "success": False,
                    "error": "Item name and phone are required.",
                }
            ),
            400,
        )

    try:
        qr_base64 = generate_qr_png_base64(item_name, phone)
    except Exception as exc:
        return (
            jsonify(
                {
                    "success": False,
                    "error": f"QR generation failed: {exc}",
                }
            ),
            500,
        )

    add_record(item_name, full_name, address, phone)

    return jsonify(
        {
            "success": True,
            "qr_base64": qr_base64,
            "item_name": item_name,
        }
    )


@app.route("/api/history", methods=["GET"])
def api_history():
    records = get_all_records()
    return jsonify({"success": True, "records": records})


@app.route("/api/delete/<int:record_id>", methods=["DELETE"])
def api_delete(record_id):
    delete_record(record_id)
    return jsonify({"success": True})


@app.route("/api/export", methods=["GET"])
def api_export():
    records = get_all_records()
    payload = json.dumps(records, ensure_ascii=False, indent=2)
    return Response(
        payload,
        mimetype="application/json; charset=utf-8",
        headers={
            "Content-Disposition": 'attachment; filename="qr_history_export.json"',
        },
    )


if __name__ == "__main__":
    app.run(host='0.0.0.0', port=5005, debug=True)
