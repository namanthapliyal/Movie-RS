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
    ? 'Local AI queued'
    : status.phase === 'downloading'
      ? 'Downloading local AI model'
      : status.phase === 'loading'
        ? 'Preparing local AI model'
        : status.phase === 'ready'
          ? 'Local AI model ready'
          : status.phase === 'enriching'
            ? 'Enriching movie details'
            : 'Local AI issue';

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
          {status.phase === 'downloading' && status.progress !== null && (
            <div
              className="mt-2 h-1.5 overflow-hidden rounded-full bg-indigo-200 dark:bg-indigo-900"
              role="progressbar"
              aria-label="Local AI model download progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={status.progress}
            >
              <div className="h-full rounded-full bg-indigo-600 transition-[width] dark:bg-indigo-300" style={{ width: `${status.progress}%` }} />
            </div>
          )}
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
