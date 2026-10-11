export type ModelPhase = 'idle' | 'queued' | 'downloading' | 'loading' | 'ready' | 'enriching' | 'error';

export interface ModelStatus {
  phase: ModelPhase;
  message: string;
  progress: number | null;
  queuedJobs: number;
}

const initialStatus: ModelStatus = {
  phase: 'idle',
  message: '',
  progress: null,
  queuedJobs: 0,
};

let status = initialStatus;
const listeners = new Set<() => void>();

function publish(next: ModelStatus) {
  status = next;
  listeners.forEach(listener => listener());
}

export function getModelStatus(): ModelStatus {
  return status;
}

export function subscribeToModelStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function updateModelStatus(
  update: Omit<ModelStatus, 'queuedJobs'> & { queuedJobs?: number }
) {
  publish({ ...status, ...update, queuedJobs: update.queuedJobs ?? status.queuedJobs });
}

export function addQueuedModelJob(): void {
  const queuedJobs = status.queuedJobs + 1;
  publish({
    ...status,
    phase: status.phase === 'idle' || status.phase === 'error' ? 'queued' : status.phase,
    message: status.phase === 'idle' || status.phase === 'error'
      ? 'Starting the local AI worker…'
      : status.message,
    progress: status.phase === 'idle' || status.phase === 'error' ? null : status.progress,
    queuedJobs,
  });
}

export function finishQueuedModelJob(errorMessage?: string): void {
  const queuedJobs = Math.max(0, status.queuedJobs - 1);
  if (errorMessage) {
    publish({
      ...status,
      phase: 'error',
      message: errorMessage,
      progress: null,
      queuedJobs,
    });
    return;
  }

  publish(queuedJobs > 0
    ? { ...status, phase: 'queued', message: 'Waiting to enrich the next movie…', progress: null, queuedJobs }
    : initialStatus);
}

export function dismissModelStatus(): void {
  if (status.phase === 'error' && status.queuedJobs === 0) publish(initialStatus);
}
