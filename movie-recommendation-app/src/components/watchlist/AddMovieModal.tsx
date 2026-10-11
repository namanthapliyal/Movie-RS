'use client';

import { useEffect, useState } from 'react';
import type { TMDBMovie, TMDBMovieDetails } from '@/types/db';
import { appLogger } from '@/lib/logger';
import { rankMovieTitleMatches } from '@/lib/movie-title-match';

interface AddMovieModalProps {
  show: boolean;
  onClose: () => void;
  onAdd: (movie: TMDBMovieDetails, query: string, lookupNeeded: boolean) => void | Promise<void>;
}

interface MovieSearchResponse {
  data: {
    results: TMDBMovie[];
  };
}

function provisionalId(title: string): number {
  let hash = 0;
  for (const character of title.normalize('NFKC').trim().toLocaleLowerCase()) {
    hash = Math.imul(hash, 31) + character.charCodeAt(0) | 0;
  }
  return -(Math.abs(hash) || 1);
}

function makeMovieDetails(movie: TMDBMovie): TMDBMovieDetails {
  return {
    ...movie,
    genres: movie.genres ?? [],
    credits: { cast: [], crew: [] },
    keywords: { keywords: [] },
    videos: { results: [] },
  };
}

export default function AddMovieModal({
  show,
  onClose,
  onAdd
}: AddMovieModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TMDBMovie[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [addError, setAddError] = useState('');
  const [selectedMovie, setSelectedMovie] = useState<TMDBMovie | null>(null);

  useEffect(() => {
    const query = searchQuery.trim();
    if (!show || query.length < 2) {
      setSearchResults([]);
      setLoading(false);
      setSearchError('');
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      setSearchError('');
      try {
        const response = await fetch(
          `/api/tmdb?action=search&q=${encodeURIComponent(query)}`,
          { signal: controller.signal }
        );
        if (!response.ok) {
          throw new Error(`Search failed (${response.status})`);
        }
        const result = await response.json() as MovieSearchResponse;
        setSearchResults(rankMovieTitleMatches(query, result.data.results).map(match => match.candidate));
      } catch (error) {
        if (!controller.signal.aborted) {
          appLogger.error('Movie suggestion search failed.');
          setSearchResults([]);
          setSearchError('Could not search for movies. Please try again.');
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 300);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [searchQuery, show]);

  const handleMovieSelect = (movie: TMDBMovie) => {
    setSelectedMovie(movie);
    setAddError('');
  };

  const handleAddMovie = async () => {
    const query = searchQuery.trim();
    if (!query) return;

    setAdding(true);
    setAddError('');
    try {
      const exactMatch = searchResults.find(movie =>
        movie.title.trim().toLocaleLowerCase() === query.toLocaleLowerCase()
      );
      const movieToAdd = selectedMovie ?? exactMatch;
      const movieDetails = movieToAdd
        ? makeMovieDetails(movieToAdd)
        : makeMovieDetails({
          id: provisionalId(query),
          title: query,
          original_title: query,
          overview: '',
          poster_path: null,
          backdrop_path: null,
          release_date: '',
          vote_average: 0,
          vote_count: 0,
          genre_ids: [],
          genres: [],
          runtime: null,
          adult: false,
          original_language: '',
          popularity: 0,
          lookup_status: 'pending',
        });
      await onAdd(movieDetails, query, !movieToAdd);
      onClose();
      setSelectedMovie(null);
      setSearchResults([]);
      setSearchQuery('');
    } catch (error) {
      appLogger.error('Could not add a movie to the watchlist.');
      setAddError('Could not add this movie. Please try again.');
    } finally {
      setAdding(false);
    }
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden">
        <div className="flex max-h-full flex-col overflow-hidden rounded-xl bg-card text-card-foreground shadow-xl">
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-6 py-4">
            <h2 className="text-xl font-bold">Add Movie to Watchlist</h2>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={handleAddMovie}
                disabled={!searchQuery.trim() || adding}
                className="btn btn-primary"
              >
                {adding ? 'Adding...' : 'Add to Watchlist'}
              </button>
              <button
                onClick={onClose}
                className="btn btn-ghost text-destructive/60 hover:text-destructive"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="min-h-0 flex-1 overflow-y-auto p-6">
            <div className="space-y-4">
            {/* Search Form */}
            <form onSubmit={(event) => event.preventDefault()} className="flex gap-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSelectedMovie(null);
                  setAddError('');
                }}
                placeholder="Search for a movie..."
                className="input flex-1"
                role="combobox"
                aria-label="Search for a movie"
                aria-autocomplete="list"
                aria-expanded={searchResults.length > 0}
                aria-controls="movie-search-suggestions"
                autoFocus
              />
            </form>

            {/* Search Results */}
            {loading ? (
              <div className="text-center py-8">
                <div className="flex items-center justify-center mb-3">
                  <div className="h-4 w-4 rounded border border-primary/50 animate-spin" />
                </div>
                <p className="text-muted-foreground">Searching TMDB...</p>
              </div>
            ) : searchError ? (
              <p className="text-center py-4 text-destructive" role="alert">{searchError}</p>
            ) : searchResults.length > 0 ? (
              <div className="space-y-3">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                  Suggestions
                </h3>
                <div id="movie-search-suggestions" className="space-y-2" role="listbox">
                  {searchResults.map(movie => (
                    <button
                      key={movie.id}
                      type="button"
                      role="option"
                      aria-selected={selectedMovie?.id === movie.id}
                      onClick={() => handleMovieSelect(movie)}
                      className={`w-full text-left cursor-pointer p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors ${
                        selectedMovie?.id === movie.id ? 'bg-primary/10 border-primary' : ''
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <img
                          src={movie.poster_path ? `https://image.tmdb.org/t/p/w92${movie.poster_path}` : '/movie-poster-placeholder.svg'}
                          alt={movie.title}
                          className="w-20 h-28 object-cover rounded-lg flex-shrink-0"
                          onError={(e) => {
                            e.currentTarget.src = '/movie-poster-placeholder.svg';
                          }}
                        />
                        <div className="flex-1 space-y-2">
                          <div className="flex justify-between items-start">
                            <h4 className="font-semibold">{movie.title}</h4>
                            <span className="text-xs text-muted-foreground">
                              {movie.release_date ? new Date(movie.release_date).getFullYear() : '????'}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {movie.overview}
                          </p>
                          <div className="flex items-center gap-2 mt-2 text-xs">
                            {movie.genres?.map((g: any, index: number) => (
                              <span key={index} className="px-2 py-0.5 rounded bg-muted/50">
                                {g.name}
                              </span>
                            )) || []}
                            <span className="ml-2">
                              ⭐ {movie.vote_average.toFixed(1)} ({movie.vote_count} votes)
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : searchQuery.trim().length >= 2 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  No TMDB suggestions for "{searchQuery}". You can still add this text and look it up.
                </p>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  Search for a movie above to add it to your watchlist
                </p>
              </div>
            )}

              {/* Selected Movie Preview */}
              {selectedMovie && (
                <div className="border-t border-border pt-6">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-3">
                    Selected Movie
                  </h3>
                  <div className="flex items-start gap-4">
                    <img
                      src={selectedMovie.poster_path ? `https://image.tmdb.org/t/p/w185${selectedMovie.poster_path}` : '/movie-poster-placeholder.svg'}
                      alt={selectedMovie.title}
                      className="w-24 h-36 object-cover rounded-lg flex-shrink-0"
                      onError={(e) => {
                        e.currentTarget.src = '/movie-poster-placeholder.svg';
                      }}
                    />
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <h4 className="font-semibold">{selectedMovie.title}</h4>
                        <span className="text-xs text-muted-foreground">
                          {selectedMovie.release_date ? new Date(selectedMovie.release_date).getFullYear() : '????'}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-3">
                        {selectedMovie.overview}
                      </p>
                      <div className="flex items-center gap-2 mt-2 text-xs">
                        {selectedMovie.genres?.map((g: any, index: number) => (
                          <span key={index} className="px-2 py-0.5 rounded bg-muted/50">
                            {g.name}
                          </span>
                        )) || []}
                        <span className="ml-2">
                          ⭐ {selectedMovie.vote_average.toFixed(1)} ({selectedMovie.vote_count} votes)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {addError && (
                <p className="text-sm text-destructive" role="alert">{addError}</p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex shrink-0 justify-end gap-3 border-t border-border px-6 py-4">
            <button
              onClick={onClose}
              className="btn btn-outline"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}