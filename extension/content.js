/**
 * lifeOS Content Script
 * Extracts readable content, selection, metadata, and handles clipping messages.
 */

function getCleanPageText() {
  // Grab selected text first if available
  const selection = window.getSelection() ? window.getSelection().toString().trim() : '';
  if (selection && selection.length > 5) {
    return {
      text: selection,
      isSelection: true,
    };
  }

  // Target specific content containers (GitHub releases, blog posts, documentation, articles)
  const candidate = 
    document.querySelector('.markdown-body') ||
    document.querySelector('.release-body') ||
    document.querySelector('[data-test-selector="body-content"]') ||
    document.querySelector('article') ||
    document.querySelector('main') ||
    document.querySelector('[role="main"]') ||
    document.querySelector('#content') ||
    document.querySelector('.post-content') ||
    document.querySelector('.entry-content') ||
    document.body;

  if (!candidate) return { text: '', isSelection: false };

  // Clone node to avoid altering DOM
  const clone = candidate.cloneNode(true);

  // Remove clutter elements
  const removeSelectors = [
    'script', 'style', 'noscript', 'nav', 'footer', 'header',
    'aside', '.ad', '.ads', '.advertisement', '.sidebar',
    '.comment', '.comments', '#comments', '.cookie-banner',
    '.popup', '.modal', '.menu', 'svg', 'canvas', 'iframe'
  ];

  removeSelectors.forEach(selector => {
    clone.querySelectorAll(selector).forEach(el => el.remove());
  });

  let extracted = clone.innerText || clone.textContent || '';
  // Collapse whitespace
  extracted = extracted.replace(/[ \t]+/g, ' ').replace(/\n\s*\n\s*\n+/g, '\n\n').trim();

  // If candidate was too sparse (e.g. nested main didn't catch whole body), fallback to document.body text
  if (extracted.length < 50 && document.body && candidate !== document.body) {
    const bodyClone = document.body.cloneNode(true);
    removeSelectors.forEach(selector => {
      bodyClone.querySelectorAll(selector).forEach(el => el.remove());
    });
    extracted = (bodyClone.innerText || bodyClone.textContent || '').replace(/[ \t]+/g, ' ').replace(/\n\s*\n\s*\n+/g, '\n\n').trim();
  }

  // Cap length to 15000 characters for high-density summaries
  if (extracted.length > 15000) {
    extracted = extracted.slice(0, 15000) + '... [truncated]';
  }

  return {
    text: extracted,
    isSelection: false,
  };
}

function getPageMetadata() {
  const title = (
    document.querySelector('meta[property="og:title"]')?.content ||
    document.querySelector('meta[name="twitter:title"]')?.content ||
    document.title ||
    window.location.hostname
  ).trim();

  const description = (
    document.querySelector('meta[property="og:description"]')?.content ||
    document.querySelector('meta[name="description"]')?.content ||
    document.querySelector('meta[name="twitter:description"]')?.content ||
    ''
  ).trim();

  const siteName = (
    document.querySelector('meta[property="og:site_name"]')?.content ||
    window.location.hostname.replace(/^www\./, '')
  ).trim();

  const favicon = (
    document.querySelector('link[rel="icon"]')?.href ||
    document.querySelector('link[rel="shortcut icon"]')?.href ||
    document.querySelector('link[rel="apple-touch-icon"]')?.href ||
    `${window.location.origin}/favicon.ico`
  );

  const { text: contentText, isSelection } = getCleanPageText();

  return {
    title,
    url: window.location.href,
    origin: window.location.origin,
    pathname: window.location.pathname,
    description,
    siteName,
    favicon,
    contentText,
    isSelection,
  };
}

// Listen for messages from popup or background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'EXTRACT_PAGE_DATA') {
    try {
      const data = getPageMetadata();
      sendResponse({ success: true, data });
    } catch (err) {
      sendResponse({ success: false, error: err.message });
    }
  }
  return true;
});

