/**
 * lifeOS Companion Clean Popup Controller
 */

import { supabaseClient } from '../lib/supabaseClient.js';
import { aiClient } from '../lib/aiClient.js';

// DOM Elements
const elements = {
  // Screentime & Header
  screentimeVal: document.getElementById('screentime-value'),
  btnRefresh: document.getElementById('btn-refresh'),
  btnOpenLifeOs: document.getElementById('btn-open-lifeos'),

  // Tabs
  navTabs: document.querySelectorAll('.nav-tab'),
  tabPanels: document.querySelectorAll('.tab-panel'),
  todayTasksBadge: document.getElementById('today-tasks-badge'),

  // Clipper
  clipFavicon: document.getElementById('clip-favicon'),
  clipTitle: document.getElementById('clip-title'),
  clipUrl: document.getElementById('clip-url'),
  clipSnippet: document.getElementById('clip-snippet'),
  clipTargetNote: document.getElementById('clip-target-note'),
  btnNewNoteModal: document.getElementById('btn-new-note-modal'),
  btnAiAnalyzeClip: document.getElementById('btn-ai-analyze-clip'),
  btnQuickClip: document.getElementById('btn-quick-clip'),
  aiCustomPrompt: document.getElementById('ai-custom-prompt'),
  aiAppendCheckbox: document.getElementById('ai-append-checkbox'),
  aiModeHint: document.getElementById('ai-mode-hint'),

  // Today Tab
  quickAddTaskForm: document.getElementById('quick-add-task-form'),
  taskTitleInput: document.getElementById('task-title-input'),
  taskPrioritySelect: document.getElementById('task-priority-select'),
  todayTasksList: document.getElementById('today-tasks-list'),
  tasksCount: document.getElementById('tasks-count'),
  todayHabitsList: document.getElementById('today-habits-list'),
  habitsCount: document.getElementById('habits-count'),

  // Notes Tab
  notesSearchInput: document.getElementById('notes-search-input'),
  notesListView: document.getElementById('notes-list-view'),
  noteViewerPane: document.getElementById('note-viewer-pane'),
  noteViewerTitle: document.getElementById('note-viewer-title'),
  noteViewerBody: document.getElementById('note-viewer-body'),
  btnBackToNotes: document.getElementById('btn-back-to-notes'),

  // Settings
  btnAutoSyncLifeos: document.getElementById('btn-auto-sync-lifeos'),
  statusDot: document.getElementById('status-dot'),
  statusMessage: document.getElementById('status-message'),

  // Toast
  toast: document.getElementById('toast'),
  toastText: document.getElementById('toast-text'),
};

let currentTabInfo = {
  title: '',
  url: '',
  favicon: '',
  description: '',
  contentText: '',
};

let allNotes = [];
let activeViewingNote = null;

// Toast Helper
function showToast(message, type = 'info') {
  if (!elements.toast || !elements.toastText) return;
  elements.toastText.textContent = message;
  elements.toast.className = `toast ${type}`;
  elements.toast.classList.remove('hidden');

  setTimeout(() => {
    elements.toast?.classList.add('hidden');
  }, 2500);
}

// Tab Switching
function initTabNavigation() {
  elements.navTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const targetTabId = tab.getAttribute('data-tab');

      elements.navTabs.forEach((t) => t.classList.remove('active'));
      elements.tabPanels.forEach((p) => p.classList.remove('active'));

      tab.classList.add('active');
      const targetPanel = document.getElementById(targetTabId);
      if (targetPanel) targetPanel.classList.add('active');

      if (targetTabId === 'tab-today') {
        loadTodayData();
      } else if (targetTabId === 'tab-notes') {
        renderNotesList();
      }
    });
  });
}

// Screentime & Header
async function loadScreentime() {
  try {
    if (elements.screentimeVal) elements.screentimeVal.textContent = '...';
    const stats = await supabaseClient.fetchTodayScreentime();
    if (elements.screentimeVal) {
      elements.screentimeVal.textContent = stats.formatted || '0m';
    }
  } catch (err) {
    if (elements.screentimeVal) elements.screentimeVal.textContent = '0m';
  }
}

