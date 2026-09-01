/**
 * lifeOS Options Controller
 */

import { supabaseClient } from '../lib/supabaseClient.js';

const elements = {
  lifeosUrl: document.getElementById('opt-lifeos-url'),
  defaultNote: document.getElementById('opt-default-note'),
  btnSave: document.getElementById('btn-save-options'),
  statusDot: document.getElementById('status-dot'),
  statusMessage: document.getElementById('status-message'),
  toast: document.getElementById('toast'),
  toastText: document.getElementById('toast-text'),
};

function showToast(msg, type = 'info') {
  if (!elements.toast || !elements.toastText) return;
  elements.toastText.textContent = msg;
  elements.toast.className = `toast ${type}`;
  elements.toast.classList.remove('hidden');
  setTimeout(() => elements.toast?.classList.add('hidden'), 2500);
}

async function loadData() {
  const config = await supabaseClient.loadConfig();

  if (elements.lifeosUrl) elements.lifeosUrl.value = config.lifeOsUrl || 'http://localhost:5173';
  if (elements.defaultNote) elements.defaultNote.value = config.defaultNoteName || 'Projects I wanna try';

  if (supabaseClient.isConfigured()) {
    if (elements.statusDot) elements.statusDot.className = 'status-indicator connected';
    if (elements.statusMessage) {
      elements.statusMessage.textContent = supabaseClient.userEmail
        ? `Connected as ${supabaseClient.userEmail}`
        : 'Connected & Auto-Configured';
    }
  } else {
    if (elements.statusDot) elements.statusDot.className = 'status-indicator error';
    if (elements.statusMessage) elements.statusMessage.textContent = 'Not connected';
  }
}

if (elements.btnSave) {
  elements.btnSave.addEventListener('click', async () => {
    const newConfig = {
      lifeOsUrl: elements.lifeosUrl ? elements.lifeosUrl.value.trim() : 'http://localhost:5173',
      defaultNoteName: elements.defaultNote ? elements.defaultNote.value.trim() || 'Projects I wanna try' : 'Projects I wanna try',
    };

    await supabaseClient.saveConfig(newConfig);
    showToast('Preferences saved!', 'success');
    loadData();
  });
}

document.addEventListener('DOMContentLoaded', loadData);
