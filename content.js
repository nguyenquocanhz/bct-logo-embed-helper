(function () {
  const currentUrl = window.location.href;

  // Check if we are on a detail page
  let companyId = null;
  let isPlatform = false;
  let shadowRoot = null;

  const platformMatch = currentUrl.match(/\/nen-tang\/([a-zA-Z0-9-]+)/);
  if (platformMatch) {
    companyId = platformMatch[1];
    isPlatform = true;
  } else {
    const webDetailsMatch = currentUrl.match(/\/Home\/WebDetails\/([0-9]+)/);
    if (webDetailsMatch) {
      companyId = webDetailsMatch[1];
    }
  }

  if (!companyId) return;

  // Initialize widget
  createFloatingWidget();

  // Fetch details to populate widget
  if (isPlatform) {
    const apiUrl = `https://api.online.gov.vn/api/HomeBlock/PlatformPublic/${companyId}`;
    fetch(apiUrl)
      .then(res => res.json())
      .then(res => {
        if (res && res.status && res.data) {
          updateWidget(res.data.companyName, res.data.name, res.data.statusName || 'Đã xác nhận');
        } else {
          fallbackWidgetData();
        }
      })
      .catch(err => {
        console.warn('API Error in Content Script:', err);
        fallbackWidgetData();
      });
  } else {
    // Try to scrape DOM for WebDetails
    try {
      const companyName = getDomCompanyName() || 'Chi tiết đăng ký';
      const webName = getDomWebName() || 'Website Bộ Công Thương';
      updateWidget(companyName, webName, 'Đã đăng ký');
    } catch (e) {
      fallbackWidgetData();
    }
  }

  function getDomCompanyName() {
    const h2Elements = document.getElementsByTagName('h2');
    for (let h2 of h2Elements) {
      if (h2.textContent.trim()) return h2.textContent.trim();
    }
    const labels = document.querySelectorAll('td, span, div, p');
    for (let el of labels) {
      if (el.textContent.includes('Tên cá nhân/tổ chức') || el.textContent.includes('Tên Công ty')) {
        const nextSibling = el.nextElementSibling || el.parentElement.nextElementSibling;
        if (nextSibling) return nextSibling.textContent.trim();
      }
    }
    return null;
  }

  function getDomWebName() {
    const labels = document.querySelectorAll('td, span, div, p');
    for (let el of labels) {
      if (el.textContent.includes('Tên website') || el.textContent.includes('Tên ứng dụng')) {
        const nextSibling = el.nextElementSibling || el.parentElement.nextElementSibling;
        if (nextSibling) return nextSibling.textContent.trim();
      }
    }
    return null;
  }

  // Toast Notification System (within Shadow DOM)
  function showToast(message) {
    if (!shadowRoot) return;
    
    let container = shadowRoot.getElementById('bct-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'bct-toast-container';
      shadowRoot.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'bct-toast';
    toast.innerHTML = `
      <svg class="bct-toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
      <span>${message}</span>
    `;

    container.appendChild(toast);

    // Trigger animation
    setTimeout(() => toast.classList.add('bct-show'), 10);

    // Auto remove
    setTimeout(() => {
      toast.classList.remove('bct-show');
      toast.classList.add('bct-toast-fadeout');
      setTimeout(() => {
        toast.remove();
        if (container.children.length === 0) {
          container.remove();
        }
      }, 300);
    }, 2500);
  }

  function makeDraggable(element, dragTarget) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    const handle = element;

    handle.addEventListener('mousedown', dragMouseDown);

    function dragMouseDown(e) {
      if (e.target.closest('button') || e.target.closest('textarea') || e.target.closest('input')) return;
      
      e = e || window.event;
      e.preventDefault();
      
      const rect = dragTarget.getBoundingClientRect();
      dragTarget.style.top = rect.top + 'px';
      dragTarget.style.left = rect.left + 'px';
      dragTarget.style.bottom = 'auto';
      dragTarget.style.right = 'auto';

      pos3 = e.clientX;
      pos4 = e.clientY;
      
      document.addEventListener('mouseup', closeDragElement);
      document.addEventListener('mousemove', elementDrag);
      dragTarget.classList.add('bct-dragging');
    }

    function elementDrag(e) {
      e = e || window.event;
      e.preventDefault();
      
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;

      let newTop = dragTarget.offsetTop - pos2;
      let newLeft = dragTarget.offsetLeft - pos1;

      // Keep within viewport boundaries
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const widgetRect = dragTarget.getBoundingClientRect();

      newLeft = Math.max(10, Math.min(newLeft, viewportWidth - widgetRect.width - 10));
      newTop = Math.max(10, Math.min(newTop, viewportHeight - widgetRect.height - 10));

      dragTarget.style.top = newTop + "px";
      dragTarget.style.left = newLeft + "px";
    }

    function closeDragElement() {
      document.removeEventListener('mouseup', closeDragElement);
      document.removeEventListener('mousemove', elementDrag);
      dragTarget.classList.remove('bct-dragging');
    }
  }

  function createFloatingWidget() {
    if (document.getElementById('bct-extension-wrapper')) return;

    // Create container wrapper on host DOM
    const wrapper = document.createElement('div');
    wrapper.id = 'bct-extension-wrapper';
    wrapper.style.position = 'fixed';
    wrapper.style.bottom = '24px';
    wrapper.style.right = '24px';
    wrapper.style.zIndex = '2147483647'; // Max z-index to stay on top
    wrapper.style.width = 'auto';
    wrapper.style.height = 'auto';
    document.body.appendChild(wrapper);

    // Attach shadow root
    const shadow = wrapper.attachShadow({ mode: 'open' });
    shadowRoot = shadow;

    // Inject stylesheet inside the Shadow DOM
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('content.css');
    shadow.appendChild(link);

    // Create widget root inside Shadow DOM
    const widget = document.createElement('div');
    widget.id = 'bct-floating-widget';
    widget.className = 'bct-widget-collapsed';
    shadow.appendChild(widget);

    const embedUrl = currentUrl;
    const htmlCode = `<a href="${embedUrl}" target="_blank" rel="noopener noreferrer"><img src="http://online.gov.vn/logoCCDV.png" alt="Đã Đăng Ký Bộ Công Thương" style="width: 150px; border: 0;" /></a>`;
    const markdownCode = `[![Đã Đăng Ký Bộ Công Thương](http://online.gov.vn/logoCCDV.png)](${embedUrl})`;

    widget.innerHTML = `
      <!-- Collapsed Toggle Button -->
      <button class="bct-toggle-btn" title="Bộ Công Thương Logo Embed Helper">
        <img src="http://online.gov.vn/logoCCDV.png" alt="BCT Badge" />
        <span class="bct-pulse"></span>
      </button>

      <!-- Expanded Panel -->
      <div class="bct-panel">
        <div class="bct-panel-header">
          <div class="bct-header-title">
            <svg class="bct-icon-shield" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 22C12 22 20 18 20 12V5L12 2L4 5V12C4 18 12 22 12 22Z"/>
              <path d="M9 11L11 13L15 9"/>
            </svg>
            <span>BCT Embed Helper</span>
            <div class="bct-drag-indicator" title="Nhấn giữ để di chuyển">
              <span></span><span></span><span></span>
            </div>
          </div>
          <button class="bct-close-btn" title="Đóng">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div class="bct-panel-body">
          <div class="bct-info-section">
            <div class="bct-status-badge" id="bct-badge-status">Đang tải...</div>
            <div class="bct-company-name" id="bct-company-name">Đang lấy thông tin...</div>
            <div class="bct-platform-name" id="bct-platform-name">online.gov.vn</div>
            
            <div class="bct-meta-section">
              <div class="bct-meta-item">
                <span class="bct-meta-label">Mã:</span>
                <span class="bct-meta-value" id="bct-meta-id">${companyId}</span>
                <button class="bct-icon-copy-btn" id="bct-btn-copy-id" title="Sao chép mã công ty">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="11" height="11" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                </button>
              </div>
              <div class="bct-meta-item">
                <span class="bct-meta-label">Link:</span>
                <span class="bct-meta-value" id="bct-meta-link">${embedUrl}</span>
                <button class="bct-icon-copy-btn" id="bct-btn-copy-link" title="Sao chép link đăng ký">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="11" height="11" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div class="bct-preview-section">
            <div class="bct-section-label">Xem trước logo</div>
            <div class="bct-logo-preview">
              <img src="http://online.gov.vn/logoCCDV.png" alt="Logo Bộ Công Thương" />
            </div>
          </div>

          <div class="bct-code-section">
            <div class="bct-code-tabs">
              <button class="bct-tab-btn bct-active" id="bct-tab-html" type="button">HTML</button>
              <button class="bct-tab-btn" id="bct-tab-markdown" type="button">Markdown</button>
            </div>
            
            <div id="bct-panel-html" class="bct-tab-panel">
              <div class="bct-code-header">
                <div class="bct-section-label">Mã nhúng HTML</div>
                <button class="bct-copy-btn" id="bct-btn-copy" type="button">
                  <svg class="bct-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="12" height="12">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                  <span>Sao chép</span>
                </button>
              </div>
              <textarea class="bct-code-area" id="bct-code-html" readonly>${htmlCode}</textarea>
            </div>

            <div id="bct-panel-markdown" class="bct-tab-panel bct-hidden">
              <div class="bct-code-header">
                <div class="bct-section-label">Mã nhúng Markdown</div>
                <button class="bct-copy-btn" id="bct-btn-copy-md" type="button">
                  <svg class="bct-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="12" height="12">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                  <span>Sao chép</span>
                </button>
              </div>
              <textarea class="bct-code-area" id="bct-code-markdown" readonly>${markdownCode}</textarea>
            </div>
          </div>
        </div>
        
        <div class="bct-panel-footer">
          Nhấn giữ phần tiêu đề để kéo và di chuyển
        </div>
      </div>
    `;

    // Enable drag capability on the host wrapper element
    makeDraggable(widget.querySelector('.bct-panel-header'), wrapper);

    // Event listeners
    const toggleBtn = widget.querySelector('.bct-toggle-btn');
    const closeBtn = widget.querySelector('.bct-close-btn');

    const tabHtml = widget.querySelector('#bct-tab-html');
    const tabMarkdown = widget.querySelector('#bct-tab-markdown');
    const panelHtml = widget.querySelector('#bct-panel-html');
    const panelMarkdown = widget.querySelector('#bct-panel-markdown');

    const codeHtml = widget.querySelector('#bct-code-html');
    const codeMarkdown = widget.querySelector('#bct-code-markdown');
    
    const copyHtmlBtn = widget.querySelector('#bct-btn-copy');
    const copyMarkdownBtn = widget.querySelector('#bct-btn-copy-md');

    // Expand
    toggleBtn.addEventListener('click', () => {
      widget.classList.remove('bct-widget-collapsed');
      widget.classList.add('bct-widget-expanded');
    });

    // Collapse and reset wrapper position
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      widget.classList.remove('bct-widget-expanded');
      widget.classList.add('bct-widget-collapsed');
      
      wrapper.style.top = 'auto';
      wrapper.style.left = 'auto';
      wrapper.style.bottom = '24px';
      wrapper.style.right = '24px';
    });

    // Tab switching
    tabHtml.addEventListener('click', (e) => {
      e.stopPropagation();
      tabHtml.classList.add('bct-active');
      tabMarkdown.classList.remove('bct-active');
      panelHtml.classList.remove('bct-hidden');
      panelMarkdown.classList.add('bct-hidden');
    });

    tabMarkdown.addEventListener('click', (e) => {
      e.stopPropagation();
      tabMarkdown.classList.add('bct-active');
      tabHtml.classList.remove('bct-active');
      panelMarkdown.classList.remove('bct-hidden');
      panelHtml.classList.add('bct-hidden');
    });

    // Clipboard Copies with Toast Notifications
    copyHtmlBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      codeHtml.select();
      navigator.clipboard.writeText(codeHtml.value)
        .then(() => {
          showToast('Đã sao chép mã nhúng HTML!');
          animateCopyBtn(copyHtmlBtn);
        })
        .catch(err => console.error('Cannot copy HTML:', err));
    });

    copyMarkdownBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      codeMarkdown.select();
      navigator.clipboard.writeText(codeMarkdown.value)
        .then(() => {
          showToast('Đã sao chép mã nhúng Markdown!');
          animateCopyBtn(copyMarkdownBtn);
        })
        .catch(err => console.error('Cannot copy Markdown:', err));
    });

    const copyIdBtn = widget.querySelector('#bct-btn-copy-id');
    const copyLinkBtn = widget.querySelector('#bct-btn-copy-link');

    copyIdBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(companyId)
        .then(() => {
          showToast('Đã sao chép mã công ty!');
          animateIconCopyBtn(copyIdBtn);
        })
        .catch(err => console.error('Cannot copy ID:', err));
    });

    copyLinkBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(embedUrl)
        .then(() => {
          showToast('Đã sao chép link đăng ký!');
          animateIconCopyBtn(copyLinkBtn);
        })
        .catch(err => console.error('Cannot copy Link:', err));
    });
  }

  // Visual helper animations
  function animateCopyBtn(btn) {
    const originalContent = btn.innerHTML;
    btn.classList.add('bct-copied');
    btn.innerHTML = `
      <svg class="bct-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="12" height="12">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
      <span>Đã chép!</span>
    `;
    setTimeout(() => {
      btn.classList.remove('bct-copied');
      btn.innerHTML = originalContent;
    }, 1500);
  }

  function animateIconCopyBtn(btn) {
    btn.classList.add('bct-copied');
    const originalSvg = btn.innerHTML;
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="11" height="11" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    `;
    setTimeout(() => {
      btn.classList.remove('bct-copied');
      btn.innerHTML = originalSvg;
    }, 1500);
  }

  function updateWidget(companyName, platformName, status) {
    if (!shadowRoot) return;
    const companyEl = shadowRoot.getElementById('bct-company-name');
    const platformEl = shadowRoot.getElementById('bct-platform-name');
    const statusEl = shadowRoot.getElementById('bct-badge-status');

    if (companyEl) companyEl.textContent = companyName;
    if (platformEl) platformEl.textContent = platformName;
    if (statusEl) {
      statusEl.textContent = status;
      if (status.includes('Đã xác nhận') || status.includes('Đã đăng ký') || status.includes('Phê duyệt')) {
        statusEl.className = 'bct-status-badge bct-status-approved';
      } else {
        statusEl.className = 'bct-status-badge bct-status-pending';
      }
    }
  }

  function fallbackWidgetData() {
    updateWidget(
      'Chi tiết doanh nghiệp',
      isPlatform ? 'Nền tảng Bộ Công Thương' : 'Website Bộ Công Thương',
      'Đã đăng ký'
    );
  }
})();
