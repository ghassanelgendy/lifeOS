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