// Current Browser Tab Extraction
async function initCurrentTab() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs || tabs.length === 0) return;

    const tab = tabs[0];
    const isInternal = !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('about:') || tab.url.startsWith('edge://');

    if (isInternal) {
      currentTabInfo.title = '';
      currentTabInfo.url = '';
      currentTabInfo.favicon = '../icons/icon-16.png';
      if (elements.clipTitle) {
        elements.clipTitle.value = '';
        elements.clipTitle.placeholder = 'Type title or browse to a webpage...';
      }
      if (elements.clipUrl) elements.clipUrl.textContent = 'Active on browser page';
      if (elements.clipFavicon) elements.clipFavicon.src = '../icons/icon-16.png';
      return;
    }

    currentTabInfo.title = tab.title || '';
    currentTabInfo.url = tab.url || '';
    currentTabInfo.favicon = tab.favIconUrl || '../icons/icon-16.png';

    if (elements.clipTitle) elements.clipTitle.value = currentTabInfo.title;
    if (elements.clipUrl) elements.clipUrl.textContent = currentTabInfo.url;
    if (elements.clipFavicon) elements.clipFavicon.src = currentTabInfo.favicon;

    chrome.tabs.sendMessage(tab.id, { action: 'EXTRACT_PAGE_DATA' }, (response) => {
      if (chrome.runtime.lastError) return;
      if (response && response.success && response.data) {
        const data = response.data;
        currentTabInfo = { ...currentTabInfo, ...data };
        if (data.title && elements.clipTitle) elements.clipTitle.value = data.title;
        if ((data.description || data.contentText) && elements.clipSnippet) {
          elements.clipSnippet.value = data.isSelection
            ? data.contentText
            : (data.description || data.contentText.slice(0, 300));
        }
        if (data.favicon && elements.clipFavicon) elements.clipFavicon.src = data.favicon;
      }
    });
  } catch (err) {
    console.warn('Error reading active tab:', err);
  }
}

// Load & Populate Notes for Clipper
async function loadNotesDropdown() {
  try {
    allNotes = await supabaseClient.fetchNotes();
    if (!elements.clipTargetNote) return;

    elements.clipTargetNote.innerHTML = '';

    if (allNotes.length === 0) {
      const opt = document.createElement('option');
      opt.value = '__new_projects__';
      opt.textContent = 'Create "Projects I wanna try"';
      elements.clipTargetNote.appendChild(opt);
      return;
    }

    // Default note detection
    const defaultNote = await supabaseClient.findDefaultNote();
    const defaultNoteId = defaultNote ? defaultNote.id : allNotes[0]?.id;

    if (elements.aiModeHint && defaultNote) {
      elements.aiModeHint.textContent = `Default: ${defaultNote.title}`;
    }

    allNotes.forEach((note) => {
      const opt = document.createElement('option');
      opt.value = note.id;
      opt.textContent = note.title || 'Untitled Note';
      if (note.id === defaultNoteId) {
        opt.selected = true;
      }
      elements.clipTargetNote.appendChild(opt);
    });

    const newOpt = document.createElement('option');
    newOpt.value = '__create_new__';
    newOpt.textContent = 'Create New Note...';
    elements.clipTargetNote.appendChild(newOpt);
  } catch (err) {
    console.error('Failed to load notes dropdown:', err);
    if (elements.clipTargetNote) {
      elements.clipTargetNote.innerHTML = '<option value="">(Error loading notes)</option>';
    }
  }
}

// AI Clipper Controls
function initClipperControls() {
  if (elements.btnQuickClip) {
    elements.btnQuickClip.addEventListener('click', async () => {
      await executeClip({ useAi: false });
    });
  }

  if (elements.btnAiAnalyzeClip) {
    elements.btnAiAnalyzeClip.addEventListener('click', async () => {
      await executeClip({ useAi: true });
    });
  }

  if (elements.btnNewNoteModal) {
    elements.btnNewNoteModal.addEventListener('click', async () => {
      const noteTitle = prompt('Enter title for new note:', 'Projects I wanna try');
      if (!noteTitle || !noteTitle.trim()) return;

      try {
        const newNote = await supabaseClient.createNote({ title: noteTitle.trim(), body: '' });
        showToast(`Created note: ${noteTitle}`, 'success');
        await loadNotesDropdown();
        if (newNote && newNote.id && elements.clipTargetNote) {
          elements.clipTargetNote.value = newNote.id;
        }
      } catch (err) {
        showToast(`Failed: ${err.message}`, 'error');
      }
    });
  }
}

