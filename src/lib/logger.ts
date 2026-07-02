export interface SystemLog {
  timestamp: string;
  message: string;
  type: 'info' | 'warn' | 'error';
}

const LOGS_KEY = 'lifeos_system_logs';
const MAX_LOGS = 100;

export function addSystemLog(message: string, type: 'info' | 'warn' | 'error' = 'info') {
  try {
    const raw = localStorage.getItem(LOGS_KEY) || '[]';
    let logs: SystemLog[] = [];
    try {
      logs = JSON.parse(raw);
      if (!Array.isArray(logs)) logs = [];
    } catch {
      logs = [];
    }

    const newLog: SystemLog = {
      timestamp: new Date().toISOString(),
      message,
      type
    };

    // Keep the nearest 100 logs
    const updated = [newLog, ...logs].slice(0, MAX_LOGS);
    localStorage.setItem(LOGS_KEY, JSON.stringify(updated));
    
    // Also print to console
    const consoleMethod = type === 'error' ? 'error' : type === 'warn' ? 'warn' : 'log';
    console[consoleMethod](`[SystemLog] [${type.toUpperCase()}] ${message}`);
  } catch (e) {
    console.error('Failed to write system log:', e);
  }
}

export function getSystemLogs(): SystemLog[] {
  try {
    const raw = localStorage.getItem(LOGS_KEY) || '[]';
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function clearSystemLogs() {
  try {
    localStorage.removeItem(LOGS_KEY);
  } catch (e) {
    console.error('Failed to clear system logs:', e);
  }
}
