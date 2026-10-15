import os
import sys
import time
import subprocess
from threading import Thread

# Add project root to sys.path
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
    {"key": "Database_Backup.zip", "size": 8940.80, "last_modified": "2026-10-12 14:20:00"},
    {"key": "ML_Lecture_Notes.pdf", "size": 3120.40, "last_modified": "2026-10-11 11:10:00"},
    {"key": "Code_Examples.py", "size": 48.60, "last_modified": "2026-10-10 17:05:00"},
]

def mock_list_files(query=""):
    if not query:
        return POPULATED_FILES
    return [f for f in POPULATED_FILES if query.lower() in f["key"].lower()]

s3.list_files = mock_list_files

def start_server(port=5055):
    from werkzeug.serving import make_server
    server = make_server("127.0.0.1", port, app)
    t = Thread(target=server.serve_forever, daemon=True)
    t.start()
    time.sleep(1)
    return server

if __name__ == "__main__":
    print("Starting background Flask server on port 5055...")
    server = start_server(5055)
    print("Flask server ready.")

    script_path = os.path.join(os.path.dirname(__file__), "run_proof_and_audit.js")
    print(f"Executing Playwright proof script: node {script_path}")
    res = subprocess.run(["node", script_path])
    sys.exit(res.returncode)