// Clip Execution
async function executeClip({ useAi = false }) {
  const targetNoteValue = elements.clipTargetNote ? elements.clipTargetNote.value : null;
  const isAppend = elements.aiAppendCheckbox ? elements.aiAppendCheckbox.checked : true;
  const customPrompt = elements.aiCustomPrompt ? elements.aiCustomPrompt.value.trim() : '';
  const pageTitle = (elements.clipTitle ? elements.clipTitle.value.trim() : '') || currentTabInfo.title || 'Untitled Page';
  const pageUrl = currentTabInfo.url || '';
  const snippet = elements.clipSnippet ? elements.clipSnippet.value.trim() : '';

  const actionBtn = useAi ? elements.btnAiAnalyzeClip : elements.btnQuickClip;
  if (!actionBtn) return;
  const origText = actionBtn.innerText;
  actionBtn.disabled = true;
  actionBtn.innerText = 'Saving...';

  try {
    let finalContent = '';
    const nowStr = new Date().toLocaleString();

    if (useAi) {
      showToast('Processing with AI...', 'info');
      const contentToAnalyze = currentTabInfo.contentText || snippet || currentTabInfo.description || pageTitle;

      const aiResult = await aiClient.analyzeContent({
        title: pageTitle,
        url: pageUrl,
        content: contentToAnalyze,
        customPrompt,
      });

      finalContent = `### [${pageTitle}](${pageUrl})\n*Clipped on ${nowStr}*\n\n${aiResult}`;
    } else {
      finalContent = `### [${pageTitle}](${pageUrl})\n*Clipped on ${nowStr}*\n\n${snippet ? `> ${snippet}\n` : ''}`;
    }

    let targetNoteId = targetNoteValue;

    if (targetNoteValue === '__create_new__' || targetNoteValue === '__new_projects__' || !targetNoteValue) {
      const newNote = await supabaseClient.createNote({
        title: targetNoteValue === '__new_projects__' ? 'Projects I wanna try' : pageTitle,
        body: finalContent,
      });
      targetNoteId = newNote.id;
      showToast('Created note and saved clip', 'success');
    } else {
      await supabaseClient.updateNote(targetNoteId, finalContent, { append: isAppend });
      showToast(isAppend ? 'Appended to note' : 'Updated note', 'success');
    }

    await loadNotesDropdown();
    if (targetNoteId && elements.clipTargetNote) elements.clipTargetNote.value = targetNoteId;
  } catch (err) {
    console.error('Clip error:', err);
    showToast(`Error: ${err.message}`, 'error');
  } finally {
    actionBtn.disabled = false;
    actionBtn.innerText = origText;
  }
}

// ================= TODAY TAB (TASKS & HABITS) =================
async function loadTodayData() {
  await Promise.all([loadTodayTasks(), loadTodayHabits()]);
}

