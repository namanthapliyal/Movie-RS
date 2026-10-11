import log from 'loglevel';

const ENABLED_KEY = 'movie_app_logging_enabled';
const RECORDS_KEY = 'movie_app_diagnostics';
const MAX_RECORDS = 100;
const MAX_MESSAGE_LENGTH = 240;

export interface DiagnosticRecord {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}

log.setLevel('silent');

function isEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(ENABLED_KEY) === 'true';
  } catch {
    return false;
  }
}

function sanitize(message: string): string {
  return message
    .replace(/(token|api[_-]?key|authorization)\s*[:=]\s*\S+/gi, '$1=[redacted]')
    .replace(/https?:\/\/\S+/gi, '[url]')
    .slice(0, MAX_MESSAGE_LENGTH);
}

function getRecords(): DiagnosticRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const records: unknown = JSON.parse(window.sessionStorage.getItem(RECORDS_KEY) || '[]');
    return Array.isArray(records) ? records as DiagnosticRecord[] : [];
  } catch {
    return [];
  }
}

function write(level: DiagnosticRecord['level'], message: string): void {
  if (!isEnabled()) return;
  log.setLevel('info');
  const safeMessage = sanitize(message);
  const record = { timestamp: new Date().toISOString(), level, message: safeMessage };
  try {
    window.sessionStorage.setItem(RECORDS_KEY, JSON.stringify([...getRecords(), record].slice(-MAX_RECORDS)));
    window.dispatchEvent(new Event('movie-app-diagnostics-updated'));
  } catch (error) {
    console.warn('Unable to persist diagnostic log entry.', error);
  }
  log[level](safeMessage);
}

export const appLogger = {
  info: (message: string) => write('info', message),
  warn: (message: string) => write('warn', message),
  error: (message: string) => write('error', message),
};

export function setLoggingEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ENABLED_KEY, String(enabled));
  log.setLevel(enabled ? 'info' : 'silent');
  window.dispatchEvent(new Event('movie-app-logging-updated'));
}

export function getLoggingEnabled(): boolean {
  return isEnabled();
}

export function getDiagnosticRecords(): DiagnosticRecord[] {
  return getRecords();
}
