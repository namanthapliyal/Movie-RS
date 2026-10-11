'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { TMDBMovieDetails } from '@/types/db';

export default function ExploredMovieDetailsPage() {
  const params = useParams<{ movieId: string }>();
  const searchParams = useSearchParams();
  const title = searchParams.get('title') ?? '';
  const source = searchParams.get('source');
  const [movie, setMovie] = useState<TMDBMovieDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function loadMovieDetails() {
      setLoading(true);
      setError('');
      try {
        const movieId = Number(params.movieId);
        if (!Number.isInteger(movieId) || movieId === 0) {
          throw new Error('Invalid movie selection.');
        }

        if (movieId < 0 || source === 'wikimedia') {
          if (!title) throw new Error('Movie title is missing.');
          const response = await fetch('/api/movie-lookup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: title }),
          });
          const result = await response.json() as { candidates?: TMDBMovieDetails[]; error?: string };
          if (!response.ok) throw new Error(result.error || `Movie lookup failed (${response.status})`);
          const candidate = result.candidates?.find(item => item.id === movieId) ?? result.candidates?.[0];
          if (!candidate) throw new Error(`No complete details found for ${title}.`);
          if (active) setMovie(candidate);
          return;
        }

        const response = await fetch(`/api/tmdb?action=movie&id=${movieId}`);
        const result = await response.json() as { data?: TMDBMovieDetails; message?: string };
        if (!response.ok || !result.data) {
          throw new Error(result.message || `Movie details could not be loaded (${response.status})`);
        }
        if (active) setMovie(result.data);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Movie details could not be loaded.');
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadMovieDetails();
    return () => {
      active = false;
    };
  }, [params.movieId, source, title]);

  if (loading) {
    return <p role="status" className="py-12 text-center text-muted-foreground">Loading complete movie details…</p>;
  }

  if (error || !movie) {
    return (
      <section className="mx-auto max-w-2xl space-y-4 py-8">
        <Link className="btn btn-outline" href="/movie-explorer">← Back to Movie Explorer</Link>
        <h1 className="text-2xl font-bold">Movie details unavailable</h1>
        <p role="alert" className="break-words text-muted-foreground">{error || 'No movie details were returned.'}</p>
      </section>
    );
  }

  const cast = movie.credits.cast.slice(0, 12);
  const directors = movie.credits.crew.filter(member => member.job === 'Director');

  return (
    <article className="mx-auto w-full max-w-5xl space-y-6">
      <Link className="btn btn-outline" href="/movie-explorer">← Back to Movie Explorer</Link>

      <section className="grid min-w-0 gap-6 rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-sm sm:p-6 md:grid-cols-[200px_minmax(0,1fr)]">
        <img
          src={movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : '/movie-poster-placeholder.svg'}
          alt={`${movie.title} poster`}
          className="mx-auto aspect-[2/3] max-h-[300px] w-full max-w-[200px] rounded-xl border border-border object-cover"
          onError={event => {
            event.currentTarget.src = '/movie-poster-placeholder.svg';
          }}
        />

        <div className="min-w-0 space-y-5">
          <header>
            <h1 className="break-words text-3xl font-bold">{movie.title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {movie.release_date ? movie.release_date.slice(0, 4) : 'Release year unavailable'}
              {movie.runtime ? ` · ${movie.runtime} min` : ''}
              {movie.vote_count > 0 ? ` · Rating ${movie.vote_average.toFixed(1)}/10 (${movie.vote_count} votes)` : ''}
            </p>
          </header>

          {!!movie.genres.length && (
            <div className="flex flex-wrap gap-2" aria-label="Genres">
              {movie.genres.map(genre => (
                <span key={genre.id} className="rounded-full bg-primary/10 px-3 py-1 text-sm text-primary">{genre.name}</span>
              ))}
            </div>
          )}

          {!!movie.overview && (
            <section className="space-y-2">
              <h2 className="text-lg font-semibold">Synopsis</h2>
              <p className="whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">{movie.overview}</p>
            </section>
          )}

          {!!cast.length && (
            <section className="space-y-2">
              <h2 className="text-lg font-semibold">Cast</h2>
              <ul className="flex flex-wrap gap-x-2 gap-y-1 text-sm text-muted-foreground">
                {cast.map(member => (
                  <li key={member.id}>{member.name}{member.character ? ` as ${member.character}` : ''}</li>
                ))}
              </ul>
            </section>
          )}

          {!!directors.length && (
            <section className="space-y-2">
              <h2 className="text-lg font-semibold">Director{directors.length === 1 ? '' : 's'}</h2>
              <p className="break-words text-sm text-muted-foreground">
                {directors.map(director => director.name).join(', ')}
              </p>
            </section>
          )}

          {!!movie.keywords.keywords.length && (
            <section className="space-y-2">
              <h2 className="text-lg font-semibold">Keywords</h2>
              <div className="flex flex-wrap gap-2">
                {movie.keywords.keywords.slice(0, 12).map(keyword => (
                  <span key={keyword.id} className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">{keyword.name}</span>
                ))}
              </div>
            </section>
          )}

          {!!movie.metadata_sources?.length && (
            <section className="space-y-2">
              <h2 className="text-lg font-semibold">Sources</h2>
              <div className="flex flex-wrap gap-3">
                {movie.metadata_sources.map(metadataSource => (
                  <a key={metadataSource.url} href={metadataSource.url} target="_blank" rel="noreferrer" className="break-all text-sm text-primary underline">
                    {metadataSource.name}
                  </a>
                ))}
              </div>
            </section>
          )}
        </div>
      </section>
    </article>
  );
}