async function loadTodayTasks() {
  try {
    const tasks = await supabaseClient.fetchTodayTasks();
    if (elements.tasksCount) elements.tasksCount.textContent = tasks.length;
    if (elements.todayTasksBadge) elements.todayTasksBadge.textContent = tasks.length;

    if (!elements.todayTasksList) return;

    if (tasks.length === 0) {
      elements.todayTasksList.innerHTML = '<div class="empty-state">No pending tasks for today</div>';
      return;
    }

    elements.todayTasksList.innerHTML = '';
    tasks.forEach((task) => {
      const item = document.createElement('div');
      item.className = `task-item ${task.is_completed ? 'completed' : ''}`;

      const dueDisplay = task.due_time ? `<span style="font-size: 9px; color: var(--text-muted);">${task.due_time.slice(0, 5)}</span>` : '';
      const priorityClass = task.priority && task.priority !== 'none' ? `priority-tag ${task.priority}` : '';
      const priorityLabel = task.priority && task.priority !== 'none' ? `<span class="${priorityClass}">${task.priority.toUpperCase()}</span>` : '';

      item.innerHTML = `
        <div class="task-item-left">
          <label class="checkbox-label">
            <input type="checkbox" class="task-checkbox" data-task-id="${task.id}" ${task.is_completed ? 'checked' : ''} />
            <span class="custom-checkbox"></span>
          </label>
          <span class="task-title" title="${task.title}">${task.title}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 4px;">
          ${dueDisplay}
          ${priorityLabel}
        </div>
      `;

      const cb = item.querySelector('.task-checkbox');
      cb.addEventListener('change', async (e) => {
        const isCompleted = e.target.checked;
        item.classList.toggle('completed', isCompleted);
        try {
          await supabaseClient.toggleTask(task.id, isCompleted);
          showToast(isCompleted ? 'Task completed' : 'Task reopened', 'info');
          setTimeout(() => loadTodayTasks(), 400);
        } catch (err) {
          showToast(`Failed: ${err.message}`, 'error');
          e.target.checked = !isCompleted;
        }
      });

      elements.todayTasksList.appendChild(item);
    });
  } catch (err) {
    if (elements.todayTasksList) {
      elements.todayTasksList.innerHTML = `<div class="empty-state">${err.message}</div>`;
    }
  }
}

async function loadTodayHabits() {
  try {
    const habits = await supabaseClient.fetchTodayHabits();
    if (elements.habitsCount) elements.habitsCount.textContent = habits.length;
    if (!elements.todayHabitsList) return;

    if (habits.length === 0) {
      elements.todayHabitsList.innerHTML = '<div class="empty-state" style="grid-column: span 2;">No habits scheduled today</div>';
      return;
    }

    elements.todayHabitsList.innerHTML = '';
    habits.forEach((habit) => {
      const card = document.createElement('div');
      card.className = `habit-card ${habit.isCompletedToday ? 'completed' : ''}`;

      const displayTitle = habit.isPrayer
        ? habit.title.replace(/\s*\(\d{1,2}:\d{2}\s*(?:AM|PM)?\)/i, '').trim()
        : habit.title;

      const timeTag = (habit.time && !habit.isPrayer)
        ? `<span style="font-size: 9px; color: var(--text-muted); margin-left: 2px;">${habit.time.slice(0, 5)}</span>`
        : '';

      card.innerHTML = `
        <div style="display: flex; align-items: center; gap: 4px; overflow: hidden;">
          <span class="habit-title">${displayTitle}</span>
          ${timeTag}
        </div>
        <div class="habit-check-icon"></div>
      `;

      card.addEventListener('click', async () => {
        const nextState = !habit.isCompletedToday;
        card.classList.toggle('completed', nextState);
        habit.isCompletedToday = nextState;

        try {
          await supabaseClient.toggleHabit(habit.id, nextState);
          showToast(nextState ? `Completed: ${habit.title}` : `Reverted: ${habit.title}`, 'info');
        } catch (err) {
          showToast(`Failed: ${err.message}`, 'error');
          card.classList.toggle('completed', !nextState);
          habit.isCompletedToday = !nextState;
        }
      });

      elements.todayHabitsList.appendChild(card);
    });
  } catch (err) {
    if (elements.todayHabitsList) {
      elements.todayHabitsList.innerHTML = `<div class="empty-state" style="grid-column: span 2;">${err.message}</div>`;
    }
  }
}

// Quick Add Task Form
function initQuickAddTask() {
  if (!elements.quickAddTaskForm) return;

  elements.quickAddTaskForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = elements.taskTitleInput.value.trim();
    if (!title) return;

    const priority = elements.taskPrioritySelect ? elements.taskPrioritySelect.value : 'none';
    const todayStr = new Date().toISOString().split('T')[0];

    try {
      await supabaseClient.createTask({
        title,
        priority,
        dueDate: todayStr,
      });

      showToast('Task added', 'success');
      elements.taskTitleInput.value = '';
      await loadTodayTasks();
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
    }
  });
}

