'use client';

import type { TMDBMovieDetails } from '@/types/db';
import { appLogger } from './logger';
import {
  addQueuedModelJob,
  finishQueuedModelJob,
  updateModelStatus,
  type ModelPhase,
} from './model-status';

interface WorkerStatusMessage {
  type: 'status';
  requestId: string;
  phase: ModelPhase;
  message: string;
  progress: number | null;
}

interface WorkerResultMessage {
  type: 'result';
  requestId: string;
  movie: TMDBMovieDetails;
}

interface WorkerErrorMessage {
  type: 'error';
  requestId: string;
  message: string;
}

type WorkerResponse = WorkerStatusMessage | WorkerResultMessage | WorkerErrorMessage;

interface PendingJob {
  resolve: (movie: TMDBMovieDetails) => void;
  reject: (error: Error) => void;
  onJobStarted?: () => void;
}

let worker: Worker | null = null;
let nextRequestId = 0;
const pendingJobs = new Map<string, PendingJob>();

function rejectPendingJobs(message: string): void {
  const jobs = [...pendingJobs.entries()];
  pendingJobs.clear();
  worker?.terminate();
  worker = null;
  jobs.forEach(([, job]) => {
    finishQueuedModelJob(message);
    job.reject(new Error(message));
  });
}

function getWorker(): Worker {
  if (worker) return worker;

  const instance = new Worker('/movie-enrichment-worker.js', { type: 'module' });
  instance.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
    const response = event.data;
    if (response.type === 'status') {
      updateModelStatus({
        phase: response.phase,
        message: response.message,
        progress: response.progress,
      });
      if (response.phase === 'enriching') pendingJobs.get(response.requestId)?.onJobStarted?.();
      appLogger.info(`Local AI: ${response.message}`);
      return;
    }

    const job = pendingJobs.get(response.requestId);
    if (!job) return;
    pendingJobs.delete(response.requestId);

    if (response.type === 'result') {
      finishQueuedModelJob();
      job.resolve(response.movie);
    } else {
      finishQueuedModelJob(response.message);
      appLogger.error('Local movie enrichment failed in the model worker.');
      job.reject(new Error(`Local movie enrichment failed: ${response.message}`));
    }
  });
  instance.addEventListener('error', event => {
    event.preventDefault();
    const message = 'The local AI worker stopped unexpectedly. Try the movie lookup again.';
    appLogger.error('The local AI worker stopped unexpectedly.');
    rejectPendingJobs(message);
  });
  worker = instance;
  return instance;
}

export function enrichMovieLocally(
  movie: TMDBMovieDetails,
  onQueued?: () => void,
  onJobStarted?: () => void
): Promise<TMDBMovieDetails> {
  const requestId = `movie-enrichment-${++nextRequestId}`;
  addQueuedModelJob();
  onQueued?.();

  return new Promise((resolve, reject) => {
    pendingJobs.set(requestId, { resolve, reject, onJobStarted });
    try {
      getWorker().postMessage({ type: 'ENRICH_MOVIE', requestId, movie });
    } catch (error) {
      pendingJobs.delete(requestId);
      const message = error instanceof Error ? error.message : 'Could not start the local AI worker.';
      finishQueuedModelJob(message);
      reject(new Error(`Local movie enrichment failed: ${message}`));
    }
  });
}
