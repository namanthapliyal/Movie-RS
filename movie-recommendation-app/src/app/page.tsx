'use client';

import { DBService } from '@/lib/storage';
import type { TMDBMovieDetails, WatchlistEntry } from '@/types/db';
import { enrichMovieLocally } from '@/lib/local-movie-enrichment';
import MovieCard from '@/components/watchlist/MovieCard';
import AddMovieModal from '@/components/watchlist/AddMovieModal';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import { useState, useEffect } from 'react';
import { toast } from '@/components/ui/use-toast';
import { appLogger } from '@/lib/logger';
import { isConfidentMovieTitleMatch, rankMovieTitleMatches } from '@/lib/movie-title-match';

export default function Dashboard() {
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [lookupFailure, setLookupFailure] = useState<{ entryId: string; message: string } | null>(null);

  // Fetch data on mount
  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const watchlistData = DBService.getWatchlist();
      setWatchlist(watchlistData);
    } catch (error) {
      appLogger.error('Unable to load local watchlist data.');
    } finally {
      setLoading(false);
    }
  }

  function handleMovieUpdate(updatedMovie: WatchlistEntry) {
    setWatchlist(prev => prev.map(movie =>
      movie.id === updatedMovie.id ? updatedMovie : movie
    ));
    toast({
      title: 'Movie updated',
      description: 'Your movie details have been saved',
    });
  }

  function updateWatchlistEntry(updatedMovie: WatchlistEntry) {
    setWatchlist(prev => prev.map(movie =>
      movie.id === updatedMovie.id ? updatedMovie : movie
    ));
  }

  function updateLookupProgress(
    entryId: string,
    status: NonNullable<WatchlistEntry['lookup_status']>,
    message: string
  ) {
    const updatedMovie = DBService.updateMovieLookupProgress(entryId, status, message);
    if (updatedMovie) updateWatchlistEntry(updatedMovie);
    appLogger.info(`Movie lookup: ${message}`);
  }

  function handleAddMovie(movie: TMDBMovieDetails, query: string, lookupNeeded: boolean) {
    const duplicate = DBService.getWatchlist().find(entry =>
      entry.tmdb_id === movie.id ||
      (movie.id < 0 && entry.title.trim().toLocaleLowerCase() === movie.title.trim().toLocaleLowerCase())
    );
    if (duplicate) {
      setShowAddModal(false);
      toast({ title: 'Already in watchlist', description: `${duplicate.title} is already on your list.` });
      return;
    }

    const addedMovie = DBService.addMovieToWatchlist({
      ...movie,
      lookup_status: 'searching',
      lookup_message: lookupNeeded
        ? 'Searching TMDB; checking Wikipedia/Wikidata if no confident match is found…'
        : 'Loading movie details from TMDB…',
    });
    setWatchlist(prev => [
      addedMovie,
      ...prev.filter(entry => entry.tmdb_id !== addedMovie.tmdb_id)
    ]);
    setShowAddModal(false);
    toast({
      title: 'Movie tile added',
      description: `${movie.title} is saved locally while its details are looked up.`,
    });

    if (lookupNeeded) {
      void lookupMovieMetadata(addedMovie, query);
    } else {
      void loadTMDBDetails(addedMovie, query);
    }
  }

  function chooseMatchingCandidate(query: string, candidates: TMDBMovieDetails[]): TMDBMovieDetails | null {
    const bestMatch = rankMovieTitleMatches(query, candidates)[0];
    if (!bestMatch) return null;

    return isConfidentMovieTitleMatch(query, bestMatch.candidate.title, bestMatch.score)
      ? bestMatch.candidate
      : null;
  }

  async function lookupMovieMetadata(entry: WatchlistEntry, query: string) {
    try {
      updateLookupProgress(entry.id, 'searching', 'Searching TMDB and Wikipedia/Wikidata…');
      const response = await fetch('/api/movie-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      const result = await response.json() as { candidates?: TMDBMovieDetails[]; error?: string };
      if (!response.ok) throw new Error(result.error || `Lookup failed (${response.status})`);
      const candidate = chooseMatchingCandidate(query, result.candidates ?? []);
      if (!candidate) throw new Error('not-found');

      updateLookupProgress(entry.id, 'downloading', 'Waiting for the local AI model…');
      const enrichedMovie = await enrichMovieLocally(candidate, () => {
        updateLookupProgress(
          entry.id,
          'downloading',
          'Waiting for the local AI model…'
        );
      }, () => {
        updateLookupProgress(entry.id, 'processing', 'Enriching movie details locally…');
      });
      const updatedMovie = DBService.updateMovieMetadata(entry.id, enrichedMovie);
      if (updatedMovie) {
        updateWatchlistEntry(updatedMovie);
        toast({ title: 'Movie details found', description: `${updatedMovie.title} was enriched from local sources.` });
      }
    } catch (error) {
      const notFound = error instanceof Error && error.message === 'not-found';
      if (!notFound) appLogger.error('Fallback movie lookup failed.');
      const message = notFound
        ? `“${query}” was not found in the movie database. Click OK to remove its temporary tile.`
        : `Movie details for “${query}” could not be verified. Click OK to remove its temporary tile.`;
      setLookupFailure({ entryId: entry.id, message });
    }
  }

  async function loadTMDBDetails(entry: WatchlistEntry, query: string) {
    try {
      updateLookupProgress(entry.id, 'searching', 'Loading movie details from TMDB…');
      const response = await fetch(`/api/tmdb?action=movie&id=${entry.tmdb_id}`);
      if (!response.ok) throw new Error(`TMDB details unavailable (${response.status})`);
      const result = await response.json() as { data: TMDBMovieDetails };
      const updatedMovie = DBService.updateMovieMetadata(entry.id, { ...result.data, metadata_source: 'tmdb' });
      if (updatedMovie) updateWatchlistEntry(updatedMovie);
    } catch (error) {
      appLogger.warn('TMDB details unavailable; trying fallback lookup.');
      await lookupMovieMetadata(entry, query);
    }
  }

  function acknowledgeLookupFailure() {
    if (lookupFailure) {
      DBService.removeWatchlistEntry(lookupFailure.entryId);
      setWatchlist(prev => prev.filter(movie => movie.id !== lookupFailure.entryId));
      setLookupFailure(null);
    }
  }

  function handleRemoveMovie(tmdbId: number) {
    DBService.removeMovieFromWatchlist(tmdbId);
    setWatchlist(prev => prev.filter(movie => movie.tmdb_id !== tmdbId));
    toast({
      title: 'Movie removed',
      description: 'Movie has been removed from your watchlist',
    });
    fetchData(); // Refresh to get formula updates
  }

  function handleMarkAsWatched(tmdbId: number) {
    const watched = DBService.toggleWatched(tmdbId);
    if (watched === null) return;
    setWatchlist(prev => prev.map(movie => movie.tmdb_id === tmdbId
      ? { ...movie, watched, watched_at: watched ? new Date() : null }
      : movie
    ));
    toast({
      title: watched ? 'Marked as watched' : 'Moved back to watchlist',
      description: watched ? 'Movie marked as watched' : 'Movie marked as unwatched',
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="flex h-full items-center justify-center">
          <div className="space-y-6">
            <div className="flex space-x-3">
              <div className="h-8 w-8 rounded-lg bg-primary/20 text-primary flex items-center justify-center">
                <svg className="h-5 w-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Loading your personalized recommendations...
              </h2>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const unwatchedMovies = watchlist.filter(movie => !movie.watched);
  const watchedMovies = watchlist.filter(movie => movie.watched);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Your Movie Watchlist
            </h1>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowAddModal(true)}
                className="btn btn-primary"
              >
                Add Movie
              </button>
              <button
                onClick={() => { /* Open recommendations */ }}
                className="btn btn-secondary"
              >
                Get Recommendations
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="card p-4">
              <h3 className="text-sm font-medium text-muted-foreground">Total Movies</h3>
              <p className="text-2xl font-bold text-primary">{watchlist.length}</p>
            </div>
            <div className="card p-4">
              <h3 className="text-sm font-medium text-muted-foreground">Watched</h3>
              <p className="text-2xl font-bold text-success">{watchedMovies.length}</p>
            </div>
          </div>
        </div>

        {/* Movie Lists */}
        <div className="grid gap-6">
          {/* Unwatched Movies */}
          <div className="col-span-1">
            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                To Watch ({unwatchedMovies.length})
              </h2>

              {unwatchedMovies.length === 0 ? (
                <div className="empty-state py-8">
                  <div className="flex items-center justify-center mb-4">
                    <svg className="h-10 w-10 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path className="stroke-2" strokeLinecap="round" strokeLinejoin="round" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12 12c-4.416 0-8 3.584-8 8s3.584 8 8 8 8-3.584 8-8-3.584-8-8-8z"></path>
                    </svg>
                  </div>
                  <p className="text-center text-muted-foreground">
                    No movies to watch yet. Add some movies to get started!
                  </p>
                </div>
              ) : (
                <div className="movie-grid">
                  {unwatchedMovies.slice(0, 8).map(movie => (
                    <MovieCard
                      key={movie.id}
                      movie={movie}
                      onUpdate={handleMovieUpdate}
                      onRemove={handleRemoveMovie}
                      onWatch={handleMarkAsWatched}
                    />
                  ))}
                  {unwatchedMovies.length > 8 && (
                    <div className="col-span-full text-center py-4">
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => { /* Show all unwatched */ }}
                      >
                        Show all {unwatchedMovies.length} movies
                      </button>
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>

          {/* Watched Movies */}
          <div className="col-span-1">
            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Watched ({watchedMovies.length})
              </h2>

              {watchedMovies.length === 0 ? (
                <div className="empty-state py-8">
                  <div className="flex items-center justify-center mb-4">
                    <svg className="h-10 w-10 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path className="stroke-2" strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M5 18V6a2 2 0 012-2h10a2 2 0 012 2v12a2 2 0 01-2 2h-5l-5 5-5-5H5z"></path>
                    </svg>
                  </div>
                  <p className="text-center text-muted-foreground">
                    You haven't watched any movies yet. Mark some as watched to build your taste profile!
                  </p>
                </div>
              ) : (
                <div className="movie-grid">
                  {watchedMovies.slice(0, 8).map(movie => (
                    <MovieCard
                      key={movie.id}
                      movie={movie}
                      onUpdate={handleMovieUpdate}
                      onRemove={handleRemoveMovie}
                      onWatch={handleMarkAsWatched}
                    />
                  ))}
                  {watchedMovies.length > 8 && (
                    <div className="col-span-full text-center py-4">
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => { /* Show all watched */ }}
                      >
                        Show all {watchedMovies.length} movies
                      </button>
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>

      {lookupFailure && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" role="alertdialog" aria-modal="true" aria-labelledby="lookup-failure-title">
          <div className="w-full max-w-md rounded-xl bg-card p-6 text-card-foreground shadow-xl">
            <h2 id="lookup-failure-title" className="mb-3 text-lg font-semibold">Movie lookup failed</h2>
            <p className="mb-5 text-sm text-muted-foreground">{lookupFailure.message}</p>
            <div className="flex justify-end">
              <button className="btn btn-primary" onClick={acknowledgeLookupFailure} autoFocus>
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Movie Modal */}
      <AddMovieModal
        show={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddMovie}
      />
    </div>
  );
}