// ================= NOTES TAB =================
function renderNotesList(filter = '') {
  if (!elements.notesListView) return;
  const q = filter.toLowerCase().trim();
  const filtered = allNotes.filter((n) => !q || (n.title && n.title.toLowerCase().includes(q)) || (n.body && n.body.toLowerCase().includes(q)));

  elements.notesListView.innerHTML = '';
  if (elements.noteViewerPane) elements.noteViewerPane.classList.add('hidden');
  elements.notesListView.classList.remove('hidden');

  if (filtered.length === 0) {
    elements.notesListView.innerHTML = '<div class="empty-state">No notes found</div>';
    return;
  }

  filtered.forEach((note) => {
    const item = document.createElement('div');
    item.className = 'note-item';
    item.innerHTML = `
      <div class="note-item-title">${note.title || 'Untitled'}</div>
      <div class="note-item-snippet">${note.body ? note.body.slice(0, 70).replace(/\n/g, ' ') : 'Empty note'}</div>
    `;

    item.addEventListener('click', () => {
      openNoteViewer(note);
    });

    elements.notesListView.appendChild(item);
  });
}

function openNoteViewer(note) {
  activeViewingNote = note;
  if (elements.noteViewerTitle) elements.noteViewerTitle.textContent = note.title || 'Untitled Note';
  if (elements.noteViewerBody) elements.noteViewerBody.textContent = note.body || '(Empty note)';
  if (elements.notesListView) elements.notesListView.classList.add('hidden');
  if (elements.noteViewerPane) elements.noteViewerPane.classList.remove('hidden');
}

function initNotesExplorer() {
  if (elements.notesSearchInput) {
    elements.notesSearchInput.addEventListener('input', (e) => {
      renderNotesList(e.target.value);
    });
  }

  if (elements.btnBackToNotes) {
    elements.btnBackToNotes.addEventListener('click', () => {
      if (elements.noteViewerPane) elements.noteViewerPane.classList.add('hidden');
      if (elements.notesListView) elements.notesListView.classList.remove('hidden');
      activeViewingNote = null;
    });
  }
}

// ================= SETTINGS & AUTO-SYNC =================
async function loadSettingsUI() {
  const config = await supabaseClient.loadConfig();
  if (elements.btnOpenLifeOs) {
    elements.btnOpenLifeOs.href = config.lifeOsUrl || 'http://localhost:5173';
  }
  updateConnectionStatus();
}

function updateConnectionStatus() {
  if (supabaseClient.isConfigured()) {
    if (elements.statusDot) elements.statusDot.className = 'status-indicator connected';
    if (elements.statusMessage) {
      elements.statusMessage.textContent = supabaseClient.userEmail
        ? `Connected: ${supabaseClient.userEmail}`
        : 'Connected & Auto-Configured';
    }
  } else {
    if (elements.statusDot) elements.statusDot.className = 'status-indicator error';
    if (elements.statusMessage) elements.statusMessage.textContent = 'Not connected';
  }
}

