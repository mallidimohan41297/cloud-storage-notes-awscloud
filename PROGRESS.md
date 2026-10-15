# PROGRESS

This document tracks progress, regression gates, architectural decisions, and constraints for redesigning the UI into a dense, full-screen dark cloud-storage dashboard.

---

## Baseline Route Table

The Flask URL map contract MUST be maintained identically throughout all redesign phases:

| Path | Methods | Endpoint | Purpose |
|---|---|---|---|
| `/` | `GET` | `index` | Main dashboard displaying files and search |
| `/upload` | `POST` | `upload` | File upload handler |
| `/download/<path:filename>` | `GET` | `download` | Generates S3 presigned URL and redirects |
| `/delete/<path:filename>` | `POST` | `delete` | S3 object deletion handler |
| `/static/<path:filename>` | `GET` | `static` | Static file serving (Flask default) |

---

## Form Field Names Per Route

| Route | Method | Form Field / Param Name | Type / Note |
|---|---|---|---|
| `/upload` | `POST` | `file` | `multipart/form-data` file input (`request.files['file']`) |
| `/` | `GET` | `search` | Query parameter (`request.args.get('search', '')`) |
| `/delete/<path:filename>` | `POST` | *None* | Path parameter `filename`; form action directly specifies target |

---

## Template Variables Each Template Receives

### `src/templates/index.html`

* `files`: List of dictionaries representing S3 objects. Each item contains:
  * `key` (`str`): S3 object key / filename
  * `size` (`float`): File size in kilobytes (`KB`), rounded to 2 decimal places (`round(obj['Size'] / 1024, 2)`)
  * `last_modified` (`str`): Formatted timestamp string `"%Y-%m-%d %H:%M:%S"`
* `query` (`str`): Current search string from `request.args.get('search', '')`
* Flashed Messages (`get_flashed_messages(with_categories=true)`):
  * Categories used in code: `"success"`, `"danger"`

---

## File Metadata Actually Available

