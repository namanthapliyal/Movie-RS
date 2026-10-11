'use client';

import { DBService } from '@/lib/storage';
import type { ScoredMovie } from '@/types/formula';
import RecommendationGrid from '@/components/recommendations/RecommendationGrid';
import PromptInput from '@/components/recommendations/PromptInput';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import { useState, useEffect } from 'react';
import { toast } from '@/components/ui/use-toast';
import { appLogger } from '@/lib/logger';

export default function RecommendationsPage() {
  const [recommendations, setRecommendations] = useState<ScoredMovie[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Fetch data on mount
  useEffect(() => {
    fetchRecommendations();
  }, []);

  async function fetchRecommendations(forceRefresh = false) {
    if (forceRefresh) setPage(1);
    setLoading(true);
    try {
      const hasRatedMovies = DBService.getWatchlist().some(movie => movie.rating !== null);
      const mode = hasRatedMovies ? 'personalized' : 'random';

      const response = await fetch(`/api/recommendations?page=${forceRefresh ? 1 : page}&limit=20&mode=${mode}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      const incomingMovies: ScoredMovie[] = data.data.movies || [];
      setRecommendations(prev => {
        const next = forceRefresh ? [] : [...prev];
        const existingIds = new Set(next.map(movie => movie.tmdb_id));
        return [
          ...next,
          ...incomingMovies.filter(movie => !existingIds.has(movie.tmdb_id)),
        ];
      });

      setHasMore(data.data.page < data.data.total_pages);
      setPage(data.data.page + 1);
    } catch (error) {
      appLogger.error('Unable to fetch movie recommendations.');
      toast({
        title: 'Error loading recommendations',
        description: 'Failed to load recommendations. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleSearchPrompt(prompt: string) {
    setLoading(true);
    try {
      // Search with prompt
      const response = await fetch('/api/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, page: 1, limit: 20 })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setRecommendations(data.data.movies || []);
      setPage(2);
      setHasMore(data.data.total_pages > 1);

      toast({
        title: 'Recommendations updated',
        description: `Based on your prompt: "${prompt}"`,
      });
    } catch (error) {
      appLogger.error('Recommendation prompt search failed.');
      toast({
        title: 'Search error',
        description: 'Failed to search with prompt. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }

  function handleLoadMore() {
    if (!hasMore || loading) return;
    fetchRecommendations();
  }

  function handleRefresh() {
    fetchRecommendations(true);
  }

  if (loading && recommendations.length === 0) {
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
                Generating your personalized recommendations...
              </h2>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const unwatchedInWatchlist = DBService.getWatchlist().filter(movie => !movie.watched).length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                  {DBService.getWatchlist().some(movie => movie.rating !== null)
                    ? 'Personalized Recommendations'
                    : 'Movies to Discover'}
            </h1>
            <div className="flex items-center gap-3">
              <button
                onClick={handleRefresh}
                className="btn btn-outline"
              >
                Refresh
              </button>
              <button
                onClick={() => { /* Go to watchlist */ }}
                className="btn btn-secondary"
              >
                Watchlist ({unwatchedInWatchlist})
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="card p-4">
              <h3 className="text-sm font-medium text-muted-foreground">Recommendations</h3>
              <p className="text-2xl font-bold text-primary">{recommendations.length}</p>
            </div>
            <div className="card p-4">
              <h3 className="text-sm font-medium text-muted-foreground">Unwatched</h3>
              <p className="text-2xl font-bold text-success">{unwatchedInWatchlist}</p>
            </div>
          </div>
        </div>

        {/* Prompt Input */}
        <div className="mb-6">
          <PromptInput
            onSearch={handleSearchPrompt}
            placeholder="Describe what kind of movie you're in the mood for..."
          />
        </div>

        {/* Recommendations Grid */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Movies For You
          </h2>

          {recommendations.length === 0 ? (
            <div className="empty-state py-12">
              <div className="flex items-center justify-center mb-6">
                <svg className="h-12 w-12 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path className="stroke-2" strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M5 18V6a2 2 0 012-2h10a2 2 0 012 2v12a2 2 0 01-2 2h-5l-5 5-5-5H5z"></path>
                </svg>
              </div>
              <p className="text-center text-muted-foreground">
                No movies are available right now. Try refreshing or describing what kind of movie you’d like to watch above.
              </p>
              <div className="mt-6 flex justify-center">
                <button
                  onClick={() => { /* Go to watchlist */ }}
                  className="btn btn-outline"
                >
                  Go to Watchlist
                </button>
              </div>
            </div>
          ) : (
            <RecommendationGrid
              movies={recommendations}
              onMovieSelect={() => { /* Handle movie selection */ }}
              loading={loading}
              hasMore={hasMore}
              onLoadMore={handleLoadMore}
            />
          )}
        </div>
      </div>
    </div>
  );
}