'use client';

import type { TMDBMovieDetails } from '@/types/db';
import { appLogger } from './logger';
import {
  addQueuedModelJob,
  finishQueuedModelJob,
  updateModelStatus,
} from './model-status';

interface OllamaEnrichment {
  synopsis: string;
  genres: string[];
  cast: string[];
}

interface PendingJob {
  movie: TMDBMovieDetails;
  resolve: (movie: TMDBMovieDetails) => void;
  reject: (error: Error) => void;
  onJobStarted?: () => void;
}

let queue = Promise.resolve();

function validateEnrichment(value: unknown): value is OllamaEnrichment {
  if (!value || typeof value !== 'object') return false;
  const result = value as Record<string, unknown>;
  return typeof result.synopsis === 'string'
    && Array.isArray(result.genres)
    && result.genres.every(item => typeof item === 'string')
    && Array.isArray(result.cast)
    && result.cast.every(item => typeof item === 'string');
}

async function enrichFromOllama(job: PendingJob): Promise<TMDBMovieDetails> {
  const { movie } = job;
  updateModelStatus({
    phase: 'connecting',
    message: 'Connecting to Ollama at http://127.0.0.1:11434…',
  });
  job.onJobStarted?.();
  updateModelStatus({
    phase: 'enriching',
    message: 'Sending sourced movie facts to local Ollama…',
  });

  let response: Response;
  try {
    response = await fetch('/api/local-ai/enrich', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        movie: {
          title: movie.title,
          year: movie.release_date.slice(0, 4),
          synopsis: movie.overview,
          genres: movie.genres.map(genre => genre.name),
          cast: movie.credits.cast.slice(0, 50).map(member => member.name),
        },
      }),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Network request failed.';
    throw new Error(`Could not reach the local Ollama endpoint: ${detail}`);
  }

  const result = await response.json() as { enrichment?: unknown; error?: string };
  if (!response.ok) {
    throw new Error(result.error || `Local Ollama request failed (${response.status}).`);
  }
  if (!validateEnrichment(result.enrichment)) {
    throw new Error('Ollama returned an invalid structured response.');
  }

  const allowedGenres = new Set(movie.genres.map(genre => genre.name));
  const allowedCast = new Set(movie.credits.cast.map(member => member.name));
  const genres = result.enrichment.genres.filter(genre => allowedGenres.has(genre));
  const cast = result.enrichment.cast.filter(name => allowedCast.has(name));
  const sourceSynopsis = movie.overview.replace(/\s+/g, ' ');
  const normalizedSynopsis = result.enrichment.synopsis.trim().replace(/\s+/g, ' ');
  const synopsis = normalizedSynopsis && sourceSynopsis.includes(normalizedSynopsis)
    ? normalizedSynopsis
    : movie.overview;

  return {
    ...movie,
    overview: synopsis,
    genres: genres.length ? movie.genres.filter(genre => genres.includes(genre.name)) : movie.genres,
    credits: {
      ...movie.credits,
      cast: cast.length ? movie.credits.cast.filter(member => cast.includes(member.name)) : movie.credits.cast,
    },
  };
}

export function enrichMovieLocally(
  movie: TMDBMovieDetails,
  onQueued?: () => void,
  onJobStarted?: () => void
): Promise<TMDBMovieDetails> {
  addQueuedModelJob();
  onQueued?.();

  const result = new Promise<TMDBMovieDetails>((resolve, reject) => {
    const job = { movie, resolve, reject, onJobStarted };
    queue = queue.then(async () => {
      try {
        const enrichedMovie = await enrichFromOllama(job);
        finishQueuedModelJob();
        resolve(enrichedMovie);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Local Ollama enrichment failed.';
        finishQueuedModelJob(message);
        appLogger.error(`Local Ollama enrichment failed: ${message}`);
        reject(new Error(message));
      }
    });
  });

  return result;
}
