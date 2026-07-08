document.addEventListener('DOMContentLoaded', async () => {
  const errorState = document.getElementById('error-state');
  const loadingState = document.getElementById('loading-state');
  const successState = document.getElementById('success-state');

  const companyStatus = document.getElementById('company-status');
  const companyNameEl = document.getElementById('company-name');
  const platformNameEl = document.getElementById('platform-name');
  const embedCodeText = document.getElementById('embed-code-text');
  const btnCopy = document.getElementById('btn-copy');
  
  const companyIdEl = document.getElementById('company-id');
  const companyLinkEl = document.getElementById('company-link');
  const btnCopyId = document.getElementById('btn-copy-id');
  const btnCopyLink = document.getElementById('btn-copy-link');

  const tabHtml = document.getElementById('tab-html');
  const tabMarkdown = document.getElementById('tab-markdown');
  const panelHtml = document.getElementById('panel-html');
  const panelMarkdown = document.getElementById('panel-markdown');
  const embedCodeMd = document.getElementById('embed-code-md');
  const btnCopyMd = document.getElementById('btn-copy-md');



  // Query the active tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || tabs.length === 0) {
      showError();
      return;
    }

    const activeTab = tabs[0];
    const url = activeTab.url;

    if (!url) {
      showError();
      return;
    }

    // Check if the domain is online.gov.vn
    try {
      const parsedUrl = new URL(url);
      if (!parsedUrl.hostname.endsWith('online.gov.vn')) {
        showError();
        return;
      }

      // Extract ID from URL
      let companyId = null;
      let isPlatform = false;

      // Match: http://online.gov.vn/nen-tang/6fa369f9-dc53-45be-9f69-014b06f1aa68
      const platformMatch = url.match(/\/nen-tang\/([a-zA-Z0-9-]+)/);
      if (platformMatch) {
        companyId = platformMatch[1];
        isPlatform = true;
      } else {
        // Also support standard website registration: http://online.gov.vn/Home/WebDetails/12345
        const webDetailsMatch = url.match(/\/Home\/WebDetails\/([0-9]+)/);
        if (webDetailsMatch) {
          companyId = webDetailsMatch[1];
        }
      }

      if (!companyId) {
        showError();
        return;
      }

      // If it is a platform, try to fetch the public API for extra details
      if (isPlatform) {
        showLoading();
        const apiUrl = `http://api.online.gov.vn/api/HomeBlock/PlatformPublic/${companyId}`;
        
        fetch(apiUrl)
          .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
          })
          .then(res => {
            if (res && res.status && res.data) {
              const data = res.data;
              showSuccess({
                companyName: data.companyName || 'Công ty đăng ký',
                platformName: data.name || 'Nền tảng / Ứng dụng',
                statusName: data.statusName || 'Đã xác nhận',
                isApproved: data.isApproved !== false,
                id: companyId,
                originalUrl: url
              });
            } else {
              showFallback(companyId, url, 'Nền tảng Bộ Công Thương');
            }
          })
          .catch(error => {
            console.warn('API fetch failed, falling back to URL parsing:', error);
            showFallback(companyId, url, 'Nền tảng Bộ Công Thương');
          });
      } else {
        // For WebDetails, use fallback direct generation
        showFallback(companyId, url, 'Website Bộ Công Thương');
      }

    } catch (e) {
      console.error(e);
      showError();
    }
  });

  // Copy code event
  btnCopy.addEventListener('click', () => {
    embedCodeText.select();
    navigator.clipboard.writeText(embedCodeText.value)
      .then(() => {
        const btnText = btnCopy.querySelector('span');
        const originalText = btnText.textContent;
        
        btnCopy.classList.add('copied');
        btnText.textContent = 'Đã chép!';
        
        setTimeout(() => {
          btnCopy.classList.remove('copied');
          btnText.textContent = originalText;
        }, 1500);
      })
      .catch(err => {
        console.error('Cannot copy code: ', err);
      });
  });

  // Copy ID event
  btnCopyId.addEventListener('click', () => {
    const idVal = companyIdEl.textContent;
    if (idVal && idVal !== '...') {
      navigator.clipboard.writeText(idVal)
        .then(() => {
          btnCopyId.classList.add('copied');
          const originalSvg = btnCopyId.innerHTML;
          btnCopyId.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
          setTimeout(() => {
            btnCopyId.classList.remove('copied');
            btnCopyId.innerHTML = originalSvg;
          }, 1500);
        })
        .catch(err => console.error('Cannot copy ID:', err));
    }
  });

  // Copy Link event
  btnCopyLink.addEventListener('click', () => {
    const linkVal = companyLinkEl.textContent;
    if (linkVal && linkVal !== '...') {
      navigator.clipboard.writeText(linkVal)
        .then(() => {
          btnCopyLink.classList.add('copied');
          const originalSvg = btnCopyLink.innerHTML;
          btnCopyLink.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
          setTimeout(() => {
            btnCopyLink.classList.remove('copied');
            btnCopyLink.innerHTML = originalSvg;
          }, 1500);
        })
        .catch(err => console.error('Cannot copy Link:', err));
    }
  });



  // Copy Markdown event
  btnCopyMd.addEventListener('click', () => {
    embedCodeMd.select();
    navigator.clipboard.writeText(embedCodeMd.value)
      .then(() => {
        const btnText = btnCopyMd.querySelector('span');
        const originalText = btnText.textContent;
        
        btnCopyMd.classList.add('copied');
        btnText.textContent = 'Đã chép!';
        
        setTimeout(() => {
          btnCopyMd.classList.remove('copied');
          btnText.textContent = originalText;
        }, 1500);
      })
      .catch(err => {
        console.error('Cannot copy Markdown: ', err);
      });
  });

  // Tab switching events
  tabHtml.addEventListener('click', () => {
    tabHtml.classList.add('active');
    tabMarkdown.classList.remove('active');
    panelHtml.classList.remove('hidden');
    panelMarkdown.classList.add('hidden');
  });

  tabMarkdown.addEventListener('click', () => {
    tabMarkdown.classList.add('active');
    tabHtml.classList.remove('active');
    panelMarkdown.classList.remove('hidden');
    panelHtml.classList.add('hidden');
  });



  function showError() {
    errorState.classList.remove('hidden');
    loadingState.classList.add('hidden');
    successState.classList.add('hidden');
  }

  function showLoading() {
    errorState.classList.add('hidden');
    loadingState.classList.remove('hidden');
    successState.classList.add('hidden');
  }

  function showSuccess(details) {
    errorState.classList.add('hidden');
    loadingState.classList.add('hidden');
    successState.classList.remove('hidden');

    companyNameEl.textContent = details.companyName;
    platformNameEl.textContent = details.platformName;
    companyStatus.textContent = details.statusName;
    companyIdEl.textContent = details.id;
    companyLinkEl.textContent = details.originalUrl;
    
    if (details.isApproved) {
      companyStatus.className = 'tag-status';
    } else {
      companyStatus.className = 'tag-status pending';
    }

    // Generate Embed Codes
    const embedUrl = details.originalUrl;
    const htmlCode = `<a href="${embedUrl}" target="_blank" rel="noopener noreferrer">
  <img src="http://online.gov.vn/logoCCDV.png" alt="Đã Đăng Ký Bộ Công Thương" style="width: 150px; border: 0;" />
</a>`;
    const markdownCode = `[![Đã Đăng Ký Bộ Công Thương](http://online.gov.vn/logoCCDV.png)](${embedUrl})`;

    embedCodeText.value = htmlCode;
    embedCodeMd.value = markdownCode;
  }

  function showFallback(id, originalUrl, defaultTitle) {
    errorState.classList.add('hidden');
    loadingState.classList.add('hidden');
    successState.classList.remove('hidden');

    companyNameEl.textContent = 'Chi tiết đăng ký';
    platformNameEl.textContent = defaultTitle;
    companyStatus.textContent = 'Đã đăng ký';
    companyStatus.className = 'tag-status';
    companyIdEl.textContent = id;
    companyLinkEl.textContent = originalUrl;

    const htmlCode = `<a href="${originalUrl}" target="_blank" rel="noopener noreferrer">
  <img src="http://online.gov.vn/logoCCDV.png" alt="Đã Đăng Ký Bộ Công Thương" style="width: 150px; border: 0;" />
</a>`;
    const markdownCode = `[![Đã Đăng Ký Bộ Công Thương](http://online.gov.vn/logoCCDV.png)](${originalUrl})`;

    embedCodeText.value = htmlCode;
    embedCodeMd.value = markdownCode;
  }


});