// Zero-config lifeOS session bridge: if this page has lifeos_extension_sync in localStorage,
// silently push fresh tokens to the extension background worker and answer 1-click pair requests.
(function initLifeOSSessionBridge() {
  function readLifeOSPayload() {
    try {
      const rawSync = window.localStorage.getItem('lifeos_extension_sync');
      if (!rawSync) return null;
      const syncData = JSON.parse(rawSync);
      let accessToken = syncData.accessToken || '';
      let refreshToken = syncData.refreshToken || '';
      let userId = syncData.userId || '';
      let userEmail = syncData.userEmail || '';
      let supabaseUrl = syncData.supabaseUrl || window.__LIFEOS_CONFIG__?.supabaseUrl || '';
      const supabaseKey = syncData.supabaseAnonKey || window.__LIFEOS_CONFIG__?.supabaseAnonKey || '';

      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (!k) continue;
        if (k.includes('auth-token') || k === 'supabase.auth.token') {
          try {
            const parsed = JSON.parse(window.localStorage.getItem(k) || '{}');
            accessToken = parsed.access_token || parsed.currentSession?.access_token || accessToken;
            refreshToken = parsed.refresh_token || parsed.currentSession?.refresh_token || refreshToken;
            userId = parsed.user?.id || parsed.currentSession?.user?.id || userId;
            userEmail = parsed.user?.email || parsed.currentSession?.user?.email || userEmail;
          } catch (e) {}
        }
        const refMatch = k.match(/^sb-([a-zA-Z0-9_-]+)-auth-token$/);
        if (refMatch && refMatch[1] && !supabaseUrl) {
          supabaseUrl = `https://${refMatch[1]}.supabase.co`;
        }
      }

      let aiApiKey = '';
      let aiBaseUrl = '';
      let aiModel = '';
      const rawUi = window.localStorage.getItem('lifeos-ui-store') || window.localStorage.getItem('lifeos_ui_storage');
      if (rawUi) {
        try {
          const uiStore = JSON.parse(rawUi);
          const s = uiStore.state || uiStore;
          aiApiKey = s.aiDahlApiKey || s.aiApiKey || s.aiBynaraApiKey || s.aiGroqApiKey || '';
          aiBaseUrl = s.aiBaseUrl || '';
          aiModel = s.aiActiveModel || s.aiModel || '';
        } catch (e) {}
      }

      return {
        supabase: {
          lifeOsUrl: window.location.origin,
          ...(supabaseUrl ? { supabaseUrl } : {}),
          ...(supabaseKey ? { supabaseKey } : {}),
          ...(accessToken ? { accessToken } : {}),
          ...(refreshToken ? { refreshToken } : {}),
          ...(userId ? { userId } : {}),
          ...(userEmail ? { userEmail } : {}),
        },
        ai: {
          lifeOsUrl: window.location.origin,
          ...(aiApiKey ? { aiApiKey } : {}),
          ...(aiBaseUrl ? { aiBaseUrl } : {}),
          ...(aiModel ? { aiModel } : {}),
        },
      };
    } catch (e) {
      return null;
    }
  }

  function pushSessionToExtension(callback) {
    const payload = readLifeOSPayload();
    if (!payload) {
      if (callback) callback({ connected: false });
      return;
    }
    try {
      chrome.runtime.sendMessage({ action: 'LIFEOS_SYNC_FROM_PAGE', payload }, (res) => {
        if (callback) callback(res || { connected: Boolean(payload.supabase?.userId) });
      });
    } catch (e) {
      if (callback) callback({ connected: false });
    }
  }

  // Only run automatically if this tab is actually a lifeOS app tab
  if (window.localStorage.getItem('lifeos_extension_sync')) {
    pushSessionToExtension();
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data || typeof event.data !== 'object') return;
    if (event.data.type === 'LIFEOS_EXTENSION_PING') {
      try {
        chrome.runtime.sendMessage({ action: 'LIFEOS_GET_STATUS' }, (res) => {
          window.postMessage(
            {
              type: 'LIFEOS_EXTENSION_PONG',
              installed: true,
              connected: Boolean(res?.connected),
              userEmail: res?.userEmail || '',
            },
            window.location.origin
          );
        });
      } catch (e) {}
    } else if (event.data.type === 'LIFEOS_EXTENSION_PAIR_REQUEST') {
      pushSessionToExtension((res) => {
        window.postMessage(
          {
            type: 'LIFEOS_EXTENSION_PAIR_RESULT',
            installed: true,
            connected: Boolean(res?.connected),
            userEmail: res?.userEmail || '',
          },
          window.location.origin
        );
      });
    }
  });
})();
