from flask import Flask, render_template, request, redirect, url_for, flash
from src.config import Config
from src.s3_manager import S3Manager
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.config.from_object(Config)
s3 = S3Manager()

@app.route('/', methods=['GET'])
def index():
    query = request.args.get('search', '')
    try:
        files = s3.list_files(query)
    except Exception as e:
        flash(f"AWS S3 connection failed: Unable to retrieve files. {str(e)}", "danger")
        files = []
    return render_template('index.html', files=files, query=query)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in Config.ALLOWED_EXTENSIONS

@app.errorhandler(413)
def request_entity_too_large(error):
    flash(f"File exceeds maximum allowed size ({Config.MAX_CONTENT_LENGTH // (1024 * 1024)} MB).", "danger")
    return redirect(url_for('index'))

@app.route('/upload', methods=['POST'])
def upload():
    if 'file' not in request.files:
        flash("No file part found", "danger")
        return redirect(url_for('index'))
    
    file = request.files['file']
    if file.filename == '':
        flash("No selected file", "danger")
        return redirect(url_for('index'))

    if not allowed_file(file.filename):
        flash(f"Unsupported file type. Please upload academic notes, documents, code, or images.", "danger")
        return redirect(url_for('index'))
        
    filename = secure_filename(file.filename)
    if not filename:
        flash("Invalid filename provided.", "danger")
        return redirect(url_for('index'))

    if s3.upload_file(file, filename):
        flash(f"Successfully uploaded {filename} to AWS S3!", "success")
    else:
        flash("Upload failed.", "danger")
    return redirect(url_for('index'))

@app.route('/download/<path:filename>')
def download(filename):
    url = s3.get_download_url(filename)
    if url:
        return redirect(url)
    flash("Failed to generate secure download link.", "danger")
    return redirect(url_for('index'))

@app.route('/delete/<path:filename>', methods=['POST'])
def delete(filename):
    if s3.delete_file(filename):
        flash(f"Deleted {filename} successfully.", "success")
    else:
        flash("Deletion failed.", "danger")
    return redirect(url_for('index'))

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)