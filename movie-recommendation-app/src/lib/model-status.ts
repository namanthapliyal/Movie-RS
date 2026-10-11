export type ModelPhase = 'idle' | 'queued' | 'connecting' | 'enriching' | 'error';

export interface ModelStatus {
  phase: ModelPhase;
  message: string;
  queuedJobs: number;
}

const initialStatus: ModelStatus = {
  phase: 'idle',
  message: '',
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
  update: Partial<ModelStatus>
) {
  publish({ ...status, ...update, queuedJobs: update.queuedJobs ?? status.queuedJobs });
}

export function addQueuedModelJob(): void {
  const queuedJobs = status.queuedJobs + 1;
  publish({
    ...status,
    phase: status.phase === 'idle' || status.phase === 'error' ? 'queued' : status.phase,
    message: status.phase === 'idle' || status.phase === 'error'
      ? 'Preparing a local Ollama request…'
      : status.message,
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
      queuedJobs,
    });
    return;
  }

  publish(queuedJobs > 0
    ? {
      ...status,
      phase: 'queued',
      message: 'Waiting for the next local Ollama request…',
      queuedJobs,
    }
    : initialStatus);
}

export function dismissModelStatus(): void {
  if (status.phase === 'error' && status.queuedJobs === 0) publish(initialStatus);
}
