'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import type { TMDBMovie, TMDBSearchResponse } from '@/types/db';

export default function MovieExplorerPage() {
  const [query, setQuery] = useState('');
  const [movies, setMovies] = useState<TMDBMovie[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingPopular, setLoadingPopular] = useState(true);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadPopularMovies() {
      try {
        const response = await fetch('/api/tmdb?action=popular');
        const result = await response.json() as { data?: TMDBMovie[]; message?: string };
        if (!response.ok || !result.data) {
          throw new Error(result.message || `Movie catalogue unavailable (${response.status})`);
        }
        if (active) setMovies(result.data);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Movie catalogue unavailable.');
      } finally {
        if (active) setLoadingPopular(false);
      }
    }
    void loadPopularMovies();
    return () => {
      active = false;
    };
  }, []);

  async function searchMovies(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = query.trim();
    if (!value) return;

    setLoading(true);
    setHasSearched(false);
    setError('');
    setMovies([]);
    try {
      const response = await fetch(`/api/tmdb?action=search&q=${encodeURIComponent(value)}`);
      const result = await response.json() as { data?: TMDBSearchResponse; message?: string };
      let matches: TMDBMovie[] = response.ok && result.data ? result.data.results : [];
      if (!matches.length) {
        const fallbackResponse = await fetch('/api/movie-lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: value }),
        });
        const fallback = await fallbackResponse.json() as {
          candidates?: TMDBMovie[];
          error?: string;
        };
        if (!fallbackResponse.ok) {
          throw new Error(fallback.error || `Movie search failed (${fallbackResponse.status})`);
        }
        matches = fallback.candidates ?? [];
      }
      setMovies(matches);
      setHasSearched(true);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : 'Movie search failed.');
      setHasSearched(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-6" aria-labelledby="movie-explorer-title">
      <header className="rounded-2xl bg-gradient-to-br from-indigo-950 via-indigo-900 to-slate-900 px-6 py-8 text-white shadow-sm sm:px-8">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-200">Discover</p>
        <h1 id="movie-explorer-title" className="mt-2 text-3xl font-bold sm:text-4xl">Movie Explorer</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-indigo-100 sm:text-base">
          Search the movie catalogue and explore titles, release years, ratings, and summaries.
        </p>
      </header>

      <form onSubmit={searchMovies} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm sm:flex-row">
        <label htmlFor="movie-explorer-search" className="sr-only">Search movies by title</label>
        <input
          id="movie-explorer-search"
          className="input min-w-0 flex-1"
          aria-label="Search movies"
          placeholder="Try a title, such as Ex Machina"
          value={query}
          onChange={event => {
            setQuery(event.target.value);
            setError('');
            setHasSearched(false);
          }}
        />
        <button className="btn btn-primary sm:min-w-28" type="submit" disabled={loading || !query.trim()}>
          {loading ? 'Searching…' : 'Search'}
        </button>
      </form>

      {loadingPopular && !query && (
        <p role="status" className="text-sm text-muted-foreground">Loading popular movies…</p>
      )}
      {loading && <p role="status" className="text-sm text-muted-foreground">Searching TMDB and checking movie sources if needed…</p>}
      {!loading && !query && <h2 className="text-xl font-semibold">Popular movies</h2>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {!loading && !error && hasSearched && movies.length === 0 && (
        <p role="status" className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-muted-foreground">
          No movies found for “{query.trim()}”. Try another title.
        </p>
      )}
      {!loading && !error && !hasSearched && !loadingPopular && movies.length === 0 && (
        <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-muted-foreground">
          The movie catalogue is empty. Search by title to try another movie source.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {movies.map(movie => (
          <Link
            key={movie.id}
            href={`/movie-explorer/${movie.id}?title=${encodeURIComponent(movie.title)}&source=${movie.metadata_source ?? 'tmdb'}`}
            aria-label={`View complete details for ${movie.title}`}
            className="card group block min-w-0 overflow-hidden transition-shadow hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <div className="flex h-full min-w-0 gap-4 p-4">
              <img
                src={movie.poster_path ? `https://image.tmdb.org/t/p/w185${movie.poster_path}` : '/movie-poster-placeholder.svg'}
                alt=""
                className="aspect-[2/3] w-20 shrink-0 rounded-md object-cover"
                loading="lazy"
                onError={event => {
                  event.currentTarget.src = '/movie-poster-placeholder.svg';
                }}
              />
              <div className="min-w-0">
                <h2 className="break-words font-semibold group-hover:text-primary">{movie.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {movie.release_date ? movie.release_date.slice(0, 4) : 'Release year unavailable'}
                </p>
                {movie.vote_count > 0 && (
                  <p className="mt-2 text-sm">Rating: {movie.vote_average.toFixed(1)} ({movie.vote_count} votes)</p>
                )}
                {movie.overview && (
                  <p className="mt-3 break-words text-sm text-muted-foreground line-clamp-4">{movie.overview}</p>
                )}
                <span className="mt-3 inline-block text-sm font-medium text-primary">View complete details →</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
