'use client';

import { useEffect, useState } from 'react';
import {
  getDiagnosticRecords,
  getLoggingEnabled,
  setLoggingEnabled,
  type DiagnosticRecord,
} from '@/lib/logger';

export default function DiagnosticsControls() {
  const [enabled, setEnabled] = useState(false);
  const [records, setRecords] = useState<DiagnosticRecord[]>([]);

  useEffect(() => {
    const refresh = () => setRecords(getDiagnosticRecords());
    setEnabled(getLoggingEnabled());
    refresh();
    window.addEventListener('movie-app-diagnostics-updated', refresh);
    return () => window.removeEventListener('movie-app-diagnostics-updated', refresh);
  }, []);

  return (
    <div className="mt-2 border-t border-gray-200 px-3 py-3 dark:border-gray-700">
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          onChange={event => {
            setLoggingEnabled(event.target.checked);
            setEnabled(event.target.checked);
          }}
        />
        Enable diagnostics logging
      </label>
      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-muted-foreground">
          Recent diagnostics ({records.length})
        </summary>
        <div className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs" aria-live="polite">
          {records.length ? records.slice().reverse().map((record, index) => (
            <p key={`${record.timestamp}-${index}`}>
              {new Date(record.timestamp).toLocaleTimeString()} [{record.level}] {record.message}
            </p>
          )) : <p>No diagnostics recorded this session.</p>}
        </div>
      </details>
    </div>
  );
}