From `src/s3_manager.py` (`S3Manager.list_files`):
1. **Filename / Key**: `file.key` (string)
2. **File Size**: `file.size` in KB (numeric float)
3. **Last Modified**: `file.last_modified` (string formatted `%Y-%m-%d %H:%M:%S`)
4. **Content Type**: Detected at upload time via `mimetypes.guess_type(filename)` and saved in S3 object metadata (`ContentType`), but **not** retrieved or returned in `list_files` (`list_objects_v2` call).
5. **No database or other metadata**: No tags, no author, no download counts, no custom folders, no user ownership. (Rule 5: *No mock or fabricated data; omit elements if data doesn't exist*).

---

## How Upload, Download, and Delete Currently Work

### Upload Flow
1. User submits a multipart POST form to `/upload` with file input `name="file"`.
2. `upload()` validates that `'file'` is in `request.files` and `file.filename != ''`.
3. `filename` is sanitized using `werkzeug.utils.secure_filename(file.filename)`.
4. `S3Manager.upload_file(file, filename)` guesses MIME type and calls `boto3.client('s3').upload_fileobj(file_obj, bucket, filename, ExtraArgs={"ContentType": content_type})`.
5. Success or failure triggers `flash()` and redirects to `url_for('index')`.

### Download Flow (Presigned URL)
1. User clicks download link pointing to `/download/<path:filename>`.
2. Flask route calls `S3Manager.get_download_url(filename)`.
3. `boto3` generates a secure presigned URL via `generate_presigned_url('get_object', Params={'Bucket': bucket, 'Key': filename}, ExpiresIn=3600)`.
4. Flask issues a `302 redirect(url)`. The raw S3 bucket is never public.

### Delete Flow
1. User triggers POST to `/delete/<path:filename>` via a form button (with JavaScript confirmation prompt).
2. Flask route calls `S3Manager.delete_file(filename)`.
3. `boto3` calls `delete_object(Bucket=bucket, Key=filename)`.
4. Result flashes a message and redirects to `url_for('index')`.

---

## Security Observations
* **CSRF Protection**: No CSRF tokens are implemented in POST forms (`/upload` and `/delete/<path:filename>`). Adding Flask-WTF or CSRF protection would require contract validation.
* **Filename Sanitization**: Upload uses `secure_filename()`. However, `secure_filename` strips slashes and non-ASCII characters; nested pseudo-directories in S3 are not supported by the default sanitizer.
* **Deletion Method**: Delete is correctly performed via `POST` (not `GET`), avoiding search engine crawler accidental deletes.
* **Public S3 Access**: Bucket is kept private; files are securely accessed via temporary presigned URLs expiring in 1 hour (3600s).
* **Credential Exposure**: AWS credentials are read from environment variables; `.env` is ignored by `.gitignore`. No credentials or raw S3 URLs are rendered in HTML templates.
* **File Validation**: Currently no file type allowlisting or max size restrictions exist in Flask routes before passing to Boto3.

---

## Regression Gate Instructions

Run the route regression and behavior test suite:
```bash
./venv/bin/python -m unittest discover tests
```

To print and verify the live Flask URL map:
```bash
AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test AWS_BUCKET_NAME=test-bucket ./venv/bin/python -c "
from src.app import app
for rule in sorted(app.url_map.iter_rules(), key=lambda r: r.rule):
    methods = ','.join(sorted(rule.methods - {'HEAD', 'OPTIONS'}))
    print(f'{rule.rule} | {methods} | {rule.endpoint}')
"
```

---

## Part Checklist

- [x] **Part 0: Safety Net & Repository Baseline** (DONE)
- [x] **Part 1: Self-Hosted Static Assets & Design System Foundation** (DONE)
- [x] **Part 2: Main Data Display (Stats, Filter Chips, List & Grid Views, Sorting)** (DONE)
- [x] **Part 3: File Actions & Security Hardening** (DONE)
- [x] **Part 4: UI States (Loading, Empty, Success, Error Toasts & Alerts)** (DONE)
- [x] **Part 5: Responsive, A11y, Tests & Close-Out** (DONE)

---

## Part Status History

### Part 0: Safety Net & Repository Baseline
* **Status**: DONE
* **Files Touched**:
  * `.gitignore`
  * `.env.example`
  * `tests/test_baseline.py`
  * `PROGRESS.md`
* **Decisions Made**:
  * Initialized git repository on branch `ui-redesign` matching remote `https://github.com/mallidimohan41297/cloud-storage-notes-awscloud.git` (commit `adf2a26`).
  * Created automated regression test gate in `tests/test_baseline.py` using standard library `unittest` (no extra external test runners required).
  * Maintained 100% clean baseline without modifying any existing production code or route contracts.
* **Open Issues**:
  * None.

### Part 1: Self-Hosted Static Assets & Design System Foundation
* **Status**: DONE
* **Files Touched**:
  * `src/static/vendor/bootstrap.min.css` (Self-hosted Bootstrap 5.3.0)
  * `src/static/vendor/bootstrap.bundle.min.js` (Self-hosted Bootstrap 5.3.0 bundle)
  * `src/static/css/dashboard.css` (Design tokens, base, 100dvh layout, components, utilities)
  * `src/static/js/dashboard.js` (Keyboard shortcut `/` for search, tooltips, view switcher)
  * `src/templates/partials/icons.html` (Jinja SVG macro for self-hosted inline icons)
  * `src/templates/partials/sidebar.html` (64-72px icon-only nav landmark with active state)
  * `src/templates/partials/topbar.html` (56px header landmark with search, view toggles, upload trigger)
  * `src/templates/base.html` (Core layout shell with landmarks: nav, header, main content)
  * `src/templates/index.html` (Refactored to extend base.html while preserving all routes and contracts)
  * `screenshots/shell_1366x768.png` (Screenshot at 1366x768)
  * `screenshots/shell_1920x1080.png` (Screenshot at 1920x1080)
  * `PROGRESS.md` (Updated tracking)
* **Decisions Made**:
  * Fully eliminated CDN dependencies for Bootstrap 5 and icons; placed self-hosted vendor files in `src/static/vendor/` and SVG macros in `src/templates/partials/icons.html`.
  * Created comprehensive design tokens with `--bg #080909`, `--surface #171A17`, `--surface-2 #212621`, `--border rgba(255,255,255,0.08)`, and accent roles (`--lime #C7F36B`, `--orange #FF512B`, `--blue #1765D1`, `--pink #F49AC2`, `--green #347748`, `--yellow #FFC52E`).
  * Enforced full viewport shell at `100dvh` without document-level scroll; main content region has styled custom scrollbars and safe inner padding (16px desktop, 12px mobile).
  * Maintained exact route and form contracts (`/`, `/upload`, `/download/<path:filename>`, `/delete/<path:filename>`).
* **Open Issues**:
  * None.

### Part 2: Main Data Display (Stats, Filter Chips, List & Grid Views, Sorting)
* **Status**: DONE
* **Files Touched**:
  * `src/templates/partials/file_macros.html` (Created reusable macros `file_row` and `file_card` with escaped filenames and tooltips)
  * `src/templates/partials/icons.html` (Added file-type SVG icons: `file-text`, `image`, `archive`, `video`, `music`, `code`, `clock`, `hard-drive`)
  * `src/templates/partials/topbar.html` (Integrated global sort dropdown synchronized with table header sorting)
  * `src/templates/index.html` (Added stat tiles calculated strictly from real data, filter chips with counts, list/grid layouts, no-results state)
  * `src/static/css/dashboard.css` (Added styles for stat tiles, filter chips, file badges, card hover effects, sortable headers, fast `.is-filtered-out` CSS rule)
  * `src/static/js/dashboard.js` (Implemented instant client-side search, category filter chips, column/dropdown sorting, view persistence in localStorage and URL param)
  * `screenshots/part2_list_1366x768.png`, `screenshots/part2_list_1920x1080.png`
  * `screenshots/part2_grid_1366x768.png`, `screenshots/part2_grid_1920x1080.png`
  * `PROGRESS.md`
* **Decisions Made**:
  * Stat tiles derived strictly from available S3 object metadata: Total Files, Total Storage (KB/MB), Largest File, and Latest Upload timestamp. No fabricated storage quotas or fake percentages.
  * Filter chips dynamically display real category counts (All, Documents, Images, Other).
  * Fast O(1) visibility toggling using `.is-filtered-out` ensures high performance even with 500+ files.
  * Dual view modes: Dense list table view with sortable columns (name, type, size, modified) and responsive grid view, persisted in `localStorage`.
  * Download button wired directly to `url_for('download', filename=file.key)`; Delete button preserved as a non-functional placeholder until Part 3 per task instructions.
* **Open Issues**:
  * None.

### Part 3: File Actions & Security Hardening
* **Status**: DONE
* **Files Touched**:
  * `src/config.py` (Added `MAX_CONTENT_LENGTH = 16 * 1024 * 1024` and `ALLOWED_EXTENSIONS`)
  * `src/app.py` (Added `allowed_file` check, 413 error handler, safe filename sanitization)
  * `src/templates/base.html` (Added `{% block modals %}` outside `.app-shell` to avoid backdrop stacking conflicts)
  * `src/templates/index.html` (Added compact dropzone, progress bar, download toast, and delete confirmation modal)
  * `src/templates/partials/file_macros.html` (Wired delete buttons to trigger delete confirmation modal with file context)
  * `src/static/css/dashboard.css` (Dropzone states, progress bar, modal styling, `.btn-danger-destructive`)
  * `src/static/js/dashboard.js` (Drag-and-drop, validation, XHR upload progress, download toast trigger, delete modal focus management)
  * `tests/test_baseline.py` (Added 4 unit tests covering upload validation, download redirect, delete flow, 413 handling; 7/7 passing)
  * `screenshots/part3_upload_dropzone.png`
  * `screenshots/part3_delete_modal.png`
  * `PROGRESS.md`
* **Decisions Made**:
  * Kept original form field name `file`, method `POST`, and route `/upload`.
  * Dropzone: Compact dropzone (~110px tall) supporting drag-and-drop and file browsing with instant client-side file extension & size validation (mirroring server 16MB limit). Pure HTML `<input type="file" name="file">` fallback ensures form submits even with JavaScript disabled.
  * XHR progress bar: Real-time progress updates during upload with percent readout, animated status, and submit button state management.
  * Download flow: Retained existing presigned S3 download URL generation. Added a "preparing download" notification toast without exposing any raw bucket details in HTML or client scripts.
  * Delete flow: Retained existing secure `POST /delete/<path:filename>` route. Implemented Bootstrap modal `#deleteConfirmModal` displaying the filename, destructive orange submit button (`.btn-danger-destructive`), default focus on Cancel, and aria focus trap/return.
  * Backend safety: Added `MAX_CONTENT_LENGTH = 16 * 1024 * 1024` (16MB) in `src/config.py`, filename extension validation against `ALLOWED_EXTENSIONS`, 413 Payload Too Large error handler with friendly flash message, and `secure_filename` sanitization.
* **Open Issues**:
  * None.

### Part 4: UI States (Loading, Empty, Success, Error Toasts & Alerts)
* **Status**: DONE
* **Files Touched**:
  * `src/app.py` (Wrapped `s3.list_files` in error handler with flash messaging and fallback to empty list)
  * `src/templates/base.html` (Added accessible `#globalToastContainer` with `aria-live="polite"` and category mapping; added `<noscript>` fallback alert block)
  * `src/templates/partials/icons.html` (Added SVG icons for `check-circle`, `info`, `alert-triangle`, and `refresh-cw`)
  * `src/templates/partials/topbar.html` (Added `id="topbarUploadBtn"` for spinner state management during uploads)
  * `src/templates/index.html` (Added skeleton table & grid shimmers, empty state card with folder icon, one sentence, and upload CTA with zero illustrations; added inline error alert banner with retry action)
  * `src/static/css/dashboard.css` (Added styles for skeleton shimmer pulse keyframes, dark toast categories, badges, `.btn-outline-orange`, `.btn-danger-soft`)
  * `src/static/js/dashboard.js` (Added toast system initialization, dynamic toast generator `spawnToast`, retry action delegation, upload button spinner state, and testing hooks for `?state=loading`, `?state=empty`, `?state=success`, `?state=error`)
  * `tests/test_baseline.py` (Added 3 unit tests covering empty state rendering, S3 error resilience, and accessible toast container; 10/10 tests passing)
  * `screenshots/part4_loading_1366x768.png`, `screenshots/part4_loading_390x844.png`
  * `screenshots/part4_empty_1366x768.png`, `screenshots/part4_empty_390x844.png`
  * `screenshots/part4_success_1366x768.png`, `screenshots/part4_success_390x844.png`
  * `screenshots/part4_error_1366x768.png`, `screenshots/part4_error_390x844.png`
  * `PROGRESS.md`
### Part 5: Responsive, A11y, Tests & Close-Out
* **Status**: DONE
* **Files Touched**:
  * `src/templates/partials/icons.html` (Added SVG icon `more-vertical`)
  * `src/templates/partials/topbar.html` (Added `aria-label` attributes to view toggles)
  * `src/templates/partials/file_macros.html` (Added mobile meta line, mobile overflow dropdown menu, `col-xxl-2` 6-column grid support, and explicit action `aria-label`s)
  * `src/templates/index.html` (Added semantic `h1` landmark, responsive table headers with `d-none d-md-table-cell`, accessible `role="group"` on filter chips, and aria-labels)
  * `src/static/css/dashboard.css` (Tuned WCAG AA contrast tokens, added lime `:focus-visible` styles, prefers-reduced-motion media query, 1920x1080 6-column grid, tuned 1366x768 tile height with font >= 13px, mobile bottom nav layout, horizontally scrollable stats strip, >= 44px tap targets, dark dropdown menus, and removed dead badge classes)
  * `src/static/js/dashboard.js` (Added uploadModal focus management, trap, and return; wired mobile overflow menu actions)
  * `tests/test_s3_manager.py` (Added 10 unit tests for S3Manager upload, list, download presigned URL, and delete using stubbed boto3 client; 20/20 total tests passing)
  * `scripts/run_proof_and_audit.js` (Automated Playwright test script asserting zero horizontal overflow across 15 viewport/state combinations and saving screenshots)
  * `scripts/run_lighthouse.py` (Automated Lighthouse accessibility audit runner)
  * `docs/screenshots/` (15 full screenshots covering empty, grid, list, delete modal, and error across 1920x1080, 1366x768, and 390x844)
  * `README.md` (Updated installation, configuration, running, and testing documentation)
  * `.gitignore` (Added `node_modules/` exclusion)
  * `PROGRESS.md`
* **Decisions Made**:
  * **1920x1080 Viewport**: Grid expanded to 6 dense columns via `col-xxl-2` (`width: 16.66667%`), stat tiles sit on a single unified row without wasted space.
  * **1366x768 Viewport**: Fits sidebar, top bar, stat tiles, filter bar, and 2+ rows of files above the fold without reducing content font sizes below 13px (tuned tile vertical padding to 10px 14px and icon wrappers to 36x36px).
  * **Mobile (<=768px)**: Sidebar converted to a bottom navigation bar (`order: 2`, 56px height, flex row); stat tiles formatted as a horizontally scrollable strip (`#stat-tiles-row` with `overflow-x: auto`); list view displays filename + one meta line (`ext • size • date`) + overflow menu (`...` 3-dots dropdown); all interactive tap targets enforce >= 44px height/width.
  * **Accessibility (WCAG AA & Landmark Hierarchy)**: Text contrast increased (`--text-subtle: #A2B0A4`, `--text-muted: #B6C4B8` giving > 4.8:1 and > 7:1 contrast on dark surfaces); added lime focus ring (`:focus-visible` with 2px outline and 2px offset); added `prefers-reduced-motion` override; added `<h1>` semantic landmark; filter chips use `role="group"`; icon buttons include explicit `aria-label`s; both upload and delete modals trap focus and restore focus to trigger buttons on dismiss.
  * **Zero Horizontal Overflow**: Programmatically verified across all 15 viewport/state matrix tests (`docScrollWidth === docClientWidth` on every combination).
  * **Lighthouse Score**: Achieved **100 / 100** on Lighthouse Accessibility Audit.
  * **Test Coverage**: Added 10 tests in `tests/test_s3_manager.py` testing S3Manager operations with stubbed boto3 client. Full test suite: 20/20 passing.
  * **Flask Route Contract**: Route table remains 100% identical to Part 0 baseline with zero diff.
* **Open Issues**:
  * None.




