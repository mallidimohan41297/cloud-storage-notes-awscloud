import unittest
from unittest.mock import MagicMock, patch
import io
import datetime
import os
from botocore.exceptions import ClientError

# Ensure dummy AWS environment variables are set
os.environ["AWS_ACCESS_KEY_ID"] = "test-access-key"
os.environ["AWS_SECRET_ACCESS_KEY"] = "test-secret-key"
os.environ["AWS_BUCKET_NAME"] = "test-notes-bucket"
os.environ["AWS_REGION"] = "us-east-1"
os.environ["FLASK_SECRET_KEY"] = "test-secret"

from src.config import Config
from src.s3_manager import S3Manager


class S3ManagerStubTests(unittest.TestCase):
    """Tests for S3Manager operations using a stubbed Boto3 client."""

    @patch("boto3.client")
    def setUp(self, mock_boto_client):
        self.mock_s3 = MagicMock()
        mock_boto_client.return_value = self.mock_s3
        self.manager = S3Manager()
        self.bucket = self.manager.bucket_name

    def test_upload_file_success(self):
        """Test uploading a file with correct MIME type detection using stubbed client."""
        file_data = io.BytesIO(b"lecture notes content")
        result = self.manager.upload_file(file_data, "lecture_01.pdf")

        self.assertTrue(result)
        self.mock_s3.upload_fileobj.assert_called_once_with(
            file_data,
            self.bucket,
            "lecture_01.pdf",
            ExtraArgs={"ContentType": "application/pdf"}
        )

    def test_upload_file_client_error(self):
        """Test upload error handling when S3 client throws ClientError."""
        self.mock_s3.upload_fileobj.side_effect = ClientError(
            {"Error": {"Code": "AccessDenied", "Message": "Access Denied"}},
            "UploadFileObj"
        )
        file_data = io.BytesIO(b"data")
        result = self.manager.upload_file(file_data, "notes.txt")
        self.assertFalse(result)

    def test_list_files_success_and_metadata(self):
        """Test listing files, calculating KB size, and formatting timestamp."""
        now = datetime.datetime(2026, 10, 15, 12, 30, 0)
        self.mock_s3.list_objects_v2.return_value = {
            "Contents": [
                {"Key": "cs101_syllabus.pdf", "Size": 2048, "LastModified": now},
                {"Key": "diagram.png", "Size": 5120, "LastModified": now},
            ]
        }

        files = self.manager.list_files()
        self.mock_s3.list_objects_v2.assert_called_once_with(Bucket=self.bucket)
        self.assertEqual(len(files), 2)

        self.assertEqual(files[0]["key"], "cs101_syllabus.pdf")
        self.assertEqual(files[0]["size"], 2.0)  # 2048 / 1024
        self.assertEqual(files[0]["last_modified"], "2026-10-15 12:30:00")

        self.assertEqual(files[1]["key"], "diagram.png")
        self.assertEqual(files[1]["size"], 5.0)  # 5120 / 1024

    def test_list_files_with_search_filter(self):
        """Test listing files with client-side/query filtering applied."""
        now = datetime.datetime(2026, 10, 15, 12, 0, 0)
        self.mock_s3.list_objects_v2.return_value = {
            "Contents": [
                {"Key": "cs101_syllabus.pdf", "Size": 1024, "LastModified": now},
                {"Key": "math201_homework.docx", "Size": 2048, "LastModified": now},
            ]
        }

        files = self.manager.list_files("syllabus")
        self.assertEqual(len(files), 1)
        self.assertEqual(files[0]["key"], "cs101_syllabus.pdf")

    def test_list_files_empty_bucket(self):
        """Test listing files when S3 bucket is empty (no Contents key)."""
        self.mock_s3.list_objects_v2.return_value = {}
        files = self.manager.list_files()
        self.assertEqual(files, [])

    def test_list_files_client_error(self):
        """Test listing files error handling on ClientError."""
        self.mock_s3.list_objects_v2.side_effect = ClientError(
            {"Error": {"Code": "NoSuchBucket", "Message": "Bucket does not exist"}},
            "ListObjectsV2"
        )
        files = self.manager.list_files()
        self.assertEqual(files, [])

    def test_get_download_url_presigned(self):
        """Test generating presigned URL with 3600s expiration."""
        expected_url = "https://test-notes-bucket.s3.amazonaws.com/lecture.pdf?AWSAccessKeyId=test"
        self.mock_s3.generate_presigned_url.return_value = expected_url

        url = self.manager.get_download_url("lecture.pdf")
        self.assertEqual(url, expected_url)
        self.mock_s3.generate_presigned_url.assert_called_once_with(
            "get_object",
            Params={"Bucket": self.bucket, "Key": "lecture.pdf"},
            ExpiresIn=3600
        )

    def test_get_download_url_client_error(self):
        """Test presigned URL generation error handling on ClientError."""
        self.mock_s3.generate_presigned_url.side_effect = ClientError(
            {"Error": {"Code": "InvalidParameter", "Message": "Invalid"}},
            "GeneratePresignedUrl"
        )
        url = self.manager.get_download_url("bad_file.pdf")
        self.assertIsNone(url)

    def test_delete_file_success(self):
        """Test deleting an object from S3 using stubbed client."""
        self.mock_s3.delete_object.return_value = {"DeleteMarker": True}

        result = self.manager.delete_file("obsolete_note.txt")
        self.assertTrue(result)
        self.mock_s3.delete_object.assert_called_once_with(
            Bucket=self.bucket,
            Key="obsolete_note.txt"
        )

    def test_delete_file_client_error(self):
        """Test delete file error handling on ClientError."""
        self.mock_s3.delete_object.side_effect = ClientError(
            {"Error": {"Code": "AccessDenied", "Message": "Access Denied"}},
            "DeleteObject"
        )
        result = self.manager.delete_file("protected.pdf")
        self.assertFalse(result)


if __name__ == "__main__":
    unittest.main()
