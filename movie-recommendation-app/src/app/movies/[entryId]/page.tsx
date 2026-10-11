'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import StarRating from '@/components/ui/StarRating';
import LikedElementsEditor from '@/components/watchlist/LikedElementsEditor';
import { DBService } from '@/lib/storage';
import type { LikedElement, WatchlistEntry } from '@/types/db';

export default function MovieDetailsPage() {
  const params = useParams<{ entryId: string }>();
  const [movie, setMovie] = useState<WatchlistEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [likedElements, setLikedElements] = useState<LikedElement[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    const entry = DBService.getWatchlist().find(item => item.id === params.entryId) ?? null;
    setMovie(entry);
    setRating(entry?.rating ?? 0);
    setReview(entry?.review ?? '');
    setLikedElements(entry?.liked_elements ?? []);
    setLoading(false);
  }, [params.entryId]);

  function saveReview() {
    if (!movie) return;
    setSaving(true);
    setSaveMessage('');
    try {
      DBService.updateReviewByEntryId(
        movie.id,
        rating > 0 ? rating : null,
        review.trim(),
        likedElements
      );
      const updated = DBService.getWatchlist().find(entry => entry.id === movie.id) ?? movie;
      setMovie(updated);
      setSaveMessage('Your rating and review have been saved.');
    } catch {
      setSaveMessage('Could not save your review. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function toggleWatched() {
    if (!movie) return;
    const watched = DBService.toggleWatched(movie.tmdb_id);
    if (watched === null) return;
    const updated = DBService.getWatchlist().find(entry => entry.id === movie.id);
    if (updated) setMovie(updated);
  }

  if (loading) {
    return <p role="status" className="py-12 text-center text-muted-foreground">Loading movie details…</p>;
  }

  if (!movie) {
    return (
      <section className="mx-auto max-w-2xl space-y-4 py-10">
        <Link className="btn btn-outline" href="/">← Back to watchlist</Link>
        <h1 className="text-2xl font-bold">Movie not found</h1>
        <p className="break-words text-muted-foreground">
          This movie may have been removed from your local watchlist.
        </p>
      </section>
    );
  }

  return (
    <article className="mx-auto w-full max-w-5xl space-y-6">
      <Link className="btn btn-outline" href="/">← Back to watchlist</Link>

      <div className="grid min-w-0 gap-6 md:grid-cols-[minmax(180px,280px)_minmax(0,1fr)]">
        <div className="mx-auto w-full max-w-[200px] md:mx-0">
          <img
            src={movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : '/movie-poster-placeholder.svg'}
            alt={`${movie.title} poster`}
            className="aspect-[2/3] max-h-[300px] w-full rounded-xl border border-border object-cover shadow-sm"
            onError={(event) => {
              event.currentTarget.src = '/movie-poster-placeholder.svg';
            }}
          />
        </div>

        <div className="min-w-0 space-y-5">
          <header className="min-w-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h1 className="min-w-0 break-words text-3xl font-bold leading-tight text-gray-900 dark:text-gray-100">
                {movie.title}
              </h1>
              <span className="shrink-0 rounded-full bg-muted px-3 py-1 text-sm">
                {movie.watched ? 'Watched' : 'To watch'}
              </span>
            </div>
            <p className="mt-2 text-muted-foreground">
              {movie.release_date ? movie.release_date.slice(0, 4) : 'Release year unavailable'}
              {movie.runtime ? ` · ${movie.runtime} min` : ''}
              {movie.vote_count ? ` · TMDB ${movie.vote_average?.toFixed(1)}/10 (${movie.vote_count} votes)` : ''}
            </p>
          </header>

          {!!movie.genres.length && (
            <div className="flex flex-wrap gap-2">
              {movie.genres.map((genre, index) => (
                <span key={`${genre}-${index}`} className="max-w-full break-words rounded-full bg-primary/10 px-3 py-1 text-sm text-primary">
                  {genre}
                </span>
              ))}
            </div>
          )}

          {movie.overview && (
            <section className="min-w-0 space-y-2">
              <h2 className="text-lg font-semibold">Synopsis</h2>
              <p className="whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">
                {movie.overview}
              </p>
            </section>
          )}

          {movie.cast?.length ? (
            <section className="space-y-2">
              <h2 className="text-lg font-semibold">Cast</h2>
              <p className="break-words text-sm text-muted-foreground">
                {movie.lead_actor ? `Lead actor: ${movie.lead_actor} · ` : ''}
                {movie.cast.join(', ')}
              </p>
            </section>
          ) : null}

          {!!movie.directors?.length && (
            <section className="space-y-2">
              <h2 className="text-lg font-semibold">Director{movie.directors.length > 1 ? 's' : ''}</h2>
              <p className="break-words text-sm text-muted-foreground">{movie.directors.join(', ')}</p>
            </section>
          )}

          {!!movie.metadata_sources?.length && (
            <section className="space-y-2">
              <h2 className="text-lg font-semibold">Sources</h2>
              <div className="flex flex-wrap gap-3">
                {movie.metadata_sources.map(source => (
                  <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="break-all text-sm text-primary underline">
                    {source.name}
                  </a>
                ))}
              </div>
            </section>
          )}

          {movie.lookup_status && movie.lookup_status !== 'complete' && (
            <p className="break-words text-sm text-primary" role="status">
              {movie.lookup_message || 'Movie details are still being looked up.'}
            </p>
          )}
        </div>
      </div>

      <section className="min-w-0 space-y-5 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold">Your rating & review</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              You can rate and update your review before or after marking this movie watched.
            </p>
          </div>
          <button type="button" className="btn btn-outline" onClick={toggleWatched}>
            {movie.watched ? 'Move to To Watch' : 'Mark as Watched'}
          </button>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <label className="font-medium">Star rating (out of 10)</label>
            <span className="text-sm font-semibold" aria-live="polite">
              {rating > 0 ? `${rating}/10` : 'Not rated'}
            </span>
          </div>
          <StarRating rating={rating} onRatingChange={setRating} />
          {rating > 0 && (
            <button type="button" className="text-sm text-muted-foreground underline" onClick={() => setRating(0)}>
              Clear rating
            </button>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="movie-review" className="font-medium">Review</label>
          <textarea
            id="movie-review"
            value={review}
            onChange={event => setReview(event.target.value)}
            placeholder="What did you think of the movie?"
            className="textarea min-h-32 resize-y break-words"
          />
        </div>

        <div className="min-w-0 space-y-2">
          <h3 className="font-medium">Likes & dislikes (optional)</h3>
          <LikedElementsEditor elements={likedElements} onChange={setLikedElements} />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn btn-primary" disabled={saving} onClick={saveReview}>
            {saving ? 'Saving…' : 'Save rating and review'}
          </button>
          {saveMessage && (
            <p role="status" className={`break-words text-sm ${saveMessage.startsWith('Could not') ? 'text-destructive' : 'text-muted-foreground'}`}>
              {saveMessage}
            </p>
          )}
        </div>
      </section>
    </article>
  );
}
