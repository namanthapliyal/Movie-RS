'use client';

import { useSyncExternalStore } from 'react';
import {
  dismissModelStatus,
  getModelStatus,
  subscribeToModelStatus,
} from '@/lib/model-status';

export default function ModelStatusBanner() {
  const status = useSyncExternalStore(
    subscribeToModelStatus,
    getModelStatus,
    getModelStatus
  );

  if (status.phase === 'idle') return null;

  const busy = status.phase !== 'error';
  const label = status.phase === 'queued'
    ? 'Local Ollama queued'
    : status.phase === 'connecting'
      ? 'Connecting to local Ollama'
      : status.phase === 'enriching'
        ? 'Enriching movie details with Ollama'
        : 'Local Ollama issue';

  return (
    <aside
      className="border-b border-indigo-200 bg-indigo-50 text-indigo-950 dark:border-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-100"
      aria-label="Local AI model status"
    >
      <div className="mx-auto flex max-w-7xl items-start gap-3 px-4 py-3 sm:px-6">
        {busy && (
          <span
            className="mt-1.5 h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-indigo-300 border-t-indigo-700 dark:border-indigo-700 dark:border-t-indigo-200"
            aria-hidden="true"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold" role={status.phase === 'error' ? 'alert' : 'status'}>
            {label}{status.queuedJobs > 1 ? ` · ${status.queuedJobs} movies queued` : ''}
          </p>
          <p className="mt-0.5 break-words text-xs text-indigo-800 dark:text-indigo-200">{status.message}</p>
        </div>
        {status.phase === 'error' && (
          <button
            type="button"
            className="btn btn-outline shrink-0 px-2 py-1 text-xs"
            onClick={dismissModelStatus}
          >
            Dismiss
          </button>
        )}
      </div>
    </aside>
  );
}
