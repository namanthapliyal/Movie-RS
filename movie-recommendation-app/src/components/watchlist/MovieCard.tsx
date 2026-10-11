'use client';

import Link from 'next/link';
import type { WatchlistEntry } from '@/types/db';

interface MovieCardProps {
  movie: WatchlistEntry;
  onUpdate: (updatedMovie: WatchlistEntry) => void;
  onRemove: (tmdbId: number) => void;
  onWatch: (tmdbId: number) => void;
}

export default function MovieCard({ movie, onRemove, onWatch }: MovieCardProps) {
  return (
    <article className="movie-card flex min-w-0 flex-col">
      <Link
        href={`/movies/${encodeURIComponent(movie.id)}`}
        className="block min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`View details for ${movie.title}`}
      >
        <img
          src={movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : '/movie-poster-placeholder.svg'}
          alt=""
          className="movie-poster"
          onError={(event) => {
            event.currentTarget.src = '/movie-poster-placeholder.svg';
          }}
        />

        <div className="movie-info min-w-0">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <h3 className="movie-title min-w-0 break-words" title={movie.title}>
              {movie.title}
            </h3>
            <span className="shrink-0 text-xs text-muted-foreground">
              {movie.release_date ? new Date(movie.release_date).getFullYear() : '????'}
            </span>
          </div>

          <div className="flex flex-wrap gap-1">
            {movie.genres.slice(0, 2).map((genre, index) => (
              <span key={`${genre}-${index}`} className="max-w-full break-words rounded bg-muted/50 px-2 py-0.5 text-xs">
                {genre}
              </span>
            ))}
          </div>
          {movie.overview && (
            <p className="line-clamp-3 break-words text-xs text-muted-foreground">{movie.overview}</p>
          )}
          <p className="text-xs text-muted-foreground">
            {movie.watched ? 'Watched' : 'To watch'}
            {movie.rating !== null ? ` · Your rating: ${movie.rating}/10` : ' · Not rated'}
          </p>
          {movie.lookup_status && movie.lookup_status !== 'complete' && (
            <div className="flex min-w-0 items-start gap-2 text-xs text-primary" role="status">
              <span className="mt-0.5 h-3 w-3 shrink-0 animate-spin rounded-full border border-primary/40 border-t-primary" aria-hidden="true" />
              <span className="min-w-0 break-words">
                {movie.lookup_status === 'downloading' || movie.lookup_status === 'processing'
                  ? movie.lookup_status === 'processing'
                    ? 'Enriching movie details with local Ollama…'
                    : 'Waiting for local Ollama enrichment…'
                  : movie.lookup_message || 'Looking up movie details…'}
              </span>
            </div>
          )}
          <span className="mt-1 inline-block text-sm font-medium text-primary">View details and review</span>
        </div>
      </Link>

      <div className="mt-auto flex flex-wrap gap-2 px-4 pb-4">
        <button
          type="button"
          onClick={() => onWatch(movie.tmdb_id)}
          className="btn btn-outline btn-sm"
        >
          {movie.watched ? 'Unwatch' : 'Mark Watched'}
        </button>
        <button
          type="button"
          onClick={() => onRemove(movie.tmdb_id)}
          className="btn btn-ghost btn-sm text-destructive/70 hover:text-destructive"
          aria-label={`Remove ${movie.title} from watchlist`}
        >
          Remove
        </button>
      </div>
    </article>
  );
}
