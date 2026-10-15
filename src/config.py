import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.getenv("FLASK_SECRET_KEY", "dev-key-123")
    AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
    AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
    AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
    AWS_BUCKET_NAME = os.getenv("AWS_BUCKET_NAME")

    # File Upload Limits & Validation Rules
    MAX_CONTENT_LENGTH = int(os.getenv("MAX_UPLOAD_SIZE_BYTES", 16 * 1024 * 1024))  # 16 MB default
    ALLOWED_EXTENSIONS = {
        'pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'md', 'csv', 'xlsx', 'xls', 'pptx', 'ppt',
        'jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'ico',
        'zip', 'tar', 'gz', 'rar', '7z',
        'py', 'js', 'html', 'css', 'json', 'ts', 'java', 'cpp', 'c', 'sql', 'sh'
    }

    @classmethod
    def validate(cls):
        missing = [k for k in ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_BUCKET_NAME"] if not getattr(cls, k)]
        if missing:
            raise EnvironmentError(f"Missing configuration keys: {', '.join(missing)}")