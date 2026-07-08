document.addEventListener('DOMContentLoaded', () => {
  // Constants
  const API_URL = 'http://api.online.gov.vn/api/HomeBlock/PlatformsApproved?top=500';
  const CACHE_KEY = 'bct_platforms_cache';
  const CACHE_TIME_KEY = 'bct_platforms_cache_time';
  const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
  const SILENT_SYNC_DURATION = 6 * 60 * 60 * 1000; // Silent sync after 6 hours

  // State Variables
  let allData = [];
  let filteredData = [];
  let currentPage = 1;
  const pageSize = 24; // Load 24 cards/rows at a time
  let currentView = 'grid'; // 'grid' or 'list'

  // DOM Elements
  const loadingSpinner = document.getElementById('loading-spinner');
  const noResults = document.getElementById('no-results');
  const gridContainer = document.getElementById('grid-container');
  const listContainer = document.getElementById('list-container');
  const tableBody = document.getElementById('table-body');
  const scrollTrigger = document.getElementById('scroll-trigger');

  // Filter Elements
  const searchInput = document.getElementById('search-input');
  const btnClearSearch = document.getElementById('btn-clear-search');
  const filterCategory = document.getElementById('filter-category');
  const filterTemplate = document.getElementById('filter-template');
  const btnRefreshCache = document.getElementById('btn-refresh-cache');

  // Stats Elements
  const statTotal = document.getElementById('stat-total-platforms');
  const statApproved = document.getElementById('stat-approved-platforms');
  const statCategories = document.getElementById('stat-total-categories');
  const statCacheStatus = document.getElementById('stat-cache-status');

  // View toggles
  const toggleGrid = document.getElementById('toggle-grid');
  const toggleList = document.getElementById('toggle-list');

  // Initialize
  init();

  async function init() {
    setupEventListeners();
    setupInfiniteScroll();
    await loadData();
  }

  // Event Listeners Setup
  function setupEventListeners() {
    // Search input
    searchInput.addEventListener('input', () => {
      if (searchInput.value.trim() !== '') {
        btnClearSearch.classList.remove('hidden');
      } else {
        btnClearSearch.classList.add('hidden');
      }
      debounce(filterAndRender, 150)();
    });

    // Clear search button
    btnClearSearch.addEventListener('click', () => {
      searchInput.value = '';
      btnClearSearch.classList.add('hidden');
      filterAndRender();
    });

    // Dropdowns changes
    filterCategory.addEventListener('change', filterAndRender);
    filterTemplate.addEventListener('change', filterAndRender);

    // Refresh Cache button
    btnRefreshCache.addEventListener('click', () => refreshData(true));

    // View toggles
    toggleGrid.addEventListener('click', () => switchView('grid'));
    toggleList.addEventListener('click', () => switchView('list'));

    // Event delegation for copy actions
    document.addEventListener('click', handleCopyActions);
  }

  // Infinite scroll observer setup
  function setupInfiniteScroll() {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && filteredData.length > currentPage * pageSize) {
        currentPage++;
        renderPage();
      }
    }, {
      rootMargin: '100px'
    });

    observer.observe(scrollTrigger);
  }

  // Switch between Grid and Table View
  function switchView(view) {
    currentView = view;
    if (view === 'grid') {
      toggleGrid.classList.add('active');
      toggleList.classList.remove('active');
      gridContainer.classList.remove('hidden');
      listContainer.classList.add('hidden');
    } else {
      toggleList.classList.add('active');
      toggleGrid.classList.remove('active');
      listContainer.classList.remove('hidden');
      gridContainer.classList.add('hidden');
    }
    // Re-render
    currentPage = 1;
    gridContainer.innerHTML = '';
    tableBody.innerHTML = '';
    renderPage();
  }

  // Load data from cache or API (Stale-While-Revalidate pattern)
  async function loadData() {
    showLoading(true);
    const cachedData = localStorage.getItem(CACHE_KEY);
    const cachedTime = localStorage.getItem(CACHE_TIME_KEY);
    const now = Date.now();

    if (cachedData && cachedTime) {
      try {
        allData = JSON.parse(cachedData);
        statCacheStatus.textContent = 'Trực tuyến (Bộ nhớ đệm)';
        statCacheStatus.className = 'stat-value text-green';
        processData(allData);
        showLoading(false);

        // Silent background update if cache is older than 6 hours
        if (now - parseInt(cachedTime) > SILENT_SYNC_DURATION) {
          silentBackgroundUpdate();
        }
        return;
      } catch (e) {
        console.warn('Failed to parse cached data, fetching from API:', e);
      }
    }

    // Cache missing or expired: Fetch from API
    await refreshData(false);
  }

  // Silent sync database in background
  async function silentBackgroundUpdate() {
    try {
      const response = await fetch(API_URL);
      if (!response.ok) return;
      const res = await response.json();
      if (res && res.status && Array.isArray(res.data)) {
        const newDataStr = JSON.stringify(res.data);
        const oldDataStr = localStorage.getItem(CACHE_KEY);
        
        // Only update cache & re-render if data is actually changed
        if (newDataStr !== oldDataStr) {
          allData = res.data;
          localStorage.setItem(CACHE_KEY, newDataStr);
          localStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
          processData(allData);
          showToast('Cơ sở dữ liệu tự động cập nhật bản mới nhất!');
        }
      }
    } catch (e) {
      console.warn('Silent background update failed:', e);
    }
  }

  // Fetch API and update cache (Manual/Hard refresh)
  async function refreshData(isManual = false) {
    showLoading(true);
    statCacheStatus.textContent = 'Đang tải...';
    statCacheStatus.className = 'stat-value text-purple';

    const spinIcon = btnRefreshCache.querySelector('.icon-spin-target');
    if (spinIcon) spinIcon.classList.add('icon-spin');

    try {
      const response = await fetch(API_URL);
      if (!response.ok) throw new Error('API request failed');
      
      const res = await response.json();
      if (res && res.status && Array.isArray(res.data)) {
        allData = res.data;
        
        // Save to cache
        localStorage.setItem(CACHE_KEY, JSON.stringify(allData));
        localStorage.setItem(CACHE_TIME_KEY, Date.now().toString());

        statCacheStatus.textContent = 'Trực tuyến (Mới nhất)';
        statCacheStatus.className = 'stat-value text-green';
        
        processData(allData);
        if (isManual) showToast('Đồng bộ dữ liệu thành công!');
      } else {
        throw new Error('Invalid data format received');
      }
    } catch (e) {
      console.error('API Error:', e);
      statCacheStatus.textContent = 'Ngoại tuyến (Lỗi API)';
      statCacheStatus.className = 'stat-value text-red';
      showToast('Không thể kết nối API. Đang dùng dữ liệu cũ.');

      // Try loading whatever is in cache as fallback
      const cachedData = localStorage.getItem(CACHE_KEY);
      if (cachedData) {
        allData = JSON.parse(cachedData);
        processData(allData);
      }
    } finally {
      if (spinIcon) spinIcon.classList.remove('icon-spin');
      showLoading(false);
    }
  }

  // Populate filter selectors and stats based on data
  function processData(data) {
    // 1. Update stats values
    statTotal.textContent = data.length;
    
    const approvedCount = data.filter(item => item.statusName === 'Đã xác nhận' || item.status === 5).length;
    statApproved.textContent = approvedCount;

    // 2. Extract unique Categories & Templates
    const categories = new Set();
    const templates = new Set();
    
    data.forEach(item => {
      if (item.categoryLabel) categories.add(item.categoryLabel);
      if (item.mauSo) templates.add(item.mauSo);
    });

    statCategories.textContent = categories.size;

    // 3. Populate Category Dropdown
    const currentCategoryVal = filterCategory.value;
    filterCategory.innerHTML = '<option value="all">-- Tất cả danh mục --</option>';
    Array.from(categories).sort().forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      filterCategory.appendChild(opt);
    });
    filterCategory.value = currentCategoryVal;

    // 4. Populate Template Dropdown
    const currentTemplateVal = filterTemplate.value;
    filterTemplate.innerHTML = '<option value="all">-- Tất cả các mẫu --</option>';
    Array.from(templates).sort().forEach(temp => {
      const opt = document.createElement('option');
      opt.value = temp;
      opt.textContent = temp;
      filterTemplate.appendChild(opt);
    });
    filterTemplate.value = currentTemplateVal;

    // 5. Initial Filter and Render
    filterAndRender();
  }

  // Calculate search relevance score (Fuzzy search matching score)
  function getSearchScore(item, query) {
    if (query === '') return 1;

    const name = removeAccents((item.name || '').toLowerCase());
    const domain = removeAccents((item.domain || '').toLowerCase());
    const company = removeAccents((item.companyName || '').toLowerCase());
    const tax = removeAccents((item.companyTaxCode || '').toLowerCase());

    let score = 0;

    // 1. Exact Match Tax Code (Highest importance)
    if (tax === query) {
      score += 100;
    } else if (tax.includes(query)) {
      score += 40;
    }

    // 2. Match Domain
    if (domain === query) {
      score += 80;
    } else if (domain.includes(query)) {
      score += 30;
      if (domain.startsWith(query)) score += 10;
    }

    // 3. Match Platform Name
    if (name === query) {
      score += 60;
    } else if (name.includes(query)) {
      score += 25;
      if (name.startsWith(query)) score += 10;
    }

    // 4. Match Company Name
    if (company === query) {
      score += 50;
    } else if (company.includes(query)) {
      score += 20;
      if (company.startsWith(query)) score += 5;
    }

    return score;
  }

  // Filter algorithms with weighted fuzzy sorting
  function filterAndRender() {
    const query = removeAccents(searchInput.value.toLowerCase().trim());
    const selectedCategory = filterCategory.value;
    const selectedTemplate = filterTemplate.value;

    // Filter items first
    let matchedItems = allData.filter(item => {
      // 1. Category filter
      const matchCategory = selectedCategory === 'all' || item.categoryLabel === selectedCategory;

      // 2. Template filter
      const matchTemplate = selectedTemplate === 'all' || item.mauSo === selectedTemplate;

      if (!matchCategory || !matchTemplate) return false;

      // 3. Search query filter
      if (query === '') return true;
      return getSearchScore(item, query) > 0;
    });

    // Sort items by relevance score descending if searching
    if (query !== '') {
      matchedItems.sort((a, b) => {
        const scoreA = getSearchScore(a, query);
        const scoreB = getSearchScore(b, query);
        return scoreB - scoreA;
      });
    }

    filteredData = matchedItems;
    currentPage = 1;
    gridContainer.innerHTML = '';
    tableBody.innerHTML = '';
    
    if (filteredData.length === 0) {
      noResults.classList.remove('hidden');
      scrollTrigger.classList.add('hidden');
    } else {
      noResults.classList.add('hidden');
      scrollTrigger.classList.remove('hidden');
      renderPage();
    }
  }

  // Render current page items
  function renderPage() {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, filteredData.length);
    const itemsToRender = filteredData.slice(startIndex, endIndex);

    if (currentView === 'grid') {
      const fragment = document.createDocumentFragment();
      itemsToRender.forEach(item => {
        fragment.appendChild(createGridCard(item));
      });
      gridContainer.appendChild(fragment);
    } else {
      const fragment = document.createDocumentFragment();
      itemsToRender.forEach(item => {
        fragment.appendChild(createTableRow(item));
      });
      tableBody.appendChild(fragment);
    }

    // Hide infinite scroll loader if all items are rendered
    if (filteredData.length <= currentPage * pageSize) {
      scrollTrigger.classList.add('hidden');
    } else {
      scrollTrigger.classList.remove('hidden');
    }
  }

  // Create Card Widget
  function createGridCard(item) {
    const card = document.createElement('div');
    card.className = 'platform-card';
    
    // Logo block
    let logoHtml = '';
    if (item.logo) {
      logoHtml = `<img src="${item.logo}" alt="Logo" onerror="this.src=''; this.parentElement.innerHTML='<div class=&quot;logo-fallback&quot;>${getInitials(item.name || item.companyName)}</div>'">`;
    } else {
      logoHtml = `<div class="logo-fallback">${getInitials(item.name || item.companyName)}</div>`;
    }

    const domainUrl = formatDomainUrl(item.domain);
    const detailUrl = `http://online.gov.vn/nen-tang/${item.id}`;
    
    const embedHtml = `<a href="${detailUrl}" target="_blank" rel="noopener noreferrer"><img src="http://online.gov.vn/logoCCDV.png" alt="Đã Đăng Ký Bộ Công Thương" style="width: 150px; border: 0;" /></a>`;
    const embedMarkdown = `[![Đã Đăng Ký Bộ Công Thương](http://online.gov.vn/logoCCDV.png)](${detailUrl})`;

    card.innerHTML = `
      <div class="card-header">
        <div class="card-logo-wrapper">${logoHtml}</div>
        <div class="card-title-area">
          <div class="card-title" title="${item.name || 'Nền tảng'}">${item.name || 'Nền tảng không tên'}</div>
          <div class="card-domain">
            ${domainUrl ? `<a href="${domainUrl}" target="_blank" class="card-info-value link">${item.domain}</a>` : 'Không có link'}
          </div>
        </div>
      </div>

      <div class="card-body">
        <div class="card-info-row">
          <span class="card-info-label">Doanh nghiệp</span>
          <span class="card-info-value bold" title="${item.companyName || ''}">${item.companyName || 'N/A'}</span>
        </div>
        <div class="card-info-row">
          <span class="card-info-label">Mã số thuế</span>
          <span class="card-info-value">${item.companyTaxCode || 'N/A'}</span>
        </div>
        <div class="card-info-row">
          <span class="card-info-label">Danh mục</span>
          <span class="card-info-value" title="${item.categoryLabel || ''}">${item.categoryLabel || 'Chưa phân loại'}</span>
        </div>
        
        <div class="card-badge-row">
          <span class="card-badge approved">${item.statusName || 'Đã xác nhận'}</span>
          <span class="card-badge template">${item.mauSo || 'Mẫu 01'}</span>
        </div>
      </div>

      <div class="card-actions">
        <button class="btn-card-action primary bct-copy-html" data-code="${escapeHtml(embedHtml)}" title="Copy mã nhúng chèn website">Copy Mã HTML</button>
        <button class="btn-card-action bct-copy-md" data-code="${escapeHtml(embedMarkdown)}" title="Copy mã Markdown chèn github">Copy Markdown</button>
        <button class="btn-card-action bct-copy-id" data-val="${item.id}" title="Copy mã ID công ty">Copy UUID</button>
        <button class="btn-card-action bct-open-bct" data-url="${detailUrl}" title="Mở trang chi tiết Bộ Công Thương">Mở BCT</button>
      </div>
    `;

    return card;
  }

  // Create Table Row
  function createTableRow(item) {
    const tr = document.createElement('tr');
    
    let logoHtml = '';
    if (item.logo) {
      logoHtml = `<img src="${item.logo}" alt="" onerror="this.src=''; this.parentElement.innerHTML='<div class=&quot;table-fallback-logo&quot;>${getInitials(item.name || item.companyName)}</div>'">`;
    } else {
      logoHtml = `<div class="table-fallback-logo">${getInitials(item.name || item.companyName)}</div>`;
    }

    const domainUrl = formatDomainUrl(item.domain);
    const detailUrl = `http://online.gov.vn/nen-tang/${item.id}`;
    
    const embedHtml = `<a href="${detailUrl}" target="_blank" rel="noopener noreferrer"><img src="http://online.gov.vn/logoCCDV.png" alt="Đã Đăng Ký Bộ Công Thương" style="width: 150px; border: 0;" /></a>`;
    const embedMarkdown = `[![Đã Đăng Ký Bộ Công Thương](http://online.gov.vn/logoCCDV.png)](${detailUrl})`;

    tr.innerHTML = `
      <td>
        <div class="table-logo">${logoHtml}</div>
      </td>
      <td>
        <div class="card-title" title="${item.name || ''}" style="max-width: 250px;">${item.name || 'Không tên'}</div>
        <div style="font-size: 10px; color: var(--text-muted); margin-top: 2px;">Mẫu: ${item.mauSo || 'Mẫu 01'}</div>
      </td>
      <td>
        ${domainUrl ? `<a href="${domainUrl}" target="_blank" class="table-link">${item.domain}</a>` : '<span style="color: var(--text-muted);">Không có</span>'}
      </td>
      <td>
        <div style="font-weight: 500; color: var(--text-primary); max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.companyName || 'N/A'}</div>
        <div style="font-size: 10.5px; color: var(--text-muted); margin-top: 2px;">MST: ${item.companyTaxCode || 'N/A'}</div>
      </td>
      <td>
        <span style="color: var(--text-secondary);">${item.categoryLabel || 'N/A'}</span>
      </td>
      <td>
        <div class="table-actions">
          <button class="btn-table-icon bct-copy-html" data-code="${escapeHtml(embedHtml)}" title="Copy mã nhúng HTML">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12"><path d="M16 18L22 12L16 6M8 6L2 12L8 18"/></svg>
          </button>
          <button class="btn-table-icon bct-copy-md" data-code="${escapeHtml(embedMarkdown)}" title="Copy mã Markdown">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
          </button>
          <button class="btn-table-icon bct-copy-id" data-val="${item.id}" title="Copy mã UUID">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          </button>
          <button class="btn-table-icon bct-open-bct" data-url="${detailUrl}" title="Mở trang chi tiết Bộ Công Thương">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>
          </button>
        </div>
      </td>
    `;

    return tr;
  }

  // Handle Event delegation for Copy & Open operations
  function handleCopyActions(e) {
    const target = e.target;

    // 1. Copy HTML Embed code
    const copyHtmlBtn = target.closest('.bct-copy-html');
    if (copyHtmlBtn) {
      e.preventDefault();
      const code = copyHtmlBtn.getAttribute('data-code');
      navigator.clipboard.writeText(unescapeHtml(code))
        .then(() => {
          showToast('Đã sao chép mã nhúng HTML!');
          animateActionElement(copyHtmlBtn, 'Đã chép!');
        });
      return;
    }

    // 2. Copy Markdown Embed code
    const copyMdBtn = target.closest('.bct-copy-md');
    if (copyMdBtn) {
      e.preventDefault();
      const code = copyMdBtn.getAttribute('data-code');
      navigator.clipboard.writeText(unescapeHtml(code))
        .then(() => {
          showToast('Đã sao chép mã nhúng Markdown!');
          animateActionElement(copyMdBtn, 'Đã chép!');
        });
      return;
    }

    // 3. Copy UUID ID
    const copyIdBtn = target.closest('.bct-copy-id');
    if (copyIdBtn) {
      e.preventDefault();
      const uuid = copyIdBtn.getAttribute('data-val');
      navigator.clipboard.writeText(uuid)
        .then(() => {
          showToast('Đã sao chép mã UUID công ty!');
          animateActionElement(copyIdBtn, 'Đã chép!');
        });
      return;
    }

    // 4. Open BCT link
    const openBctBtn = target.closest('.bct-open-bct');
    if (openBctBtn) {
      e.preventDefault();
      const url = openBctBtn.getAttribute('data-url');
      window.open(url, '_blank');
      return;
    }
  }

  // Helper animation when buttons are clicked
  function animateActionElement(element, successText) {
    element.classList.add('copied');
    const isIconOnly = element.classList.contains('btn-table-icon');
    
    let originalHtml = element.innerHTML;
    if (isIconOnly) {
      element.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    } else {
      element.textContent = successText;
    }

    setTimeout(() => {
      element.classList.remove('copied');
      element.innerHTML = originalHtml;
    }, 1500);
  }

  // Toast Alerts
  function showToast(message) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'bct-toast';
    toast.innerHTML = `
      <svg class="bct-toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
      <span>${message}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => toast.classList.add('bct-show'), 10);

    setTimeout(() => {
      toast.classList.remove('bct-show');
      toast.classList.add('bct-toast-fadeout');
      setTimeout(() => {
        toast.remove();
      }, 300);
    }, 2000);
  }

  // Text helpers
  function getInitials(text) {
    if (!text) return 'BCT';
    const clean = removeAccents(text).replace(/[^a-zA-Z0-9\s]/g, '').trim();
    const words = clean.split(/\s+/).filter(w => w.length > 0);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return text.substring(0, 2).toUpperCase();
  }

  function formatDomainUrl(domain) {
    if (!domain) return null;
    let url = domain.trim();
    if (!/^https?:\/\//i.test(url)) {
      url = 'http://' + url;
    }
    try {
      new URL(url);
      return url;
    } catch (e) {
      return null;
    }
  }

  function removeAccents(str) {
    if (!str) return '';
    return str.normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .replace(/đ/g, 'd')
              .replace(/Đ/g, 'D');
  }

  function escapeHtml(text) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function unescapeHtml(text) {
    return text
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'");
  }

  // Helper utility functions
  function showLoading(show) {
    if (show) {
      loadingSpinner.classList.remove('hidden');
    } else {
      loadingSpinner.classList.add('hidden');
    }
  }

  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
});
