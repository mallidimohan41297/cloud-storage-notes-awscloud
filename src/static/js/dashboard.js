/**
 * Dashboard Shell & Data Display Vanilla JS
 * - "/" keyboard shortcut to focus search input
 * - Instant client-side search across files
 * - Category filter chips (All, Documents, Images, Other) with live counts
 * - Grid / List view switching with localStorage persistence
 * - Table header column sorting and topbar sort dropdown synchronization
 * - Dynamic empty states and "Clear filters" action
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize Bootstrap Tooltips
  const initTooltips = () => {
    if (window.bootstrap && window.bootstrap.Tooltip) {
      const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
      [...tooltipTriggerList].map(tooltipTriggerEl => new window.bootstrap.Tooltip(tooltipTriggerEl, {
        boundary: document.body
      }));
    }
  };
  initTooltips();

  // 2. State & Cache
  const urlParams = new URLSearchParams(window.location.search);
  const initialView = urlParams.get('view') || localStorage.getItem('notes_dashboard_view') || 'list';
  const showModalParam = urlParams.get('show_modal');

  const state = {
    view: initialView,
    search: '',
    category: 'all',
    sort: 'date-desc'
  };

  const searchInput = document.getElementById('global-search-input');
  const sortSelect = document.getElementById('global-sort-select');
  const listViewContainer = document.getElementById('list-view-container');
  const gridViewContainer = document.getElementById('grid-view-container');
  const viewToggleBtns = document.querySelectorAll('[data-view-toggle]');
  const filterChips = document.querySelectorAll('[data-filter-category]');
  const noResultsState = document.getElementById('no-search-results');
  const clearFiltersBtn = document.getElementById('clear-filters-btn');
  const visibleCountBadge = document.getElementById('visible-count-badge');

  const listRows = Array.from(document.querySelectorAll('.file-item-row'));
  const gridCards = Array.from(document.querySelectorAll('.file-item-card'));

  // 3. View switching & persistence
  const setView = (viewMode) => {
    state.view = viewMode;
    localStorage.setItem('notes_dashboard_view', viewMode);

    viewToggleBtns.forEach(btn => {
      if (btn.getAttribute('data-view-toggle') === viewMode) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    if (viewMode === 'grid') {
      if (listViewContainer) listViewContainer.classList.add('d-none');
      if (gridViewContainer) gridViewContainer.classList.remove('d-none');
      const skTable = document.getElementById('skeleton-table-card');
      const skGrid = document.getElementById('skeleton-grid-cards');
      if (skTable) skTable.classList.add('d-none');
      if (skGrid) skGrid.classList.remove('d-none');
    } else {
      if (gridViewContainer) gridViewContainer.classList.add('d-none');
      if (listViewContainer) listViewContainer.classList.remove('d-none');
      const skTable = document.getElementById('skeleton-table-card');
      const skGrid = document.getElementById('skeleton-grid-cards');
      if (skGrid) skGrid.classList.add('d-none');
      if (skTable) skTable.classList.remove('d-none');
    }
  };

  // Set initial view
  setView(state.view);

  viewToggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const viewMode = btn.getAttribute('data-view-toggle');
      setView(viewMode);
    });
  });

  // 4. "/" keyboard shortcut to focus search input
  if (searchInput) {
    window.addEventListener('keydown', (e) => {
      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') {
        return;
      }
      if (e.key === '/') {
        e.preventDefault();
        searchInput.focus();
        searchInput.select();
      }
    });

    // Instant client-side search
    searchInput.addEventListener('input', (e) => {
      state.search = e.target.value.trim().toLowerCase();
      applyFilters();
    });

    // Don't submit GET form on enter if search input is focused, unless user presses Enter
    searchInput.form?.addEventListener('submit', (e) => {
      e.preventDefault(); // Client-side search is instantaneous
    });
  }

  // 5. Category filter chips
  filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      filterChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.category = chip.getAttribute('data-filter-category');
      applyFilters();
    });
  });

  // 6. Filtering & Fast visibility toggling
  const applyFilters = () => {
    let visibleCount = 0;

    // Filter list rows
    listRows.forEach(row => {
      const key = row.getAttribute('data-key') || '';
      const category = row.getAttribute('data-category') || 'other';

      const matchesSearch = !state.search || key.includes(state.search);
      const matchesCategory = state.category === 'all' || category === state.category;

      if (matchesSearch && matchesCategory) {
        row.classList.remove('is-filtered-out');
        visibleCount++;
      } else {
        row.classList.add('is-filtered-out');
      }
    });

    // Filter grid cards
    gridCards.forEach(card => {
      const key = card.getAttribute('data-key') || '';
      const category = card.getAttribute('data-category') || 'other';

      const matchesSearch = !state.search || key.includes(state.search);
      const matchesCategory = state.category === 'all' || category === state.category;

      if (matchesSearch && matchesCategory) {
        card.classList.remove('is-filtered-out');
      } else {
        card.classList.add('is-filtered-out');
      }
    });

    // Update UI counters & empty states
    if (visibleCountBadge) {
      visibleCountBadge.textContent = `${visibleCount} file${visibleCount !== 1 ? 's' : ''}`;
    }

    if (noResultsState) {
      if (visibleCount === 0 && (listRows.length > 0)) {
        noResultsState.classList.remove('d-none');
        if (listViewContainer) listViewContainer.classList.add('d-none');
        if (gridViewContainer) gridViewContainer.classList.add('d-none');
      } else {
        noResultsState.classList.add('d-none');
        setView(state.view); // Restore current active view
      }
    }
  };

  // Clear filters
  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', () => {
      state.search = '';
      state.category = 'all';
      if (searchInput) searchInput.value = '';
      filterChips.forEach(c => {
        if (c.getAttribute('data-filter-category') === 'all') {
          c.classList.add('active');
        } else {
          c.classList.remove('active');
        }
      });
      applyFilters();
    });
  }

  // 7. Sorting Functionality
  const sortFiles = (sortKey) => {
    state.sort = sortKey;
    if (sortSelect && sortSelect.value !== sortKey) {
      sortSelect.value = sortKey;
    }

    const [field, direction] = sortKey.split('-');
    const multiplier = direction === 'asc' ? 1 : -1;

    const compareFn = (a, b) => {
      let valA, valB;
      if (field === 'name') {
        valA = a.getAttribute('data-key');
        valB = b.getAttribute('data-key');
        return valA.localeCompare(valB) * multiplier;
      } else if (field === 'type') {
        valA = a.getAttribute('data-type');
        valB = b.getAttribute('data-type');
        return valA.localeCompare(valB) * multiplier;
      } else if (field === 'size') {
        valA = parseFloat(a.getAttribute('data-size') || 0);
        valB = parseFloat(b.getAttribute('data-size') || 0);
        return (valA - valB) * multiplier;
      } else if (field === 'date') {
        valA = a.getAttribute('data-modified');
        valB = b.getAttribute('data-modified');
        return valA.localeCompare(valB) * multiplier;
      }
      return 0;
    };

    // Sort list tbody
    const tbody = document.querySelector('#file-table-body');
    if (tbody) {
      const sortedRows = [...listRows].sort(compareFn);
      sortedRows.forEach(row => tbody.appendChild(row));
    }

    // Sort grid row
    const gridRow = document.querySelector('#file-grid-row');
    if (gridRow) {
      const sortedCards = [...gridCards].sort(compareFn);
      sortedCards.forEach(card => gridRow.appendChild(card));
    }

    // Update table header sorted indicators
    document.querySelectorAll('th.sortable').forEach(th => {
      const thField = th.getAttribute('data-sort-field');
      const sortIcon = th.querySelector('.sort-indicator');
      if (thField === field) {
        th.classList.add('sorted');
        if (sortIcon) {
          sortIcon.textContent = direction === 'asc' ? ' ↑' : ' ↓';
        }
      } else {
        th.classList.remove('sorted');
        if (sortIcon) sortIcon.textContent = '';
      }
    });
  };

  // Topbar sort select change
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      sortFiles(e.target.value);
    });
  }

  // Clickable table header column sorting
  document.querySelectorAll('th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const field = th.getAttribute('data-sort-field');
      const currentSort = state.sort;
      let newDirection = 'asc';
      if (currentSort.startsWith(field)) {
        newDirection = currentSort.endsWith('asc') ? 'desc' : 'asc';
      }
      sortFiles(`${field}-${newDirection}`);
    });
  });

  // Initial sort
  sortFiles(state.sort);

  // =========================================================================
  // 8. UPLOAD DROPZONE & CLIENT VALIDATION & PROGRESS BAR
  // =========================================================================
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('modalFileInput');
  const dropzonePrompt = document.querySelector('.dropzone-prompt');
  const filePreview = document.getElementById('dropzoneFilePreview');
  const fileNameDisplay = document.getElementById('dropzoneFileName');
  const fileSizeDisplay = document.getElementById('dropzoneFileSize');
  const removeFileBtn = document.getElementById('dropzoneRemoveFile');
  const errorNotice = document.getElementById('uploadErrorNotice');
  const errorText = document.getElementById('uploadErrorText');
  const uploadForm = document.getElementById('uploadForm');
  const progressWrapper = document.getElementById('uploadProgressWrapper');
  const progressBar = document.getElementById('uploadProgressBar');
  const progressPercent = document.getElementById('uploadProgressPercent');
  const progressStatus = document.getElementById('uploadProgressStatus');
  const uploadSubmitBtn = document.getElementById('uploadSubmitBtn');

  // Allowed extensions mirroring server rules (Config.ALLOWED_EXTENSIONS)
  const allowedExtensions = new Set([
    'pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'md', 'csv', 'xlsx', 'xls', 'pptx', 'ppt',
    'jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'ico',
    'zip', 'tar', 'gz', 'rar', '7z',
    'py', 'js', 'html', 'css', 'json', 'ts', 'java', 'cpp', 'c', 'sql', 'sh'
  ]);
  const MAX_FILE_SIZE = 16 * 1024 * 1024; // 16 MB

  const showError = (msg) => {
    if (errorNotice && errorText) {
      errorText.textContent = msg;
      errorNotice.classList.remove('d-none');
    }
  };

  const clearError = () => {
    if (errorNotice) {
      errorNotice.classList.add('d-none');
    }
  };

  const validateFile = (file) => {
    if (!file) return false;
    clearError();

    // Size check
    if (file.size > MAX_FILE_SIZE) {
      showError(`File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds 16 MB maximum limit.`);
      return false;
    }

    // Extension check
    const ext = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : '';
    if (!allowedExtensions.has(ext)) {
      showError(`Unsupported file extension ".${ext || 'unknown'}". Allowed: PDF, Docs, Code, Images, Archives.`);
      return false;
    }

    return true;
  };

  const handleSelectedFile = (file) => {
    if (!validateFile(file)) {
      if (fileInput) fileInput.value = '';
      if (filePreview) filePreview.classList.add('d-none');
      if (dropzonePrompt) dropzonePrompt.classList.remove('d-none');
      return;
    }

    if (fileNameDisplay) fileNameDisplay.textContent = file.name;
    if (fileSizeDisplay) fileSizeDisplay.textContent = (file.size / 1024).toFixed(1) + ' KB';
    if (dropzonePrompt) dropzonePrompt.classList.add('d-none');
    if (filePreview) {
      filePreview.classList.remove('d-none');
      filePreview.classList.add('d-flex');
    }
  };

  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handleSelectedFile(e.target.files[0]);
      }
    });
  }

  if (dropzone) {
    ['dragenter', 'dragover'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('dragover');
      });
    });

    dropzone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files && files.length > 0) {
        if (fileInput) {
          fileInput.files = files; // Sync with file input
        }
        handleSelectedFile(files[0]);
      }
    });
  }

  if (removeFileBtn) {
    removeFileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (fileInput) fileInput.value = '';
      if (filePreview) {
        filePreview.classList.add('d-none');
        filePreview.classList.remove('d-flex');
      }
      if (dropzonePrompt) dropzonePrompt.classList.remove('d-none');
      clearError();
    });
  }

  // Upload Form Submission with XMLHttpRequest Progress Bar
  if (uploadForm) {
    uploadForm.addEventListener('submit', (e) => {
      const file = fileInput && fileInput.files && fileInput.files[0];
      if (!validateFile(file)) {
        e.preventDefault();
        return;
      }

      // If browser supports XMLHttpRequest upload, submit via AJAX to show progress bar
      if (window.XMLHttpRequest && file) {
        e.preventDefault();
        const formData = new FormData(uploadForm);
        const xhr = new XMLHttpRequest();

        if (progressWrapper) progressWrapper.classList.remove('d-none');
        const topbarUploadBtn = document.getElementById('topbarUploadBtn');
        if (topbarUploadBtn) {
          topbarUploadBtn.disabled = true;
          topbarUploadBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span><span>Uploading...</span>`;
        }
        if (uploadSubmitBtn) {
          uploadSubmitBtn.disabled = true;
          uploadSubmitBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span><span>Uploading to S3...</span>`;
        }

        xhr.upload.addEventListener('progress', (ev) => {
          if (ev.lengthComputable) {
            const percent = Math.round((ev.loaded / ev.total) * 100);
            if (progressBar) progressBar.style.width = `${percent}%`;
            if (progressPercent) progressPercent.textContent = `${percent}%`;
          }
        });

        xhr.addEventListener('load', () => {
          if (progressStatus) progressStatus.textContent = 'Uploaded! Processing...';
          // Reload page to display flash messages and updated file explorer
          window.location.reload();
        });

        xhr.addEventListener('error', () => {
          showError('Upload failed: Network connection error. Unable to send file to server.');
          if (uploadSubmitBtn) {
            uploadSubmitBtn.disabled = false;
            uploadSubmitBtn.innerHTML = `<span>Upload File</span>`;
          }
          if (topbarUploadBtn) {
            topbarUploadBtn.disabled = false;
            topbarUploadBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg><span>Upload</span>`;
          }
          if (window.spawnToast) {
            window.spawnToast({
              type: 'danger',
              badge: 'Error',
              message: 'Network connection lost during upload. Please verify your internet and retry.',
              retry: 'upload'
            });
          }
        });

        xhr.open('POST', uploadForm.action);
        xhr.send(formData);
      }
    });
  }

  // Upload Modal Focus Management
  const uploadModalEl = document.getElementById('uploadModal');
  let lastUploadTrigger = null;
  document.querySelectorAll('[data-bs-target="#uploadModal"]').forEach(btn => {
    btn.addEventListener('click', () => {
      lastUploadTrigger = btn;
    });
  });
  if (uploadModalEl) {
    uploadModalEl.addEventListener('shown.bs.modal', () => {
      if (fileInput) fileInput.focus();
    });
    uploadModalEl.addEventListener('hidden.bs.modal', () => {
      if (lastUploadTrigger && typeof lastUploadTrigger.focus === 'function') {
        lastUploadTrigger.focus();
      }
    });
  }

  // =========================================================================
  // 9. DOWNLOAD: PREPARING TOAST STATE
  // =========================================================================
  const downloadToastEl = document.getElementById('downloadToast');
  let downloadToastInstance = null;
  if (downloadToastEl && window.bootstrap && window.bootstrap.Toast) {
    downloadToastInstance = new window.bootstrap.Toast(downloadToastEl, { delay: 3500 });
  }

  document.querySelectorAll('.btn-download-action').forEach(btn => {
    btn.addEventListener('click', () => {
      if (downloadToastInstance) {
        downloadToastInstance.show();
      }
    });
  });

  // =========================================================================
  // 10. DELETE: CONFIRMATION MODAL WITH FOCUS TRAP & FOCUS RETURN
  // =========================================================================
  const deleteModalEl = document.getElementById('deleteConfirmModal');
  const deleteForm = document.getElementById('deleteForm');
  const deleteFileNameSpan = document.getElementById('deleteModalFileName');
  const deleteCancelBtn = document.getElementById('deleteModalCancelBtn');
  let deleteModalInstance = null;
  let lastActiveTrigger = null;

  if (deleteModalEl && window.bootstrap && window.bootstrap.Modal) {
    deleteModalInstance = new window.bootstrap.Modal(deleteModalEl);

    // Focus Cancel button by default when opened
    deleteModalEl.addEventListener('shown.bs.modal', () => {
      if (deleteCancelBtn) {
        deleteCancelBtn.focus();
      }
    });

    // Return focus to triggering button when closed
    deleteModalEl.addEventListener('hidden.bs.modal', () => {
      if (lastActiveTrigger && typeof lastActiveTrigger.focus === 'function') {
        lastActiveTrigger.focus();
      }
    });
  }

  document.querySelectorAll('.btn-delete-trigger').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      lastActiveTrigger = btn;
      const filename = btn.getAttribute('data-filename');

      if (deleteFileNameSpan) deleteFileNameDisplay(filename);
      if (deleteForm) {
        // Set form action to /delete/<path:filename>
        deleteForm.action = `/delete/${encodeURIComponent(filename)}`;
      }

      if (deleteModalInstance) {
        deleteModalInstance.show();
      }
    });
  });

  const deleteFileNameDisplay = (fname) => {
    if (deleteFileNameSpan) {
      deleteFileNameSpan.textContent = fname;
    }
  };

  // =========================================================================
  // 11. TOAST SYSTEM & RETRY ACTIONS
  // =========================================================================
  const initGlobalToasts = () => {
    if (window.bootstrap && window.bootstrap.Toast) {
      document.querySelectorAll('#globalToastContainer .toast').forEach(toastEl => {
        const autohide = toastEl.getAttribute('data-bs-autohide') !== 'false';
        const delay = parseInt(toastEl.getAttribute('data-bs-delay')) || 4000;
        const inst = window.bootstrap.Toast.getOrCreateInstance(toastEl, {
          autohide,
          delay
        });
        inst.show();
      });
    }
  };
  initGlobalToasts();

  // Retry Action Handlers
  document.addEventListener('click', (e) => {
    const retryBtn = e.target.closest('.toast-retry-action') || e.target.closest('#inline-error-retry-btn');
    if (retryBtn) {
      const action = retryBtn.getAttribute('data-retry') || 'reload';
      if (action === 'upload') {
        const uploadModalEl = document.getElementById('uploadModal');
        if (uploadModalEl && window.bootstrap && window.bootstrap.Modal) {
          const modal = window.bootstrap.Modal.getOrCreateInstance(uploadModalEl);
          modal.show();
        }
      } else {
        window.location.reload();
      }
    }
  });

  // Dynamic Toast Generator
  const spawnToast = ({ type = 'info', badge = 'Notice', message = '', retry = null }) => {
    const container = document.getElementById('globalToastContainer');
    if (!container) return;

    const toastEl = document.createElement('div');
    const isDanger = type === 'danger' || type === 'error';
    const autohide = !isDanger;
    const delay = isDanger ? 0 : 4000;
    const role = isDanger ? 'alert' : 'status';
    const ariaLive = isDanger ? 'assertive' : 'polite';

    toastEl.className = `toast dark-toast toast-${type} align-items-center show shadow-lg`;
    toastEl.setAttribute('role', role);
    toastEl.setAttribute('aria-live', ariaLive);
    toastEl.setAttribute('aria-atomic', 'true');
    toastEl.setAttribute('data-bs-autohide', autohide ? 'true' : 'false');
    if (delay) toastEl.setAttribute('data-bs-delay', delay);

    let iconSvg = '';
    let badgeClass = '';
    let iconClass = '';
    if (type === 'success') {
      iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
      badgeClass = 'badge-success-subtle text-lime';
      iconClass = 'text-lime';
    } else if (isDanger) {
      iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
      badgeClass = 'badge-danger-subtle text-orange';
      iconClass = 'text-orange';
    } else if (type === 'warning') {
      iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
      badgeClass = 'badge-warning-subtle text-yellow';
      iconClass = 'text-yellow';
    } else {
      iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
      badgeClass = 'badge-info-subtle text-blue';
      iconClass = 'text-blue';
    }

    let retryBtnHtml = '';
    if (retry === 'upload') {
      retryBtnHtml = `<div class="mt-2"><button type="button" class="btn-dense btn-danger-soft btn-action-sm toast-retry-action" data-retry="upload"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg><span class="ms-1">Retry Upload</span></button></div>`;
    } else if (retry === 'reload') {
      retryBtnHtml = `<div class="mt-2"><button type="button" class="btn-dense btn-danger-soft btn-action-sm toast-retry-action" data-retry="reload"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg><span class="ms-1">Retry Connection</span></button></div>`;
    }

    toastEl.innerHTML = `
      <div class="toast-content d-flex align-items-start p-3 gap-12">
        <span class="${iconClass} flex-shrink-0 mt-1">${iconSvg}</span>
        <div class="flex-grow-1 min-w-0">
          <div class="d-flex align-items-center gap-8 mb-1">
            <span class="toast-badge ${badgeClass} text-uppercase fw-bold" style="font-size: 10px; letter-spacing: 0.5px;">${badge}</span>
            <span class="text-subtle-custom" style="font-size: 11px;">${isDanger ? 'Action required' : 'Notification'}</span>
          </div>
          <div class="toast-message text-white" style="font-size: 13px;">${message}</div>
          ${retryBtnHtml}
        </div>
        <button type="button" class="btn-close btn-close-white flex-shrink-0" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
    `;

    container.appendChild(toastEl);
    if (window.bootstrap && window.bootstrap.Toast) {
      const inst = window.bootstrap.Toast.getOrCreateInstance(toastEl, {
        autohide,
        delay
      });
      inst.show();
    }
  };
  window.spawnToast = spawnToast;

  // =========================================================================
  // 12. UI STATES TESTING & AUTOMATION (?state=loading|empty|success|error)
  // =========================================================================
  const stateParam = urlParams.get('state');

  if (stateParam === 'loading') {
    // Show skeleton cards/rows, hide real containers
    const skeletonContainer = document.getElementById('skeleton-loading-container');
    const skeletonTable = document.getElementById('skeleton-table-card');
    const skeletonGrid = document.getElementById('skeleton-grid-cards');
    if (skeletonContainer) skeletonContainer.classList.remove('d-none');
    if (state.view === 'grid') {
      if (skeletonTable) skeletonTable.classList.add('d-none');
      if (skeletonGrid) skeletonGrid.classList.remove('d-none');
    } else {
      if (skeletonGrid) skeletonGrid.classList.add('d-none');
      if (skeletonTable) skeletonTable.classList.remove('d-none');
    }
    if (listViewContainer) listViewContainer.classList.add('d-none');
    if (gridViewContainer) gridViewContainer.classList.add('d-none');

    // Upload button disabled with spinner during upload
    const topbarUploadBtn = document.getElementById('topbarUploadBtn');
    if (topbarUploadBtn) {
      topbarUploadBtn.disabled = true;
      topbarUploadBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span><span>Uploading...</span>`;
    }
    const uploadSubmitBtn = document.getElementById('uploadSubmitBtn');
    if (uploadSubmitBtn) {
      uploadSubmitBtn.disabled = true;
      uploadSubmitBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span><span>Uploading to S3...</span>`;
    }
  } else if (stateParam === 'empty') {
    // Empty state: icon + one sentence + Upload CTA (no illustrations)
    if (listViewContainer) listViewContainer.classList.add('d-none');
    if (gridViewContainer) gridViewContainer.classList.add('d-none');
    const emptyStateCard = document.getElementById('empty-state-card');
    if (emptyStateCard) emptyStateCard.classList.remove('d-none');

    const statTotalFiles = document.getElementById('stat-total-files');
    if (statTotalFiles) statTotalFiles.textContent = '0';
    const statTotalStorage = document.getElementById('stat-total-storage');
    if (statTotalStorage) statTotalStorage.textContent = '0.00 KB';
    const statLargestSize = document.getElementById('stat-largest-size');
    if (statLargestSize) statLargestSize.textContent = '0.0 KB';
    const statLargestName = document.getElementById('stat-largest-name');
    if (statLargestName) statLargestName.textContent = 'None';
    const statNewestDate = document.getElementById('stat-newest-date');
    if (statNewestDate) statNewestDate.textContent = 'None';
    const statNewestName = document.getElementById('stat-newest-name');
    if (statNewestName) statNewestName.textContent = 'None';
    if (visibleCountBadge) visibleCountBadge.textContent = '0 files';
  } else if (stateParam === 'success') {
    // Success toast from flash messages
    spawnToast({
      type: 'success',
      badge: 'Success',
      message: 'Note "CS601_Distributed_Systems.pdf" uploaded successfully to AWS S3.'
    });
  } else if (stateParam === 'error') {
    // Error state: inline alert + toast with clear message and retry action
    const inlineAlert = document.getElementById('inline-error-alert');
    if (inlineAlert) inlineAlert.classList.remove('d-none');

    spawnToast({
      type: 'danger',
      badge: 'Error',
      message: 'AWS S3 Connection Failure: Unable to communicate with remote storage bucket. Verify credentials or connection.',
      retry: 'reload'
    });
  }

  // Support ?show_modal=upload or ?show_modal=delete for automated screenshot testing
  if (showModalParam === 'upload') {
    setTimeout(() => {
      const uploadModalEl = document.getElementById('uploadModal');
      if (uploadModalEl && window.bootstrap && window.bootstrap.Modal) {
        const uploadModal = window.bootstrap.Modal.getOrCreateInstance(uploadModalEl);
        uploadModal.show();
      }
    }, 200);
  } else if (showModalParam === 'delete') {
    setTimeout(() => {
      deleteFileNameDisplay('CS601_Distributed_Systems.pdf');
      if (deleteForm) {
        deleteForm.action = '/delete/CS601_Distributed_Systems.pdf';
      }
      if (deleteModalEl && window.bootstrap && window.bootstrap.Modal) {
        const deleteModal = window.bootstrap.Modal.getOrCreateInstance(deleteModalEl);
        deleteModal.show();
      }
    }, 200);
  }
});


