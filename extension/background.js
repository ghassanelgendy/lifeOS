/**
 * lifeOS Background Service Worker (Manifest V3)
 * Handles context menus, keyboard shortcuts, badge status, background clipping,
 * and Chronos Screentime website domain tracking.
 */

import { supabaseClient } from './lib/supabaseClient.js';
import { aiClient } from './lib/aiClient.js';

// Setup Context Menus on Installation
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'lifeos-clip-page',
    title: 'Clip page to lifeOS',
    contexts: ['page'],
  });

  chrome.contextMenus.create({
    id: 'lifeos-clip-selection',
    title: 'Clip selection to lifeOS note',
    contexts: ['selection'],
  });

  chrome.contextMenus.create({
    id: 'lifeos-ai-summarize-page',
    title: 'Summarize with AI and save to lifeOS',
    contexts: ['page', 'selection'],
  });

  // Schedule periodic screentime flush every 30 seconds
  chrome.alarms.create('flush-screentime', { periodInMinutes: 0.5 });
});

async function showBadgeSuccess() {
  chrome.action.setBadgeText({ text: 'OK' });
  chrome.action.setBadgeBackgroundColor({ color: '#10B981' }); // emerald-500
  setTimeout(() => {
    chrome.action.setBadgeText({ text: '' });
  }, 2500);
}

async function showBadgeError() {
  chrome.action.setBadgeText({ text: '!' });
  chrome.action.setBadgeBackgroundColor({ color: '#EF4444' }); // red-500
  setTimeout(() => {
    chrome.action.setBadgeText({ text: '' });
  }, 3000);
}

// Background clip execution
async function handleBackgroundClip({ tab, selectionText = null, useAi = false }) {
  try {
    await supabaseClient.loadConfig();
    await aiClient.loadConfig();

    if (!supabaseClient.isConfigured()) {
      console.warn('lifeOS Extension: Supabase not configured.');
      showBadgeError();
      return;
    }

    // 1. Get tab details or message content script
    let pageData = {
      title: tab.title || 'Untitled Webpage',
      url: tab.url || '',
      description: '',
      contentText: selectionText || '',
    };

    try {
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'EXTRACT_PAGE_DATA' });
      if (response && response.success && response.data) {
        pageData = response.data;
        if (selectionText) {
          pageData.contentText = selectionText;
        }
      }
    } catch (e) {
      // Content script may not be loaded on internal pages
    }

    // 2. Find target note (defaults to "Projects I wanna try" or user preference)
    const targetNote = await supabaseClient.findDefaultNote();

    let clipContent = '';
    const nowStr = new Date().toLocaleString();

    if (useAi) {
      const aiResult = await aiClient.analyzeContent({
        title: pageData.title,
        url: pageData.url,
        content: pageData.contentText || pageData.description || pageData.title,
      });

      clipContent = `### [${pageData.title}](${pageData.url})\n*Clipped on ${nowStr}*\n\n${aiResult}`;
    } else {
      const excerpt = selectionText || pageData.contentText?.slice(0, 500) || pageData.description || '';
      clipContent = `### [${pageData.title}](${pageData.url})\n*Clipped on ${nowStr}*\n\n${excerpt ? `> ${excerpt}\n` : ''}`;
    }

    if (targetNote) {
      await supabaseClient.updateNote(targetNote.id, clipContent, { append: true });
    } else {
      await supabaseClient.createNote({
        title: 'Projects I wanna try',
        body: clipContent,
      });
    }

    showBadgeSuccess();
  } catch (err) {
    console.error('Background clipping failed:', err);
    showBadgeError();
  }
}

// Listen to context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'lifeos-clip-page') {
    handleBackgroundClip({ tab, selectionText: null, useAi: false });
  } else if (info.menuItemId === 'lifeos-clip-selection') {
    handleBackgroundClip({ tab, selectionText: info.selectionText, useAi: false });
  } else if (info.menuItemId === 'lifeos-ai-summarize-page') {
    handleBackgroundClip({ tab, selectionText: info.selectionText || null, useAi: true });
  }
});

// Listen to keyboard shortcut commands
chrome.commands.onCommand.addListener((command) => {
  if (command === 'quick-clip') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0]) {
        handleBackgroundClip({ tab: tabs[0], selectionText: null, useAi: false });
      }
    });
  }
});

// ==========================================
// CHRONOS SCREENTIME ACTIVE WEBSITE TRACKER
// ==========================================

let activeSession = {
  domain: null,
  faviconUrl: null,
  lastTimestamp: Date.now(),
  isFocused: true,
  isIdle: false,
};

const screentimeBuffer = new Map(); // domain -> { seconds: number, faviconUrl: string }

function cleanDomain(rawUrl) {
  if (!rawUrl) return null;
  try {
    const parsed = new URL(rawUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    let host = parsed.hostname.toLowerCase().trim();
    if (host.startsWith('www.')) host = host.slice(4);
    return host;
  } catch (e) {
    return null;
  }
}

function recordActiveInterval() {
  const now = Date.now();
  const elapsedSeconds = Math.round((now - activeSession.lastTimestamp) / 1000);
  activeSession.lastTimestamp = now;

  if (
    elapsedSeconds > 0 &&
    elapsedSeconds < 3600 &&
    activeSession.isFocused &&
    !activeSession.isIdle &&
    activeSession.domain
  ) {
    const existing = screentimeBuffer.get(activeSession.domain) || {
      seconds: 0,
      faviconUrl: activeSession.faviconUrl,
    };
    existing.seconds += elapsedSeconds;
    if (activeSession.faviconUrl) existing.faviconUrl = activeSession.faviconUrl;
    screentimeBuffer.set(activeSession.domain, existing);
  }
}

async function flushScreentimeBuffer() {
  recordActiveInterval();
  if (screentimeBuffer.size === 0) return;

  await supabaseClient.loadConfig();
  if (!supabaseClient.isConfigured()) return;

  const entries = Array.from(screentimeBuffer.entries());
  screentimeBuffer.clear();

  for (const [domain, data] of entries) {
    if (data.seconds > 0) {
      await supabaseClient.logWebsiteScreentime({
        domain,
        faviconUrl: data.faviconUrl,
        seconds: data.seconds,
      });
    }
  }
}

async function updateActiveTab() {
  recordActiveInterval();

  try {
    const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (tabs && tabs[0]) {
      const tab = tabs[0];
      const domain = cleanDomain(tab.url);
      activeSession.domain = domain;
      activeSession.faviconUrl = tab.favIconUrl || (domain ? `https://${domain}/favicon.ico` : null);
    } else {
      activeSession.domain = null;
    }
  } catch (e) {
    activeSession.domain = null;
  }
}

// Track tab activation & URL change
chrome.tabs.onActivated.addListener(() => {
  updateActiveTab();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.active && (changeInfo.url || changeInfo.status === 'complete')) {
    updateActiveTab();
  }
});

// Track window focus
chrome.windows.onFocusChanged.addListener((windowId) => {
  recordActiveInterval();
  activeSession.isFocused = windowId !== chrome.windows.WINDOW_ID_NONE;
  if (activeSession.isFocused) {
    updateActiveTab();
  }
});

// Track idle state (locks/away)
chrome.idle.onStateChanged.addListener((state) => {
  recordActiveInterval();
  activeSession.isIdle = state !== 'active';
});

// Periodic flush alarm
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'flush-screentime') {
    flushScreentimeBuffer();
  }
});
