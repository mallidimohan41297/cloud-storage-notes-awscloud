import unittest
from unittest.mock import MagicMock, patch
import os

# Set dummy AWS credentials before importing app/config
os.environ["AWS_ACCESS_KEY_ID"] = "test-access-key"
os.environ["AWS_SECRET_ACCESS_KEY"] = "test-secret-key"
os.environ["AWS_BUCKET_NAME"] = "test-bucket"
os.environ["AWS_REGION"] = "us-east-1"
os.environ["FLASK_SECRET_KEY"] = "test-secret"

from src.app import app


class BaselineRouteTests(unittest.TestCase):
    def setUp(self):
        app.config["TESTING"] = True
        self.client = app.test_client()

    def test_route_table_matches_baseline(self):
        """Regression Gate: route table (path, methods, endpoint) matches baseline."""
        expected_routes = {
            ("/", "GET", "index"),
            ("/upload", "POST", "upload"),
            ("/download/<path:filename>", "GET", "download"),
            ("/delete/<path:filename>", "POST", "delete"),
            ("/static/<path:filename>", "GET", "static"),
        }
        actual_routes = set()
        for rule in app.url_map.iter_rules():
            methods = rule.methods - {"HEAD", "OPTIONS"}
            for m in methods:
                actual_routes.add((rule.rule, m, rule.endpoint))

        self.assertEqual(expected_routes, actual_routes)

    @patch("src.app.s3")
    def test_index_route_loads(self, mock_s3):
        mock_s3.list_files.return_value = [
            {"key": "test_note.pdf", "size": 12.34, "last_modified": "2026-10-15 12:00:00"}
        ]
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"Cloud Notes Storage Dashboard", response.data)
        self.assertIn(b"test_note.pdf", response.data)
        mock_s3.list_files.assert_called_with("")

    @patch("src.app.s3")
    def test_search_query_passed(self, mock_s3):
        mock_s3.list_files.return_value = []
        response = self.client.get("/?search=exam")
        self.assertEqual(response.status_code, 200)
        mock_s3.list_files.assert_called_with("exam")

    @patch("src.app.s3")
    def test_upload_success_flow(self, mock_s3):
        mock_s3.upload_file.return_value = True
        import io
        data = {"file": (io.BytesIO(b"Notes content"), "sample_notes.pdf")}
        response = self.client.post("/upload", data=data, content_type="multipart/form-data", follow_redirects=True)
        self.assertEqual(response.status_code, 200)
        mock_s3.upload_file.assert_called()

    @patch("src.app.s3")
    def test_upload_rejects_unallowed_extension(self, mock_s3):
        import io
        data = {"file": (io.BytesIO(b"binary"), "malicious_file.exe")}
        response = self.client.post("/upload", data=data, content_type="multipart/form-data", follow_redirects=True)
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"Unsupported file type", response.data)
        mock_s3.upload_file.assert_not_called()

    @patch("src.app.s3")
    def test_download_presigned_redirect(self, mock_s3):
        mock_s3.get_download_url.return_value = "https://s3.amazonaws.com/test-bucket/doc.pdf?signature=123"
        response = self.client.get("/download/doc.pdf")
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.headers["Location"], "https://s3.amazonaws.com/test-bucket/doc.pdf?signature=123")

    @patch("src.app.s3")
    def test_delete_post_flow(self, mock_s3):
        mock_s3.delete_file.return_value = True
        response = self.client.post("/delete/sample_note.pdf", follow_redirects=True)
        self.assertEqual(response.status_code, 200)
        mock_s3.delete_file.assert_called_with("sample_note.pdf")

    @patch("src.app.s3")
    def test_empty_state_rendering(self, mock_s3):
        mock_s3.list_files.return_value = []
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        html = response.data.decode("utf-8")
        self.assertIn("empty-state-card", html)
        self.assertIn("No academic files stored in your cloud storage yet.", html)
        self.assertIn("Upload Note", html)

    @patch("src.app.s3")
    def test_s3_failure_error_handling(self, mock_s3):
        mock_s3.list_files.side_effect = Exception("S3 bucket connection timeout")
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        html = response.data.decode("utf-8")
        self.assertIn("globalToastContainer", html)
        self.assertIn("AWS S3 connection failed", html)
        self.assertIn("Retry Connection", html)

    def test_toast_container_aria_live(self):
        with self.client as client:
            with client.session_transaction() as sess:
                sess["_flashes"] = [("success", "Operation completed successfully")]
            response = client.get("/")
            self.assertEqual(response.status_code, 200)
            html = response.data.decode("utf-8")
            self.assertIn('id="globalToastContainer"', html)
            self.assertIn('aria-live="polite"', html)
            self.assertIn("toast-success", html)
            self.assertIn("Operation completed successfully", html)


if __name__ == "__main__":
    unittest.main()