async function syncFromOpenTabs(interactive = false) {
  try {
    const tabs = await chrome.tabs.query({});
    let foundTab = null;

    for (const tab of tabs) {
      if (
        tab.url &&
        (tab.url.includes('localhost:5173') ||
         tab.url.includes('lifeos') ||
         tab.title?.toLowerCase().includes('lifeos'))
      ) {
        foundTab = tab;
        break;
      }
    }

    if (!foundTab) {
      if (interactive) showToast('Open lifeOS in a browser tab first', 'error');
      return false;
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: foundTab.id },
      func: () => {
        const items = {};
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key) items[key] = localStorage.getItem(key);
          }
        } catch (e) {}
        return {
          origin: window.location.origin,
          storage: items,
          windowConfig: (window).__LIFEOS_CONFIG__ || null,
        };
      },
    });

    if (results && results[0]?.result) {
      const { origin, storage, windowConfig } = results[0].result;
      let token = '';
      let refreshToken = '';
      let userEmail = '';
      let userId = '';
      let supabaseUrl = windowConfig?.supabaseUrl || '';
      let supabaseKey = windowConfig?.supabaseAnonKey || '';

      if (storage['lifeos_extension_sync']) {
        try {
          const syncData = JSON.parse(storage['lifeos_extension_sync']);
          if (syncData.supabaseUrl) supabaseUrl = syncData.supabaseUrl;
          if (syncData.supabaseAnonKey) supabaseKey = syncData.supabaseAnonKey;
          if (syncData.accessToken) token = syncData.accessToken;
          if (syncData.refreshToken) refreshToken = syncData.refreshToken;
          if (syncData.userId) userId = syncData.userId;
          if (syncData.userEmail) userEmail = syncData.userEmail;
        } catch (e) {}
      }

      for (const [k, v] of Object.entries(storage)) {
        if (k.includes('auth-token') || k === 'supabase.auth.token') {
          try {
            const parsed = JSON.parse(v);
            token = parsed.access_token || parsed.currentSession?.access_token || token;
            refreshToken = parsed.refresh_token || parsed.currentSession?.refresh_token || refreshToken;
            userEmail = parsed.user?.email || parsed.currentSession?.user?.email || userEmail;
            userId = parsed.user?.id || parsed.currentSession?.user?.id || userId;
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

      if (storage['lifeos_ui_storage']) {
        try {
          const uiStore = JSON.parse(storage['lifeos_ui_storage']);
          const s = uiStore.state || uiStore;
          if (s.aiApiKey || s.aiDahlApiKey || s.aiBynaraApiKey) {
            aiApiKey = s.aiDahlApiKey || s.aiApiKey || s.aiBynaraApiKey || '';
          }
          if (s.aiBaseUrl) aiBaseUrl = s.aiBaseUrl;
          if (s.aiActiveModel || s.aiModel) {
            aiModel = s.aiActiveModel || s.aiModel;
          }
        } catch (e) {}
      }

      const syncPayload = {
        lifeOsUrl: origin,
        ...(supabaseUrl ? { supabaseUrl } : {}),
        ...(supabaseKey ? { supabaseKey } : {}),
        ...(token ? { accessToken: token } : {}),
        ...(refreshToken ? { refreshToken } : {}),
        ...(userEmail ? { userEmail } : {}),
        ...(userId ? { userId } : {}),
      };

      const aiSyncPayload = {
        lifeOsUrl: origin,
        ...(aiApiKey ? { aiApiKey } : {}),
        ...(aiBaseUrl ? { aiBaseUrl } : {}),
        ...(aiModel ? { aiModel } : {}),
      };

      await supabaseClient.saveConfig(syncPayload);
      await aiClient.saveConfig(aiSyncPayload);
      return true;
    }
  } catch (err) {
    if (interactive) showToast(`Sync error: ${err.message}`, 'error');
  }
  return false;
}

function initSettings() {
  if (!elements.btnAutoSyncLifeos) return;

  elements.btnAutoSyncLifeos.addEventListener('click', async () => {
    elements.btnAutoSyncLifeos.textContent = 'Syncing...';
    const success = await syncFromOpenTabs(true);
    if (success) {
      await loadSettingsUI();
      await loadNotesDropdown();
      await loadScreentime();
      await loadTodayData();
      showToast('Synced with lifeOS', 'success');
    }
    elements.btnAutoSyncLifeos.textContent = 'Sync with lifeOS Tab';
  });
}

// Refresh Button Handler
function initRefresh() {
  if (!elements.btnRefresh) return;
  elements.btnRefresh.addEventListener('click', async () => {
    showToast('Refreshing...', 'info');
    await syncFromOpenTabs(false);
    await loadScreentime();
    await loadNotesDropdown();
    await loadTodayData();
  });
}

// Master Initialization
async function init() {
  initTabNavigation();
  initClipperControls();
  initQuickAddTask();
  initNotesExplorer();
  initSettings();
  initRefresh();

  await loadSettingsUI();
  await initCurrentTab();

  // Try silent sync from open lifeOS tab to ensure fresh access/refresh tokens
  await syncFromOpenTabs(false);

  await loadScreentime();
  await loadNotesDropdown();
  await loadTodayData();
}

document.addEventListener('DOMContentLoaded', init);
