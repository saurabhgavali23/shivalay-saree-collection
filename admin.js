/**
 * ==============================================================================
 * SHIVALAY SAREE COLLECTION - ADMIN PANEL SCRIPT (admin.js)
 * ==============================================================================
 * Complete admin dashboard logic:
 * - Supabase Authentication (login, logout, session persistence across refresh)
 * - Saree CRUD operations (Create, Read, Update, Delete)
 * - Client-side image compression (Canvas resize to 1200px max, JPEG 0.8 quality)
 * - Video Support (Max 15MB, Max 60s duration validation, canvas poster extraction,
 *   direct Supabase Storage upload to 'saree-videos' or YouTube link embedding)
 * - Image reordering (left/right) with cover image designation and deletion
 * - Video and image cleanup from Supabase Storage on saree deletion
 * - Fast 1-click status toggle ("Mark Sold" / "Mark Available")
 * - 1-click saree duplication for quick entry of similar sarees
 * - Live search & filter within the admin inventory list
 * ==============================================================================
 */

(function () {
  'use strict';

  // ----------------------------------------------------------------------------
  // ADMIN STATE
  // ----------------------------------------------------------------------------
  const state = {
    supabaseClient: null,
    currentUser: null,
    allSarees: [],
    editingSareeId: null,      // null for 'Add' mode, number/string for 'Edit' mode
    currentPhotos: [],         // Array of { type: 'existing' | 'new', url?: string, blob?: Blob, previewUrl: string, file?: File }
    videoData: null,           // null | { type: 'existing' | 'new_file' | 'link', videoUrl?: string, posterUrl?: string, file?: File, posterBlob?: Blob, posterPreviewUrl?: string, duration?: number }
    searchQuery: '',
    filterStatus: 'all',
    filterCategory: 'all',
    orphanFiles: null,         // null until first scan, then array of orphan file objects
    isScanningOrphans: false,
    storageTotalFilesCount: 0,
    allReviews: [],
    selectedReviewSareeId: null,
    currentReviewPhotos: [],
    editingReviewId: null,
    formColors: [],            // Array of available colors added to currently edited saree
    statsEvents: null,         // Cached raw saree_events rows
    isLoadingStats: false
  };

  const PLACEHOLDER_IMG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='800' viewBox='0 0 600 800'%3E%3Crect fill='%23f4ede4' width='600' height='800'/%3E%3Ctext fill='%239c9389' font-family='sans-serif' font-size='24' font-weight='600' x='50%25' y='50%25' text-anchor='middle'%3ENo Photo%3C/text%3E%3C/svg%3E";

  // ----------------------------------------------------------------------------
  // DOM REFERENCES
  // ----------------------------------------------------------------------------
  const dom = {};

  function cacheDom() {
    // Navigation & Auth Header
    dom.adminShopTitle = document.getElementById('admin-shop-title');
    dom.adminUserEmail = document.getElementById('admin-user-email');
    dom.headerStatsBtn = document.getElementById('header-stats-btn');
    dom.btnLogout = document.getElementById('btn-logout');

    // Views
    dom.authView = document.getElementById('auth-view');
    dom.dashboardView = document.getElementById('dashboard-view');

    // Login Form
    dom.loginForm = document.getElementById('login-form');
    dom.loginEmail = document.getElementById('login-email');
    dom.loginPassword = document.getElementById('login-password');
    dom.loginAlert = document.getElementById('login-alert');
    dom.btnLogin = document.getElementById('btn-login');

    // Tabs
    dom.adminTabsNav = document.querySelector('.admin-tabs');
    dom.tabFormBtn = document.getElementById('tab-form-btn');
    dom.tabListBtn = document.getElementById('tab-list-btn');
    dom.tabReviewsBtn = document.getElementById('tab-reviews-btn');
    dom.tabCleanupBtn = document.getElementById('tab-cleanup-btn');
    dom.tabStatsBtn = document.getElementById('tab-stats-btn');
    dom.tabFormContent = document.getElementById('tab-form-content');
    dom.tabListContent = document.getElementById('tab-list-content');
    dom.tabReviewsContent = document.getElementById('tab-reviews-content');
    dom.tabCleanupContent = document.getElementById('tab-cleanup-content');
    dom.tabStatsContent = document.getElementById('tab-stats-content');
    dom.totalSareesCount = document.getElementById('total-sarees-count');
    dom.totalReviewsCount = document.getElementById('total-reviews-count');
    dom.orphanTabBadge = document.getElementById('orphan-tab-badge');
    dom.formTabLabel = document.getElementById('form-tab-label');

    // Stats DOM
    dom.statsBannerNotice = document.getElementById('stats-banner-notice');
    dom.btnRefreshStats = document.getElementById('btn-refresh-stats');
    dom.btnPurgeOldEvents = document.getElementById('btn-purge-old-events');
    dom.btnPurgeOldEventsBottom = document.getElementById('btn-purge-old-events-bottom');
    dom.statsDailyChartWrap = document.getElementById('stats-daily-chart-wrap');
    dom.statsTopViewedList = document.getElementById('stats-top-viewed-list');
    dom.statsTopClickedList = document.getElementById('stats-top-clicked-list');
    dom.statsNoClicksList = document.getElementById('stats-no-clicks-list');

    // Reviews DOM
    dom.reviewSareeSelect = document.getElementById('review-saree-select');
    dom.reviewFormWrap = document.getElementById('review-form-wrap');
    dom.sareeReviewForm = document.getElementById('saree-review-form');
    dom.reviewEditId = document.getElementById('review-edit-id');
    dom.reviewFormTitle = document.getElementById('review-form-title');
    dom.inputReviewName = document.getElementById('input-review-name');
    dom.inputReviewRating = document.getElementById('input-review-rating');
    dom.inputReviewComment = document.getElementById('input-review-comment');
    dom.reviewPhotoFileInput = document.getElementById('review-photo-file-input');
    dom.btnChooseReviewPhotos = document.getElementById('btn-choose-review-photos');
    dom.inputReviewPhotoUrl = document.getElementById('input-review-photo-url');
    dom.btnAddReviewPhotoUrl = document.getElementById('btn-add-review-photo-url');
    dom.reviewPhotosPreviewGrid = document.getElementById('review-photos-preview-grid');
    dom.inputReviewVideoUrl = document.getElementById('input-review-video-url');
    dom.btnSaveReview = document.getElementById('btn-save-review');
    dom.btnCancelReviewEdit = document.getElementById('btn-cancel-review-edit');
    dom.selectedSareeReviewsCount = document.getElementById('selected-saree-reviews-count');
    dom.selectedSareeReviewsList = document.getElementById('selected-saree-reviews-list');

    // Saree Form
    dom.sareeForm = document.getElementById('saree-form');
    dom.formSectionTitle = document.getElementById('form-section-title');
    dom.formSectionDesc = document.getElementById('form-section-desc');
    dom.btnCancelEdit = document.getElementById('btn-cancel-edit');
    dom.sareeEditId = document.getElementById('saree-edit-id');
    dom.btnSaveSaree = document.getElementById('btn-save-saree');
    dom.btnSaveLabel = document.getElementById('btn-save-label');

    // Photo inputs & Preview
    dom.imageFilesInput = document.getElementById('image-files-input');
    dom.cameraFileInput = document.getElementById('camera-file-input');
    dom.btnChoosePhotos = document.getElementById('btn-choose-photos');
    dom.btnTakePhoto = document.getElementById('btn-take-photo');
    dom.photoPreviewGrid = document.getElementById('photo-preview-grid');

    // Video Elements
    dom.btnModeVideoUpload = document.getElementById('btn-mode-video-upload');
    dom.btnModeVideoLink = document.getElementById('btn-mode-video-link');
    dom.videoUploadPane = document.getElementById('video-upload-pane');
    dom.videoLinkPane = document.getElementById('video-link-pane');
    dom.videoFileInput = document.getElementById('video-file-input');
    dom.videoCameraInput = document.getElementById('video-camera-input');
    dom.btnChooseVideo = document.getElementById('btn-choose-video');
    dom.btnRecordVideo = document.getElementById('btn-record-video');
    dom.inputVideoLink = document.getElementById('input-video-link');
    dom.btnApplyVideoLink = document.getElementById('btn-apply-video-link');
    dom.videoPreviewWrap = document.getElementById('video-preview-wrap');
    dom.videoPreviewPlayer = document.getElementById('video-preview-player');
    dom.videoPreviewThumb = document.getElementById('video-preview-thumb');
    dom.videoPreviewInfo = document.getElementById('video-preview-info');
    dom.btnRemoveVideo = document.getElementById('btn-remove-video');
    dom.videoHiddenValidator = document.getElementById('video-hidden-validator');
    dom.videoPosterCanvas = document.getElementById('video-poster-canvas');
    dom.sareeVideoUrl = document.getElementById('saree-video-url');
    dom.sareeVideoPoster = document.getElementById('saree-video-poster');

    // Progress Bar
    dom.uploadProgressWrap = document.getElementById('upload-progress-wrap');
    dom.progressStatusText = document.getElementById('progress-status-text');
    dom.progressPercentText = document.getElementById('progress-percent-text');
    dom.progressBarFill = document.getElementById('progress-bar-fill');

    // Supplier Message & Auto-fill
    dom.inputSupplierText = document.getElementById('input-supplier-text');
    dom.btnAutofillMessage = document.getElementById('btn-autofill-message');
    dom.btnClearSupplierText = document.getElementById('btn-clear-supplier-text');
    dom.chkOverwriteExisting = document.getElementById('chk-overwrite-existing');
    dom.autofillStatusBanner = document.getElementById('autofill-status-banner');

    // Cost, Margin & Pricing Controls
    dom.inputCostPrice = document.getElementById('input-cost-price');
    dom.selectMarginType = document.getElementById('select-margin-type');
    dom.inputMarginVal = document.getElementById('input-margin-val');
    dom.marginCalcPreview = document.getElementById('margin-calc-preview');
    dom.priceAlternativesWrap = document.getElementById('price-alternatives-wrap');

    // Dimensions & Blouse
    dom.inputLength = document.getElementById('input-length');
    dom.inputWidth = document.getElementById('input-width');
    dom.inputBlouse = document.getElementById('input-blouse');

    // Color Chips & Multi-Color Manager
    dom.colorSuggestionsWrap = document.getElementById('color-suggestions-wrap');
    dom.colorChipsList = document.getElementById('color-chips-list');
    dom.btnAddColor = document.getElementById('btn-add-color');
    dom.adminColorTagsWrap = document.getElementById('admin-color-tags-wrap');
    dom.adminColorTagsList = document.getElementById('admin-color-tags-list');
    dom.adminColorTagsHint = document.getElementById('admin-color-tags-hint');
    dom.colorPresetsList = document.getElementById('color-presets-list');

    // Form Fields
    dom.inputName = document.getElementById('input-name');
    dom.inputPrice = document.getElementById('input-price');
    dom.inputShipping = document.getElementById('input-shipping');
    dom.inputFabric = document.getElementById('input-fabric');
    dom.inputCategory = document.getElementById('input-category');
    dom.inputStatus = document.getElementById('input-status');
    dom.inputColor = document.getElementById('input-color');
    dom.inputPattern = document.getElementById('input-pattern');
    dom.inputBorder = document.getElementById('input-border');
    dom.inputOccasion = document.getElementById('input-occasion');
    dom.inputDescription = document.getElementById('input-description');
    dom.fabricSuggestionsList = document.getElementById('fabric-suggestions-list');
    dom.categorySuggestionsList = document.getElementById('category-suggestions-list');

    // List & Inventory
    dom.btnRefreshList = document.getElementById('btn-refresh-list');
    dom.adminSearchInput = document.getElementById('admin-search-input');
    dom.adminStatusFilter = document.getElementById('admin-status-filter');
    dom.adminCategoryFilter = document.getElementById('admin-category-filter');
    dom.adminSareeList = document.getElementById('admin-saree-list');

    // Toast
    dom.adminToast = document.getElementById('admin-toast');
    dom.adminToastMessage = document.getElementById('admin-toast-message');

    // Storage Cleanup DOM
    dom.btnScanOrphans = document.getElementById('btn-scan-orphans');
    dom.btnScanOrphansEmpty = document.getElementById('btn-scan-orphans-empty');
    dom.orphanSummaryGrid = document.getElementById('orphan-summary-grid');
    dom.statTotalStorageFiles = document.getElementById('stat-total-storage-files');
    dom.statActiveFiles = document.getElementById('stat-active-files');
    dom.statOrphanFiles = document.getElementById('stat-orphan-files');
    dom.statOrphanSize = document.getElementById('stat-orphan-size');
    dom.orphanToolbar = document.getElementById('orphan-toolbar');
    dom.orphanSelectAll = document.getElementById('orphan-select-all');
    dom.orphanSelectedCountLabel = document.getElementById('orphan-selected-count-label');
    dom.btnDeleteSelectedOrphans = document.getElementById('btn-delete-selected-orphans');
    dom.btnDeleteAllOrphans = document.getElementById('btn-delete-all-orphans');
    dom.orphanFilesList = document.getElementById('orphan-files-list');
  }

  // ----------------------------------------------------------------------------
  // UTILITIES
  // ----------------------------------------------------------------------------
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatPrice(num) {
    const amount = Number(num) || 0;
    if (amount <= 0) return `${CONFIG.CURRENCY_SYMBOL}—`;
    return `${CONFIG.CURRENCY_SYMBOL}${new Intl.NumberFormat('en-US').format(amount)}`;
  }

  function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function formatDate(isoString) {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch (e) {
      return isoString;
    }
  }

  function getFilenameFromUrl(url) {
    if (!url || typeof url !== 'string') return '';
    try {
      const clean = url.split('?')[0].split('#')[0];
      const part = clean.split('/').pop();
      return decodeURIComponent(part || '').trim();
    } catch (e) {
      return (url.split('/').pop() || '').trim();
    }
  }

  function showToast(msg) {
    if (!dom.adminToast) return;
    dom.adminToastMessage.textContent = msg;
    dom.adminToast.classList.add('show');
    clearTimeout(dom.adminToast._timer);
    dom.adminToast._timer = setTimeout(() => {
      dom.adminToast.classList.remove('show');
    }, 3000);
  }

  function setProgress(status, percent) {
    if (!dom.uploadProgressWrap) return;
    if (percent === null) {
      dom.uploadProgressWrap.classList.remove('visible');
      return;
    }
    dom.uploadProgressWrap.classList.add('visible');
    dom.progressStatusText.textContent = status;
    dom.progressPercentText.textContent = `${Math.round(percent)}%`;
    dom.progressBarFill.style.width = `${percent}%`;
  }

  // ----------------------------------------------------------------------------
  // CLIENT-SIDE IMAGE COMPRESSION (CANVAS)
  // ----------------------------------------------------------------------------
  function compressImage(file, maxDimension = 1200, quality = 0.8) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = e => {
        const img = new Image();
        img.src = e.target.result;
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(blob => {
            if (!blob) return reject(new Error('Canvas compression failed'));
            resolve({
              blob: blob,
              previewUrl: canvas.toDataURL('image/jpeg', quality)
            });
          }, 'image/jpeg', quality);
        };
        img.onerror = () => reject(new Error('Failed to load image for compression'));
      };
      reader.onerror = () => reject(new Error('Failed to read image file'));
    });
  }

  // ----------------------------------------------------------------------------
  // CLIENT-SIDE VIDEO VALIDATION & POSTER EXTRACTION
  // ----------------------------------------------------------------------------
  /**
   * Validates video size (<= 15MB) and duration (<= 60 seconds),
   * and draws the first frame to canvas to produce a JPEG poster.
   */
  function validateAndExtractPoster(file) {
    const maxMb = CONFIG.MAX_VIDEO_SIZE_MB || 15;
    const maxDuration = CONFIG.MAX_VIDEO_DURATION_SEC || 60;

    // 1. File size check
    if (file.size > maxMb * 1024 * 1024) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      return Promise.reject(new Error(`Video is too large (${sizeMb} MB). Maximum allowed is ${maxMb} MB. Record at 720p or trim it.`));
    }

    return new Promise((resolve, reject) => {
      const video = dom.videoHiddenValidator;
      const objUrl = URL.createObjectURL(file);
      video.src = objUrl;
      video.muted = true;
      video.playsInline = true;

      const timeoutId = setTimeout(() => {
        URL.revokeObjectURL(objUrl);
        reject(new Error('Video validation timed out. Ensure the file is a valid MP4 or WebM video.'));
      }, 10000);

      video.onloadedmetadata = () => {
        const duration = video.duration;
        // Allow slight wiggle room of 0.5s for camera recording
        if (duration > maxDuration + 0.5) {
          clearTimeout(timeoutId);
          URL.revokeObjectURL(objUrl);
          return reject(new Error(`Video is too long (${duration.toFixed(1)}s). Maximum allowed is ${maxDuration} seconds. Record at 720p or trim it.`));
        }

        // Seek slightly forward to capture a vibrant non-black frame
        video.currentTime = Math.min(0.2, duration / 2);
      };

      video.onseeked = () => {
        clearTimeout(timeoutId);
        try {
          const canvas = dom.videoPosterCanvas;
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 360;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          canvas.toBlob(blob => {
            const posterPreviewUrl = canvas.toDataURL('image/jpeg', 0.8);
            URL.revokeObjectURL(objUrl);

            resolve({
              duration: video.duration,
              posterBlob: blob,
              posterPreviewUrl: posterPreviewUrl
            });
          }, 'image/jpeg', 0.8);
        } catch (err) {
          URL.revokeObjectURL(objUrl);
          reject(err);
        }
      };

      video.onerror = () => {
        clearTimeout(timeoutId);
        URL.revokeObjectURL(objUrl);
        reject(new Error('Failed to read video file. Please ensure it is in MP4 or WebM format.'));
      };
    });
  }

  // ----------------------------------------------------------------------------
  // INITIALIZATION
  // ----------------------------------------------------------------------------
  async function initAdmin() {
    cacheDom();

    if (dom.adminShopTitle) dom.adminShopTitle.textContent = CONFIG.SHOP_NAME;
    const adminLogoIcon = document.getElementById('admin-logo-icon');
    if (adminLogoIcon && CONFIG.ICON_URL) {
      adminLogoIcon.src = CONFIG.ICON_URL;
      adminLogoIcon.alt = CONFIG.SHOP_NAME;
    }

    // Datalists
    if (dom.fabricSuggestionsList && CONFIG.FABRIC_SUGGESTIONS) {
      dom.fabricSuggestionsList.innerHTML = CONFIG.FABRIC_SUGGESTIONS
        .map(f => `<option value="${escapeHtml(f)}">`).join('');
    }
    if (dom.categorySuggestionsList && CONFIG.CATEGORY_SUGGESTIONS) {
      dom.categorySuggestionsList.innerHTML = CONFIG.CATEGORY_SUGGESTIONS
        .map(c => `<option value="${escapeHtml(c)}">`).join('');
    }

    // Initialize Margin Settings & Pricing Calculator
    initMarginSettings();
    updateSellingPriceFromMargin(true);

    // Initialize Multi-Color Tags & Presets
    renderAdminColorTags();

    // Verify Supabase
    if (!CONFIG.SUPABASE_URL || CONFIG.SUPABASE_URL.includes('YOUR_PROJECT_ID') || !window.supabase) {
      showLoginAlert('Supabase credentials missing! Configure SUPABASE_URL and SUPABASE_ANON_KEY in config.js.');
      return;
    }

    try {
      state.supabaseClient = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
    } catch (e) {
      showLoginAlert('Failed to initialize Supabase: ' + e.message);
      return;
    }

    setupEventListeners();

    // Check active session
    try {
      const { data: { session } } = await state.supabaseClient.auth.getSession();
      if (session && session.user) {
        setLoggedIn(session.user);
      } else {
        setLoggedOut();
      }
    } catch (err) {
      setLoggedOut();
    }

    state.supabaseClient.auth.onAuthStateChange((event, session) => {
      if (session && session.user) {
        setLoggedIn(session.user);
      } else {
        setLoggedOut();
      }
    });
  }

  // ----------------------------------------------------------------------------
  // AUTHENTICATION
  // ----------------------------------------------------------------------------
  function setLoggedIn(user) {
    state.currentUser = user;
    try {
      localStorage.setItem('msc_admin_logged_in', '1');
    } catch (e) {}

    if (dom.authView) dom.authView.style.display = 'none';
    if (dom.dashboardView) dom.dashboardView.classList.add('active');
    if (dom.btnLogout) dom.btnLogout.style.display = 'inline-flex';
    if (dom.headerStatsBtn) dom.headerStatsBtn.style.display = 'inline-flex';
    if (dom.adminUserEmail) dom.adminUserEmail.textContent = user.email || 'Admin';

    loadAllSarees();
    checkUrlHashTab();
  }

  function setLoggedOut() {
    state.currentUser = null;
    state.orphanFiles = null;
    try {
      localStorage.removeItem('msc_admin_logged_in');
    } catch (e) {}

    if (dom.authView) dom.authView.style.display = 'flex';
    if (dom.dashboardView) dom.dashboardView.classList.remove('active');
    if (dom.btnLogout) dom.btnLogout.style.display = 'none';
    if (dom.headerStatsBtn) dom.headerStatsBtn.style.display = 'none';
    if (dom.adminUserEmail) dom.adminUserEmail.textContent = '';
    if (dom.orphanTabBadge) dom.orphanTabBadge.textContent = 'Scan';
  }

  function showLoginAlert(msg) {
    if (!dom.loginAlert) return;
    dom.loginAlert.textContent = msg;
    dom.loginAlert.classList.add('visible');
  }

  function hideLoginAlert() {
    if (!dom.loginAlert) return;
    dom.loginAlert.classList.remove('visible');
  }

  async function handleLogin(e) {
    e.preventDefault();
    hideLoginAlert();

    const email = dom.loginEmail.value.trim();
    const password = dom.loginPassword.value;

    if (!email || !password) {
      showLoginAlert('Please enter both email and password.');
      return;
    }

    dom.btnLogin.disabled = true;
    dom.btnLogin.textContent = 'Authenticating...';

    try {
      const { data, error } = await state.supabaseClient.auth.signInWithPassword({
        email: email,
        password: password
      });

      if (error) {
        showLoginAlert(error.message || 'Invalid login credentials.');
      } else if (data && data.user) {
        setLoggedIn(data.user);
        showToast('Signed in successfully!');
      }
    } catch (err) {
      showLoginAlert('Login error: ' + (err.message || 'Please check your connection.'));
    } finally {
      dom.btnLogin.disabled = false;
      dom.btnLogin.textContent = 'Sign In to Dashboard';
    }
  }

  async function handleLogout() {
    if (!state.supabaseClient) return;
    try {
      await state.supabaseClient.auth.signOut();
      showToast('Logged out.');
      setLoggedOut();
    } catch (e) {
      console.warn('Logout error:', e);
    }
  }

  // ----------------------------------------------------------------------------
  // PHOTO PICKER & REORDERING
  // ----------------------------------------------------------------------------
  async function handleFilesSelected(fileList) {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;

    setProgress(`Optimizing ${files.length} photo${files.length > 1 ? 's' : ''}...`, 15);

    let processedCount = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isImg = (file.type && file.type.startsWith('image/')) ||
                    /\.(jpe?g|png|webp|gif|bmp|heic|heif|jfif)$/i.test(file.name || '') ||
                    !file.type;
      if (!isImg) {
        console.warn('Skipping non-image file:', file.name, file.type);
        continue;
      }

      const currentStep = i + 1;
      const progressPct = Math.round(15 + (currentStep / files.length) * 75);
      setProgress(`Optimizing photo ${currentStep} of ${files.length}...`, progressPct);

      try {
        const { blob, previewUrl } = await compressImage(file, 1200, 0.8);
        state.currentPhotos.push({
          type: 'new',
          file: file,
          blob: blob,
          previewUrl: previewUrl
        });
        processedCount++;
      } catch (err) {
        console.warn(`Compression fallback for ${file.name}:`, err);
        try {
          const fallbackUrl = URL.createObjectURL(file);
          state.currentPhotos.push({
            type: 'new',
            file: file,
            blob: file,
            previewUrl: fallbackUrl
          });
          processedCount++;
        } catch (fallbackErr) {
          console.error('Failed to process image:', file.name, fallbackErr);
          showToast(`Could not process photo: ${file.name}`);
        }
      }
    }

    setProgress(null, null);
    renderPhotoPreviews();

    if (processedCount > 0) {
      showToast(`${processedCount} photo${processedCount > 1 ? 's' : ''} added! Total: ${state.currentPhotos.length}`);
    }

    if (state.currentPhotos.length > 0) {
      triggerPhotoColorDetection(state.currentPhotos[0]);
    }
  }

  function renderPhotoPreviews() {
    if (!dom.photoPreviewGrid) return;

    if (state.currentPhotos.length === 0) {
      dom.photoPreviewGrid.innerHTML = `
        <div style="grid-column: 1 / -1; font-size: 0.85rem; color: #94a3b8; text-align: center; padding: 1rem;">
          No photos selected yet. Tap above to add photos.
        </div>
      `;
      return;
    }

    dom.photoPreviewGrid.innerHTML = state.currentPhotos.map((photo, idx) => {
      const isCover = idx === 0;
      const previewSrc = photo.type === 'existing' ? photo.url : photo.previewUrl;

      return `
        <div class="photo-preview-card ${isCover ? 'is-cover' : ''}" data-index="${idx}">
          ${isCover ? '<span class="cover-badge">★ MAIN COVER</span>' : ''}
          <img src="${escapeHtml(previewSrc)}" alt="Photo ${idx + 1}" class="photo-preview-img">
          
          <div class="photo-actions-overlay">
            <button type="button" class="btn-photo-action btn-move-left" data-index="${idx}" title="Move earlier" ${idx === 0 ? 'disabled style="opacity:0.3;"' : ''}>
              ←
            </button>
            <button type="button" class="btn-photo-action btn-move-right" data-index="${idx}" title="Move later" ${idx === state.currentPhotos.length - 1 ? 'disabled style="opacity:0.3;"' : ''}>
              →
            </button>
            <button type="button" class="btn-photo-action btn-photo-delete" data-index="${idx}" title="Remove photo">
              ×
            </button>
          </div>
        </div>
      `;
    }).join('');

    dom.photoPreviewGrid.querySelectorAll('.btn-move-left').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-index'), 10);
        if (idx > 0) {
          const temp = state.currentPhotos[idx];
          state.currentPhotos[idx] = state.currentPhotos[idx - 1];
          state.currentPhotos[idx - 1] = temp;
          renderPhotoPreviews();
        }
      });
    });

    dom.photoPreviewGrid.querySelectorAll('.btn-move-right').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-index'), 10);
        if (idx < state.currentPhotos.length - 1) {
          const temp = state.currentPhotos[idx];
          state.currentPhotos[idx] = state.currentPhotos[idx + 1];
          state.currentPhotos[idx + 1] = temp;
          renderPhotoPreviews();
        }
      });
    });

    dom.photoPreviewGrid.querySelectorAll('.btn-photo-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-index'), 10);
        state.currentPhotos.splice(idx, 1);
        renderPhotoPreviews();
      });
    });
  }

  // ----------------------------------------------------------------------------
  // MULTI-COLOR SELECTION & PRESET MANAGEMENT
  // ----------------------------------------------------------------------------
  const COLOR_PRESETS = [
    'Red', 'Maroon', 'Wine', 'Pink', 'Rani Pink', 'Orange', 'Rust', 'Yellow', 'Mustard',
    'Green', 'Bottle Green', 'Pista Green', 'Teal', 'Royal Blue', 'Navy Blue',
    'Purple', 'Brown', 'Black', 'White', 'Cream', 'Gold', 'Multicolor'
  ];

  function getColorSwatchHelper(name) {
    if (typeof getColorSwatch === 'function') return getColorSwatch(name);
    return '#94a3b8';
  }

  function renderAdminColorTags() {
    if (!dom.adminColorTagsList) return;
    if (!state.formColors || state.formColors.length === 0) {
      dom.adminColorTagsList.innerHTML = `<span style="font-size: 0.74rem; color: #94a3b8; font-style: italic;">No colors added yet. Type a color name or click a quick preset below.</span>`;
      if (dom.adminColorTagsHint) dom.adminColorTagsHint.style.display = 'none';
      if (dom.inputColor) dom.inputColor.value = '';
      renderColorPresets();
      return;
    }

    dom.adminColorTagsList.innerHTML = state.formColors.map((colorName, idx) => {
      const isPrimary = idx === 0;
      const swatch = getColorSwatchHelper(colorName);
      const swatchStyle = swatch.startsWith('linear') ? `background: ${swatch};` : `background-color: ${swatch};`;
      const isLight = ['white', 'cream', 'off white', 'beige'].includes(colorName.toLowerCase());
      return `
        <span class="admin-color-tag-pill ${isPrimary ? 'is-primary' : ''}">
          <span class="admin-color-tag-swatch ${isLight ? 'is-light' : ''}" style="${swatchStyle}"></span>
          <span>${escapeHtml(colorName)}</span>
          ${isPrimary ? '<small style="color: #b45309; font-size: 0.65rem; font-weight: 700;" title="Default Color">★ Primary</small>' : ''}
          <button type="button" class="btn-remove-color-tag" data-color-idx="${idx}" aria-label="Remove ${escapeHtml(colorName)}">×</button>
        </span>
      `;
    }).join('');

    if (dom.adminColorTagsHint) {
      dom.adminColorTagsHint.style.display = state.formColors.length > 1 ? 'block' : 'none';
    }

    // Keep inputColor in sync for form submission validity
    if (dom.inputColor) {
      dom.inputColor.value = state.formColors.join(', ');
    }

    dom.adminColorTagsList.querySelectorAll('.btn-remove-color-tag').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.getAttribute('data-color-idx'), 10);
        if (!isNaN(idx)) {
          state.formColors.splice(idx, 1);
          renderAdminColorTags();
        }
      });
    });

    renderColorPresets();
  }

  function addColorTag(name) {
    if (!name) return;
    const trimmed = String(name).trim();
    if (!trimmed) return;
    if (!state.formColors) state.formColors = [];
    const exists = state.formColors.some(c => c.toLowerCase() === trimmed.toLowerCase());
    if (!exists) {
      state.formColors.push(trimmed);
      renderAdminColorTags();
    }
  }

  function setColorTags(colorsArray) {
    if (Array.isArray(colorsArray)) {
      state.formColors = colorsArray.map(c => String(c).trim()).filter(Boolean);
    } else if (typeof colorsArray === 'string') {
      state.formColors = colorsArray.split(/[,/|]+/).map(c => c.trim()).filter(Boolean);
    } else {
      state.formColors = [];
    }
    renderAdminColorTags();
  }

  function renderColorPresets() {
    if (!dom.colorPresetsList) return;
    const currentLower = (state.formColors || []).map(c => c.toLowerCase());
    dom.colorPresetsList.innerHTML = COLOR_PRESETS.map(presetName => {
      const isAdded = currentLower.includes(presetName.toLowerCase());
      const swatch = getColorSwatchHelper(presetName);
      const swatchStyle = swatch.startsWith('linear') ? `background: ${swatch};` : `background-color: ${swatch};`;
      const isLight = ['white', 'cream', 'off white', 'beige'].includes(presetName.toLowerCase());
      return `
        <button type="button" class="btn-color-preset ${isAdded ? 'is-added' : ''}" data-preset="${escapeHtml(presetName)}">
          <span class="color-swatch-circle ${isLight ? 'is-light' : ''}" style="width: 10px; height: 10px; ${swatchStyle}"></span>
          <span>${escapeHtml(presetName)}</span>
          <span style="font-size: 0.65rem;">${isAdded ? '✓' : '＋'}</span>
        </button>
      `;
    }).join('');

    dom.colorPresetsList.querySelectorAll('.btn-color-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = btn.getAttribute('data-preset');
        if (!p) return;
        const idx = (state.formColors || []).findIndex(c => c.toLowerCase() === p.toLowerCase());
        if (idx >= 0) {
          state.formColors.splice(idx, 1);
        } else {
          if (!state.formColors) state.formColors = [];
          state.formColors.push(p);
        }
        renderAdminColorTags();
      });
    });
  }

  // ----------------------------------------------------------------------------
  // PHOTO COLOR DETECTION (CANVAS-BASED 50x50 CLUSTERING & HSL MAPPING)
  // ----------------------------------------------------------------------------
  async function triggerPhotoColorDetection(photoObj) {
    if (!photoObj || typeof extractColorsFromImage !== 'function') return;
    const src = photoObj.type === 'existing' ? photoObj.url : (photoObj.previewUrl || photoObj.blob);
    if (!src) return;

    try {
      const result = await extractColorsFromImage(src);
      if (!result) return;

      const overwrite = dom.chkOverwriteExisting ? dom.chkOverwriteExisting.checked : false;
      const hasColors = state.formColors && state.formColors.length > 0;

      // Auto-add dominant color if empty or overwrite checked
      if (result.dominant && (!hasColors || overwrite)) {
        addColorTag(result.dominant);
        if (dom.inputColor) markField(dom.inputColor, 'autofill');
      }

      // Render top suggestions as clickable chips
      if (dom.colorSuggestionsWrap && dom.colorChipsList) {
        const chips = Array.isArray(result.suggestions) && result.suggestions.length > 0
          ? result.suggestions
          : (result.dominant ? [result.dominant] : []);

        if (chips.length > 0) {
          dom.colorChipsList.innerHTML = chips.map(cName => {
            const isSelected = (state.formColors || []).some(c => c.toLowerCase() === cName.toLowerCase());
            return `<button type="button" class="btn-color-chip ${isSelected ? 'active' : ''}" data-color="${escapeHtml(cName)}">＋ ${escapeHtml(cName)}</button>`;
          }).join('');

          dom.colorSuggestionsWrap.style.display = 'flex';

          dom.colorChipsList.querySelectorAll('.btn-color-chip').forEach(btn => {
            btn.addEventListener('click', () => {
              const c = btn.getAttribute('data-color');
              if (c) {
                addColorTag(c);
                btn.classList.add('active');
                showToast(`Color added: ${c}`);
              }
            });
          });
        }
      }
    } catch (err) {
      console.warn('Color detection from photo failed:', err);
    }
  }

  // ----------------------------------------------------------------------------
  // PRICING & MARGIN CALCULATOR (100% PRIVATE BUYING COST)
  // ----------------------------------------------------------------------------
  function initMarginSettings() {
    const defaultMargin = (typeof CONFIG !== 'undefined' && CONFIG.DEFAULT_MARGIN)
      ? CONFIG.DEFAULT_MARGIN
      : { TYPE: 'flat', VALUE: 300 };

    const savedType = localStorage.getItem('msc_admin_margin_type') || defaultMargin.TYPE || 'flat';
    const savedVal = localStorage.getItem('msc_admin_margin_value') || String(defaultMargin.VALUE || 300);

    if (dom.selectMarginType) dom.selectMarginType.value = savedType;
    if (dom.inputMarginVal) dom.inputMarginVal.value = savedVal;
  }

  function updateSellingPriceFromMargin(costOnlyUpdate = false) {
    if (!dom.inputCostPrice || !dom.inputPrice) return;
    const cost = parseFloat(dom.inputCostPrice.value);
    const mType = dom.selectMarginType ? dom.selectMarginType.value : 'flat';
    const mVal = dom.inputMarginVal ? (parseFloat(dom.inputMarginVal.value) || 0) : 0;

    // Persist margin preference in localStorage
    if (dom.selectMarginType) localStorage.setItem('msc_admin_margin_type', mType);
    if (dom.inputMarginVal) localStorage.setItem('msc_admin_margin_value', String(mVal));

    if (isNaN(cost) || cost <= 0) {
      if (dom.marginCalcPreview) {
        dom.marginCalcPreview.innerHTML = 'Selling = Cost + Margin';
      }
      return;
    }

    let calculated = 0;
    if (mType === 'percent') {
      calculated = cost + (cost * (mVal / 100));
    } else {
      calculated = cost + mVal;
    }

    // Round to nearest 10 (e.g. 1270 + 300 = 1570, 1273 -> 1270)
    const roundedSelling = Math.round(calculated / 10) * 10;

    if (!costOnlyUpdate) {
      dom.inputPrice.value = roundedSelling;
    }

    if (dom.marginCalcPreview) {
      const marginLabel = mType === 'percent' ? `${mVal}%` : `₹${mVal}`;
      const currSelling = parseFloat(dom.inputPrice.value) || roundedSelling;
      const actualDiff = Math.round(currSelling - cost);
      dom.marginCalcPreview.innerHTML = `Selling: <strong>₹${currSelling}</strong> (Cost ₹${cost} + ${marginLabel} → Profit ₹${actualDiff})`;
    }
  }

  function handleManualSellingPriceChange() {
    if (!dom.inputCostPrice || !dom.marginCalcPreview) return;
    const cost = parseFloat(dom.inputCostPrice.value);
    const selling = parseFloat(dom.inputPrice.value);
    if (!isNaN(cost) && cost > 0 && !isNaN(selling) && selling > 0) {
      const diff = Math.round(selling - cost);
      const pct = Math.round((diff / cost) * 100);
      dom.marginCalcPreview.innerHTML = `Selling: <strong>₹${selling}</strong> (Manual: Profit ₹${diff} / ${pct}%)`;
    }
  }

  // ----------------------------------------------------------------------------
  // SUPPLIER MESSAGE AUTO-FILL LOGIC
  // ----------------------------------------------------------------------------
  function clearFieldFeedback(container) {
    if (!container) return;
    container.querySelectorAll('.field-feedback-wrap').forEach(el => el.remove());
    container.querySelectorAll('.field-autofilled, .field-uncertain').forEach(el => {
      el.classList.remove('field-autofilled', 'field-uncertain');
    });
  }

  function markField(inputElem, status, message) {
    if (!inputElem) return;
    const parent = inputElem.parentElement;
    if (!parent) return;

    const old = parent.querySelector('.field-feedback-wrap');
    if (old) old.remove();

    inputElem.classList.remove('field-autofilled', 'field-uncertain');

    const wrap = document.createElement('div');
    wrap.className = 'field-feedback-wrap';

    if (status === 'autofill') {
      inputElem.classList.add('field-autofilled');
      wrap.innerHTML = `<span style="font-size: 0.72rem; color: #16a34a; font-weight: 600;">✓ Auto-filled</span>`;
    } else if (status === 'uncertain') {
      inputElem.classList.add('field-uncertain');
      wrap.innerHTML = `<span class="field-uncertain-badge">⚠️ Check this: ${escapeHtml(message || 'Uncertain')}</span>`;
    } else if (status === 'not-found') {
      wrap.innerHTML = `<span class="field-not-found-hint">— Not detected in message</span>`;
    }
    parent.appendChild(wrap);
  }

  function handleAutoFillFromMessage() {
    if (!dom.inputSupplierText) return;
    const rawText = dom.inputSupplierText.value.trim();
    if (!rawText) {
      showToast('Please paste a WhatsApp message first.');
      dom.inputSupplierText.focus();
      return;
    }

    if (typeof parseSareeText !== 'function') {
      showToast('Parser module not available.');
      return;
    }

    const overwrite = dom.chkOverwriteExisting ? dom.chkOverwriteExisting.checked : false;
    const parsed = parseSareeText(rawText);

    // Clear old feedback
    clearFieldFeedback(dom.sareeForm);
    if (dom.priceAlternativesWrap) {
      dom.priceAlternativesWrap.innerHTML = '';
      dom.priceAlternativesWrap.style.display = 'none';
    }

    const filledFields = [];
    const uncertainFields = [];
    const notFoundFields = [];

    function applyField(inputElem, fieldKey, val, isUncertain = false, uncertainReason = '') {
      if (!inputElem) return;
      const hasExisting = Boolean(inputElem.value && inputElem.value.trim() !== '' && inputElem.value !== '0');

      if (val !== null && val !== undefined && val !== '') {
        if (!hasExisting || overwrite) {
          inputElem.value = val;
          if (isUncertain) {
            markField(inputElem, 'uncertain', uncertainReason);
            uncertainFields.push(fieldKey);
          } else {
            markField(inputElem, 'autofill');
            filledFields.push(fieldKey);
          }
        }
      } else {
        if (!hasExisting) {
          markField(inputElem, 'not-found');
          notFoundFields.push(fieldKey);
        }
      }
    }

    // 1. Cost Price & Alternatives
    const hasAltPrices = Array.isArray(parsed.alternative_prices) && parsed.alternative_prices.length > 0;

    if (parsed.cost_price !== null) {
      applyField(
        dom.inputCostPrice,
        'Cost Price',
        parsed.cost_price,
        hasAltPrices,
        hasAltPrices ? `Multiple numbers found (${[parsed.cost_price, ...parsed.alternative_prices].map(p => '₹' + p).join(', ')})` : ''
      );
      updateSellingPriceFromMargin();
    } else {
      applyField(dom.inputCostPrice, 'Cost Price', null);
    }

    // Render price alternatives if any
    if (hasAltPrices && dom.priceAlternativesWrap) {
      dom.priceAlternativesWrap.innerHTML = `
        <span>Other price candidates: </span>
        ${parsed.alternative_prices.map(alt => `<button type="button" class="btn-alt-price" data-alt-price="${alt}">Use ₹${alt}</button>`).join(' ')}
      `;
      dom.priceAlternativesWrap.style.display = 'block';

      dom.priceAlternativesWrap.querySelectorAll('.btn-alt-price').forEach(btn => {
        btn.addEventListener('click', () => {
          const chosen = btn.getAttribute('data-alt-price');
          if (dom.inputCostPrice) {
            dom.inputCostPrice.value = chosen;
            markField(dom.inputCostPrice, 'autofill');
            updateSellingPriceFromMargin();
            showToast(`Applied cost price: ₹${chosen}`);
          }
        });
      });
    }

    // 2. Name / Title
    applyField(dom.inputName, 'Title', parsed.name);

    // 3. Fabric
    applyField(dom.inputFabric, 'Fabric', parsed.fabric);

    // 4. Pattern / Work
    applyField(dom.inputPattern, 'Pattern', parsed.pattern);

    // 5. Category
    applyField(dom.inputCategory, 'Category', parsed.category);

    // 6. Occasion
    applyField(dom.inputOccasion, 'Occasion', parsed.occasion);

    // 7. Color (if detected in text)
    if (parsed.color) {
      applyField(dom.inputColor, 'Color', parsed.color);
    }

    // 8. Dimensions & Blouse
    applyField(dom.inputLength, 'Length', parsed.length_m);
    applyField(dom.inputWidth, 'Width', parsed.width_in);
    applyField(dom.inputBlouse, 'Blouse', parsed.blouse);

    // Status Banner
    if (dom.autofillStatusBanner) {
      const summaryParts = [];
      if (filledFields.length > 0) {
        summaryParts.push(`<strong>✓ Auto-filled ${filledFields.length} field(s):</strong> ${filledFields.join(', ')}`);
      }
      if (uncertainFields.length > 0) {
        summaryParts.push(`<strong style="color: #b45309;">⚠️ Please check:</strong> ${uncertainFields.join(', ')}`);
      }
      if (notFoundFields.length > 0) {
        summaryParts.push(`<span style="color: #64748b;">(Not in message: ${notFoundFields.join(', ')})</span>`);
      }

      dom.autofillStatusBanner.innerHTML = summaryParts.join('<br>') || 'Parsed message. Review fields below.';
      dom.autofillStatusBanner.style.display = 'block';
    }

    showToast(`Auto-fill complete (${filledFields.length} fields filled)`);
  }

  // ----------------------------------------------------------------------------
  // SECURE PRIVATE DATA MANAGEMENT (saree_private table + localStorage fallback)
  // ----------------------------------------------------------------------------
  async function savePrivateSareeData(sareeId, costPrice, originalMessage) {
    if (!sareeId) return;

    // 1. Always cache in localStorage as seamless offline backup
    try {
      const store = JSON.parse(localStorage.getItem('msc_saree_private_store') || '{}');
      store[sareeId] = {
        cost_price: costPrice,
        original_message: originalMessage,
        updated_at: new Date().toISOString()
      };
      localStorage.setItem('msc_saree_private_store', JSON.stringify(store));
    } catch (e) {
      console.warn('localStorage private store write error:', e);
    }

    // 2. Persist to Supabase saree_private table (RLS protected for authenticated admins)
    if (state.supabaseClient) {
      try {
        const { error } = await state.supabaseClient
          .from('saree_private')
          .upsert({
            saree_id: sareeId,
            cost_price: costPrice,
            original_message: originalMessage,
            updated_at: new Date().toISOString()
          }, { onConflict: 'saree_id' });

        if (error) {
          console.warn('Supabase saree_private upsert error (run SQL migration if table not yet created):', error.message);
        }
      } catch (err) {
        console.warn('Error saving to saree_private table:', err);
      }
    }
  }

  async function loadPrivateSareeData(sareeId) {
    if (!sareeId) return;
    let foundCost = null;
    let foundMsg = '';

    // 1. Fetch from Supabase saree_private table
    if (state.supabaseClient) {
      try {
        const { data, error } = await state.supabaseClient
          .from('saree_private')
          .select('cost_price, original_message')
          .eq('saree_id', sareeId)
          .maybeSingle();

        if (!error && data) {
          if (data.cost_price !== null && data.cost_price !== undefined) {
            foundCost = data.cost_price;
          }
          if (data.original_message) {
            foundMsg = data.original_message;
          }
        }
      } catch (err) {
        console.warn('Could not query saree_private:', err);
      }
    }

    // 2. Fallback to localStorage if not found in database yet
    if (foundCost === null || !foundMsg) {
      try {
        const store = JSON.parse(localStorage.getItem('msc_saree_private_store') || '{}');
        if (store[sareeId]) {
          if (foundCost === null && store[sareeId].cost_price !== undefined) {
            foundCost = store[sareeId].cost_price;
          }
          if (!foundMsg && store[sareeId].original_message) {
            foundMsg = store[sareeId].original_message;
          }
        }
      } catch (e) {}
    }

    // Populate form inputs
    if (dom.inputCostPrice && foundCost !== null && foundCost !== undefined) {
      dom.inputCostPrice.value = foundCost;
      updateSellingPriceFromMargin(true); // Updates margin label without overwriting current selling price
    }
    if (dom.inputSupplierText && foundMsg) {
      dom.inputSupplierText.value = foundMsg;
    }
  }

  // ----------------------------------------------------------------------------
  // VIDEO HANDLING (UPLOAD & LINK)
  // ----------------------------------------------------------------------------
  async function handleVideoFileSelected(file) {
    if (!file) return;

    setProgress('Validating video duration & size...', 30);
    dom.btnSaveSaree.disabled = true;

    try {
      const { duration, posterBlob, posterPreviewUrl } = await validateAndExtractPoster(file);

      state.videoData = {
        type: 'new_file',
        file: file,
        duration: duration,
        posterBlob: posterBlob,
        posterPreviewUrl: posterPreviewUrl
      };

      renderVideoPreview();
      showToast(`Video attached! Duration: ${duration.toFixed(1)}s`);
    } catch (err) {
      console.warn('Video validation error:', err);
      alert(err.message || 'Video validation failed.');
      clearVideoData();
    } finally {
      setProgress(null, null);
      dom.btnSaveSaree.disabled = false;
    }
  }

  function handleVideoLinkSubmit() {
    const rawUrl = dom.inputVideoLink.value.trim();
    if (!rawUrl) {
      showToast('Please paste a YouTube or video URL.');
      return;
    }

    // Check YouTube URL patterns
    const ytRegex = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([a-zA-Z0-9_-]{11})/;
    const ytMatch = rawUrl.match(ytRegex);

    if (ytMatch && ytMatch[1]) {
      const videoId = ytMatch[1];
      const posterUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      const cleanYtUrl = `https://www.youtube.com/watch?v=${videoId}`;

      state.videoData = {
        type: 'link',
        videoUrl: cleanYtUrl,
        posterUrl: posterUrl,
        isYouTube: true,
        youtubeId: videoId
      };

      renderVideoPreview();
      showToast('YouTube video linked successfully!');
      dom.inputVideoLink.value = '';
      return;
    }

    // Direct MP4 / WebM link check
    if (rawUrl.startsWith('https://') && (rawUrl.includes('.mp4') || rawUrl.includes('.webm') || rawUrl.includes('supabase.co'))) {
      state.videoData = {
        type: 'link',
        videoUrl: rawUrl,
        posterUrl: null,
        isYouTube: false
      };
      renderVideoPreview();
      showToast('Direct video link attached!');
      dom.inputVideoLink.value = '';
      return;
    }

    alert('Please provide a valid YouTube link (e.g. youtube.com/watch?v=... or youtu.be/...) or a direct HTTPS .mp4 / .webm link.');
  }

  function renderVideoPreview() {
    if (!dom.videoPreviewWrap) return;

    if (!state.videoData) {
      dom.videoPreviewWrap.style.display = 'none';
      dom.videoPreviewPlayer.style.display = 'none';
      dom.videoPreviewThumb.style.display = 'none';
      dom.videoPreviewPlayer.src = '';
      return;
    }

    dom.videoPreviewWrap.style.display = 'block';

    if (state.videoData.type === 'new_file') {
      dom.videoPreviewPlayer.style.display = 'block';
      dom.videoPreviewThumb.style.display = 'none';
      dom.videoPreviewPlayer.src = URL.createObjectURL(state.videoData.file);
      dom.videoPreviewPlayer.poster = state.videoData.posterPreviewUrl;
      dom.videoPreviewInfo.textContent = `Uploaded MP4 (${state.videoData.duration.toFixed(1)}s) • Poster generated`;
    } else if (state.videoData.isYouTube) {
      dom.videoPreviewPlayer.style.display = 'none';
      dom.videoPreviewThumb.style.display = 'block';
      dom.videoPreviewThumb.src = state.videoData.posterUrl;
      dom.videoPreviewInfo.textContent = `YouTube Video (${state.videoData.videoUrl})`;
    } else {
      // Existing file or direct MP4 link
      dom.videoPreviewPlayer.style.display = 'block';
      dom.videoPreviewThumb.style.display = 'none';
      dom.videoPreviewPlayer.src = state.videoData.videoUrl;
      if (state.videoData.posterUrl) dom.videoPreviewPlayer.poster = state.videoData.posterUrl;
      dom.videoPreviewInfo.textContent = `Video attached (${state.videoData.videoUrl.substring(0, 40)}...)`;
    }
  }

  function clearVideoData() {
    state.videoData = null;
    if (dom.sareeVideoUrl) dom.sareeVideoUrl.value = '';
    if (dom.sareeVideoPoster) dom.sareeVideoPoster.value = '';
    renderVideoPreview();
  }

  // ----------------------------------------------------------------------------
  // STORAGE UPLOAD (IMAGES & VIDEOS)
  // ----------------------------------------------------------------------------
  async function uploadPendingPhotos() {
    const bucket = CONFIG.STORAGE_BUCKET || 'saree-images';
    const finalUrls = [];
    const totalToUpload = state.currentPhotos.filter(p => p.type === 'new').length;
    let uploadedCount = 0;

    for (let i = 0; i < state.currentPhotos.length; i++) {
      const item = state.currentPhotos[i];

      if (item.type === 'existing') {
        finalUrls.push(item.url);
      } else if (item.type === 'new') {
        const uploadBlob = item.blob || item.file;
        if (!uploadBlob) {
          console.warn('Skipping photo item with no blob/file:', item);
          continue;
        }

        uploadedCount++;
        const percent = Math.round((uploadedCount / Math.max(totalToUpload, 1)) * 50);
        setProgress(`Uploading photo ${uploadedCount} of ${totalToUpload}...`, percent);

        const timestamp = Date.now();
        const rand = Math.random().toString(36).substring(2, 8);
        const ext = (item.file && item.file.name ? item.file.name.split('.').pop() : 'jpg').toLowerCase() || 'jpg';
        const safeExt = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext) ? ext : 'jpg';
        const filename = `saree_${timestamp}_${i}_${rand}.${safeExt}`;

        const contentType = (uploadBlob && uploadBlob.type) ? uploadBlob.type : 'image/jpeg';

        const { error } = await state.supabaseClient.storage
          .from(bucket)
          .upload(filename, uploadBlob, {
            contentType: contentType,
            upsert: false
          });

        if (error) throw new Error(`Failed to upload photo ${uploadedCount} (${filename}): ${error.message}`);

        const { data: urlData } = state.supabaseClient.storage
          .from(bucket)
          .getPublicUrl(filename);

        if (!urlData || !urlData.publicUrl) throw new Error(`Failed to retrieve public URL for photo ${uploadedCount}.`);

        finalUrls.push(urlData.publicUrl);
      }
    }

    return finalUrls;
  }

  async function uploadVideoIfPending() {
    if (!state.videoData) return { videoUrl: null, posterUrl: null };

    // If existing or pasted link, return as is
    if (state.videoData.type === 'existing' || state.videoData.type === 'link') {
      return {
        videoUrl: state.videoData.videoUrl,
        posterUrl: state.videoData.posterUrl
      };
    }

    if (state.videoData.type === 'new_file') {
      const imageBucket = CONFIG.STORAGE_BUCKET || 'saree-images';
      const videoBucket = CONFIG.STORAGE_VIDEO_BUCKET || 'saree-videos';
      const timestamp = Date.now();
      const rand = Math.random().toString(36).substring(2, 7);

      // 1. Upload generated poster image to 'saree-images'
      setProgress('Uploading video poster frame...', 65);
      const posterFilename = `poster_${timestamp}_${rand}.jpg`;
      const { error: posterErr } = await state.supabaseClient.storage
        .from(imageBucket)
        .upload(posterFilename, state.videoData.posterBlob, {
          contentType: 'image/jpeg',
          upsert: false
        });

      if (posterErr) throw new Error(`Failed to upload poster: ${posterErr.message}`);

      const { data: posterUrlData } = state.supabaseClient.storage
        .from(imageBucket)
        .getPublicUrl(posterFilename);

      const finalPosterUrl = posterUrlData.publicUrl;

      // 2. Upload video file to 'saree-videos'
      setProgress('Uploading video file to storage (max 15MB)...', 80);
      const ext = state.videoData.file.name.split('.').pop() || 'mp4';
      const videoFilename = `video_${timestamp}_${rand}.${ext}`;

      const { error: videoErr } = await state.supabaseClient.storage
        .from(videoBucket)
        .upload(videoFilename, state.videoData.file, {
          contentType: state.videoData.file.type || 'video/mp4',
          upsert: false
        });

      if (videoErr) throw new Error(`Failed to upload video: ${videoErr.message}`);

      const { data: videoUrlData } = state.supabaseClient.storage
        .from(videoBucket)
        .getPublicUrl(videoFilename);

      const finalVideoUrl = videoUrlData.publicUrl;

      return {
        videoUrl: finalVideoUrl,
        posterUrl: finalPosterUrl
      };
    }

    return { videoUrl: null, posterUrl: null };
  }

  // ----------------------------------------------------------------------------
  // ADD / EDIT SAREE SUBMISSION
  // ----------------------------------------------------------------------------
  async function handleSareeSubmit(e) {
    e.preventDefault();

    if (!state.currentUser) {
      showToast('You must be logged in to save sarees.');
      return;
    }

    const name = dom.inputName.value.trim();
    const price = parseFloat(dom.inputPrice.value);
    const shipping = dom.inputShipping ? (parseFloat(dom.inputShipping.value) || 0) : 0;

    if (!name) {
      showToast('Please enter a saree title.');
      dom.inputName.focus();
      return;
    }

    if (isNaN(price) || price <= 0) {
      showToast('Please enter a valid price greater than zero.');
      dom.inputPrice.focus();
      return;
    }

    if (isNaN(shipping) || shipping < 0) {
      showToast('Please enter a valid shipping charge (0 for Free Delivery).');
      if (dom.inputShipping) dom.inputShipping.focus();
      return;
    }

    if (state.currentPhotos.length === 0) {
      showToast('Please upload at least 1 photo for the saree.');
      return;
    }

    dom.btnSaveSaree.disabled = true;
    dom.btnSaveLabel.textContent = 'Processing & Uploading...';

    try {
      // 1. Upload photos
      const uploadedPhotos = await uploadPendingPhotos();

      // 2. Upload video & poster if pending
      const { videoUrl, posterUrl } = await uploadVideoIfPending();

      setProgress('Saving saree record to Supabase...', 95);

      const lengthVal = dom.inputLength && dom.inputLength.value !== '' ? parseFloat(dom.inputLength.value) : null;
      const widthVal = dom.inputWidth && dom.inputWidth.value !== '' ? parseFloat(dom.inputWidth.value) : null;
      const blouseVal = dom.inputBlouse ? dom.inputBlouse.value.trim() : null;

      const colorsToSave = state.formColors && state.formColors.length > 0
        ? state.formColors
        : (dom.inputColor.value.trim() ? dom.inputColor.value.split(/[,/|]+/).map(s => s.trim()).filter(Boolean) : ['Multicolor']);

      const payload = {
        name: name,
        fabric: dom.inputFabric.value.trim() || 'Traditional Weave',
        color: colorsToSave.join(', '),
        available_colors: colorsToSave,
        pattern: dom.inputPattern.value.trim() || 'Traditional',
        border: dom.inputBorder.value.trim() || 'Zari Border',
        category: dom.inputCategory.value.trim() || 'Handloom',
        occasion: dom.inputOccasion.value.trim() || 'Festive / Wedding',
        description: dom.inputDescription.value.trim(),
        price: price,
        shipping_charges: shipping,
        status: dom.inputStatus.value,
        images: uploadedPhotos,
        video_url: videoUrl,
        video_poster: posterUrl,
        length_m: isNaN(lengthVal) ? null : lengthVal,
        width_in: isNaN(widthVal) ? null : widthVal,
        blouse: blouseVal || null
      };

      let savedSareeId = state.editingSareeId;

      if (state.editingSareeId) {
        let { error } = await state.supabaseClient
          .from('sarees')
          .update(payload)
          .eq('id', state.editingSareeId);

        // Safe retry if dimension or available_colors or shipping_charges columns have not been added to Supabase table yet
        if (error && error.message && (error.message.includes('shipping_charges') || error.message.includes('available_colors') || error.message.includes('length_m') || error.message.includes('width_in') || error.message.includes('blouse'))) {
          console.warn('Columns missing from database, saving without optional columns:', error.message);
          const safePayload = { ...payload };
          delete safePayload.shipping_charges;
          delete safePayload.available_colors;
          delete safePayload.length_m;
          delete safePayload.width_in;
          delete safePayload.blouse;
          const retryRes = await state.supabaseClient
            .from('sarees')
            .update(safePayload)
            .eq('id', state.editingSareeId);
          error = retryRes.error;
        }

        if (error) throw error;
        showToast(`Saree #${state.editingSareeId} updated successfully!`);
      } else {
        let { data: insertedData, error } = await state.supabaseClient
          .from('sarees')
          .insert([payload])
          .select('id');

        // Safe retry if columns missing
        if (error && error.message && (error.message.includes('shipping_charges') || error.message.includes('available_colors') || error.message.includes('length_m') || error.message.includes('width_in') || error.message.includes('blouse'))) {
          console.warn('Columns missing from database, inserting without optional columns:', error.message);
          const safePayload = { ...payload };
          delete safePayload.shipping_charges;
          delete safePayload.available_colors;
          delete safePayload.length_m;
          delete safePayload.width_in;
          delete safePayload.blouse;
          const retryRes = await state.supabaseClient
            .from('sarees')
            .insert([safePayload])
            .select('id');
          error = retryRes.error;
          insertedData = retryRes.data;
        }

        if (error) throw error;
        if (insertedData && insertedData[0]) {
          savedSareeId = insertedData[0].id;
        }
        showToast('New saree added to catalog successfully!');
      }

      // Persist private data (cost price and original supplier message)
      const costVal = dom.inputCostPrice && dom.inputCostPrice.value !== '' ? parseFloat(dom.inputCostPrice.value) : null;
      const origMsg = dom.inputSupplierText ? dom.inputSupplierText.value : '';
      if (savedSareeId) {
        await savePrivateSareeData(savedSareeId, isNaN(costVal) ? null : costVal, origMsg);
      }

      // Bust public catalog cache
      sessionStorage.removeItem('msc_supabase_sarees_cache_v2');
      sessionStorage.removeItem('msc_supabase_sarees_time_v2');

      resetForm();
      await loadAllSarees();
      switchToTab('list');

    } catch (err) {
      console.error('Error saving saree:', err);
      showToast('Failed to save saree: ' + err.message);
    } finally {
      setProgress(null, null);
      dom.btnSaveSaree.disabled = false;
      dom.btnSaveLabel.textContent = state.editingSareeId ? 'Update Saree' : 'Save Saree to Catalog';
    }
  }

  function resetForm() {
    state.editingSareeId = null;
    state.currentPhotos = [];
    state.videoData = null;
    dom.sareeForm.reset();
    dom.sareeEditId.value = '';
    if (dom.inputShipping) dom.inputShipping.value = '0';
    if (dom.inputCostPrice) dom.inputCostPrice.value = '';
    if (dom.inputSupplierText) dom.inputSupplierText.value = '';
    if (dom.inputLength) dom.inputLength.value = '';
    if (dom.inputWidth) dom.inputWidth.value = '';
    if (dom.inputBlouse) dom.inputBlouse.value = '';

    setColorTags([]);

    if (dom.autofillStatusBanner) {
      dom.autofillStatusBanner.innerHTML = '';
      dom.autofillStatusBanner.style.display = 'none';
    }
    if (dom.priceAlternativesWrap) {
      dom.priceAlternativesWrap.innerHTML = '';
      dom.priceAlternativesWrap.style.display = 'none';
    }
    if (dom.colorSuggestionsWrap) dom.colorSuggestionsWrap.style.display = 'none';
    if (dom.colorChipsList) dom.colorChipsList.innerHTML = '';

    clearFieldFeedback(dom.sareeForm);
    initMarginSettings();
    updateSellingPriceFromMargin(true);

    dom.formSectionTitle.textContent = 'Add New Saree';
    dom.formSectionDesc.textContent = 'Add saree specifications, photos, and drape video';
    dom.formTabLabel.textContent = 'Add New Saree';
    dom.btnSaveLabel.textContent = 'Save Saree to Catalog';
    dom.btnCancelEdit.style.display = 'none';
    renderPhotoPreviews();
    renderVideoPreview();
  }

  function startEditSaree(saree) {
    state.editingSareeId = saree.id;
    dom.sareeEditId.value = saree.id;
    dom.inputName.value = saree.name || '';
    dom.inputPrice.value = saree.price || 0;
    if (dom.inputShipping) {
      dom.inputShipping.value = saree.shipping_charges !== undefined && saree.shipping_charges !== null ? saree.shipping_charges : 0;
    }
    dom.inputFabric.value = saree.fabric || '';
    dom.inputCategory.value = saree.category || '';
    dom.inputStatus.value = saree.status || 'Available';
    dom.inputPattern.value = saree.pattern || '';
    dom.inputBorder.value = saree.border || '';
    dom.inputOccasion.value = saree.occasion || '';
    dom.inputDescription.value = saree.description || '';

    // Load available colors
    let colors = [];
    if (Array.isArray(saree.available_colors) && saree.available_colors.length > 0) {
      colors = saree.available_colors;
    } else if (saree.color) {
      colors = saree.color.split(/[,/|]+/).map(s => s.trim()).filter(Boolean);
    }
    setColorTags(colors);

    // Dimensions & Blouse
    if (dom.inputLength) dom.inputLength.value = (saree.length_m !== null && saree.length_m !== undefined) ? saree.length_m : '';
    if (dom.inputWidth) dom.inputWidth.value = (saree.width_in !== null && saree.width_in !== undefined) ? saree.width_in : '';
    if (dom.inputBlouse) dom.inputBlouse.value = saree.blouse || '';

    // Clear previous auto-fill markers & alternatives
    clearFieldFeedback(dom.sareeForm);
    if (dom.autofillStatusBanner) dom.autofillStatusBanner.style.display = 'none';
    if (dom.priceAlternativesWrap) dom.priceAlternativesWrap.style.display = 'none';

    // Photos
    let imgs = [];
    if (Array.isArray(saree.images)) {
      imgs = saree.images.filter(Boolean);
    } else if (typeof saree.images === 'string' && saree.images.trim()) {
      imgs = saree.images.split(',').map(s => s.trim()).filter(Boolean);
    } else if (saree.image_url) {
      imgs = [saree.image_url];
    }
    state.currentPhotos = imgs.map(url => ({
      type: 'existing',
      url: url,
      previewUrl: url
    }));

    // Video
    if (saree.video_url) {
      const isYt = saree.video_url.includes('youtube.com') || saree.video_url.includes('youtu.be');
      state.videoData = {
        type: 'existing',
        videoUrl: saree.video_url,
        posterUrl: saree.video_poster,
        isYouTube: isYt
      };
    } else {
      state.videoData = null;
    }

    // Load confidential private buying cost & original supplier message
    loadPrivateSareeData(saree.id);

    // If photos exist, run color detection for chips
    if (state.currentPhotos.length > 0) {
      triggerPhotoColorDetection(state.currentPhotos[0]);
    }

    dom.formSectionTitle.textContent = `Edit Saree #${saree.id}`;
    dom.formSectionDesc.textContent = `Editing: ${saree.name}`;
    dom.formTabLabel.textContent = `Edit Saree #${saree.id}`;
    dom.btnSaveLabel.textContent = 'Update Saree';
    dom.btnCancelEdit.style.display = 'inline-flex';

    renderPhotoPreviews();
    renderVideoPreview();
    switchToTab('form');
  }

  function duplicateSaree(saree) {
    resetForm();
    dom.inputName.value = `${saree.name} (Copy)`;
    dom.inputPrice.value = saree.price || 0;
    if (dom.inputShipping) {
      dom.inputShipping.value = saree.shipping_charges || 0;
    }
    dom.inputFabric.value = saree.fabric || '';
    dom.inputCategory.value = saree.category || '';
    dom.inputStatus.value = 'Available';
    dom.inputPattern.value = saree.pattern || '';
    dom.inputBorder.value = saree.border || '';
    dom.inputOccasion.value = saree.occasion || '';
    dom.inputDescription.value = saree.description || '';

    let colors = [];
    if (Array.isArray(saree.available_colors) && saree.available_colors.length > 0) {
      colors = saree.available_colors;
    } else if (saree.color) {
      colors = saree.color.split(/[,/|]+/).map(s => s.trim()).filter(Boolean);
    }
    setColorTags(colors);

    // Dimensions & Blouse
    if (dom.inputLength) dom.inputLength.value = (saree.length_m !== null && saree.length_m !== undefined) ? saree.length_m : '';
    if (dom.inputWidth) dom.inputWidth.value = (saree.width_in !== null && saree.width_in !== undefined) ? saree.width_in : '';
    if (dom.inputBlouse) dom.inputBlouse.value = saree.blouse || '';

    // Load private buying cost
    loadPrivateSareeData(saree.id);

    let imgs = [];
    if (Array.isArray(saree.images)) {
      imgs = saree.images.filter(Boolean);
    } else if (typeof saree.images === 'string' && saree.images.trim()) {
      imgs = saree.images.split(',').map(s => s.trim()).filter(Boolean);
    } else if (saree.image_url) {
      imgs = [saree.image_url];
    }
    state.currentPhotos = imgs.map(url => ({
      type: 'existing',
      url: url,
      previewUrl: url
    }));

    if (saree.video_url) {
      const isYt = saree.video_url.includes('youtube.com') || saree.video_url.includes('youtu.be');
      state.videoData = {
        type: 'existing',
        videoUrl: saree.video_url,
        posterUrl: saree.video_poster,
        isYouTube: isYt
      };
    }

    if (state.currentPhotos.length > 0) {
      triggerPhotoColorDetection(state.currentPhotos[0]);
    }

    renderPhotoPreviews();
    renderVideoPreview();
    showToast('Saree details duplicated into form! Review and click Save.');
    switchToTab('form');
  }

  // ----------------------------------------------------------------------------
  // INVENTORY LIST & ACTIONS
  // ----------------------------------------------------------------------------
  async function loadAllSarees() {
    if (!state.supabaseClient) return;

    dom.adminSareeList.innerHTML = `
      <div style="text-align: center; padding: 2rem; color: #64748b;">
        Loading catalog inventory from Supabase...
      </div>
    `;

    try {
      const { data, error } = await state.supabaseClient
        .from('sarees')
        .select('*')
        .order('id', { ascending: false });

      if (error) throw error;

      state.allSarees = data || [];
      if (dom.totalSareesCount) dom.totalSareesCount.textContent = state.allSarees.length;

      populateAdminCategories();
      renderAdminList();
      populateReviewSareeDropdown();
      loadAllReviews();
    } catch (err) {
      console.error('Failed to load sarees for admin:', err);
      dom.adminSareeList.innerHTML = `
        <div style="text-align: center; padding: 2rem; color: #b91c1c;">
          Error loading inventory: ${escapeHtml(err.message)}
        </div>
      `;
    }
  }

  function populateAdminCategories() {
    if (!dom.adminCategoryFilter) return;
    const cats = Array.from(new Set(state.allSarees.map(s => s.category).filter(Boolean))).sort();
    dom.adminCategoryFilter.innerHTML = `<option value="all">All Categories</option>` +
      cats.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  }

  function renderAdminList() {
    if (!dom.adminSareeList) return;

    const q = state.searchQuery.toLowerCase().trim();

    const filtered = state.allSarees.filter(s => {
      if (q) {
        const matchName = (s.name || '').toLowerCase().includes(q);
        const matchFabric = (s.fabric || '').toLowerCase().includes(q);
        const matchId = String(s.id).includes(q);
        if (!matchName && !matchFabric && !matchId) return false;
      }
      if (state.filterStatus !== 'all' && s.status !== state.filterStatus) return false;
      if (state.filterCategory !== 'all' && s.category !== state.filterCategory) return false;
      return true;
    });

    if (filtered.length === 0) {
      dom.adminSareeList.innerHTML = `
        <div style="text-align: center; padding: 2.5rem 1rem; color: #64748b;">
          No sarees match your filter criteria.
        </div>
      `;
      return;
    }

    dom.adminSareeList.innerHTML = filtered.map(saree => {
      const isSold = saree.status === 'Sold';
      const mainImg = (saree.images && saree.images.length > 0) ? saree.images[0] : PLACEHOLDER_IMG;
      const hasVideo = !!saree.video_url;
      const reviewCount = state.allReviews.filter(r => String(r.saree_id) === String(saree.id)).length;

      return `
        <div class="admin-saree-row" data-id="${saree.id}">
          <div class="admin-saree-info">
            <div style="position: relative;">
              <img src="${escapeHtml(mainImg)}" alt="${escapeHtml(saree.name)}" class="admin-saree-thumb" onerror="this.src='${PLACEHOLDER_IMG}';">
              ${hasVideo ? '<span style="position:absolute;bottom:2px;right:2px;background:rgba(0,0,0,0.8);color:#fff;font-size:0.6rem;padding:1px 3px;border-radius:3px;">▶ Video</span>' : ''}
            </div>
            <div class="admin-saree-details">
              <span class="admin-saree-title">#${saree.id} - ${escapeHtml(saree.name)}</span>
              <span class="admin-saree-sub">${escapeHtml(saree.fabric || 'Silk')} • ${escapeHtml(saree.category || 'Handloom')}</span>
              <div style="display: flex; align-items: baseline; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.15rem;">
                <span class="admin-saree-price">${formatPrice(saree.price)}</span>
                ${Number(saree.shipping_charges) > 0 
                  ? `<span style="font-size: 0.72rem; color: #475569; font-weight: 600; background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">+ ${formatPrice(saree.shipping_charges)} shipping</span>` 
                  : `<span style="font-size: 0.72rem; color: #15803d; font-weight: 600; background: #dcfce7; padding: 2px 6px; border-radius: 4px;">🚚 Free shipping</span>`}
              </div>
            </div>
          </div>

          <div class="admin-actions-group">
            <button type="button" class="btn-admin-action btn-sold-toggle ${isSold ? 'is-sold' : 'is-available'}" data-id="${saree.id}" data-current="${saree.status}">
              ${isSold ? '❌ Sold Out' : '✅ Available'}
            </button>
            <button type="button" class="btn-admin-action btn-edit-saree" data-id="${saree.id}">
              ✏️ Edit
            </button>
            <button type="button" class="btn-admin-action btn-manage-reviews" data-id="${saree.id}" title="Manage Reviews for this Saree">
              ⭐ Reviews (${reviewCount})
            </button>
            <button type="button" class="btn-admin-action btn-duplicate-saree" data-id="${saree.id}">
              📋 Duplicate
            </button>
            <button type="button" class="btn-admin-action btn-delete btn-delete-saree" data-id="${saree.id}">
              🗑️ Delete
            </button>
          </div>
        </div>
      `;
    }).join('');

    dom.adminSareeList.querySelectorAll('.btn-sold-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const current = btn.getAttribute('data-current');
        toggleSareeStatus(id, current);
      });
    });

    dom.adminSareeList.querySelectorAll('.btn-edit-saree').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const saree = state.allSarees.find(s => String(s.id) === String(id));
        if (saree) startEditSaree(saree);
      });
    });

    dom.adminSareeList.querySelectorAll('.btn-manage-reviews').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        switchToTab('reviews');
        if (dom.reviewSareeSelect) {
          dom.reviewSareeSelect.value = id;
          onReviewSareeChange(id);
        }
      });
    });

    dom.adminSareeList.querySelectorAll('.btn-duplicate-saree').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const saree = state.allSarees.find(s => String(s.id) === String(id));
        if (saree) duplicateSaree(saree);
      });
    });

    dom.adminSareeList.querySelectorAll('.btn-delete-saree').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const saree = state.allSarees.find(s => String(s.id) === String(id));
        if (saree) deleteSaree(saree);
      });
    });
  }

  async function toggleSareeStatus(id, currentStatus) {
    const newStatus = currentStatus === 'Available' ? 'Sold' : 'Available';

    try {
      const { error } = await state.supabaseClient
        .from('sarees')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;

      showToast(`Saree #${id} marked as ${newStatus}!`);
      sessionStorage.removeItem('msc_supabase_sarees_cache_v2');

      const saree = state.allSarees.find(s => String(s.id) === String(id));
      if (saree) saree.status = newStatus;
      renderAdminList();
    } catch (err) {
      showToast('Failed to update status: ' + err.message);
    }
  }

  async function deleteSaree(saree) {
    const confirmDelete = window.confirm(`Are you sure you want to delete saree #${saree.id} ("${saree.name}")?\n\nThis will permanently delete the record, its photos, and its video.`);
    if (!confirmDelete) return;

    try {
      const imgBucket = CONFIG.STORAGE_BUCKET || 'saree-images';
      const vidBucket = CONFIG.STORAGE_VIDEO_BUCKET || 'saree-videos';

      // 1. Delete image files from storage bucket
      if (Array.isArray(saree.images)) {
        const imgFiles = saree.images
          .filter(u => u && u.includes(imgBucket))
          .map(url => url.split('/').pop())
          .filter(Boolean);

        if (imgFiles.length > 0) {
          await state.supabaseClient.storage.from(imgBucket).remove(imgFiles);
        }
      }

      // 2. Delete video and video poster from storage bucket
      if (saree.video_url && saree.video_url.includes(vidBucket)) {
        const vidFile = saree.video_url.split('/').pop();
        if (vidFile) await state.supabaseClient.storage.from(vidBucket).remove([vidFile]);
      }
      if (saree.video_poster && saree.video_poster.includes(imgBucket)) {
        const posterFile = saree.video_poster.split('/').pop();
        if (posterFile) await state.supabaseClient.storage.from(imgBucket).remove([posterFile]);
      }

      // 3. Delete row from sarees table
      const { error } = await state.supabaseClient
        .from('sarees')
        .delete()
        .eq('id', saree.id);

      if (error) throw error;

      showToast(`Saree #${saree.id} deleted successfully.`);
      sessionStorage.removeItem('msc_supabase_sarees_cache_v2');

      state.allSarees = state.allSarees.filter(s => String(s.id) !== String(saree.id));
      if (dom.totalSareesCount) dom.totalSareesCount.textContent = state.allSarees.length;
      renderAdminList();
    } catch (err) {
      console.error('Failed to delete saree:', err);
      showToast('Error deleting saree: ' + err.message);
    }
  }

  // ----------------------------------------------------------------------------
  // CUSTOMER REVIEWS MANAGEMENT (ADMIN-ONLY)
  // ----------------------------------------------------------------------------

  async function loadAllReviews() {
    if (!state.supabaseClient) return;

    try {
      const { data, error } = await state.supabaseClient
        .from('saree_reviews')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('saree_reviews fetch notice (table may need setup):', error.message);
        // Fallback to locally cached reviews
        const local = localStorage.getItem('msc_local_reviews');
        state.allReviews = local ? JSON.parse(local) : [];
      } else {
        state.allReviews = data || [];
      }

      if (dom.totalReviewsCount) {
        dom.totalReviewsCount.textContent = state.allReviews.length;
      }

      if (state.selectedReviewSareeId) {
        renderSelectedSareeReviews(state.selectedReviewSareeId);
      }
    } catch (e) {
      console.warn('loadAllReviews error:', e);
    }
  }

  function populateReviewSareeDropdown() {
    if (!dom.reviewSareeSelect) return;
    const currentVal = dom.reviewSareeSelect.value;
    dom.reviewSareeSelect.innerHTML = `
      <option value="">-- Choose a Saree from Catalog (${state.allSarees.length} sarees) --</option>
      ${state.allSarees.map(s => {
        const count = state.allReviews.filter(r => String(r.saree_id) === String(s.id)).length;
        return `<option value="${s.id}">#${s.id} - ${escapeHtml(s.name)} (${count} reviews)</option>`;
      }).join('')}
    `;

    if (currentVal && state.allSarees.some(s => String(s.id) === String(currentVal))) {
      dom.reviewSareeSelect.value = currentVal;
    }
  }

  function onReviewSareeChange(sareeId) {
    state.selectedReviewSareeId = sareeId ? String(sareeId) : null;
    if (!sareeId) {
      if (dom.reviewFormWrap) dom.reviewFormWrap.style.display = 'none';
      return;
    }

    if (dom.reviewFormWrap) dom.reviewFormWrap.style.display = 'block';
    resetReviewForm();

    const saree = state.allSarees.find(s => String(s.id) === String(sareeId));
    if (dom.reviewFormTitle && saree) {
      dom.reviewFormTitle.textContent = `Add Customer Review for #${saree.id} - ${saree.name}`;
    }

    renderSelectedSareeReviews(sareeId);
  }

  function resetReviewForm() {
    state.editingReviewId = null;
    state.currentReviewPhotos = [];
    if (dom.sareeReviewForm) dom.sareeReviewForm.reset();
    if (dom.reviewEditId) dom.reviewEditId.value = '';
    if (dom.btnCancelReviewEdit) dom.btnCancelReviewEdit.style.display = 'none';
    if (dom.btnSaveReview) dom.btnSaveReview.textContent = '💾 Save Review';
    if (dom.inputReviewPhotoUrl) dom.inputReviewPhotoUrl.value = '';
    if (dom.inputReviewRating) dom.inputReviewRating.value = '5';
    renderReviewPhotoPreviews();
  }

  function renderReviewPhotoPreviews() {
    if (!dom.reviewPhotosPreviewGrid) return;
    if (state.currentReviewPhotos.length === 0) {
      dom.reviewPhotosPreviewGrid.innerHTML = '';
      return;
    }

    dom.reviewPhotosPreviewGrid.innerHTML = state.currentReviewPhotos.map((photo, idx) => {
      const src = photo.previewUrl || photo.url;
      return `
        <div class="photo-preview-card" style="width: 80px; height: 100px; position: relative;">
          <img src="${escapeHtml(src)}" alt="Review Photo ${idx + 1}" class="photo-preview-img" style="width: 100%; height: 100%; object-fit: cover; border-radius: 4px;">
          <button type="button" class="btn-photo-action btn-del-review-photo" data-index="${idx}" style="position: absolute; top: 2px; right: 2px; width: 22px; height: 22px; background: rgba(0,0,0,0.7); color: #fff; border-radius: 50%; font-size: 13px; display: flex; align-items: center; justify-content: center; border: none; cursor: pointer;" title="Remove">
            ×
          </button>
        </div>
      `;
    }).join('');

    dom.reviewPhotosPreviewGrid.querySelectorAll('.btn-del-review-photo').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.getAttribute('data-index'), 10);
        state.currentReviewPhotos.splice(idx, 1);
        renderReviewPhotoPreviews();
      });
    });
  }

  async function handleReviewPhotosSelected(fileList) {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isImg = (file.type && file.type.startsWith('image/')) ||
                    /\.(jpe?g|png|webp|gif|bmp|heic|heif|jfif)$/i.test(file.name || '') ||
                    !file.type;
      if (!isImg) continue;

      try {
        const { blob, previewUrl } = await compressImage(file, 1200, 0.82);
        state.currentReviewPhotos.push({
          type: 'new',
          file: file,
          blob: blob,
          previewUrl: previewUrl
        });
      } catch (err) {
        console.warn('Fallback to original file for review photo:', file.name, err);
        try {
          state.currentReviewPhotos.push({
            type: 'new',
            file: file,
            blob: file,
            previewUrl: URL.createObjectURL(file)
          });
        } catch (fallbackErr) {
          console.error('Failed to process review photo:', file.name, fallbackErr);
        }
      }
    }

    renderReviewPhotoPreviews();
  }

  async function uploadPendingReviewPhotos() {
    const bucket = CONFIG.STORAGE_BUCKET || 'saree-images';
    const finalUrls = [];

    for (let i = 0; i < state.currentReviewPhotos.length; i++) {
      const item = state.currentReviewPhotos[i];

      if (item.type === 'existing' || item.type === 'link') {
        finalUrls.push(item.url);
      } else if (item.type === 'new') {
        const uploadBlob = item.blob || item.file;
        if (!uploadBlob) continue;

        const timestamp = Date.now();
        const rand = Math.random().toString(36).substring(2, 8);
        const ext = (item.file && item.file.name ? item.file.name.split('.').pop() : 'jpg').toLowerCase() || 'jpg';
        const safeExt = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext) ? ext : 'jpg';
        const filename = `review_${timestamp}_${i}_${rand}.${safeExt}`;
        const contentType = uploadBlob.type || 'image/jpeg';

        if (state.supabaseClient) {
          const { error } = await state.supabaseClient.storage
            .from(bucket)
            .upload(filename, uploadBlob, {
              contentType: contentType,
              upsert: false
            });

          if (!error) {
            const { data: urlData } = state.supabaseClient.storage
              .from(bucket)
              .getPublicUrl(filename);
            if (urlData && urlData.publicUrl) {
              finalUrls.push(urlData.publicUrl);
            }
          } else {
            console.warn('Storage upload error for review photo:', error.message);
          }
        }
      }
    }

    return finalUrls;
  }

  function renderSelectedSareeReviews(sareeId) {
    if (!dom.selectedSareeReviewsList) return;
    const reviews = state.allReviews.filter(r => String(r.saree_id) === String(sareeId));

    if (dom.selectedSareeReviewsCount) {
      dom.selectedSareeReviewsCount.textContent = reviews.length;
    }

    if (reviews.length === 0) {
      dom.selectedSareeReviewsList.innerHTML = `
        <div style="text-align: center; padding: 2rem 1rem; color: #94a3b8; font-size: 0.88rem; background: #f8fafc; border-radius: 8px; border: 1px dashed #cbd5e1;">
          No customer reviews added yet for this saree.<br>
          Use the form above to add a verified feedback, photos, and video.
        </div>
      `;
      return;
    }

    dom.selectedSareeReviewsList.innerHTML = reviews.map(rev => {
      const stars = '⭐'.repeat(rev.rating || 5);
      const photos = Array.isArray(rev.photos) ? rev.photos : [];
      const photosHtml = photos.length > 0 ? `
        <div style="display: flex; gap: 0.5rem; margin-top: 0.6rem; flex-wrap: wrap;">
          ${photos.map(p => `
            <a href="${escapeHtml(p)}" target="_blank" rel="noopener noreferrer">
              <img src="${escapeHtml(p)}" alt="Customer Photo" style="width: 55px; height: 75px; object-fit: cover; border-radius: 4px; border: 1px solid #cbd5e1; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            </a>
          `).join('')}
        </div>
      ` : '';

      const videoHtml = rev.video_url ? `
        <div style="margin-top: 0.5rem; font-size: 0.76rem; color: #475569;">
          🎥 <strong>Video Review:</strong> 
          <a href="${escapeHtml(rev.video_url)}" target="_blank" rel="noopener noreferrer" style="color: #0284c7; text-decoration: underline; font-weight: 600;">
            ${escapeHtml(rev.video_url.substring(0, 45))}... &rarr;
          </a>
        </div>
      ` : '';

      return `
        <div style="padding: 1rem; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 0.75rem;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; flex-wrap: wrap;">
            <div>
              <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                <strong style="font-size: 0.95rem; color: #1e293b;">${escapeHtml(rev.customer_name)}</strong>
                <span style="font-size: 0.72rem; color: #16a34a; background: #dcfce7; padding: 2px 6px; border-radius: 4px; font-weight: 600;">✓ Verified</span>
                <span style="font-size: 0.8rem;">${stars}</span>
              </div>
              <span style="font-size: 0.72rem; color: #94a3b8;">${formatDate(rev.created_at)}</span>
            </div>

            <div style="display: flex; gap: 0.4rem;">
              <button type="button" class="btn-admin-action btn-edit-review" data-id="${rev.id}">
                ✏️ Edit
              </button>
              <button type="button" class="btn-admin-action btn-delete btn-delete-review" data-id="${rev.id}">
                🗑️ Delete
              </button>
            </div>
          </div>

          <p style="font-size: 0.88rem; color: #334155; line-height: 1.45; margin: 0.6rem 0 0 0; background: #f8fafc; padding: 0.65rem 0.85rem; border-radius: 6px;">
            "${escapeHtml(rev.comment)}"
          </p>

          ${photosHtml}
          ${videoHtml}
        </div>
      `;
    }).join('');

    dom.selectedSareeReviewsList.querySelectorAll('.btn-edit-review').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const rev = state.allReviews.find(r => String(r.id) === String(id));
        if (rev) startEditReview(rev);
      });
    });

    dom.selectedSareeReviewsList.querySelectorAll('.btn-delete-review').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        deleteReview(id);
      });
    });
  }

  async function handleReviewSubmit(e) {
    e.preventDefault();
    if (!state.currentUser) {
      showToast('You must be signed in to add reviews.');
      return;
    }

    const sareeId = state.selectedReviewSareeId;
    if (!sareeId) {
      showToast('Please select a saree first.');
      return;
    }

    const name = dom.inputReviewName.value.trim();
    const rating = parseInt(dom.inputReviewRating.value, 10) || 5;
    const comment = dom.inputReviewComment.value.trim();
    const videoUrl = dom.inputReviewVideoUrl ? dom.inputReviewVideoUrl.value.trim() : '';

    if (!name) {
      showToast('Please enter the customer name.');
      dom.inputReviewName.focus();
      return;
    }

    if (!comment) {
      showToast('Please enter the review comment.');
      dom.inputReviewComment.focus();
      return;
    }

    dom.btnSaveReview.disabled = true;
    dom.btnSaveReview.textContent = 'Saving Review...';

    try {
      const uploadedPhotos = await uploadPendingReviewPhotos();

      const payload = {
        saree_id: sareeId,
        customer_name: name,
        rating: rating,
        comment: comment,
        photos: uploadedPhotos,
        video_url: videoUrl || null
      };

      if (state.editingReviewId) {
        if (state.supabaseClient) {
          const { error } = await state.supabaseClient
            .from('saree_reviews')
            .update(payload)
            .eq('id', state.editingReviewId);

          if (error) console.warn('Supabase review update notice:', error.message);
        }

        const idx = state.allReviews.findIndex(r => String(r.id) === String(state.editingReviewId));
        if (idx !== -1) {
          state.allReviews[idx] = { ...state.allReviews[idx], ...payload };
        }
        showToast('Review updated successfully!');
      } else {
        let insertedReview = null;
        if (state.supabaseClient) {
          const { data, error } = await state.supabaseClient
            .from('saree_reviews')
            .insert([payload])
            .select();

          if (!error && data && data.length > 0) {
            insertedReview = data[0];
          } else if (error) {
            console.warn('Supabase review insert notice (table might need creation):', error.message);
          }
        }

        if (!insertedReview) {
          insertedReview = {
            id: Date.now(),
            ...payload,
            created_at: new Date().toISOString()
          };
        }

        state.allReviews.unshift(insertedReview);
        showToast('Customer review added successfully!');
      }

      try {
        localStorage.setItem('msc_local_reviews', JSON.stringify(state.allReviews));
        sessionStorage.removeItem('msc_supabase_sarees_cache_v2');
      } catch (e) {}

      if (dom.totalReviewsCount) {
        dom.totalReviewsCount.textContent = state.allReviews.length;
      }

      resetReviewForm();
      renderSelectedSareeReviews(sareeId);
      renderAdminList();

    } catch (err) {
      console.error('Error saving review:', err);
      showToast('Error saving review: ' + err.message);
    } finally {
      dom.btnSaveReview.disabled = false;
      dom.btnSaveReview.textContent = '💾 Save Review';
    }
  }

  function startEditReview(review) {
    state.editingReviewId = review.id;
    if (dom.reviewEditId) dom.reviewEditId.value = review.id;
    if (dom.inputReviewName) dom.inputReviewName.value = review.customer_name || '';
    if (dom.inputReviewRating) dom.inputReviewRating.value = String(review.rating || 5);
    if (dom.inputReviewComment) dom.inputReviewComment.value = review.comment || '';
    if (dom.inputReviewVideoUrl) dom.inputReviewVideoUrl.value = review.video_url || '';

    state.currentReviewPhotos = (Array.isArray(review.photos) ? review.photos : []).map(url => ({
      type: 'existing',
      url: url,
      previewUrl: url
    }));
    renderReviewPhotoPreviews();

    if (dom.reviewFormTitle) dom.reviewFormTitle.textContent = `Edit Review #${review.id}`;
    if (dom.btnSaveReview) dom.btnSaveReview.textContent = 'Update Review';
    if (dom.btnCancelReviewEdit) dom.btnCancelReviewEdit.style.display = 'inline-flex';

    dom.sareeReviewForm.scrollIntoView({ behavior: 'smooth' });
  }

  async function deleteReview(reviewId) {
    if (!confirm('Are you sure you want to delete this customer review?')) return;

    try {
      if (state.supabaseClient) {
        const { error } = await state.supabaseClient
          .from('saree_reviews')
          .delete()
          .eq('id', reviewId);
        if (error) console.warn('Supabase review delete notice:', error.message);
      }

      state.allReviews = state.allReviews.filter(r => String(r.id) !== String(reviewId));
      try {
        localStorage.setItem('msc_local_reviews', JSON.stringify(state.allReviews));
        sessionStorage.removeItem('msc_supabase_sarees_cache_v2');
      } catch (e) {}

      if (dom.totalReviewsCount) {
        dom.totalReviewsCount.textContent = state.allReviews.length;
      }

      showToast('Review deleted successfully.');
      if (state.selectedReviewSareeId) {
        renderSelectedSareeReviews(state.selectedReviewSareeId);
      }
      renderAdminList();
    } catch (e) {
      console.error('Failed to delete review:', e);
      showToast('Failed to delete review.');
    }
  }

  // ----------------------------------------------------------------------------
  // ORPHAN FILES STORAGE CLEANUP
  // ----------------------------------------------------------------------------

  /**
   * Helper to retrieve all non-folder files from a storage bucket (handles pagination)
   */
  async function fetchAllBucketFiles(bucket) {
    const list = [];
    let offset = 0;
    const limit = 100;
    try {
      while (true) {
        const { data, error } = await state.supabaseClient.storage.from(bucket).list('', {
          limit: limit,
          offset: offset,
          sortBy: { column: 'created_at', order: 'desc' }
        });
        if (error) {
          console.warn(`Bucket "${bucket}" list notice:`, error.message);
          break;
        }
        if (!data || data.length === 0) break;
        const valid = data.filter(item => item && item.name && item.name !== '.emptyFolderPlaceholder' && item.id !== null);
        list.push(...valid);
        if (data.length < limit) break;
        offset += limit;
      }
    } catch (err) {
      console.warn(`Error listing bucket "${bucket}":`, err);
    }
    return list;
  }

  /**
   * Scans Supabase Storage buckets and compares against all saree rows
   */
  async function scanOrphanFiles() {
    if (!state.supabaseClient || state.isScanningOrphans) return;
    state.isScanningOrphans = true;

    if (dom.btnScanOrphans) {
      dom.btnScanOrphans.disabled = true;
      dom.btnScanOrphans.textContent = '⏳ Scanning...';
    }
    if (dom.btnScanOrphansEmpty) {
      dom.btnScanOrphansEmpty.disabled = true;
      dom.btnScanOrphansEmpty.textContent = '⏳ Scanning...';
    }

    if (dom.orphanFilesList) {
      dom.orphanFilesList.innerHTML = `
        <div style="text-align: center; padding: 3rem 1rem; color: #64748b;">
          <div style="font-size: 2.2rem; margin-bottom: 0.5rem;">🔍</div>
          <p style="font-size: 0.95rem; font-weight: 600; color: #1e293b;">Scanning storage buckets & active sarees...</p>
          <p style="font-size: 0.78rem; color: #94a3b8; margin-top: 0.35rem;">Comparing files in saree-images and saree-videos</p>
        </div>
      `;
    }

    try {
      // 1. Fetch all saree image & video references from the database
      const { data: sarees, error: sareesErr } = await state.supabaseClient
        .from('sarees')
        .select('id, images, video_url, video_poster');

      if (sareesErr) throw sareesErr;

      const activeImageFilenames = new Set();
      const activeVideoFilenames = new Set();
      const allActiveUrls = [];

      (sarees || []).forEach(s => {
        if (Array.isArray(s.images)) {
          s.images.forEach(u => {
            if (typeof u === 'string' && u) {
              allActiveUrls.push(u);
              const name = getFilenameFromUrl(u);
              if (name) activeImageFilenames.add(name);
            }
          });
        }
        if (s.video_poster && typeof s.video_poster === 'string') {
          allActiveUrls.push(s.video_poster);
          const name = getFilenameFromUrl(s.video_poster);
          if (name) activeImageFilenames.add(name);
        }
        if (s.video_url && typeof s.video_url === 'string') {
          allActiveUrls.push(s.video_url);
          const name = getFilenameFromUrl(s.video_url);
          if (name) activeVideoFilenames.add(name);
        }
      });

      // 2. Query all files in storage buckets
      const imageBucket = CONFIG.STORAGE_BUCKET || 'saree-images';
      const videoBucket = CONFIG.STORAGE_VIDEO_BUCKET || 'saree-videos';

      const [imageFiles, videoFiles] = await Promise.all([
        fetchAllBucketFiles(imageBucket),
        fetchAllBucketFiles(videoBucket)
      ]);

      const orphanList = [];

      // Check image bucket files
      imageFiles.forEach(f => {
        const isReferenced = activeImageFilenames.has(f.name) || allActiveUrls.some(u => u.includes(f.name));
        if (!isReferenced) {
          const { data: pubUrl } = state.supabaseClient.storage.from(imageBucket).getPublicUrl(f.name);
          orphanList.push({
            bucket: imageBucket,
            name: f.name,
            id: f.id,
            size: f.metadata?.size || 0,
            created_at: f.created_at,
            publicUrl: pubUrl?.publicUrl || '',
            isVideo: false,
            selected: false
          });
        }
      });

      // Check video bucket files
      videoFiles.forEach(f => {
        const isReferenced = activeVideoFilenames.has(f.name) || allActiveUrls.some(u => u.includes(f.name));
        if (!isReferenced) {
          const { data: pubUrl } = state.supabaseClient.storage.from(videoBucket).getPublicUrl(f.name);
          orphanList.push({
            bucket: videoBucket,
            name: f.name,
            id: f.id,
            size: f.metadata?.size || 0,
            created_at: f.created_at,
            publicUrl: pubUrl?.publicUrl || '',
            isVideo: true,
            selected: false
          });
        }
      });

      state.orphanFiles = orphanList;
      state.storageTotalFilesCount = imageFiles.length + videoFiles.length;

      renderOrphanView();
      showToast(`Scan complete: ${orphanList.length} orphan file(s) found.`);
    } catch (err) {
      console.error('Scan orphan files error:', err);
      showToast('Scan error: ' + err.message);
      if (dom.orphanFilesList) {
        dom.orphanFilesList.innerHTML = `
          <div style="text-align: center; padding: 2.5rem 1rem; color: #dc2626;">
            <p style="font-weight: 700; margin-bottom: 0.5rem;">⚠️ Scan Failed</p>
            <p style="font-size: 0.82rem; color: #64748b; margin-bottom: 1rem;">${escapeHtml(err.message)}</p>
            <button type="button" id="btn-scan-orphans-retry" class="btn-secondary" style="font-size: 0.82rem;">
              🔄 Retry Scan
            </button>
          </div>
        `;
        const retryBtn = document.getElementById('btn-scan-orphans-retry');
        if (retryBtn) retryBtn.addEventListener('click', scanOrphanFiles);
      }
    } finally {
      state.isScanningOrphans = false;
      if (dom.btnScanOrphans) {
        dom.btnScanOrphans.disabled = false;
        dom.btnScanOrphans.textContent = '🔄 Scan Storage';
      }
      if (dom.btnScanOrphansEmpty) {
        dom.btnScanOrphansEmpty.disabled = false;
        dom.btnScanOrphansEmpty.textContent = '🔄 Scan Storage Now';
      }
    }
  }

  /**
   * Renders orphan file stats, toolbar, and file listing
   */
  function renderOrphanView() {
    if (!state.orphanFiles) return;

    const totalStorage = state.storageTotalFilesCount || 0;
    const orphanCount = state.orphanFiles.length;
    const activeCount = Math.max(0, totalStorage - orphanCount);
    const totalBytes = state.orphanFiles.reduce((acc, f) => acc + (f.size || 0), 0);

    // Update Metrics
    if (dom.statTotalStorageFiles) dom.statTotalStorageFiles.textContent = totalStorage;
    if (dom.statActiveFiles) dom.statActiveFiles.textContent = activeCount;
    if (dom.statOrphanFiles) dom.statOrphanFiles.textContent = orphanCount;
    if (dom.statOrphanSize) dom.statOrphanSize.textContent = formatBytes(totalBytes);
    if (dom.orphanTabBadge) {
      dom.orphanTabBadge.textContent = orphanCount === 0 ? 'Clean' : `${orphanCount} unlinked`;
    }

    if (orphanCount === 0) {
      if (dom.orphanToolbar) dom.orphanToolbar.style.display = 'none';
      if (dom.orphanFilesList) {
        const imgB = CONFIG.STORAGE_BUCKET || 'saree-images';
        const vidB = CONFIG.STORAGE_VIDEO_BUCKET || 'saree-videos';
        dom.orphanFilesList.innerHTML = `
          <div style="text-align: center; padding: 3rem 1.5rem; color: #16a34a;">
            <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🎉</div>
            <h3 style="font-size: 1.15rem; font-weight: 700; color: #15803d; margin-bottom: 0.4rem;">
              Storage is Completely Clean!
            </h3>
            <p style="font-size: 0.85rem; color: #64748b; max-width: 440px; margin: 0 auto; line-height: 1.5;">
              Every file in <code>${escapeHtml(imgB)}</code> and <code>${escapeHtml(vidB)}</code> is actively referenced by a saree in your catalog. No storage waste detected.
            </p>
          </div>
        `;
      }
      return;
    }

    // Show toolbar
    if (dom.orphanToolbar) dom.orphanToolbar.style.display = 'flex';
    updateOrphanSelectionToolbar();

    // Render list
    if (dom.orphanFilesList) {
      dom.orphanFilesList.innerHTML = state.orphanFiles.map((file, idx) => {
        return `
          <div class="orphan-file-row" data-bucket="${escapeHtml(file.bucket)}" data-name="${escapeHtml(file.name)}">
            <div class="orphan-file-left">
              <input 
                type="checkbox" 
                class="orphan-file-checkbox" 
                data-index="${idx}" 
                ${file.selected ? 'checked' : ''}
                style="width: 16px; height: 16px; cursor: pointer; flex-shrink: 0;"
              >
              ${file.isVideo ? `
                <div class="orphan-video-icon">
                  <span>▶</span>
                  <span style="font-size: 0.55rem; font-weight: 700;">VIDEO</span>
                </div>
              ` : `
                <img 
                  src="${escapeHtml(file.publicUrl)}" 
                  alt="${escapeHtml(file.name)}" 
                  class="orphan-file-thumb" 
                  onerror="this.src='${PLACEHOLDER_IMG}';"
                >
              `}
              <div class="orphan-file-info">
                <span class="orphan-file-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>
                <div class="orphan-file-meta">
                  <span class="orphan-bucket-badge">${escapeHtml(file.bucket)}</span>
                  <span>${formatBytes(file.size)}</span>
                  ${file.created_at ? `<span>• ${formatDate(file.created_at)}</span>` : ''}
                </div>
              </div>
            </div>

            <div style="flex-shrink: 0;">
              <button 
                type="button" 
                class="btn-admin-action btn-delete btn-delete-orphan-single" 
                data-index="${idx}" 
                title="Delete this unreferenced file"
              >
                🗑️ Delete
              </button>
            </div>
          </div>
        `;
      }).join('');

      // Wire checkboxes
      dom.orphanFilesList.querySelectorAll('.orphan-file-checkbox').forEach(cb => {
        cb.addEventListener('change', e => {
          const idx = parseInt(e.target.getAttribute('data-index'), 10);
          if (state.orphanFiles[idx]) {
            state.orphanFiles[idx].selected = e.target.checked;
            updateOrphanSelectionToolbar();
          }
        });
      });

      // Wire individual delete buttons
      dom.orphanFilesList.querySelectorAll('.btn-delete-orphan-single').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.getAttribute('data-index'), 10);
          deleteSingleOrphan(idx);
        });
      });
    }
  }

  function updateOrphanSelectionToolbar() {
    if (!state.orphanFiles) return;

    const selected = state.orphanFiles.filter(f => f.selected);
    const selectedCount = selected.length;
    const totalCount = state.orphanFiles.length;

    if (dom.orphanSelectedCountLabel) {
      dom.orphanSelectedCountLabel.textContent = `(${selectedCount} selected)`;
    }

    if (dom.btnDeleteSelectedOrphans) {
      dom.btnDeleteSelectedOrphans.disabled = selectedCount === 0;
      dom.btnDeleteSelectedOrphans.textContent = `🗑️ Delete Selected (${selectedCount})`;
    }

    if (dom.orphanSelectAll) {
      dom.orphanSelectAll.checked = totalCount > 0 && selectedCount === totalCount;
      dom.orphanSelectAll.indeterminate = selectedCount > 0 && selectedCount < totalCount;
    }
  }

  async function deleteSingleOrphan(index) {
    const file = state.orphanFiles[index];
    if (!file) return;

    const confirmed = window.confirm(`Are you sure you want to permanently delete "${file.name}" from "${file.bucket}"?\n\nThis unreferenced file (${formatBytes(file.size)}) will be permanently removed.`);
    if (!confirmed) return;

    try {
      const { error } = await state.supabaseClient.storage
        .from(file.bucket)
        .remove([file.name]);

      if (error) throw error;

      showToast(`Deleted ${file.name}`);
      state.orphanFiles.splice(index, 1);
      if (state.storageTotalFilesCount > 0) state.storageTotalFilesCount--;
      renderOrphanView();
    } catch (err) {
      console.error('Failed to delete orphan file:', err);
      showToast('Failed to delete file: ' + err.message);
    }
  }

  async function deleteSelectedOrphans() {
    if (!state.orphanFiles) return;
    const selected = state.orphanFiles.filter(f => f.selected);
    if (selected.length === 0) {
      showToast('No files selected for deletion.');
      return;
    }

    const totalBytes = selected.reduce((acc, f) => acc + (f.size || 0), 0);
    const confirmed = window.confirm(`Are you sure you want to permanently delete ${selected.length} selected orphan file(s)?\n\nThis will free up ${formatBytes(totalBytes)} of storage.\n\nThis action CANNOT be undone.`);
    if (!confirmed) return;

    dom.btnDeleteSelectedOrphans.disabled = true;
    dom.btnDeleteSelectedOrphans.textContent = 'Deleting...';

    try {
      const imageBucket = CONFIG.STORAGE_BUCKET || 'saree-images';
      const videoBucket = CONFIG.STORAGE_VIDEO_BUCKET || 'saree-videos';

      const imagesToDelete = selected.filter(f => f.bucket === imageBucket).map(f => f.name);
      const videosToDelete = selected.filter(f => f.bucket === videoBucket).map(f => f.name);

      if (imagesToDelete.length > 0) {
        const { error: imgErr } = await state.supabaseClient.storage.from(imageBucket).remove(imagesToDelete);
        if (imgErr) throw imgErr;
      }

      if (videosToDelete.length > 0) {
        const { error: vidErr } = await state.supabaseClient.storage.from(videoBucket).remove(videosToDelete);
        if (vidErr) throw vidErr;
      }

      showToast(`Successfully deleted ${selected.length} orphan file(s)!`);
      await scanOrphanFiles();
    } catch (err) {
      console.error('Failed to delete selected files:', err);
      showToast('Error deleting files: ' + err.message);
    } finally {
      if (dom.btnDeleteSelectedOrphans) {
        dom.btnDeleteSelectedOrphans.disabled = false;
      }
    }
  }

  async function deleteAllOrphans() {
    if (!state.orphanFiles || state.orphanFiles.length === 0) {
      showToast('No orphan files to delete.');
      return;
    }

    const totalCount = state.orphanFiles.length;
    const totalBytes = state.orphanFiles.reduce((acc, f) => acc + (f.size || 0), 0);

    const confirmed = window.confirm(`⚠️ WARNING: DELETE ALL ORPHAN FILES?\n\nYou are about to permanently delete all ${totalCount} unreferenced file(s) across your storage buckets.\n\nSpace to reclaim: ${formatBytes(totalBytes)}\n\nThis action CANNOT be undone. Are you sure you want to proceed?`);
    if (!confirmed) return;

    dom.btnDeleteAllOrphans.disabled = true;
    dom.btnDeleteAllOrphans.textContent = 'Deleting All...';

    try {
      const imageBucket = CONFIG.STORAGE_BUCKET || 'saree-images';
      const videoBucket = CONFIG.STORAGE_VIDEO_BUCKET || 'saree-videos';

      const imagesToDelete = state.orphanFiles.filter(f => f.bucket === imageBucket).map(f => f.name);
      const videosToDelete = state.orphanFiles.filter(f => f.bucket === videoBucket).map(f => f.name);

      if (imagesToDelete.length > 0) {
        const { error: imgErr } = await state.supabaseClient.storage.from(imageBucket).remove(imagesToDelete);
        if (imgErr) throw imgErr;
      }

      if (videosToDelete.length > 0) {
        const { error: vidErr } = await state.supabaseClient.storage.from(videoBucket).remove(videosToDelete);
        if (vidErr) throw vidErr;
      }

      showToast(`Successfully cleaned up ${totalCount} orphan file(s)!`);
      await scanOrphanFiles();
    } catch (err) {
      console.error('Failed to delete all orphan files:', err);
      showToast('Error deleting all orphans: ' + err.message);
    } finally {
      if (dom.btnDeleteAllOrphans) {
        dom.btnDeleteAllOrphans.disabled = false;
        dom.btnDeleteAllOrphans.textContent = '⚠️ Delete All Orphans';
      }
    }
  }

  // ----------------------------------------------------------------------------
  // VISITOR & SAREE ANALYTICS (STATS TAB)
  // ----------------------------------------------------------------------------
  async function loadStatsData() {
    if (!state.supabaseClient) {
      showToast('Supabase client not connected.');
      return;
    }

    if (state.isLoadingStats) return;
    state.isLoadingStats = true;

    if (dom.btnRefreshStats) {
      dom.btnRefreshStats.disabled = true;
      dom.btnRefreshStats.textContent = '⏳ Loading...';
    }

    if (dom.statsBannerNotice) {
      dom.statsBannerNotice.style.display = 'none';
      dom.statsBannerNotice.innerHTML = '';
    }

    if (dom.statsDailyChartWrap) {
      dom.statsDailyChartWrap.innerHTML = `
        <div style="text-align: center; padding: 2.5rem; color: #64748b; font-size: 0.85rem;">
          Loading statistics from Supabase...
        </div>
      `;
    }

    try {
      // 1. Fetch events from saree_events
      const { data: events, error } = await state.supabaseClient
        .from('saree_events')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      state.statsEvents = events || [];

      // Ensure sarees catalog is loaded
      if (state.allSarees.length === 0) {
        const { data: sareesData } = await state.supabaseClient
          .from('sarees')
          .select('*')
          .order('id', { ascending: false });
        if (sareesData) state.allSarees = sareesData;
      }

      processAndRenderStats(state.statsEvents, state.allSarees);

      if (state.statsEvents.length === 0 && dom.statsBannerNotice) {
        dom.statsBannerNotice.style.display = 'block';
        dom.statsBannerNotice.innerHTML = `
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 0.9rem 1.1rem; color: #166534; font-size: 0.85rem; display: flex; align-items: flex-start; gap: 0.65rem;">
            <span style="font-size: 1.1rem; line-height: 1;">💡</span>
            <div>
              <strong>Analytics table is connected!</strong>
              <p style="margin: 0.2rem 0 0 0; color: #15803d; font-size: 0.8rem; line-height: 1.4;">
                No visitor traffic recorded yet. Saree views and WhatsApp order clicks will appear here automatically in real time as visitors browse your website.
              </p>
            </div>
          </div>
        `;
      }

    } catch (err) {
      console.error('Failed to load statistics:', err);
      showToast('Stats error: ' + err.message);

      if (dom.statsBannerNotice) {
        dom.statsBannerNotice.style.display = 'block';
        dom.statsBannerNotice.innerHTML = `
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 1rem 1.25rem; color: #991b1b; font-size: 0.85rem;">
            <div style="font-weight: 700; margin-bottom: 0.35rem; display: flex; align-items: center; gap: 0.5rem;">
              <span>⚠️</span>
              <span>Statistics Table Setup Required in Supabase</span>
            </div>
            <p style="margin: 0 0 0.65rem 0; font-size: 0.82rem; color: #7f1d1d; line-height: 1.5;">
              To view analytics, make sure the <code>saree_events</code> table has been created in your Supabase project.<br>
              Run the SQL script from <code>supabase-setup.sql</code> in your Supabase SQL Editor.
            </p>
            <div style="font-size: 0.78rem; font-family: monospace; background: #fee2e2; padding: 0.35rem 0.65rem; border-radius: 4px; margin-bottom: 0.75rem; word-break: break-all;">
              ${escapeHtml(err.message)}
            </div>
            <button type="button" id="btn-stats-banner-retry" class="btn-primary" style="font-size: 0.8rem; padding: 0.35rem 0.85rem;">
              🔄 Retry Fetch
            </button>
          </div>
        `;
        const bannerRetry = document.getElementById('btn-stats-banner-retry');
        if (bannerRetry) bannerRetry.addEventListener('click', loadStatsData);
      }

      if (dom.statsDailyChartWrap) {
        dom.statsDailyChartWrap.innerHTML = `
          <div style="text-align: center; padding: 2rem 1rem; color: #94a3b8; font-size: 0.85rem;">
            Analytics chart will display here once <code>saree_events</code> table is active.
          </div>
        `;
      }
    } finally {
      state.isLoadingStats = false;
      if (dom.btnRefreshStats) {
        dom.btnRefreshStats.disabled = false;
        dom.btnRefreshStats.textContent = '🔄 Refresh Stats';
      }
    }
  }

  function processAndRenderStats(events, sarees) {
    const now = Date.now();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const tToday = startOfToday.getTime();
    const t7d = now - (7 * 86400000);
    const t30d = now - (30 * 86400000);

    let todayViews = 0, todayClicks = 0;
    let views7d = 0, clicks7d = 0;
    let views30d = 0, clicks30d = 0;
    let allViews = 0, allClicks = 0;
    const allVisitorsSet = new Set();

    // Map each saree to its statistics
    const sareeStatsMap = new Map();
    sarees.forEach(s => {
      sareeStatsMap.set(s.id, {
        id: s.id,
        name: s.name,
        price: s.price,
        status: s.status,
        fabric: s.fabric || 'Silk',
        images: Array.isArray(s.images) ? s.images : (s.image_url ? [s.image_url] : []),
        views7d: 0,
        clicks7d: 0,
        views30d: 0,
        clicks30d: 0,
        viewsAll: 0,
        clicksAll: 0,
        uniqueVisitors: new Set()
      });
    });

    events.forEach(e => {
      const time = new Date(e.created_at).getTime();
      const isView = e.event_type === 'view';
      const isClick = e.event_type === 'whatsapp_click';

      // KPI Time windows
      if (time >= tToday) {
        if (isView) todayViews++;
        if (isClick) todayClicks++;
      }
      if (time >= t7d) {
        if (isView) views7d++;
        if (isClick) clicks7d++;
      }
      if (time >= t30d) {
        if (isView) views30d++;
        if (isClick) clicks30d++;
      }
      if (isView) allViews++;
      if (isClick) allClicks++;

      if (e.visitor_id) {
        allVisitorsSet.add(e.visitor_id);
      }

      // Per-saree counters
      if (e.saree_id && sareeStatsMap.has(e.saree_id)) {
        const item = sareeStatsMap.get(e.saree_id);
        if (time >= t7d) {
          if (isView) item.views7d++;
          if (isClick) item.clicks7d++;
        }
        if (time >= t30d) {
          if (isView) item.views30d++;
          if (isClick) item.clicks30d++;
        }
        if (isView) {
          item.viewsAll++;
          if (e.visitor_id) item.uniqueVisitors.add(e.visitor_id);
        }
        if (isClick) item.clicksAll++;
      }
    });

    // 1. Update KPI Card numbers
    const elTodayV = document.getElementById('stat-today-views');
    const elTodayC = document.getElementById('stat-today-clicks');
    const elTodayConv = document.getElementById('stat-today-conv');
    if (elTodayV) elTodayV.textContent = todayViews;
    if (elTodayC) elTodayC.textContent = todayClicks;
    if (elTodayConv) {
      const conv = todayViews > 0 ? ((todayClicks / todayViews) * 100).toFixed(1) : '0.0';
      elTodayConv.textContent = `${conv}% conversion`;
    }

    const el7dV = document.getElementById('stat-7d-views');
    const el7dC = document.getElementById('stat-7d-clicks');
    const el7dConv = document.getElementById('stat-7d-conv');
    if (el7dV) el7dV.textContent = views7d;
    if (el7dC) el7dC.textContent = clicks7d;
    if (el7dConv) {
      const conv = views7d > 0 ? ((clicks7d / views7d) * 100).toFixed(1) : '0.0';
      el7dConv.textContent = `${conv}% conversion`;
    }

    const el30dV = document.getElementById('stat-30d-views');
    const el30dC = document.getElementById('stat-30d-clicks');
    const el30dConv = document.getElementById('stat-30d-conv');
    if (el30dV) el30dV.textContent = views30d;
    if (el30dC) el30dC.textContent = clicks30d;
    if (el30dConv) {
      const conv = views30d > 0 ? ((clicks30d / views30d) * 100).toFixed(1) : '0.0';
      el30dConv.textContent = `${conv}% conversion`;
    }

    const elAllV = document.getElementById('stat-all-views');
    const elAllC = document.getElementById('stat-all-clicks');
    const elAllVis = document.getElementById('stat-all-visitors');
    const elAllConv = document.getElementById('stat-all-conv');
    if (elAllV) elAllV.textContent = allViews;
    if (elAllC) elAllC.textContent = allClicks;
    if (elAllVis) elAllVis.textContent = allVisitorsSet.size;
    if (elAllConv) {
      const conv = allViews > 0 ? ((allClicks / allViews) * 100).toFixed(1) : '0.0';
      elAllConv.textContent = `${conv}% conversion`;
    }

    // 2. Generate 14-day daily buckets for SVG Bar Chart
    const dailyTrend = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dateKey = `${yyyy}-${mm}-${dd}`;
      const label = (i === 0) ? 'Today' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      dailyTrend.push({
        dateKey: dateKey,
        dateStr: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        label: label,
        views: 0,
        clicks: 0
      });
    }

    events.forEach(e => {
      const eDateKey = new Date(e.created_at).toISOString().split('T')[0];
      const match = dailyTrend.find(d => d.dateKey === eDateKey);
      if (match) {
        if (e.event_type === 'view') match.views++;
        else if (e.event_type === 'whatsapp_click') match.clicks++;
      }
    });

    renderDailyActivityChart(dailyTrend);

    // 3. Render Top 10 Most Viewed Sarees
    const allSareeStats = Array.from(sareeStatsMap.values());
    const topViewed = [...allSareeStats].sort((a, b) => b.viewsAll - a.viewsAll).slice(0, 10);
    renderTopViewedTable(topViewed);

    // 4. Render Most Ordered (WhatsApp Clicks)
    const topClicked = [...allSareeStats].filter(s => s.clicksAll > 0).sort((a, b) => b.clicksAll - a.clicksAll).slice(0, 10);
    renderTopClickedTable(topClicked);

    // 5. Render Views But No Orders (Needs Attention / Opportunities)
    const noClicks = [...allSareeStats].filter(s => s.viewsAll > 0 && s.clicksAll === 0).sort((a, b) => b.viewsAll - a.viewsAll);
    renderNoClicksTable(noClicks);
  }

  function renderDailyActivityChart(dailyData) {
    if (!dom.statsDailyChartWrap) return;

    if (!dailyData || dailyData.length === 0) {
      dom.statsDailyChartWrap.innerHTML = `
        <div style="text-align: center; padding: 2rem; color: #94a3b8; font-size: 0.85rem;">
          No visitor activity recorded yet.
        </div>
      `;
      return;
    }

    const svgWidth = 680;
    const svgHeight = 220;
    const chartLeft = 40;
    const chartRight = 660;
    const chartTop = 25;
    const chartBottom = 165;
    const chartHeight = chartBottom - chartTop;
    const chartWidth = chartRight - chartLeft;

    let maxVal = 1;
    dailyData.forEach(d => {
      if (d.views > maxVal) maxVal = d.views;
      if (d.clicks > maxVal) maxVal = d.clicks;
    });
    maxVal = Math.ceil(maxVal * 1.15);

    const numSlots = dailyData.length;
    const slotWidth = chartWidth / numSlots;
    const barWidth = Math.min(14, Math.max(6, Math.floor(slotWidth * 0.32)));

    // Grid lines (0, 50%, 100%)
    let gridLinesHtml = '';
    const steps = [0, Math.round(maxVal / 2), maxVal];
    steps.forEach(val => {
      const y = chartBottom - (val / maxVal) * chartHeight;
      gridLinesHtml += `
        <line x1="${chartLeft}" y1="${y}" x2="${chartRight}" y2="${y}" stroke="#e2e8f0" stroke-dasharray="3,3" stroke-width="1" />
        <text x="${chartLeft - 6}" y="${y + 3}" text-anchor="end" font-size="10" fill="#94a3b8">${val}</text>
      `;
    });

    let barsHtml = '';
    dailyData.forEach((d, idx) => {
      const slotCenterX = chartLeft + (idx + 0.5) * slotWidth;
      const viewBarX = slotCenterX - barWidth - 1;
      const clickBarX = slotCenterX + 1;

      const viewHeight = Math.max(2, (d.views / maxVal) * chartHeight);
      const viewY = chartBottom - viewHeight;

      const clickHeight = Math.max(2, (d.clicks / maxVal) * chartHeight);
      const clickY = chartBottom - clickHeight;

      barsHtml += `
        <g class="chart-day-group">
          <!-- Views bar -->
          <rect x="${viewBarX}" y="${viewY}" width="${barWidth}" height="${viewHeight}" rx="3" fill="#6366f1">
            <title>${d.dateStr}: ${d.views} Views</title>
          </rect>
          ${d.views > 0 ? `<text x="${viewBarX + barWidth / 2}" y="${viewY - 4}" text-anchor="middle" font-size="9" font-weight="600" fill="#4f46e5">${d.views}</text>` : ''}

          <!-- Clicks bar -->
          <rect x="${clickBarX}" y="${clickY}" width="${barWidth}" height="${clickHeight}" rx="3" fill="#10b981">
            <title>${d.dateStr}: ${d.clicks} WhatsApp Orders</title>
          </rect>
          ${d.clicks > 0 ? `<text x="${clickBarX + barWidth / 2}" y="${clickY - 4}" text-anchor="middle" font-size="9" font-weight="600" fill="#059669">${d.clicks}</text>` : ''}

          <!-- Date label below axis -->
          <text x="${slotCenterX}" y="185" text-anchor="middle" font-size="10" fill="#64748b">${d.label}</text>
        </g>
      `;
    });

    dom.statsDailyChartWrap.innerHTML = `
      <svg class="stats-svg-chart" viewBox="0 0 ${svgWidth} ${svgHeight}" preserveAspectRatio="xMidYMid meet">
        <line x1="${chartLeft}" y1="${chartBottom}" x2="${chartRight}" y2="${chartBottom}" stroke="#cbd5e1" stroke-width="1.5" />
        ${gridLinesHtml}
        ${barsHtml}
      </svg>
    `;
  }

  function renderTopViewedTable(sarees) {
    if (!dom.statsTopViewedList) return;

    if (!sarees || sarees.length === 0 || sarees.every(s => s.viewsAll === 0)) {
      dom.statsTopViewedList.innerHTML = `
        <div style="text-align: center; padding: 1.5rem; color: #94a3b8; font-size: 0.85rem;">
          No saree views recorded yet.
        </div>
      `;
      return;
    }

    dom.statsTopViewedList.innerHTML = `
      <table class="stats-table">
        <thead>
          <tr>
            <th style="width: 30px;">#</th>
            <th>Saree</th>
            <th>Price</th>
            <th title="Total Views / Last 30d">Views</th>
            <th>Orders</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${sarees.map((s, idx) => {
            const thumb = (s.images && s.images[0]) || PLACEHOLDER_IMG;
            const conv = s.viewsAll > 0 ? ((s.clicksAll / s.viewsAll) * 100).toFixed(0) : '0';
            return `
              <tr>
                <td style="font-weight: 700; color: #64748b;">${idx + 1}</td>
                <td>
                  <div class="stats-saree-cell">
                    <img src="${escapeHtml(thumb)}" alt="${escapeHtml(s.name)}" class="stats-thumb-img" onerror="this.src='${PLACEHOLDER_IMG}';">
                    <div>
                      <span class="stats-saree-name" title="${escapeHtml(s.name)}">#${s.id} ${escapeHtml(s.name)}</span>
                      <span class="stats-saree-sub">${escapeHtml(s.fabric)} • ${s.uniqueVisitors.size} visitors</span>
                    </div>
                  </div>
                </td>
                <td style="font-weight: 600;">${formatPrice(s.price)}</td>
                <td>
                  <span class="stat-pill stat-pill-view">👁️ ${s.viewsAll}</span>
                  <span style="font-size: 0.72rem; color: #64748b; margin-left: 3px;">(${s.views30d} in 30d)</span>
                </td>
                <td>
                  <span class="stat-pill stat-pill-click">💬 ${s.clicksAll}</span>
                  <span style="font-size: 0.72rem; color: #16a34a; font-weight: 600; margin-left: 3px;">${conv}%</span>
                </td>
                <td>
                  <button type="button" class="btn-admin-action btn-stats-edit-saree" data-id="${s.id}" style="font-size: 0.75rem; padding: 2px 7px;">
                    ✏️ Edit
                  </button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;

    attachStatsEditListeners();
  }

  function renderTopClickedTable(sarees) {
    if (!dom.statsTopClickedList) return;

    if (!sarees || sarees.length === 0) {
      dom.statsTopClickedList.innerHTML = `
        <div style="text-align: center; padding: 1.5rem; color: #94a3b8; font-size: 0.85rem;">
          No WhatsApp order clicks recorded yet.
        </div>
      `;
      return;
    }

    dom.statsTopClickedList.innerHTML = `
      <table class="stats-table">
        <thead>
          <tr>
            <th style="width: 30px;">#</th>
            <th>Saree</th>
            <th>Price</th>
            <th>Orders</th>
            <th>Views</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${sarees.map((s, idx) => {
            const thumb = (s.images && s.images[0]) || PLACEHOLDER_IMG;
            const conv = s.viewsAll > 0 ? ((s.clicksAll / s.viewsAll) * 100).toFixed(0) : '0';
            return `
              <tr>
                <td style="font-weight: 700; color: #16a34a;">${idx + 1}</td>
                <td>
                  <div class="stats-saree-cell">
                    <img src="${escapeHtml(thumb)}" alt="${escapeHtml(s.name)}" class="stats-thumb-img" onerror="this.src='${PLACEHOLDER_IMG}';">
                    <div>
                      <span class="stats-saree-name" title="${escapeHtml(s.name)}">#${s.id} ${escapeHtml(s.name)}</span>
                      <span class="stats-saree-sub">${escapeHtml(s.fabric)} • ${s.status}</span>
                    </div>
                  </div>
                </td>
                <td style="font-weight: 600;">${formatPrice(s.price)}</td>
                <td>
                  <span class="stat-pill stat-pill-click">💬 ${s.clicksAll} orders</span>
                  <span style="font-size: 0.72rem; color: #16a34a; font-weight: 600; margin-left: 3px;">(${s.clicks30d} in 30d)</span>
                </td>
                <td>
                  <span class="stat-pill stat-pill-view">👁️ ${s.viewsAll}</span>
                  <span style="font-size: 0.72rem; color: #64748b; margin-left: 3px;">${conv}% rate</span>
                </td>
                <td>
                  <button type="button" class="btn-admin-action btn-stats-edit-saree" data-id="${s.id}" style="font-size: 0.75rem; padding: 2px 7px;">
                    ✏️ Edit
                  </button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;

    attachStatsEditListeners();
  }

  function renderNoClicksTable(sarees) {
    if (!dom.statsNoClicksList) return;

    if (!sarees || sarees.length === 0) {
      dom.statsNoClicksList.innerHTML = `
        <div style="text-align: center; padding: 1.5rem; color: #15803d; font-size: 0.85rem;">
          🎉 All viewed sarees currently have customer orders or enquiries! No stalled sarees found.
        </div>
      `;
      return;
    }

    dom.statsNoClicksList.innerHTML = `
      <table class="stats-table">
        <thead>
          <tr>
            <th>Saree</th>
            <th>Price</th>
            <th>Status</th>
            <th>Views</th>
            <th>Action Suggestion</th>
            <th>Manage</th>
          </tr>
        </thead>
        <tbody>
          ${sarees.slice(0, 10).map(s => {
            const thumb = (s.images && s.images[0]) || PLACEHOLDER_IMG;
            return `
              <tr>
                <td>
                  <div class="stats-saree-cell">
                    <img src="${escapeHtml(thumb)}" alt="${escapeHtml(s.name)}" class="stats-thumb-img" onerror="this.src='${PLACEHOLDER_IMG}';">
                    <div>
                      <span class="stats-saree-name" title="${escapeHtml(s.name)}">#${s.id} ${escapeHtml(s.name)}</span>
                      <span class="stats-saree-sub">${escapeHtml(s.fabric)}</span>
                    </div>
                  </div>
                </td>
                <td style="font-weight: 600; color: #b91c1c;">${formatPrice(s.price)}</td>
                <td>
                  <span class="badge ${s.status === 'Sold' ? 'badge-sold' : 'badge-available'}">${s.status}</span>
                </td>
                <td>
                  <span class="stat-pill stat-pill-warn">👁️ ${s.viewsAll} views (0 orders)</span>
                </td>
                <td style="font-size: 0.75rem; color: #475569; max-width: 250px;">
                  💡 Customer interest without order. Consider dropping price ₹100–₹200 or adding drape video.
                </td>
                <td>
                  <button type="button" class="btn-admin-action btn-stats-edit-saree" data-id="${s.id}" style="font-size: 0.75rem; padding: 3px 8px; font-weight: 600;">
                    ✏️ Edit Price/Photos
                  </button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;

    attachStatsEditListeners();
  }

  function attachStatsEditListeners() {
    document.querySelectorAll('.btn-stats-edit-saree').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const saree = state.allSarees.find(s => String(s.id) === String(id));
        if (saree) {
          startEditingSaree(saree);
        }
      });
    });
  }

  async function purgeOldEvents() {
    if (!state.supabaseClient) return;

    const countEstimate = (state.statsEvents || []).filter(e => {
      const t = new Date(e.created_at).getTime();
      return t < (Date.now() - 90 * 86400000);
    }).length;

    const confirmed = confirm(
      `Delete visitor and analytics events older than 90 days?\n\n` +
      `This permanently deletes old event log rows (${countEstimate} older than 90 days) to keep your Supabase database free and fast.\n\n` +
      `Saree records, prices, and recent stats will not be affected.`
    );
    if (!confirmed) return;

    setProgress('Purging events older than 90 days...', 40);

    try {
      let deletedCount = null;
      // 1. Try RPC function
      try {
        const { data, error } = await state.supabaseClient.rpc('delete_old_saree_events', { days_threshold: 90 });
        if (!error && data !== null) deletedCount = data;
      } catch (rpcErr) {
        console.warn('RPC delete_old_saree_events not available, using direct delete fallback:', rpcErr);
      }

      // 2. Direct delete fallback
      if (deletedCount === null) {
        const cutoff = new Date(Date.now() - 90 * 86400000).toISOString();
        const { error: delErr } = await state.supabaseClient
          .from('saree_events')
          .delete()
          .lt('created_at', cutoff);
        if (delErr) throw delErr;
      }

      setProgress(null, null);
      showToast('Database maintenance complete! Old events pruned successfully.');
      await loadStatsData();
    } catch (err) {
      setProgress(null, null);
      console.error('Failed to purge old events:', err);
      showToast('Cleanup error: ' + err.message);
    }
  }

  // ----------------------------------------------------------------------------
  // TAB SWITCHER
  // ----------------------------------------------------------------------------
  function switchToTab(tabName) {
    if (dom.tabFormBtn) dom.tabFormBtn.classList.toggle('active', tabName === 'form');
    if (dom.tabListBtn) dom.tabListBtn.classList.toggle('active', tabName === 'list');
    if (dom.tabReviewsBtn) dom.tabReviewsBtn.classList.toggle('active', tabName === 'reviews');
    if (dom.tabCleanupBtn) dom.tabCleanupBtn.classList.toggle('active', tabName === 'cleanup');
    if (dom.tabStatsBtn) dom.tabStatsBtn.classList.toggle('active', tabName === 'stats');

    if (dom.tabFormContent) dom.tabFormContent.style.display = tabName === 'form' ? 'block' : 'none';
    if (dom.tabListContent) dom.tabListContent.style.display = tabName === 'list' ? 'block' : 'none';
    if (dom.tabReviewsContent) dom.tabReviewsContent.style.display = tabName === 'reviews' ? 'block' : 'none';
    if (dom.tabCleanupContent) dom.tabCleanupContent.style.display = tabName === 'cleanup' ? 'block' : 'none';
    if (dom.tabStatsContent) dom.tabStatsContent.style.display = tabName === 'stats' ? 'block' : 'none';

    // Scroll active button into view on mobile horizontal tabs
    const tabMap = {
      form: dom.tabFormBtn,
      list: dom.tabListBtn,
      reviews: dom.tabReviewsBtn,
      cleanup: dom.tabCleanupBtn,
      stats: dom.tabStatsBtn
    };
    const activeBtn = tabMap[tabName];
    if (activeBtn && typeof activeBtn.scrollIntoView === 'function') {
      try {
        activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      } catch (e) {}
    }

    // Scroll window to top smoothly
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Sync URL hash
    try {
      if (window.location.hash !== '#' + tabName) {
        history.replaceState(null, '', '#' + tabName);
      }
    } catch (e) {}

    if (tabName === 'reviews') {
      populateReviewSareeDropdown();
    } else if (tabName === 'cleanup') {
      if (state.orphanFiles === null && !state.isScanningOrphans) {
        scanOrphanFiles();
      }
    } else if (tabName === 'stats') {
      loadStatsData();
    }
  }

  function checkUrlHashTab() {
    const hash = (window.location.hash || '').replace('#', '').toLowerCase();
    if (hash === 'stats' || hash === 'analytics') {
      switchToTab('stats');
    } else if (hash === 'list' || hash === 'sarees' || hash === 'manage') {
      switchToTab('list');
    } else if (hash === 'reviews') {
      switchToTab('reviews');
    } else if (hash === 'cleanup' || hash === 'storage') {
      switchToTab('cleanup');
    } else if (hash === 'form' || hash === 'add') {
      switchToTab('form');
    }
  }

  // ----------------------------------------------------------------------------
  // EVENT LISTENERS
  // ----------------------------------------------------------------------------
  function setupEventListeners() {
    // Auth
    if (dom.loginForm) dom.loginForm.addEventListener('submit', handleLogin);
    if (dom.btnLogout) dom.btnLogout.addEventListener('click', handleLogout);

    // Header Quick Stats Button
    if (dom.headerStatsBtn) dom.headerStatsBtn.addEventListener('click', () => switchToTab('stats'));

    // Tabs Individual Click Listeners
    if (dom.tabFormBtn) dom.tabFormBtn.addEventListener('click', () => switchToTab('form'));
    if (dom.tabListBtn) dom.tabListBtn.addEventListener('click', () => switchToTab('list'));
    if (dom.tabReviewsBtn) dom.tabReviewsBtn.addEventListener('click', () => switchToTab('reviews'));
    if (dom.tabCleanupBtn) dom.tabCleanupBtn.addEventListener('click', () => switchToTab('cleanup'));
    if (dom.tabStatsBtn) dom.tabStatsBtn.addEventListener('click', () => switchToTab('stats'));

    // Event Delegation on .admin-tabs for mobile touch / click reliability
    if (dom.adminTabsNav) {
      dom.adminTabsNav.addEventListener('click', (e) => {
        const btn = e.target.closest('.admin-tab-btn');
        if (!btn) return;
        if (btn.id === 'tab-form-btn') switchToTab('form');
        else if (btn.id === 'tab-list-btn') switchToTab('list');
        else if (btn.id === 'tab-reviews-btn') switchToTab('reviews');
        else if (btn.id === 'tab-cleanup-btn') switchToTab('cleanup');
        else if (btn.id === 'tab-stats-btn') switchToTab('stats');
      });
    }

    // URL Hash Routing
    window.addEventListener('hashchange', checkUrlHashTab);

    // Stats Actions
    if (dom.btnRefreshStats) dom.btnRefreshStats.addEventListener('click', loadStatsData);
    if (dom.btnPurgeOldEvents) dom.btnPurgeOldEvents.addEventListener('click', purgeOldEvents);
    if (dom.btnPurgeOldEventsBottom) dom.btnPurgeOldEventsBottom.addEventListener('click', purgeOldEvents);

    // Reviews
    if (dom.reviewSareeSelect) {
      dom.reviewSareeSelect.addEventListener('change', e => onReviewSareeChange(e.target.value));
    }
    if (dom.sareeReviewForm) {
      dom.sareeReviewForm.addEventListener('submit', handleReviewSubmit);
    }
    if (dom.btnCancelReviewEdit) {
      dom.btnCancelReviewEdit.addEventListener('click', resetReviewForm);
    }
    if (dom.btnChooseReviewPhotos) {
      dom.btnChooseReviewPhotos.addEventListener('click', () => dom.reviewPhotoFileInput.click());
    }
    if (dom.reviewPhotoFileInput) {
      dom.reviewPhotoFileInput.addEventListener('change', async e => {
        const files = Array.from(e.target.files || []);
        dom.reviewPhotoFileInput.value = '';
        if (files.length > 0) {
          await handleReviewPhotosSelected(files);
        }
      });
    }
    if (dom.btnAddReviewPhotoUrl) {
      dom.btnAddReviewPhotoUrl.addEventListener('click', () => {
        const url = (dom.inputReviewPhotoUrl ? dom.inputReviewPhotoUrl.value : '').trim();
        if (!url) return;
        state.currentReviewPhotos.push({
          type: 'link',
          url: url,
          previewUrl: url
        });
        dom.inputReviewPhotoUrl.value = '';
        renderReviewPhotoPreviews();
      });
    }

    // Orphan Cleanup
    if (dom.btnScanOrphans) dom.btnScanOrphans.addEventListener('click', scanOrphanFiles);
    if (dom.btnScanOrphansEmpty) dom.btnScanOrphansEmpty.addEventListener('click', scanOrphanFiles);
    if (dom.btnDeleteSelectedOrphans) dom.btnDeleteSelectedOrphans.addEventListener('click', deleteSelectedOrphans);
    if (dom.btnDeleteAllOrphans) dom.btnDeleteAllOrphans.addEventListener('click', deleteAllOrphans);
    if (dom.orphanSelectAll) {
      dom.orphanSelectAll.addEventListener('change', e => {
        const isChecked = e.target.checked;
        if (state.orphanFiles) {
          state.orphanFiles.forEach(f => { f.selected = isChecked; });
          renderOrphanView();
        }
      });
    }

    // Photo selection
    if (dom.btnChoosePhotos) {
      dom.btnChoosePhotos.addEventListener('click', () => dom.imageFilesInput.click());
    }
    if (dom.btnTakePhoto) {
      dom.btnTakePhoto.addEventListener('click', () => dom.cameraFileInput.click());
    }

    if (dom.imageFilesInput) {
      dom.imageFilesInput.addEventListener('change', async e => {
        const files = Array.from(e.target.files || []);
        dom.imageFilesInput.value = '';
        if (files.length > 0) {
          await handleFilesSelected(files);
        }
      });
    }

    if (dom.cameraFileInput) {
      dom.cameraFileInput.addEventListener('change', async e => {
        const files = Array.from(e.target.files || []);
        dom.cameraFileInput.value = '';
        if (files.length > 0) {
          await handleFilesSelected(files);
        }
      });
    }

    // Video Mode Switch
    if (dom.btnModeVideoUpload) {
      dom.btnModeVideoUpload.addEventListener('click', () => {
        dom.btnModeVideoUpload.classList.add('active');
        dom.btnModeVideoLink.classList.remove('active');
        dom.videoUploadPane.style.display = 'block';
        dom.videoLinkPane.style.display = 'none';
      });
    }

    if (dom.btnModeVideoLink) {
      dom.btnModeVideoLink.addEventListener('click', () => {
        dom.btnModeVideoLink.classList.add('active');
        dom.btnModeVideoUpload.classList.remove('active');
        dom.videoUploadPane.style.display = 'none';
        dom.videoLinkPane.style.display = 'block';
      });
    }

    // Video File Selection
    if (dom.btnChooseVideo) {
      dom.btnChooseVideo.addEventListener('click', () => dom.videoFileInput.click());
    }
    if (dom.btnRecordVideo) {
      dom.btnRecordVideo.addEventListener('click', () => dom.videoCameraInput.click());
    }

    if (dom.videoFileInput) {
      dom.videoFileInput.addEventListener('change', e => {
        if (e.target.files && e.target.files[0]) {
          handleVideoFileSelected(e.target.files[0]);
          dom.videoFileInput.value = '';
        }
      });
    }

    if (dom.videoCameraInput) {
      dom.videoCameraInput.addEventListener('change', e => {
        if (e.target.files && e.target.files[0]) {
          handleVideoFileSelected(e.target.files[0]);
          dom.videoCameraInput.value = '';
        }
      });
    }

    // Video Link
    if (dom.btnApplyVideoLink) {
      dom.btnApplyVideoLink.addEventListener('click', handleVideoLinkSubmit);
    }

    // Remove Video
    if (dom.btnRemoveVideo) {
      dom.btnRemoveVideo.addEventListener('click', () => {
        clearVideoData();
        showToast('Video removed from this saree.');
      });
    }

    // Auto-fill from WhatsApp Supplier Message
    if (dom.btnAutofillMessage) {
      dom.btnAutofillMessage.addEventListener('click', handleAutoFillFromMessage);
    }
    if (dom.btnClearSupplierText) {
      dom.btnClearSupplierText.addEventListener('click', () => {
        if (dom.inputSupplierText) dom.inputSupplierText.value = '';
        if (dom.autofillStatusBanner) {
          dom.autofillStatusBanner.innerHTML = '';
          dom.autofillStatusBanner.style.display = 'none';
        }
        if (dom.priceAlternativesWrap) {
          dom.priceAlternativesWrap.innerHTML = '';
          dom.priceAlternativesWrap.style.display = 'none';
        }
        clearFieldFeedback(dom.sareeForm);
        showToast('Pasted supplier message cleared.');
      });
    }

    // Cost Price & Margin calculation listeners
    if (dom.inputCostPrice) {
      dom.inputCostPrice.addEventListener('input', () => updateSellingPriceFromMargin(false));
    }
    if (dom.selectMarginType) {
      dom.selectMarginType.addEventListener('change', () => updateSellingPriceFromMargin(false));
    }
    if (dom.inputMarginVal) {
      dom.inputMarginVal.addEventListener('input', () => updateSellingPriceFromMargin(false));
    }
    if (dom.inputPrice) {
      dom.inputPrice.addEventListener('input', handleManualSellingPriceChange);
    }

    // Color Manager: Add Custom Color via button or Enter key
    if (dom.btnAddColor) {
      dom.btnAddColor.addEventListener('click', () => {
        if (dom.inputColor && dom.inputColor.value) {
          const val = dom.inputColor.value.trim();
          if (val) {
            addColorTag(val);
            dom.inputColor.value = '';
          }
        }
      });
    }

    if (dom.inputColor) {
      dom.inputColor.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const val = dom.inputColor.value.trim();
          if (val) {
            addColorTag(val);
            dom.inputColor.value = '';
          }
        }
      });
    }

    // Saree Form Submit & Cancel
    if (dom.sareeForm) dom.sareeForm.addEventListener('submit', handleSareeSubmit);
    if (dom.btnCancelEdit) dom.btnCancelEdit.addEventListener('click', resetForm);

    // List search & filters
    let searchTimer = null;
    if (dom.adminSearchInput) {
      dom.adminSearchInput.addEventListener('input', e => {
        clearTimeout(searchTimer);
        state.searchQuery = e.target.value;
        searchTimer = setTimeout(renderAdminList, 150);
      });
    }

    if (dom.adminStatusFilter) {
      dom.adminStatusFilter.addEventListener('change', e => {
        state.filterStatus = e.target.value;
        renderAdminList();
      });
    }

    if (dom.adminCategoryFilter) {
      dom.adminCategoryFilter.addEventListener('change', e => {
        state.filterCategory = e.target.value;
        renderAdminList();
      });
    }

    if (dom.btnRefreshList) {
      dom.btnRefreshList.addEventListener('click', () => {
        loadAllSarees();
        showToast('Inventory reloaded from Supabase.');
      });
    }
  }

  // ----------------------------------------------------------------------------
  // START
  // ----------------------------------------------------------------------------
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdmin);
  } else {
    initAdmin();
  }

})();
