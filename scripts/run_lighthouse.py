import os
import sys
import time
import json
import subprocess
from threading import Thread

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

os.environ["AWS_ACCESS_KEY_ID"] = "test-access-key"
os.environ["AWS_SECRET_ACCESS_KEY"] = "test-secret-key"
os.environ["AWS_BUCKET_NAME"] = "test-notes-bucket"
os.environ["AWS_REGION"] = "us-east-1"
os.environ["FLASK_SECRET_KEY"] = "test-secret"

from src.app import app, s3

POPULATED_FILES = [
    {"key": "CS601_Distributed_Systems.pdf", "size": 2450.50, "last_modified": "2026-10-15 10:30:00"},
    {"key": "Algorithms_CheatSheet.docx", "size": 512.20, "last_modified": "2026-10-14 16:15:20"},
    {"key": "System_Architecture.png", "size": 1820.00, "last_modified": "2026-10-13 09:45:10"},
]
s3.list_files = lambda query="": POPULATED_FILES

def start_server(port=5055):
    from werkzeug.serving import make_server
    server = make_server("127.0.0.1", port, app)
    t = Thread(target=server.serve_forever, daemon=True)
    t.start()
    time.sleep(1)
    return server

if __name__ == "__main__":
    start_server(5055)
    report_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "docs", "lighthouse-report.json"))
    os.makedirs(os.path.dirname(report_path), exist_ok=True)

    cmd = [
        "npx", "lighthouse", "http://127.0.0.1:5055/",
        "--only-categories=accessibility",
        "--output=json",
        f"--output-path={report_path}",
        "--chrome-flags=--headless=new --no-sandbox"
    ]
    print("Running Lighthouse accessibility audit...")
    res = subprocess.run(cmd, capture_output=True, text=True)
    print("Return code:", res.returncode)
    if os.path.exists(report_path):
        with open(report_path, "r") as f:
            data = json.load(f)
            score = data.get("categories", {}).get("accessibility", {}).get("score", 0) * 100
            print(f"Lighthouse Accessibility Score: {score}")
            audits = data.get("audits", {})
            for audit_id, audit in audits.items():
                if audit.get("score") is not None and audit.get("score") < 1 and audit.get("details"):
                    print(f"Audit issue: {audit_id}: {audit.get('title')} ({audit.get('description')})")
