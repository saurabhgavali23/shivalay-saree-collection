/**
 * ==============================================================================
 * SHIVALAY SAREE COLLECTION - PUBLIC CATALOG SCRIPT (app.js)
 * ==============================================================================
 * Connects to Supabase Database (or demo fallback if unconfigured):
 * - Hash routing (#/ and #/saree/:id) with scroll preservation
 * - Dynamic category, fabric, and color filters
 * - Real-time price slider and "Hide Sold" toggle
 * - Search by name, fabric, and description
 * - Swipeable gallery with CSS scroll-snap, thumbnails, and tap-to-zoom
 * - WhatsApp order links with pre-filled saree details
 * - Web Share API with copy-link fallback
 * - 5-minute sessionStorage caching with force-refresh support
 * ==============================================================================
 */

(function () {
  'use strict';

  // ----------------------------------------------------------------------------
  // APPLICATION STATE
  // ----------------------------------------------------------------------------
  const state = {
    allSarees: [],
    filteredSarees: [],
    currentRoute: '#/',
    catalogScrollY: 0,
    activeCategory: 'all',
    activeFabric: 'all',
    activeColor: 'all',
    selectedSareeColor: '',
    currentOrderSaree: null,
    currentOrderColor: '',
    currentOrderPhoto: '',
    maxPrice: Infinity,
    priceMin: 0,
    priceMax: 50000,
    hideSold: false,
    searchQuery: '',
    sortBy: 'newest',
    supabaseClient: null,
    isDemoMode: false
  };

  const CACHE_KEY = 'msc_supabase_sarees_cache_v2';
  const CACHE_TIME_KEY = 'msc_supabase_sarees_time_v2';
  const PLACEHOLDER_IMG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='800' viewBox='0 0 600 800'%3E%3Crect fill='%23f4ede4' width='600' height='800'/%3E%3Ctext fill='%239c9389' font-family='sans-serif' font-size='24' font-weight='600' x='50%25' y='50%25' text-anchor='middle'%3ESaree Image Coming Soon%3C/text%3E%3C/svg%3E";

  // ----------------------------------------------------------------------------
  // DOM REFERENCES
  // ----------------------------------------------------------------------------
  const dom = {};

  function cacheDom() {
    dom.catalogView = document.getElementById('catalog-view');
    dom.detailView = document.getElementById('detail-view');
    dom.sareeGrid = document.getElementById('saree-grid');
    dom.sareeDetailContent = document.getElementById('saree-detail-content');
    dom.similarSection = document.getElementById('similar-section');
    dom.similarSareesGrid = document.getElementById('similar-sarees-grid');
    dom.demoModeBanner = document.getElementById('demo-mode-banner');

    // States
    dom.emptyState = document.getElementById('empty-state');
    dom.errorState = document.getElementById('error-state');
    dom.errorMessage = document.getElementById('error-message');
    dom.btnRetry = document.getElementById('btn-retry');
    dom.btnLoadFallback = document.getElementById('btn-load-fallback');
    dom.btnEmptyReset = document.getElementById('btn-empty-reset');

    // Filter & Search Controls
    dom.searchInput = document.getElementById('search-input');
    dom.searchClearBtn = document.getElementById('search-clear-btn');
    dom.sortSelect = document.getElementById('sort-select');
    dom.btnToggleFilters = document.getElementById('btn-toggle-filters');
    dom.activeFilterBadge = document.getElementById('active-filter-badge');
    dom.filtersDrawer = document.getElementById('filters-drawer');
    dom.quickCategoryPills = document.getElementById('quick-category-pills');
    dom.filterCategory = document.getElementById('filter-category');
    dom.filterFabric = document.getElementById('filter-fabric');
    dom.filterColor = document.getElementById('filter-color');
    dom.filterPriceRange = document.getElementById('filter-price-range');
    dom.priceSliderValue = document.getElementById('price-slider-value');
    dom.filterHideSold = document.getElementById('filter-hide-sold');
    dom.btnClearFilters = document.getElementById('btn-clear-filters');
    dom.resultsCount = document.getElementById('results-count');

    // Header & Floating Buttons
    dom.headerShopName = document.getElementById('header-shop-name');
    dom.headerShopTagline = document.getElementById('header-shop-tagline');
    dom.headerWaLink = document.getElementById('header-wa-link');
    dom.floatingWaBtn = document.getElementById('floating-whatsapp-btn');
    dom.footerWaBtn = document.getElementById('footer-wa-btn');

    // Lightbox & Toast
    dom.lightboxModal = document.getElementById('lightbox-modal');
    dom.lightboxImg = document.getElementById('lightbox-img');
    dom.lightboxClose = document.getElementById('lightbox-close');
    dom.toastNotice = document.getElementById('toast-notice');
    dom.toastMessage = document.getElementById('toast-message');

    // Order Delivery Address Modal
    dom.orderAddressModal = document.getElementById('order-address-modal');
    dom.addressModalBackdrop = document.getElementById('address-modal-backdrop');
    dom.btnCloseAddressModal = document.getElementById('btn-close-address-modal');
    dom.btnCancelAddress = document.getElementById('btn-cancel-address');
    dom.orderAddressForm = document.getElementById('order-address-form');
    dom.addressOrderSummary = document.getElementById('address-order-summary');
    dom.addrName = document.getElementById('addr-name');
    dom.addrPhone = document.getElementById('addr-phone');
    dom.addrLine = document.getElementById('addr-line');
    dom.addrPincode = document.getElementById('addr-pincode');
    dom.addrCity = document.getElementById('addr-city');
    dom.addrState = document.getElementById('addr-state');
    dom.pincodeLookupHint = document.getElementById('pincode-lookup-hint');

    // Footer Refresh
    dom.btnForceRefresh = document.getElementById('btn-force-refresh');
  }

  // ----------------------------------------------------------------------------
  // UTILITY FUNCTIONS
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

  function getShippingInfo(saree) {
    const raw = (saree && saree.shipping_charges !== undefined && saree.shipping_charges !== null)
      ? Number(saree.shipping_charges)
      : (CONFIG.SHIPPING ? Number(CONFIG.SHIPPING.DEFAULT_CHARGE) : 0);
    const amount = isNaN(raw) || raw < 0 ? 0 : raw;
    const isFree = amount <= 0;
    return {
      isFree: isFree,
      amount: amount,
      tagText: isFree ? '🚚 Free Delivery' : `+ ${formatPrice(amount)} Delivery`,
      badgeText: isFree ? '🚚 Free Delivery' : `+ ${formatPrice(amount)} Shipping`,
      detailText: isFree ? 'Free Delivery across India' : `${formatPrice(amount)} Insured Shipping`
    };
  }

  function isItemNew(createdAtStr) {
    if (!createdAtStr) return false;
    try {
      const createdDate = new Date(createdAtStr);
      if (isNaN(createdDate.getTime())) return false;
      const diffDays = (Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays >= 0 && diffDays <= 7;
    } catch (e) {
      return false;
    }
  }

  function showToast(msg) {
    if (!dom.toastNotice) return;
    dom.toastMessage.textContent = msg;
    dom.toastNotice.classList.add('show');
    clearTimeout(dom.toastNotice._timer);
    dom.toastNotice._timer = setTimeout(() => {
      dom.toastNotice.classList.remove('show');
    }, 3000);
  }

  function buildWhatsAppUrl(msg) {
    const cleanNumber = (CONFIG.WHATSAPP_NUMBER || '').replace(/[^0-9]/g, '');
    return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(msg)}`;
  }

  function getSareeColorSwatch(colorName) {
    if (typeof window.getColorSwatch === 'function') {
      return window.getColorSwatch(colorName);
    }
    if (!colorName) return '#94a3b8';
    const c = String(colorName).toLowerCase();
    if (c.includes('multi')) return 'linear-gradient(135deg, #ef4444, #eab308, #22c55e, #3b82f6, #a855f7)';
    if (c.includes('maroon') || c.includes('wine') || c.includes('burgundy')) return '#6b1d2f';
    if (c.includes('red') || c.includes('crimson') || c.includes('cherry') || c.includes('laal')) return '#dc2626';
    if (c.includes('pink') || c.includes('rani') || c.includes('rose') || c.includes('gulabi') || c.includes('magenta')) return '#ec4899';
    if (c.includes('orange') || c.includes('rust') || c.includes('saffron') || c.includes('narangi') || c.includes('kesari') || c.includes('peach')) return '#ea580c';
    if (c.includes('mustard')) return '#d97706';
    if (c.includes('yellow') || c.includes('haldi') || c.includes('lemon') || c.includes('peela')) return '#eab308';
    if (c.includes('gold') || c.includes('golden') || c.includes('zari') || c.includes('sona')) return 'linear-gradient(135deg, #d4af37, #f3e5ab, #aa771c)';
    if (c.includes('teal') || c.includes('rama') || c.includes('peacock') || c.includes('sea green')) return '#0d9488';
    if (c.includes('pista') || c.includes('mint')) return '#86efac';
    if (c.includes('green') || c.includes('emerald') || c.includes('bottle') || c.includes('hara')) return '#15803d';
    if (c.includes('navy')) return '#1e3a8a';
    if (c.includes('royal') || c.includes('blue') || c.includes('sky') || c.includes('neela') || c.includes('indigo')) return '#2563eb';
    if (c.includes('purple') || c.includes('violet') || c.includes('lavender') || c.includes('jamuni') || c.includes('baingani')) return '#7e22ce';
    if (c.includes('brown') || c.includes('chocolate') || c.includes('coffee')) return '#78350f';
    if (c.includes('black') || c.includes('kaala')) return '#18181b';
    if (c.includes('white') || c.includes('safed')) return '#ffffff';
    if (c.includes('cream') || c.includes('off white') || c.includes('offwhite') || c.includes('beige') || c.includes('ivory')) return '#fef3c7';
    if (c.includes('grey') || c.includes('gray') || c.includes('silver')) return '#94a3b8';
    return '#94a3b8';
  }

  function buildSareeOrderMessage(saree, selectedColor, selectedPhotoUrl, customerAddress) {
    const currentUrl = window.location.href;
    const shipping = getShippingInfo(saree);
    const totalAmount = saree.price + shipping.amount;
    const shippingLine = shipping.isFree 
      ? `*Shipping:* Free Delivery (Pan-India)` 
      : `*Shipping:* ${formatPrice(shipping.amount)} (Pan-India Insured Courier)`;
    const totalLine = shipping.isFree 
      ? `*Total:* ${formatPrice(saree.price)}` 
      : `*Total:* ${formatPrice(totalAmount)} (Price + Shipping)`;
    
    const color = selectedColor || saree.color || 'As shown in photo';
    const photo = selectedPhotoUrl || saree.mainImage || (saree.images && saree.images[0]) || '';

    let msg = `Hello ${CONFIG.SHOP_NAME},\n\nI would like to order this saree:\n*Saree ID:* #${saree.id}\n*Name:* ${saree.name}\n*Selected Color:* ${color}\n*Price:* ${formatPrice(saree.price)}\n${shippingLine}\n${totalLine}\n*Fabric:* ${saree.fabric}`;

    if (customerAddress) {
      msg += `\n\n*Delivery Address:*\n*Name:* ${customerAddress.name}\n*Contact:* ${customerAddress.phone}\n*Address:* ${customerAddress.address}\n*City & State:* ${customerAddress.city}, ${customerAddress.state}\n*PIN Code:* ${customerAddress.pincode}`;
    }

    msg += `\n\n*Catalog Link:*\n${currentUrl}`;

    if (photo && !photo.startsWith('data:image/svg+xml')) {
      msg += `\n\n*Direct Saree Photo:*\n${photo}`;
    }

    msg += `\n\nPlease confirm availability and payment details.`;
    return msg;
  }

  // ----------------------------------------------------------------------------
  // ORDER DELIVERY ADDRESS MODAL LOGIC
  // ----------------------------------------------------------------------------
  const CUSTOMER_ADDR_KEY = 'msc_customer_delivery_address';

  function openAddressModal(saree, selectedColor, selectedPhotoUrl) {
    if (!dom.orderAddressModal) return;

    state.currentOrderSaree = saree;
    state.currentOrderColor = selectedColor || state.selectedSareeColor || saree.color || 'Multicolor';
    state.currentOrderPhoto = selectedPhotoUrl || saree.mainImage || (saree.images && saree.images[0]) || '';

    // Render Saree Order Summary inside modal
    if (dom.addressOrderSummary) {
      const shipping = getShippingInfo(saree);
      const totalAmount = saree.price + shipping.amount;
      const displayPhoto = state.currentOrderPhoto || saree.mainImage || PLACEHOLDER_IMG;
      const displayColor = state.currentOrderColor;

      dom.addressOrderSummary.innerHTML = `
        <img src="${escapeHtml(displayPhoto)}" alt="${escapeHtml(saree.name)}" class="address-summary-thumb" onerror="this.src='${PLACEHOLDER_IMG}'">
        <div class="address-summary-details">
          <h4 class="address-summary-name">${escapeHtml(saree.name)}</h4>
          <div class="address-summary-meta">
            <span class="address-summary-color-pill">
              <span class="color-swatch-circle" style="background: ${getSareeColorSwatch(displayColor)};"></span>
              ${escapeHtml(displayColor)}
            </span>
            <span>• ID: #${escapeHtml(saree.id)}</span>
          </div>
        </div>
        <div class="address-summary-price">
          <div>${formatPrice(totalAmount)}</div>
          <span class="address-summary-shipping">${escapeHtml(shipping.badgeText)}</span>
        </div>
      `;
    }

    // Load saved address from localStorage
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(CUSTOMER_ADDR_KEY) || 'null');
    } catch (e) {}

    if (saved) {
      if (dom.addrName && !dom.addrName.value) dom.addrName.value = saved.name || '';
      if (dom.addrPhone && !dom.addrPhone.value) dom.addrPhone.value = saved.phone || '';
      if (dom.addrLine && !dom.addrLine.value) dom.addrLine.value = saved.address || '';
      if (dom.addrPincode && !dom.addrPincode.value) dom.addrPincode.value = saved.pincode || '';
      if (dom.addrCity && !dom.addrCity.value) dom.addrCity.value = saved.city || '';
      if (dom.addrState && !dom.addrState.value) dom.addrState.value = saved.state || '';
    }

    clearAddressErrors();

    dom.orderAddressModal.style.display = 'flex';
    requestAnimationFrame(() => {
      dom.orderAddressModal.classList.add('open');
    });
    document.body.style.overflow = 'hidden';

    // Focus on first empty field or name
    setTimeout(() => {
      if (dom.addrName && !dom.addrName.value) {
        dom.addrName.focus();
      } else if (dom.addrPincode && !dom.addrPincode.value) {
        dom.addrPincode.focus();
      } else if (dom.addrLine && !dom.addrLine.value) {
        dom.addrLine.focus();
      }
    }, 100);
  }

  function closeAddressModal() {
    if (!dom.orderAddressModal) return;
    dom.orderAddressModal.classList.remove('open');
    document.body.style.overflow = '';
    setTimeout(() => {
      if (dom.orderAddressModal && !dom.orderAddressModal.classList.contains('open')) {
        dom.orderAddressModal.style.display = 'none';
      }
    }, 250);
  }

  let pincodeDebounce = null;
  function handlePincodeInput() {
    if (!dom.addrPincode) return;
    // Keep numbers only, max 6 digits
    dom.addrPincode.value = dom.addrPincode.value.replace(/\D/g, '').slice(0, 6);
    const pin = dom.addrPincode.value;

    if (dom.pincodeLookupHint) dom.pincodeLookupHint.textContent = '';
    clearTimeout(pincodeDebounce);

    if (pin.length === 6 && /^[1-9][0-9]{5}$/.test(pin)) {
      if (dom.pincodeLookupHint) {
        dom.pincodeLookupHint.textContent = '🔍 Checking pincode...';
        dom.pincodeLookupHint.style.color = '#0284c7';
      }
      pincodeDebounce = setTimeout(async () => {
        try {
          const resp = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
          if (!resp.ok) return;
          const data = await resp.json();
          if (Array.isArray(data) && data[0] && data[0].Status === 'Success' && Array.isArray(data[0].PostOffice) && data[0].PostOffice.length > 0) {
            const po = data[0].PostOffice[0];
            const city = po.District || po.Division || po.Block || '';
            const stateName = po.State || '';
            if (dom.addrCity && (!dom.addrCity.value || dom.addrCity.dataset.autofilled === 'true')) {
              dom.addrCity.value = city;
              dom.addrCity.dataset.autofilled = 'true';
              dom.addrCity.classList.remove('is-invalid');
              const errCity = document.getElementById('err-addr-city');
              if (errCity) errCity.classList.remove('visible');
            }
            if (dom.addrState && (!dom.addrState.value || dom.addrState.dataset.autofilled === 'true')) {
              dom.addrState.value = stateName;
              dom.addrState.dataset.autofilled = 'true';
              dom.addrState.classList.remove('is-invalid');
              const errState = document.getElementById('err-addr-state');
              if (errState) errState.classList.remove('visible');
            }
            if (dom.pincodeLookupHint) {
              dom.pincodeLookupHint.textContent = `✓ ${city}, ${stateName}`;
              dom.pincodeLookupHint.style.color = '#059669';
            }
          } else {
            if (dom.pincodeLookupHint) dom.pincodeLookupHint.textContent = '';
          }
        } catch (err) {
          if (dom.pincodeLookupHint) dom.pincodeLookupHint.textContent = '';
        }
      }, 350);
    }
  }

  function validateAddressForm() {
    clearAddressErrors();
    let isValid = true;
    let firstInvalidEl = null;

    const name = (dom.addrName ? dom.addrName.value : '').trim();
    const phone = (dom.addrPhone ? dom.addrPhone.value : '').trim().replace(/\D/g, '');
    const line = (dom.addrLine ? dom.addrLine.value : '').trim();
    const pincode = (dom.addrPincode ? dom.addrPincode.value : '').trim();
    const city = (dom.addrCity ? dom.addrCity.value : '').trim();
    const stateName = (dom.addrState ? dom.addrState.value : '').trim();

    // Full Name
    if (!name || name.length < 2) {
      setFieldError('err-addr-name', 'Please enter your full name', dom.addrName);
      isValid = false;
      if (!firstInvalidEl) firstInvalidEl = dom.addrName;
    }

    // Phone (10 digits)
    if (!phone || phone.length < 10) {
      setFieldError('err-addr-phone', 'Please enter a valid 10-digit mobile number', dom.addrPhone);
      isValid = false;
      if (!firstInvalidEl) firstInvalidEl = dom.addrPhone;
    }

    // Full Address
    if (!line || line.length < 5) {
      setFieldError('err-addr-line', 'Please enter your complete address (house no, street, landmark)', dom.addrLine);
      isValid = false;
      if (!firstInvalidEl) firstInvalidEl = dom.addrLine;
    }

    // PIN Code (Required, strictly 6 digits, Indian pincode format)
    if (!pincode) {
      setFieldError('err-addr-pincode', 'PIN code is required to place your order', dom.addrPincode);
      isValid = false;
      if (!firstInvalidEl) firstInvalidEl = dom.addrPincode;
    } else if (!/^[1-9][0-9]{5}$/.test(pincode)) {
      setFieldError('err-addr-pincode', 'Please enter a valid 6-digit PIN code', dom.addrPincode);
      isValid = false;
      if (!firstInvalidEl) firstInvalidEl = dom.addrPincode;
    }

    // City
    if (!city) {
      setFieldError('err-addr-city', 'City / District is required', dom.addrCity);
      isValid = false;
      if (!firstInvalidEl) firstInvalidEl = dom.addrCity;
    }

    // State
    if (!stateName) {
      setFieldError('err-addr-state', 'State is required', dom.addrState);
      isValid = false;
      if (!firstInvalidEl) firstInvalidEl = dom.addrState;
    }

    if (firstInvalidEl) {
      firstInvalidEl.focus();
    }

    if (!isValid) return null;

    return {
      name,
      phone,
      address: line,
      pincode,
      city,
      state: stateName
    };
  }

  function setFieldError(errId, msg, inputEl) {
    const el = document.getElementById(errId);
    if (el) {
      el.textContent = msg;
      el.classList.add('visible');
    }
    if (inputEl) {
      inputEl.classList.add('is-invalid');
    }
  }

  function clearAddressErrors() {
    document.querySelectorAll('.field-error-msg').forEach(el => {
      el.textContent = '';
      el.classList.remove('visible');
    });
    document.querySelectorAll('.form-input.is-invalid, .form-textarea.is-invalid').forEach(el => {
      el.classList.remove('is-invalid');
    });
  }

  function handleAddressSubmit(e) {
    e.preventDefault();
    const address = validateAddressForm();
    if (!address) return;

    // Save to localStorage for convenience
    try {
      localStorage.setItem(CUSTOMER_ADDR_KEY, JSON.stringify(address));
    } catch (err) {}

    const saree = state.currentOrderSaree;
    if (!saree) return;

    const color = state.currentOrderColor || state.selectedSareeColor || saree.color || 'Multicolor';
    const photo = state.currentOrderPhoto || (saree.images && saree.images[0]) || saree.mainImage || '';

    const orderMsg = buildSareeOrderMessage(saree, color, photo, address);
    const waUrl = buildWhatsAppUrl(orderMsg);

    closeAddressModal();
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  }


  // ----------------------------------------------------------------------------
  // SUPABASE CLIENT INITIALIZATION
  // ----------------------------------------------------------------------------
  function initSupabase() {
    const hasKeys = CONFIG.SUPABASE_URL &&
      !CONFIG.SUPABASE_URL.includes('YOUR_PROJECT_ID') &&
      CONFIG.SUPABASE_ANON_KEY &&
      !CONFIG.SUPABASE_ANON_KEY.includes('YOUR_SUPABASE_ANON_KEY') &&
      window.supabase;

    if (hasKeys) {
      try {
        state.supabaseClient = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
        state.isDemoMode = false;
        if (dom.demoModeBanner) dom.demoModeBanner.classList.remove('visible');
      } catch (err) {
        console.warn('Failed to initialize Supabase client:', err);
        state.supabaseClient = null;
        state.isDemoMode = true;
        if (dom.demoModeBanner) dom.demoModeBanner.classList.add('visible');
      }
    } else {
      state.supabaseClient = null;
      state.isDemoMode = true;
      if (dom.demoModeBanner) dom.demoModeBanner.classList.add('visible');
    }
  }

  // ----------------------------------------------------------------------------
  // APPLICATION INIT & CONTENT INJECTION
  // ----------------------------------------------------------------------------
  function initApp() {
    cacheDom();
    initSupabase();
    injectConfigText();
    setupEventListeners();
    handleRouting();
    loadCatalogData();
  }

  function injectConfigText() {
    if (dom.headerShopName) dom.headerShopName.textContent = CONFIG.SHOP_NAME;
    if (dom.headerShopTagline) dom.headerShopTagline.textContent = CONFIG.SHOP_TAGLINE;

    const footerName = document.getElementById('footer-shop-name');
    const footerTagline = document.getElementById('footer-shop-tagline');
    if (footerName) footerName.textContent = CONFIG.SHOP_NAME;
    if (footerTagline) footerTagline.textContent = CONFIG.SHOP_TAGLINE;

    const headerLogo = document.getElementById('header-logo-img');
    if (headerLogo && CONFIG.LOGO_URL) {
      headerLogo.src = CONFIG.LOGO_URL;
      headerLogo.alt = CONFIG.SHOP_NAME;
    }

    const footerIcon = document.getElementById('footer-logo-icon');
    if (footerIcon && CONFIG.ICON_URL) {
      footerIcon.src = CONFIG.ICON_URL;
      footerIcon.alt = CONFIG.SHOP_NAME;
    }

    // Contact WhatsApp links
    const genericMsg = `Hello ${CONFIG.SHOP_NAME}, I would like to inquire about your online saree collection.`;
    const defaultWaUrl = buildWhatsAppUrl(genericMsg);
    if (dom.headerWaLink) dom.headerWaLink.href = defaultWaUrl;
    if (dom.floatingWaBtn) dom.floatingWaBtn.href = defaultWaUrl;
    if (dom.footerWaBtn) dom.footerWaBtn.href = defaultWaUrl;

    // Footer contact info
    const fAddress = document.getElementById('footer-address');
    const fPhone = document.getElementById('footer-phone');
    const fEmail = document.getElementById('footer-email');
    const fHours = document.getElementById('footer-hours');
    const fCopyright = document.getElementById('footer-copyright');

    if (fAddress && CONFIG.FOOTER.ADDRESS) fAddress.textContent = CONFIG.FOOTER.ADDRESS;
    if (fPhone && CONFIG.FOOTER.PHONE) fPhone.textContent = CONFIG.FOOTER.PHONE;
    if (fEmail && CONFIG.FOOTER.EMAIL) fEmail.textContent = CONFIG.FOOTER.EMAIL;
    if (fHours && CONFIG.FOOTER.HOURS) fHours.textContent = CONFIG.FOOTER.HOURS;
    if (fCopyright && CONFIG.FOOTER.COPYRIGHT) fCopyright.textContent = CONFIG.FOOTER.COPYRIGHT;

    // How It Works Steps
    const howTitle = document.getElementById('how-it-works-title');
    const howSubtitle = document.getElementById('how-it-works-subtitle');
    const howGrid = document.getElementById('how-it-works-grid');

    if (howTitle && CONFIG.HOW_TO_ORDER.TITLE) howTitle.textContent = CONFIG.HOW_TO_ORDER.TITLE;
    if (howSubtitle && CONFIG.HOW_TO_ORDER.SUBTITLE) howSubtitle.textContent = CONFIG.HOW_TO_ORDER.SUBTITLE;
    if (howGrid && CONFIG.HOW_TO_ORDER.STEPS) {
      howGrid.innerHTML = CONFIG.HOW_TO_ORDER.STEPS.map(step => `
        <div class="step-card">
          <div class="step-number">${escapeHtml(step.step)}</div>
          <div class="step-icon">${escapeHtml(step.icon)}</div>
          <h3 class="step-title">${escapeHtml(step.title)}</h3>
          <p class="step-desc">${escapeHtml(step.desc)}</p>
        </div>
      `).join('');

      // Admin redirect button below the 3 step cards
      const adminBtn = document.createElement('div');
      adminBtn.style.cssText = 'text-align: center; margin-top: 2rem; grid-column: 1 / -1;';
      adminBtn.innerHTML = `
        <a href="admin.html" id="how-to-order-admin-btn" title="Go to Store Admin Panel"
           style="display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1.25rem;
                  border: 1px solid var(--color-border, #e2d4c0); border-radius: 9999px;
                  color: var(--color-text-muted, #888); font-size: 0.78rem; font-weight: 500;
                  text-decoration: none; transition: all 0.2s ease; background: transparent;"
           onmouseover="this.style.borderColor='var(--color-primary,#7c1228)';this.style.color='var(--color-primary,#7c1228)';"
           onmouseout="this.style.borderColor='var(--color-border,#e2d4c0)';this.style.color='var(--color-text-muted,#888)';">
          🔒 Admin Portal
        </a>
      `;
      howGrid.appendChild(adminBtn);
    }

    // About Us Content
    const aboutTitle = document.getElementById('about-title');
    const aboutSubtitle = document.getElementById('about-subtitle');
    const aboutParagraphs = document.getElementById('about-paragraphs');
    const aboutHighlights = document.getElementById('about-highlights-grid');

    if (aboutTitle && CONFIG.ABOUT.TITLE) aboutTitle.textContent = CONFIG.ABOUT.TITLE;
    if (aboutSubtitle && CONFIG.ABOUT.SUBTITLE) aboutSubtitle.textContent = CONFIG.ABOUT.SUBTITLE;
    if (aboutParagraphs) {
      aboutParagraphs.innerHTML = `
        <p>${escapeHtml(CONFIG.ABOUT.DESCRIPTION_P1)}</p>
        <p>${escapeHtml(CONFIG.ABOUT.DESCRIPTION_P2)}</p>
      `;
    }
    if (aboutHighlights && CONFIG.ABOUT.HIGHLIGHTS) {
      aboutHighlights.innerHTML = CONFIG.ABOUT.HIGHLIGHTS.map(item => `
        <div class="highlight-box">
          <div class="highlight-icon">${escapeHtml(item.icon)}</div>
          <h4 class="highlight-title">${escapeHtml(item.title)}</h4>
          <p class="highlight-desc">${escapeHtml(item.desc)}</p>
        </div>
      `).join('');
    }

    // Return & Exchange Policy
    const returnTitle = document.getElementById('return-title');
    const returnSubtitle = document.getElementById('return-subtitle');
    const policyList = document.getElementById('policy-list');

    if (returnTitle && CONFIG.RETURN_POLICY.TITLE) returnTitle.textContent = CONFIG.RETURN_POLICY.TITLE;
    if (returnSubtitle && CONFIG.RETURN_POLICY.SUBTITLE) returnSubtitle.textContent = CONFIG.RETURN_POLICY.SUBTITLE;
    if (policyList && CONFIG.RETURN_POLICY.POINTS) {
      policyList.innerHTML = CONFIG.RETURN_POLICY.POINTS.map(pt => `
        <li class="policy-list-item">
          <span class="policy-check-icon">✓</span>
          <span>${escapeHtml(pt)}</span>
        </li>
      `).join('');
    }
  }

  // ----------------------------------------------------------------------------
  // DATA FETCHING & NORMALIZATION
  // ----------------------------------------------------------------------------
  function renderSkeletons() {
    if (!dom.sareeGrid) return;
    let html = '';
    for (let i = 0; i < 8; i++) {
      html += `
        <div class="skeleton-card" aria-hidden="true">
          <div class="skeleton-img"></div>
          <div class="skeleton-body">
            <div class="skeleton-line w-half"></div>
            <div class="skeleton-line w-full"></div>
            <div class="skeleton-line w-three-fourth"></div>
          </div>
        </div>
      `;
    }
    dom.sareeGrid.innerHTML = html;
    if (dom.emptyState) dom.emptyState.style.display = 'none';
    if (dom.errorState) dom.errorState.style.display = 'none';
  }

  function loadCatalogData(forceRefresh = false) {
    renderSkeletons();

    // Check sessionStorage cache
    const ttlMs = (CONFIG.CACHE_TTL_MINUTES || 5) * 60 * 1000;
    const cachedTime = sessionStorage.getItem(CACHE_TIME_KEY);
    const cachedData = sessionStorage.getItem(CACHE_KEY);

    if (!forceRefresh && cachedData && cachedTime) {
      const age = Date.now() - parseInt(cachedTime, 10);
      if (age < ttlMs) {
        try {
          const parsed = JSON.parse(cachedData);
          state.allSarees = normalizeData(parsed);
          initializeFiltersAndData();
          return;
        } catch (e) {
          sessionStorage.removeItem(CACHE_KEY);
        }
      }
    }

    // If Supabase is not configured, load demo data
    if (!state.supabaseClient) {
      console.info('Running in demo mode with fallback data.');
      state.allSarees = normalizeData(CONFIG.FALLBACK_DATA || []);
      initializeFiltersAndData();
      return;
    }

    // Query live Supabase database
    state.supabaseClient
      .from('sarees')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          throw error;
        }

        if (!data || data.length === 0) {
          // If database is empty, fallback to demo items
          console.info('Database table is empty, showing sample data.');
          state.allSarees = normalizeData(CONFIG.FALLBACK_DATA || []);
        } else {
          state.allSarees = normalizeData(data);
          // Cache in sessionStorage
          try {
            sessionStorage.setItem(CACHE_KEY, JSON.stringify(data));
            sessionStorage.setItem(CACHE_TIME_KEY, String(Date.now()));
          } catch (e) {
            console.warn('Storage quota exceeded:', e);
          }
        }

        initializeFiltersAndData();
      })
      .catch(err => {
        console.error('Failed to load sarees from Supabase:', err);
        showErrorState(err.message || 'Could not connect to Supabase.');
      });
  }

  function sanitizeVideoUrl(url) {
    if (!url || typeof url !== 'string') return null;
    const trimmed = url.trim();
    if (!trimmed.startsWith('https://')) return null;
    const isYt = trimmed.includes('youtube.com') || trimmed.includes('youtu.be');
    const isSupabase = trimmed.includes('supabase.co');
    const isDirect = trimmed.includes('.mp4') || trimmed.includes('.webm') || trimmed.includes('googleapis.com');
    if (isYt || isSupabase || isDirect) {
      return trimmed;
    }
    return null;
  }

  function normalizeData(rawItems) {
    return rawItems.map(row => {
      // Normalizing images array
      let imgs = [];
      if (Array.isArray(row.images)) {
        imgs = row.images.filter(Boolean);
      } else if (typeof row.images === 'string') {
        imgs = row.images.split(',').map(s => s.trim()).filter(Boolean);
      } else if (row.image_url) {
        imgs = [row.image_url];
      }

      if (imgs.length === 0) {
        imgs = [PLACEHOLDER_IMG];
      }

      const isSold = (row.status || '').toLowerCase() === 'sold';
      const cleanVideoUrl = sanitizeVideoUrl(row.video_url);

      // Normalize available colors list
      let colorsList = [];
      if (Array.isArray(row.available_colors) && row.available_colors.length > 0) {
        colorsList = row.available_colors.map(c => String(c).trim()).filter(Boolean);
      } else if (row.color) {
        colorsList = String(row.color).split(/[,/|]+/).map(c => c.trim()).filter(Boolean);
      }
      if (colorsList.length === 0) {
        colorsList = ['Multicolor'];
      }

      return {
        id: String(row.id),
        name: (row.name || 'Untitled Saree').trim(),
        fabric: (row.fabric || 'Traditional Weave').trim(),
        color: colorsList[0] || 'Multicolor',
        available_colors: colorsList,
        pattern: (row.pattern || 'Classic').trim(),
        border: (row.border || 'Zari Border').trim(),
        category: (row.category || 'Handloom').trim(),
        occasion: (row.occasion || 'Festive / Wedding').trim(),
        description: (row.description || '').trim(),
        price: parseFloat(row.price) || 0,
        shipping_charges: row.shipping_charges !== undefined && row.shipping_charges !== null
          ? (parseFloat(row.shipping_charges) || 0)
          : (CONFIG.SHIPPING?.DEFAULT_CHARGE ?? 0),
        images: imgs,
        mainImage: imgs[0] || PLACEHOLDER_IMG,
        video_url: cleanVideoUrl,
        video_poster: row.video_poster || null,
        reviews: Array.isArray(row.reviews) ? row.reviews : [],
        length_m: (row.length_m !== null && row.length_m !== undefined && !isNaN(row.length_m)) ? parseFloat(row.length_m) : null,
        width_in: (row.width_in !== null && row.width_in !== undefined && !isNaN(row.width_in)) ? parseFloat(row.width_in) : null,
        blouse: row.blouse ? String(row.blouse).trim() : null,
        status: isSold ? 'Sold' : 'Available',
        isSold: isSold,
        created_at: row.created_at || new Date().toISOString(),
        isNew: isItemNew(row.created_at)
      };
    });
  }

  function showErrorState(msg) {
    if (dom.sareeGrid) dom.sareeGrid.innerHTML = '';
    if (dom.emptyState) dom.emptyState.style.display = 'none';
    if (dom.errorState) {
      dom.errorState.style.display = 'block';
      if (dom.errorMessage) {
        dom.errorMessage.innerHTML = `
          ${escapeHtml(msg)}<br><br>
          <small style="color: var(--color-text-light);">
            Verify your Supabase URL & Anon Key in <code>config.js</code> and ensure RLS is enabled with public SELECT access.
          </small>
        `;
      }
    }
  }

  // ----------------------------------------------------------------------------
  // FILTERS SETUP & RENDERING
  // ----------------------------------------------------------------------------
  function initializeFiltersAndData() {
    if (dom.errorState) dom.errorState.style.display = 'none';

    // Price extremes
    const prices = state.allSarees.map(s => s.price).filter(p => p > 0);
    state.priceMin = prices.length ? Math.floor(Math.min(...prices)) : 0;
    state.priceMax = prices.length ? Math.ceil(Math.max(...prices)) : 50000;

    if (dom.filterPriceRange) {
      dom.filterPriceRange.min = state.priceMin;
      dom.filterPriceRange.max = state.priceMax;
      dom.filterPriceRange.value = state.priceMax;
      state.maxPrice = state.priceMax;
      if (dom.priceSliderValue) {
        dom.priceSliderValue.textContent = formatPrice(state.priceMax);
      }
    }

    populateFilterDropdowns();
    populateQuickCategoryPills();
    applyFiltersAndRender();
    handleRouting();
  }

  function populateFilterDropdowns() {
    const cats = new Set();
    const fabrics = new Set();
    const colors = new Set();

    state.allSarees.forEach(s => {
      if (s.category) cats.add(s.category);
      if (s.fabric) fabrics.add(s.fabric);
      if (s.available_colors && s.available_colors.length) {
        s.available_colors.forEach(c => colors.add(c));
      } else if (s.color) {
        colors.add(s.color);
      }
    });

    fillSelect(dom.filterCategory, Array.from(cats).sort(), 'All Categories');
    fillSelect(dom.filterFabric, Array.from(fabrics).sort(), 'All Fabrics');
    fillSelect(dom.filterColor, Array.from(colors).sort(), 'All Colors');
  }

  function fillSelect(el, items, allLabel) {
    if (!el) return;
    const current = el.value;
    el.innerHTML = `<option value="all">${escapeHtml(allLabel)}</option>` +
      items.map(item => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join('');
    if (items.includes(current)) el.value = current;
  }

  function populateQuickCategoryPills() {
    if (!dom.quickCategoryPills) return;
    const cats = Array.from(new Set(state.allSarees.map(s => s.category))).sort();

    let html = `<button type="button" class="pill-item active" data-category="all">All Sarees</button>`;
    cats.forEach(cat => {
      html += `<button type="button" class="pill-item" data-category="${escapeHtml(cat)}">${escapeHtml(cat)}</button>`;
    });

    dom.quickCategoryPills.innerHTML = html;

    dom.quickCategoryPills.querySelectorAll('.pill-item').forEach(pill => {
      pill.addEventListener('click', () => {
        const selected = pill.getAttribute('data-category');
        state.activeCategory = selected;
        if (dom.filterCategory) dom.filterCategory.value = selected;

        dom.quickCategoryPills.querySelectorAll('.pill-item').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');

        applyFiltersAndRender();
      });
    });
  }

  function applyFiltersAndRender() {
    const q = state.searchQuery.toLowerCase().trim();

    state.filteredSarees = state.allSarees.filter(s => {
      if (q) {
        const matchName = s.name.toLowerCase().includes(q);
        const matchDesc = s.description.toLowerCase().includes(q);
        const matchFabric = s.fabric.toLowerCase().includes(q);
        if (!matchName && !matchDesc && !matchFabric) return false;
      }

      if (state.activeCategory !== 'all' && s.category !== state.activeCategory) return false;
      if (state.activeFabric !== 'all' && s.fabric !== state.activeFabric) return false;
      if (state.activeColor !== 'all') {
        const hasColor = (s.available_colors && s.available_colors.includes(state.activeColor)) || (s.color === state.activeColor);
        if (!hasColor) return false;
      }
      if (s.price > state.maxPrice) return false;
      if (state.hideSold && s.isSold) return false;

      return true;
    });

    // Sorting
    state.filteredSarees.sort((a, b) => {
      if (state.sortBy === 'price-asc') return a.price - b.price;
      if (state.sortBy === 'price-desc') return b.price - a.price;
      // 'newest'
      const da = new Date(a.created_at).getTime() || 0;
      const db = new Date(b.created_at).getTime() || 0;
      return db - da;
    });

    updateFilterStats();
    renderCatalogGrid();
  }

  function updateFilterStats() {
    let count = 0;
    if (state.activeCategory !== 'all') count++;
    if (state.activeFabric !== 'all') count++;
    if (state.activeColor !== 'all') count++;
    if (state.maxPrice < state.priceMax) count++;
    if (state.hideSold) count++;
    if (state.searchQuery) count++;

    if (dom.activeFilterBadge) {
      dom.activeFilterBadge.textContent = count;
      dom.activeFilterBadge.style.display = count > 0 ? 'inline-block' : 'none';
    }

    if (dom.resultsCount) {
      dom.resultsCount.textContent = `Showing ${state.filteredSarees.length} of ${state.allSarees.length} sarees`;
    }
  }

  function renderCatalogGrid() {
    if (!dom.sareeGrid) return;

    if (state.filteredSarees.length === 0) {
      dom.sareeGrid.innerHTML = '';
      if (dom.emptyState) dom.emptyState.style.display = 'block';
      return;
    }

    if (dom.emptyState) dom.emptyState.style.display = 'none';

    dom.sareeGrid.innerHTML = state.filteredSarees.map(saree => {
      const soldBadge = saree.isSold ? `<span class="badge-sold-out">Sold Out</span>` : '';
      const newBadge = (!saree.isSold && saree.isNew) ? `<span class="badge-new">New</span>` : '';
      const videoBadge = saree.video_url ? `<span class="badge-video">▶ Video</span>` : '';
      const colorsBadge = (saree.available_colors && saree.available_colors.length > 1)
        ? `<span class="badge-colors-count">🎨 ${saree.available_colors.length} Colors</span>`
        : '';
      const shipping = getShippingInfo(saree);

      return `
        <article class="saree-card ${saree.isSold ? 'is-sold' : ''}" data-id="${escapeHtml(saree.id)}">
          <a href="#/saree/${encodeURIComponent(saree.id)}" class="saree-card-link" aria-label="View details of ${escapeHtml(saree.name)}">
            <div class="card-img-wrap">
              ${newBadge}
              ${soldBadge}
              ${videoBadge}
              ${colorsBadge}
              <img 
                src="${escapeHtml(saree.mainImage)}" 
                alt="${escapeHtml(saree.name)}" 
                class="card-img" 
                loading="lazy"
                onerror="this.onerror=null;this.src='${PLACEHOLDER_IMG}';"
              >
            </div>
            <div class="card-body">
              <span class="card-meta">${escapeHtml(saree.fabric)} • ${escapeHtml(saree.category)}</span>
              <h3 class="card-title">${escapeHtml(saree.name)}</h3>
              <div class="card-price-row">
                <div class="card-price-stack">
                  <span class="card-price">${formatPrice(saree.price)}</span>
                  <span class="card-shipping-tag ${shipping.isFree ? 'is-free' : 'is-paid'}">${shipping.tagText}</span>
                </div>
                <span class="card-cta-hint">${saree.isSold ? 'Sold' : 'View &rarr;'}</span>
              </div>
            </div>
          </a>
        </article>
      `;
    }).join('');
  }

  // ----------------------------------------------------------------------------
  // SAREE DETAIL PAGE
  // ----------------------------------------------------------------------------
  function renderSareeDetail(sareeId) {
    const saree = state.allSarees.find(s => String(s.id) === String(sareeId));

    if (!saree) {
      if (dom.sareeDetailContent) {
        dom.sareeDetailContent.innerHTML = `
          <div class="state-box">
            <div class="state-icon">⚠️</div>
            <h3 class="state-title">Saree Not Found</h3>
            <p class="state-desc">The saree code <strong>#${escapeHtml(sareeId)}</strong> could not be found in our catalog.</p>
            <a href="#/" class="btn-primary">Browse All Sarees</a>
          </div>
        `;
      }
      if (dom.similarSection) dom.similarSection.style.display = 'none';
      return;
    }

    document.title = `${saree.name} | ${CONFIG.SHOP_NAME}`;
    updateMeta(saree);

    const allImages = saree.images.length > 0 ? saree.images : [PLACEHOLDER_IMG];

    const colorsList = Array.isArray(saree.available_colors) && saree.available_colors.length > 0
      ? saree.available_colors
      : (saree.color ? [saree.color] : ['Multicolor']);
    const initialColor = colorsList[0] || 'Multicolor';
    state.selectedSareeColor = initialColor;
    let selectedPhotoUrl = saree.mainImage || (allImages[0] || '');

    // Build unified gallery items: Video as FIRST item if available
    const galleryItems = [];
    if (saree.video_url) {
      const isYt = saree.video_url.includes('youtube.com') || saree.video_url.includes('youtu.be');
      let ytId = '';
      if (isYt) {
        const ytMatch = saree.video_url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([a-zA-Z0-9_-]{11})/);
        ytId = ytMatch ? ytMatch[1] : '';
      }
      const poster = saree.video_poster || (ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : saree.mainImage);

      galleryItems.push({
        type: 'video',
        isYouTube: isYt,
        youtubeId: ytId,
        videoUrl: saree.video_url,
        poster: poster
      });
    }

    allImages.forEach(imgUrl => {
      galleryItems.push({
        type: 'image',
        url: imgUrl
      });
    });

    const currentUrl = window.location.href;
    const shipping = getShippingInfo(saree);
    const totalAmount = saree.price + shipping.amount;

    const orderMessage = buildSareeOrderMessage(saree, initialColor, selectedPhotoUrl);
    const orderWaUrl = buildWhatsAppUrl(orderMessage);

    const askSimilarMessage = `Hello ${CONFIG.SHOP_NAME},\n\nI liked saree *${saree.name}* (ID: ${saree.id}) which is sold out. Do you have similar designs available?\n*Link:* ${currentUrl}`;
    const askSimilarWaUrl = buildWhatsAppUrl(askSimilarMessage);

    const slidesHtml = galleryItems.map((item, idx) => {
      if (item.type === 'video') {
        if (item.isYouTube) {
          return `
            <div class="gallery-slide is-video" data-index="${idx}" data-yt-id="${escapeHtml(item.youtubeId)}">
              <div class="video-play-overlay" data-action="play-youtube" data-yt-id="${escapeHtml(item.youtubeId)}">
                <div class="btn-big-play">▶</div>
                <span class="video-play-caption">Watch Drape Video</span>
              </div>
              <img src="${escapeHtml(item.poster)}" alt="${escapeHtml(saree.name)} Video Poster" class="card-img" style="object-fit:cover;">
            </div>
          `;
        } else {
          return `
            <div class="gallery-slide is-video" data-index="${idx}">
              <div class="video-play-overlay" data-action="play-native">
                <div class="btn-big-play">▶</div>
                <span class="video-play-caption">Watch Drape Video</span>
              </div>
              <video class="gallery-video-player" controls playsinline preload="none" poster="${escapeHtml(item.poster)}">
                <source src="${escapeHtml(item.videoUrl)}" type="video/mp4">
                Your browser does not support HTML5 video.
              </video>
            </div>
          `;
        }
      } else {
        return `
          <div class="gallery-slide" data-index="${idx}" data-img="${escapeHtml(item.url)}">
            <img 
              src="${escapeHtml(item.url)}" 
              alt="${escapeHtml(saree.name)} - View ${idx + 1}"
              loading="${idx === 0 ? 'eager' : 'lazy'}"
              onerror="this.onerror=null;this.src='${PLACEHOLDER_IMG}';"
            >
            <span class="gallery-zoom-hint">🔍 Tap to Zoom</span>
          </div>
        `;
      }
    }).join('');

    const thumbnailsHtml = galleryItems.length > 1 ? `
      <div class="gallery-thumbnails" role="tablist" aria-label="Saree thumbnails">
        ${galleryItems.map((item, idx) => {
      const isVid = item.type === 'video';
      const thumbSrc = isVid ? item.poster : item.url;
      return `
            <button type="button" class="thumb-item ${isVid ? 'is-video' : ''} ${idx === 0 ? 'active' : ''}" data-index="${idx}" aria-label="${isVid ? 'Watch Video' : 'View photo ' + (idx + 1)}">
              <img src="${escapeHtml(thumbSrc)}" alt="Thumbnail ${idx + 1}" onerror="this.src='${PLACEHOLDER_IMG}';">
            </button>
          `;
    }).join('')}
      </div>
    ` : '';

    let actionButtonsHtml = '';
    if (!saree.isSold) {
      actionButtonsHtml = `
        <button type="button" id="btn-whatsapp-order-link" class="btn-whatsapp-order" aria-label="Order on WhatsApp">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z"/>
          </svg>
          <span>Order on WhatsApp</span>
        </button>
      `;
    } else {
      actionButtonsHtml = `
        <button type="button" class="btn-whatsapp-order disabled" disabled>
          <span>Sold Out</span>
        </button>
        <a href="${askSimilarWaUrl}" target="_blank" rel="noopener noreferrer" class="ask-similar-link">
          💬 Ask for similar sarees on WhatsApp &rarr;
        </a>
      `;
    }

    const colorSelectionHtml = colorsList.length > 0 ? `
      <!-- Available Colors Selector -->
      <div class="detail-color-selection-box">
        <div class="detail-color-header">
          <span class="detail-color-label">Available Colors (${colorsList.length}):</span>
          <span class="detail-selected-color-name" id="detail-selected-color-name">${escapeHtml(initialColor)}</span>
        </div>
        <div class="detail-color-chips-row" role="radiogroup" aria-label="Available Saree Colors">
          ${colorsList.map((c, idx) => `
            <button type="button" 
              class="btn-color-variant-chip ${c === initialColor ? 'active' : ''}" 
              data-color="${escapeHtml(c)}" 
              data-color-idx="${idx}"
              role="radio"
              aria-checked="${c === initialColor ? 'true' : 'false'}"
              title="Select ${escapeHtml(c)}">
              <span class="color-swatch-circle" style="background: ${getSareeColorSwatch(c)};"></span>
              <span class="color-variant-name">${escapeHtml(c)}</span>
            </button>
          `).join('')}
        </div>
        <p class="detail-color-selection-tip">💡 Tap any color above to preview and order that specific shade on WhatsApp.</p>
      </div>
    ` : '';

    dom.sareeDetailContent.innerHTML = `
      <div class="detail-grid">
        
        <!-- Left: Image & Video Gallery -->
        <div class="gallery-wrapper">
          <div class="gallery-snap-container" id="gallery-container">
            ${slidesHtml}
          </div>
          ${thumbnailsHtml}
        </div>

        <!-- Right: Specifications & Ordering -->
        <div class="detail-info">
          
          <div class="detail-header-badges">
            <span class="badge-status ${saree.isSold ? 'sold' : 'available'}">
              ${saree.isSold ? 'Sold Out' : 'Available'}
            </span>
            ${saree.isNew && !saree.isSold ? '<span class="badge-new" style="position:static;">New Arrival</span>' : ''}
            ${saree.video_url ? '<span class="badge-video" style="position:static; background:#1e293b;">▶ Video Available</span>' : ''}
            <span class="badge-detail-id">ID: #${escapeHtml(saree.id)}</span>
          </div>

          <h2 class="detail-title">${escapeHtml(saree.name)}</h2>

          <div class="detail-price-row">
            <div class="detail-price-col">
              <span class="detail-price">${formatPrice(saree.price)}</span>
              <span class="detail-shipping-badge ${shipping.isFree ? 'is-free' : 'is-paid'}">
                ${shipping.badgeText}
              </span>
            </div>
            <div class="detail-price-meta">
              ${!shipping.isFree ? `<span class="detail-total-note">Total: <strong>${formatPrice(totalAmount)}</strong></span>` : ''}
              <span class="detail-tax-note">Inclusive of all taxes • Pan-India Insured</span>
            </div>
          </div>

          ${colorSelectionHtml}

          <!-- Specifications Table -->
          <div class="specs-grid">
            <div class="spec-item">
              <span class="spec-key">Fabric</span>
              <span class="spec-val">${escapeHtml(saree.fabric)}</span>
            </div>
            <div class="spec-item">
              <span class="spec-key">Selected Color</span>
              <span class="spec-val" id="spec-color-val">${escapeHtml(initialColor)}</span>
            </div>
            <div class="spec-item">
              <span class="spec-key">Pattern</span>
              <span class="spec-val">${escapeHtml(saree.pattern)}</span>
            </div>
            <div class="spec-item">
              <span class="spec-key">Border</span>
              <span class="spec-val">${escapeHtml(saree.border)}</span>
            </div>
            <div class="spec-item">
              <span class="spec-key">Occasion</span>
              <span class="spec-val">${escapeHtml(saree.occasion)}</span>
            </div>
            <div class="spec-item">
              <span class="spec-key">Category</span>
              <span class="spec-val">${escapeHtml(saree.category)}</span>
            </div>
            ${saree.length_m ? `
            <div class="spec-item">
              <span class="spec-key">Length</span>
              <span class="spec-val">${escapeHtml(saree.length_m)} meters</span>
            </div>` : ''}
            ${saree.width_in ? `
            <div class="spec-item">
              <span class="spec-key">Width</span>
              <span class="spec-val">${escapeHtml(saree.width_in)} inches</span>
            </div>` : ''}
            ${saree.blouse ? `
            <div class="spec-item">
              <span class="spec-key">Blouse Piece</span>
              <span class="spec-val">${escapeHtml(saree.blouse)}</span>
            </div>` : ''}
            <div class="spec-item">
              <span class="spec-key">Shipping</span>
              <span class="spec-val ${shipping.isFree ? 'highlight-free-shipping' : ''}">
                ${escapeHtml(shipping.detailText)}
              </span>
            </div>
            <div class="spec-item">
              <span class="spec-key">Returns</span>
              <span class="spec-val">Damaged only (Unboxing video required)</span>
            </div>
          </div>

          <!-- Description -->
          <div class="detail-desc-box">
            <span class="detail-desc-label">Saree Description</span>
            <p class="detail-desc-text">${escapeHtml(saree.description || 'Authentic handcrafted pure saree made by master weavers.')}</p>
          </div>

          <!-- Return Policy Note -->
          <div class="detail-policy-notice">
            <span class="detail-policy-notice-title">🛡️ Return &amp; Damage Policy</span>
            <p class="detail-policy-notice-text">
              • <strong>No Exchange:</strong> We do not offer exchanges or replacements.<br>
              • <strong>Return Only if Damaged:</strong> Accepted strictly if physical damage is found on arrival.<br>
              • <strong>Mandatory Unpacking Video:</strong> Full continuous unboxing video of sealed parcel required as proof.<br>
              • <strong>Self-Ship:</strong> In case of damage, customer needs to self-ship / courier the saree back to our return address.
            </p>
          </div>

          <!-- Action Buttons -->
          <div class="cta-group">
            ${actionButtonsHtml}
            
            <div class="share-btn-row">
              <button type="button" id="btn-share-whatsapp" class="btn-share-wa" aria-label="Share this saree on WhatsApp">
                <span class="share-wa-icon">💬</span>
                <span>Share on WhatsApp</span>
              </button>
              <button type="button" id="btn-share-saree" class="btn-share-native" aria-label="Copy link or more share options">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="18" cy="5" r="3"></circle>
                  <circle cx="6" cy="12" r="3"></circle>
                  <circle cx="18" cy="19" r="3"></circle>
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                </svg>
                <span>Copy Link</span>
              </button>
            </div>
          </div>

        </div>
      </div>

      <!-- Customer Reviews Section -->
      <div class="detail-reviews-wrapper" id="detail-reviews-container"></div>
    `;

    const waBtn = document.getElementById('btn-whatsapp-order-link');
    if (waBtn) {
      waBtn.addEventListener('click', (e) => {
        e.preventDefault();
        openAddressModal(saree, state.selectedSareeColor, selectedPhotoUrl);
      });
    }

    const colorChips = dom.sareeDetailContent.querySelectorAll('.btn-color-variant-chip');
    colorChips.forEach(chip => {
      chip.addEventListener('click', () => {
        const chosen = chip.getAttribute('data-color');
        if (!chosen) return;
        state.selectedSareeColor = chosen;
        state.currentOrderColor = chosen;

        colorChips.forEach(c => {
          const isActive = c === chip;
          c.classList.toggle('active', isActive);
          c.setAttribute('aria-checked', isActive ? 'true' : 'false');
        });

        const nameEl = document.getElementById('detail-selected-color-name');
        if (nameEl) nameEl.textContent = chosen;

        const specColorEl = document.getElementById('spec-color-val');
        if (specColorEl) specColorEl.textContent = chosen;

        const chipIdx = parseInt(chip.getAttribute('data-color-idx'), 10);
        if (!isNaN(chipIdx) && chipIdx < allImages.length) {
          selectedPhotoUrl = allImages[chipIdx];
          state.currentOrderPhoto = allImages[chipIdx];
          const slides = dom.sareeDetailContent.querySelectorAll('.gallery-slide');
          const targetSlideIdx = saree.video_url ? chipIdx + 1 : chipIdx;
          if (slides[targetSlideIdx]) {
            slides[targetSlideIdx].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
          }
        }
      });
    });

    attachGalleryEvents((slideIdx, imgUrl) => {
      if (imgUrl) {
        selectedPhotoUrl = imgUrl;
        state.currentOrderPhoto = imgUrl;
      }
    });

    const shareWaBtn = document.getElementById('btn-share-whatsapp');
    if (shareWaBtn) {
      shareWaBtn.addEventListener('click', () => handleWhatsAppShare(saree));
    }

    const shareBtn = document.getElementById('btn-share-saree');
    if (shareBtn) {
      shareBtn.addEventListener('click', () => handleShare(saree));
    }

    loadAndRenderReviews(sareeId, saree);

    renderSimilarSarees(saree);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function formatDate(isoString) {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch (e) {
      return '';
    }
  }

  async function loadAndRenderReviews(sareeId, saree) {
    const container = document.getElementById('detail-reviews-container');
    if (!container) return;

    let reviews = [];

    // 1. Try Supabase live table saree_reviews if connected
    if (state.supabaseClient) {
      try {
        const { data, error } = await state.supabaseClient
          .from('saree_reviews')
          .select('*')
          .eq('saree_id', sareeId)
          .order('created_at', { ascending: false });

        if (!error && Array.isArray(data) && data.length > 0) {
          reviews = data;
        }
      } catch (e) {
        console.warn('Could not query saree_reviews table:', e);
      }
    }

    // 2. Try local storage (admin added review locally/offline)
    if (reviews.length === 0) {
      try {
        const local = JSON.parse(localStorage.getItem('msc_local_reviews') || '[]');
        const matching = local.filter(r => String(r.saree_id) === String(sareeId));
        if (matching.length > 0) reviews = matching;
      } catch (e) {}
    }

    // 3. Fallback to saree.reviews or CONFIG.FALLBACK_DATA
    if (reviews.length === 0) {
      if (saree.reviews && saree.reviews.length > 0) {
        reviews = saree.reviews;
      } else {
        const fallback = (CONFIG.FALLBACK_DATA || []).find(s => String(s.id) === String(sareeId));
        if (fallback && fallback.reviews && fallback.reviews.length > 0) {
          reviews = fallback.reviews;
        }
      }
    }

    renderReviewsHtml(container, reviews, saree);
  }

  function renderReviewsHtml(container, reviews, saree) {
    if (!reviews || reviews.length === 0) {
      container.innerHTML = `
        <section class="detail-reviews-section">
          <div class="reviews-section-header">
            <div>
              <h3 class="reviews-section-title">Verified Customer Reviews</h3>
              <p class="reviews-section-subtitle">Real drape photos, videos, and comments from verified buyers</p>
            </div>
            <div class="reviews-guarantee-badge">
              <span>🛡️ 100% Quality Guaranteed</span>
            </div>
          </div>
          <div class="review-empty-card">
            <span class="review-empty-icon">✨</span>
            <h4>No customer reviews yet for this saree</h4>
            <p>Be the first to drape this authentic handcrafted piece! Every saree is hand-inspected and backed by ${escapeHtml(CONFIG.SHOP_NAME)}'s quality promise.</p>
          </div>
        </section>
      `;
      return;
    }

    const avgRating = (reviews.reduce((acc, r) => acc + (parseFloat(r.rating) || 5), 0) / reviews.length).toFixed(1);
    const starCount = Math.round(parseFloat(avgRating));

    container.innerHTML = `
      <section class="detail-reviews-section">
        <div class="reviews-section-header">
          <div class="reviews-header-info">
            <h3 class="reviews-section-title">Customer Reviews &amp; Drapes</h3>
            <p class="reviews-section-subtitle">Authentic feedback, drape photos, and videos from buyers</p>
          </div>
          <div class="reviews-summary-card">
            <div class="reviews-score-col">
              <span class="reviews-avg-number">${avgRating}</span>
              <div class="reviews-avg-stars" aria-label="${avgRating} out of 5 stars">${'★'.repeat(starCount)}${'☆'.repeat(5 - starCount)}</div>
            </div>
            <div class="reviews-count-meta">
              <strong>${reviews.length} ${reviews.length === 1 ? 'Verified Review' : 'Verified Reviews'}</strong>
              <span class="reviews-verified-pill">✓ Admin Verified</span>
            </div>
          </div>
        </div>

        <div class="reviews-cards-list">
          ${reviews.map(rev => {
            const rating = parseInt(rev.rating, 10) || 5;
            const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);
            const initial = (rev.customer_name || 'C').trim().charAt(0).toUpperCase();
            const photos = Array.isArray(rev.photos) ? rev.photos : [];
            const dateStr = rev.created_at ? formatDate(rev.created_at) : 'Verified Purchase';

            let videoHtml = '';
            if (rev.video_url) {
              const vUrl = rev.video_url.trim();
              const isYt = vUrl.includes('youtube.com') || vUrl.includes('youtu.be');
              if (isYt) {
                const match = vUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([a-zA-Z0-9_-]{11})/);
                const ytId = match ? match[1] : '';
                if (ytId) {
                  videoHtml = `
                    <div class="review-media-block">
                      <span class="review-media-label">🎥 Customer Drape Video</span>
                      <div class="review-video-embed yt-aspect">
                        <iframe 
                          src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(ytId)}?playsinline=1" 
                          title="Customer Drape Video" 
                          frameborder="0" 
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                          allowfullscreen 
                          loading="lazy">
                        </iframe>
                      </div>
                    </div>
                  `;
                }
              } else {
                videoHtml = `
                  <div class="review-media-block">
                    <span class="review-media-label">🎥 Customer Drape Video</span>
                    <div class="review-video-embed">
                      <video controls playsinline preload="metadata" class="review-video-player">
                        <source src="${escapeHtml(vUrl)}" type="video/mp4">
                        Your browser does not support HTML5 video.
                      </video>
                    </div>
                  </div>
                `;
              }
            }

            let photosHtml = '';
            if (photos.length > 0) {
              photosHtml = `
                <div class="review-media-block">
                  <span class="review-media-label">📸 Customer Photos (${photos.length}) <small>(Tap to zoom)</small></span>
                  <div class="review-photos-grid">
                    ${photos.map((pUrl, pIdx) => `
                      <button type="button" class="review-photo-btn" data-img="${escapeHtml(pUrl)}" aria-label="View customer photo ${pIdx + 1} full screen">
                        <img src="${escapeHtml(pUrl)}" alt="Customer photo ${pIdx + 1}" loading="lazy" onerror="this.src='${PLACEHOLDER_IMG}';">
                        <span class="review-photo-zoom-icon">🔍</span>
                      </button>
                    `).join('')}
                  </div>
                </div>
              `;
            }

            return `
              <article class="customer-review-card">
                <header class="review-card-header">
                  <div class="reviewer-profile">
                    <div class="reviewer-avatar" aria-hidden="true">${escapeHtml(initial)}</div>
                    <div>
                      <h4 class="reviewer-name">${escapeHtml(rev.customer_name || 'Customer')}</h4>
                      <div class="reviewer-badges">
                        <span class="review-verified-badge">✓ Verified Buyer</span>
                        <time class="review-date">${escapeHtml(dateStr)}</time>
                      </div>
                    </div>
                  </div>
                  <div class="review-rating-stars" aria-label="${rating} out of 5 stars">${stars}</div>
                </header>

                <div class="review-comment-body">
                  <p class="review-comment-text">${escapeHtml(rev.comment || '')}</p>
                </div>

                ${photosHtml}
                ${videoHtml}
              </article>
            `;
          }).join('')}
        </div>
      </section>
    `;

    // Lightbox click on customer review photos
    container.querySelectorAll('.review-photo-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const imgSrc = btn.getAttribute('data-img');
        if (imgSrc) openLightbox(imgSrc);
      });
    });
  }

  function attachGalleryEvents(onSlideChange) {
    const gallery = document.getElementById('gallery-container');
    const thumbs = dom.sareeDetailContent.querySelectorAll('.thumb-item');
    const slides = dom.sareeDetailContent.querySelectorAll('.gallery-slide');

    thumbs.forEach(thumb => {
      thumb.addEventListener('click', () => {
        const idx = parseInt(thumb.getAttribute('data-index'), 10);
        if (slides[idx]) {
          slides[idx].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
          if (typeof onSlideChange === 'function') {
            const img = slides[idx].getAttribute('data-img');
            onSlideChange(idx, img);
          }
        }
      });
    });

    // Handle Video Play Overlays
    dom.sareeDetailContent.querySelectorAll('.video-play-overlay').forEach(overlay => {
      overlay.addEventListener('click', () => {
        const action = overlay.getAttribute('data-action');
        const parentSlide = overlay.closest('.gallery-slide');

        if (action === 'play-youtube') {
          const ytId = overlay.getAttribute('data-yt-id');
          if (ytId && parentSlide) {
            parentSlide.innerHTML = `
              <iframe 
                class="gallery-video-iframe" 
                src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(ytId)}?autoplay=1&playsinline=1" 
                frameborder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowfullscreen 
                loading="lazy">
              </iframe>
            `;
          }
        } else {
          // Native video play
          const videoEl = parentSlide ? parentSlide.querySelector('video') : null;
          if (videoEl) {
            overlay.style.display = 'none';
            videoEl.play().catch(e => console.warn('Video play prevented:', e));
          }
        }
      });
    });

    // Scroll listener: sync active thumbnail and pause video when user swipes away
    if (gallery && thumbs.length > 0) {
      gallery.addEventListener('scroll', () => {
        const width = gallery.offsetWidth;
        const currentIdx = Math.round(gallery.scrollLeft / width);
        thumbs.forEach((t, i) => t.classList.toggle('active', i === currentIdx));

        if (slides[currentIdx] && typeof onSlideChange === 'function') {
          const img = slides[currentIdx].getAttribute('data-img');
          onSlideChange(currentIdx, img);
        }

        // Pause playing videos when user swipes to a different slide
        const videos = gallery.querySelectorAll('video');
        videos.forEach(v => {
          const parent = v.closest('.gallery-slide');
          const slideIdx = parent ? parseInt(parent.getAttribute('data-index'), 10) : -1;
          if (slideIdx !== currentIdx && !v.paused) {
            v.pause();
          }
        });
      }, { passive: true });
    }

    // Lightbox for photos only
    slides.forEach(slide => {
      if (!slide.classList.contains('is-video')) {
        slide.addEventListener('click', () => {
          openLightbox(slide.getAttribute('data-img'));
        });
      }
    });
  }

  function openLightbox(imgSrc) {
    if (!dom.lightboxModal || !dom.lightboxImg) return;
    dom.lightboxImg.src = imgSrc;
    dom.lightboxModal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    if (!dom.lightboxModal) return;
    dom.lightboxModal.classList.remove('open');
    document.body.style.overflow = '';
  }

  function buildSareeShareText(saree) {
    const chosenColor = state.selectedSareeColor || saree.color || 'As shown';
    const shipping = getShippingInfo(saree);
    const shippingText = shipping.isFree ? 'Free Delivery Pan-India' : `${formatPrice(shipping.amount)} Insured Shipping`;
    const photo = state.currentOrderPhoto || saree.mainImage || (saree.images && saree.images[0]) || '';
    const currentUrl = window.location.href;

    let text = `🌸 *${saree.name}*\n` +
      `🏛️ *${CONFIG.SHOP_NAME}*\n\n` +
      `💰 *Price:* ${formatPrice(saree.price)} (${shippingText})\n` +
      `🎨 *Color:* ${chosenColor}\n` +
      `🧵 *Fabric:* ${saree.fabric}\n` +
      (saree.pattern ? `✨ *Work:* ${saree.pattern}\n` : '') +
      (saree.blouse ? `👚 *Blouse Piece:* ${saree.blouse}\n` : '') +
      `\n🔗 *Catalog Link:*\n${currentUrl}`;

    if (photo && !photo.startsWith('data:image/svg+xml') && photo !== currentUrl) {
      text += `\n\n🖼️ *Saree Photo:*\n${photo}`;
    }

    return text;
  }

  function handleWhatsAppShare(saree) {
    const text = buildSareeShareText(saree);
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  }

  function handleShare(saree) {
    const shareText = buildSareeShareText(saree);
    const shareData = {
      title: `${saree.name} | ${CONFIG.SHOP_NAME}`,
      text: shareText,
      url: window.location.href
    };

    if (navigator.share) {
      navigator.share(shareData).catch(() => copyLink(window.location.href));
    } else {
      copyLink(window.location.href);
    }
  }

  function copyLink(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => showToast('Link copied to clipboard!'))
        .catch(() => fallbackCopy(text));
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    const input = document.createElement('input');
    input.value = text;
    document.body.appendChild(input);
    input.select();
    try {
      document.execCommand('copy');
      showToast('Link copied to clipboard!');
    } catch (e) {
      showToast('Link: ' + text);
    }
    document.body.removeChild(input);
  }

  function renderSimilarSarees(current) {
    if (!dom.similarSection || !dom.similarSareesGrid) return;

    const similar = state.allSarees.filter(s => {
      if (String(s.id) === String(current.id)) return false;
      return s.category === current.category || s.fabric === current.fabric;
    }).slice(0, 4);

    if (similar.length === 0) {
      dom.similarSection.style.display = 'none';
      return;
    }

    dom.similarSection.style.display = 'block';
    dom.similarSareesGrid.innerHTML = similar.map(s => {
      const simShipping = getShippingInfo(s);
      return `
      <article class="saree-card ${s.isSold ? 'is-sold' : ''}">
        <a href="#/saree/${encodeURIComponent(s.id)}" class="saree-card-link">
          <div class="card-img-wrap">
            ${s.isSold ? '<span class="badge-sold-out">Sold Out</span>' : ''}
            <img 
              src="${escapeHtml(s.mainImage)}" 
              alt="${escapeHtml(s.name)}" 
              class="card-img" 
              loading="lazy"
              onerror="this.src='${PLACEHOLDER_IMG}';"
            >
          </div>
          <div class="card-body">
            <span class="card-meta">${escapeHtml(s.fabric)}</span>
            <h4 class="card-title">${escapeHtml(s.name)}</h4>
            <div class="card-price-row">
              <div class="card-price-stack">
                <span class="card-price">${formatPrice(s.price)}</span>
                <span class="card-shipping-tag ${simShipping.isFree ? 'is-free' : 'is-paid'}">${simShipping.tagText}</span>
              </div>
              <span class="card-cta-hint">View &rarr;</span>
            </div>
          </div>
        </a>
      </article>
      `;
    }).join('');
  }

  function updateMeta(saree) {
    const metaDesc = document.getElementById('meta-description');
    const ogTitle = document.getElementById('og-title');
    const ogDesc = document.getElementById('og-description');
    const ogImage = document.getElementById('og-image');
    const ogUrl = document.getElementById('og-url');

    const desc = `${saree.name} in ${saree.fabric} (${saree.color}) - ${formatPrice(saree.price)}. Order directly on WhatsApp from ${CONFIG.SHOP_NAME}.`;

    if (metaDesc) metaDesc.setAttribute('content', desc);
    if (ogTitle) ogTitle.setAttribute('content', `${saree.name} | ${CONFIG.SHOP_NAME}`);
    if (ogDesc) ogDesc.setAttribute('content', desc);
    if (ogImage && saree.mainImage && !saree.mainImage.endsWith('.svg')) {
      ogImage.setAttribute('content', saree.mainImage);
    }
    if (ogUrl) ogUrl.setAttribute('content', window.location.href);
  }

  function resetMeta() {
    document.title = `${CONFIG.SHOP_NAME} | ${CONFIG.SHOP_TAGLINE}`;
    const metaDesc = document.getElementById('meta-description');
    const ogTitle = document.getElementById('og-title');
    const ogDesc = document.getElementById('og-description');
    const ogImage = document.getElementById('og-image');
    const ogUrl = document.getElementById('og-url');

    const defaultDesc = `Discover handpicked Kanjivaram, Banarasi, Chanderi, and pure silk sarees directly from master weavers. Fast order confirmation via WhatsApp.`;
    if (metaDesc) metaDesc.setAttribute('content', defaultDesc);
    if (ogTitle) ogTitle.setAttribute('content', `${CONFIG.SHOP_NAME} | Handloom, Silk & Bridal Sarees`);
    if (ogDesc) ogDesc.setAttribute('content', defaultDesc);
    if (ogImage) ogImage.setAttribute('content', 'https://shivalaycollection.online/og-preview.jpg');
    if (ogUrl) ogUrl.setAttribute('content', 'https://shivalaycollection.online/');
  }

  // ----------------------------------------------------------------------------
  // HASH ROUTER
  // ----------------------------------------------------------------------------
  function handleRouting() {
    const hash = window.location.hash || '#/';
    state.currentRoute = hash;

    if (hash.startsWith('#/saree/')) {
      const sareeId = decodeURIComponent(hash.replace('#/saree/', '')).trim();

      if (!dom.catalogView.classList.contains('hidden')) {
        state.catalogScrollY = window.scrollY;
      }

      dom.catalogView.classList.add('hidden');
      dom.detailView.classList.add('active');

      if (state.allSarees.length > 0) {
        renderSareeDetail(sareeId);
      }
    } else {
      resetMeta();
      dom.catalogView.classList.remove('hidden');
      dom.detailView.classList.remove('active');

      if (state.catalogScrollY > 0) {
        window.scrollTo({ top: state.catalogScrollY, behavior: 'instant' });
      }
    }
  }

  // ----------------------------------------------------------------------------
  // EVENT LISTENERS
  // ----------------------------------------------------------------------------
  function setupEventListeners() {
    window.addEventListener('hashchange', handleRouting);

    // Search
    let searchTimer = null;
    if (dom.searchInput) {
      dom.searchInput.addEventListener('input', e => {
        clearTimeout(searchTimer);
        const val = e.target.value;
        state.searchQuery = val;
        if (dom.searchClearBtn) dom.searchClearBtn.classList.toggle('visible', val.length > 0);
        searchTimer = setTimeout(applyFiltersAndRender, 150);
      });
    }

    if (dom.searchClearBtn) {
      dom.searchClearBtn.addEventListener('click', () => {
        dom.searchInput.value = '';
        state.searchQuery = '';
        dom.searchClearBtn.classList.remove('visible');
        applyFiltersAndRender();
      });
    }

    // Sort
    if (dom.sortSelect) {
      dom.sortSelect.addEventListener('change', e => {
        state.sortBy = e.target.value;
        applyFiltersAndRender();
      });
    }

    // Toggle filter drawer
    if (dom.btnToggleFilters) {
      dom.btnToggleFilters.addEventListener('click', () => {
        const isOpen = dom.filtersDrawer.classList.toggle('open');
        dom.btnToggleFilters.setAttribute('aria-expanded', String(isOpen));
      });
    }

    // Filter selects
    if (dom.filterCategory) {
      dom.filterCategory.addEventListener('change', e => {
        state.activeCategory = e.target.value;
        if (dom.quickCategoryPills) {
          dom.quickCategoryPills.querySelectorAll('.pill-item').forEach(p => {
            p.classList.toggle('active', p.getAttribute('data-category') === state.activeCategory);
          });
        }
        applyFiltersAndRender();
      });
    }

    if (dom.filterFabric) {
      dom.filterFabric.addEventListener('change', e => {
        state.activeFabric = e.target.value;
        applyFiltersAndRender();
      });
    }

    if (dom.filterColor) {
      dom.filterColor.addEventListener('change', e => {
        state.activeColor = e.target.value;
        applyFiltersAndRender();
      });
    }

    // Price Slider
    if (dom.filterPriceRange) {
      dom.filterPriceRange.addEventListener('input', e => {
        state.maxPrice = parseFloat(e.target.value);
        if (dom.priceSliderValue) dom.priceSliderValue.textContent = formatPrice(state.maxPrice);
        applyFiltersAndRender();
      });
    }

    // Hide sold checkbox
    if (dom.filterHideSold) {
      dom.filterHideSold.addEventListener('change', e => {
        state.hideSold = e.target.checked;
        applyFiltersAndRender();
      });
    }

    // Reset filters
    const resetFilters = () => {
      state.activeCategory = 'all';
      state.activeFabric = 'all';
      state.activeColor = 'all';
      state.maxPrice = state.priceMax;
      state.hideSold = false;
      state.searchQuery = '';

      if (dom.searchInput) dom.searchInput.value = '';
      if (dom.searchClearBtn) dom.searchClearBtn.classList.remove('visible');
      if (dom.filterCategory) dom.filterCategory.value = 'all';
      if (dom.filterFabric) dom.filterFabric.value = 'all';
      if (dom.filterColor) dom.filterColor.value = 'all';
      if (dom.filterPriceRange) {
        dom.filterPriceRange.value = state.priceMax;
        if (dom.priceSliderValue) dom.priceSliderValue.textContent = formatPrice(state.priceMax);
      }
      if (dom.filterHideSold) dom.filterHideSold.checked = false;

      if (dom.quickCategoryPills) {
        dom.quickCategoryPills.querySelectorAll('.pill-item').forEach(p => {
          p.classList.toggle('active', p.getAttribute('data-category') === 'all');
        });
      }

      applyFiltersAndRender();
    };

    if (dom.btnClearFilters) dom.btnClearFilters.addEventListener('click', resetFilters);
    if (dom.btnEmptyReset) dom.btnEmptyReset.addEventListener('click', resetFilters);

    // Retry & fallback buttons
    if (dom.btnRetry) dom.btnRetry.addEventListener('click', () => loadCatalogData(true));
    if (dom.btnLoadFallback) {
      dom.btnLoadFallback.addEventListener('click', () => {
        state.allSarees = normalizeData(CONFIG.FALLBACK_DATA || []);
        initializeFiltersAndData();
      });
    }

    // Force Refresh from footer
    if (dom.btnForceRefresh) {
      dom.btnForceRefresh.addEventListener('click', () => {
        sessionStorage.removeItem(CACHE_KEY);
        sessionStorage.removeItem(CACHE_TIME_KEY);
        showToast('Refreshing catalog from live database...');
        loadCatalogData(true);
      });
    }

    // Order Delivery Address Modal Listeners
    if (dom.btnCloseAddressModal) dom.btnCloseAddressModal.addEventListener('click', closeAddressModal);
    if (dom.btnCancelAddress) dom.btnCancelAddress.addEventListener('click', closeAddressModal);
    if (dom.addressModalBackdrop) dom.addressModalBackdrop.addEventListener('click', closeAddressModal);
    if (dom.orderAddressForm) dom.orderAddressForm.addEventListener('submit', handleAddressSubmit);
    if (dom.addrPincode) dom.addrPincode.addEventListener('input', handlePincodeInput);

    // Clear input errors when user types
    ['addrName', 'addrPhone', 'addrLine', 'addrPincode', 'addrCity', 'addrState'].forEach(fieldKey => {
      if (dom[fieldKey]) {
        dom[fieldKey].addEventListener('input', () => {
          dom[fieldKey].classList.remove('is-invalid');
          const errEl = document.getElementById(`err-${dom[fieldKey].id}`);
          if (errEl) {
            errEl.textContent = '';
            errEl.classList.remove('visible');
          }
        });
      }
    });

    // Lightbox dismissal
    if (dom.lightboxClose) dom.lightboxClose.addEventListener('click', closeLightbox);
    if (dom.lightboxModal) {
      dom.lightboxModal.addEventListener('click', e => {
        if (e.target === dom.lightboxModal || e.target.classList.contains('lightbox-content-wrap')) {
          closeLightbox();
        }
      });
    }

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        if (dom.orderAddressModal && dom.orderAddressModal.classList.contains('open')) {
          closeAddressModal();
        } else if (dom.lightboxModal && dom.lightboxModal.classList.contains('open')) {
          closeLightbox();
        }
      }
    });
  }

  // ----------------------------------------------------------------------------
  // START
  // ----------------------------------------------------------------------------
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }

})();
