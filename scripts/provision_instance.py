#!/usr/bin/env python3
"""Provision a GREEN-API instance for MKS Push.

Usage:
    python scripts/provision_instance.py <instanceId> <apiToken> <apiUrl>

What it does:
    1. Sets the GREEN-API webhook to https://mkspush.ru/api/green/webhook
    2. Inserts the instance into mkspush.db with status=free
"""

import os
import sqlite3
import sys

import requests


def main() -> None:
    if len(sys.argv) < 4:
        print("Usage: python scripts/provision_instance.py <instanceId> <apiToken> <apiUrl>")
        print("Example: python scripts/provision_instance.py 1101000001 abc123token https://api.green-api.com")
        sys.exit(1)

    instance_id: str = sys.argv[1]
    api_token: str = sys.argv[2]
    api_url: str = sys.argv[3].rstrip("/")

    # ------------------------------------------------------------------
    # 1. Set webhook on GREEN-API
    # ------------------------------------------------------------------
    webhook_token: str = os.environ.get("GREEN_WEBHOOK_TOKEN", "changeme")
    webhook_url: str = f"https://mkspush.ru/api/green/webhook?token={webhook_token}"

    set_settings_url: str = f"{api_url}/waInstance{instance_id}/setSettings/{api_token}"

    print(f"[1/3] Setting webhook to: {webhook_url}")
    try:
        r = requests.post(
            set_settings_url,
            json={
                "webhookUrl": webhook_url,
                "webhookUrlToken": "",  # Not used; we verify via URL param
            },
            timeout=10,
        )
        print(f"      Response: {r.status_code} {r.text.strip()}")
        if r.status_code != 200:
            print("      WARNING: webhook setup may have failed. Check instance credentials.")
    except requests.RequestException as e:
        print(f"      FAILED to set webhook: {e}")
        sys.exit(1)

    # ------------------------------------------------------------------
    # 2. Insert into local database
    # ------------------------------------------------------------------
    db_path: str = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "mkspush.db"
    )

    print(f"[2/3] Inserting instance {instance_id} into {db_path}")

    with sqlite3.connect(db_path) as conn:
        conn.execute(
            """
            INSERT OR IGNORE INTO green_instances
                (instance_id, api_token, api_url, status)
            VALUES (?, ?, ?, 'free')
            """,
            (instance_id, api_token, api_url),
        )
        conn.commit()

        count = conn.execute(
            "SELECT COUNT(*) FROM green_instances WHERE instance_id = ?",
            (instance_id,),
        ).fetchone()
        if count and count[0] == 0:
            print("      WARNING: instance already exists and was not overwritten.")
        else:
            print("      OK.")

    # ------------------------------------------------------------------
    # 3. Summary
    # ------------------------------------------------------------------
    print(f"[3/3] Instance {instance_id} provisioned successfully.")
    print(f"      Webhook: {webhook_url}")
    print(f"      Status:  free (waiting for first user)")


if __name__ == "__main__":
    main()
