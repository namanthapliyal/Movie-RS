'use client';

import { useState } from 'react';
import type { ScoredMovie } from '@/types/formula';

interface RecommendationGridProps {
  movies: ScoredMovie[];
  onMovieSelect?: (movie: ScoredMovie) => void;
  loading?: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
}

export default function RecommendationGrid({
  movies,
  onMovieSelect,
  loading = false,
  hasMore,
  onLoadMore
}: RecommendationGridProps) {
  const [hoveredMovie, setHoveredMovie] = useState<number | null>(null);

  return (
    <div className="space-y-6">
      {loading && movies.length === 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="aspect-[2/3] bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      ) : movies.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            No recommendations match your criteria. Try adjusting your search or adding more movies to your watchlist.
          </p>
        </div>
      ) : (
        <div className="recommendation-grid gap-6">
          {movies.map(movie => (
            <div
              key={movie.tmdb_id}
              onMouseEnter={() => setHoveredMovie(movie.tmdb_id)}
              onMouseLeave={() => setHoveredMovie(null)}
              onClick={() => onMovieSelect?.(movie)}
              className={`cursor-pointer group relative overflow-hidden rounded-xl border border-border bg-card transition-all duration-300 hover:shadow-xl ${
                hoveredMovie === movie.tmdb_id ? 'scale-[1.02]' : ''
              }`}
            >
              {/* Movie Poster */}
              <div className="relative aspect-[2/3]">
                <img
                  src={movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : '/movie-poster-placeholder.svg'}
                  alt={movie.title}
                  className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-105"
                  onError={(e) => {
                    e.currentTarget.src = '/movie-poster-placeholder.svg';
                  }}
                />

                {/* Score Badge */}
                <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/90 backdrop-blur-sm text-xs font-medium text-primary border border-primary/20">
                  <span className="text-xs">⭐</span>
                  <span className="font-medium">{Math.round(movie.score)}</span>
                </div>

              </div>

              {/* Movie Info */}
              <div className="p-4 space-y-3">
                <h3 className="font-semibold text-card-foreground line-clamp-2">
                  {movie.title}
                </h3>

                <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
                  {movie.release_date ? (
                    <span>
                      {new Date(movie.release_date).getFullYear()} •
                    </span>
                  ) : ''}
                  {movie.genres.slice(0, 2).map((genre, index) => (
                    <span key={index} className="px-2 py-0.5 rounded bg-muted/50 text-xs">
                      {genre}
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
                  {movie.runtime ? (
                    <span>
                      {movie.runtime}min •
                    </span>
                  ) : ''}
                  {movie.vote_average ? (
                    <span className="flex items-center gap-1">
                      <span className="text-xs">⭐</span>
                      <span>{movie.vote_average.toFixed(1)}</span>
                    </span>
                  ) : ''}
                  {movie.vote_count ? (
                    <span className="ml-2 text-xs">
                      ({movie.vote_count} votes)
                    </span>
                  ) : ''}
                </div>

                {/* Match Explanation */}
                {movie.matched_features && movie.matched_features.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    <span className="text-xs font-medium text-muted-foreground">Matches:</span>
                    {movie.matched_features.map((feature, index) => (
                      <span key={index} className="px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-medium">
                        {feature}
                      </span>
                    ))}
                  </div>
                )}

                {/* Overview */}
                <p className="text-sm text-muted-foreground line-clamp-3 mb-2">
                  {movie.overview}
                </p>

                {/* Action Buttons */}
                <div className="flex justify-end gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // In a full implementation, this would add to watchlist
                      alert('Add to watchlist functionality would be implemented here');
                    }}
                    className="btn btn-outline btn-sm"
                  >
                    + Watchlist
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // In a full implementation, this would show details
                      alert('Movie details would be shown in a modal');
                    }}
                    className="btn btn-ghost btn-sm text-muted-foreground hover:text-gray-600"
                  >
                    Details
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Load More Button */}
          {hasMore && !loading && (
            <div className="col-span-full text-center py-4">
              <button
                onClick={onLoadMore}
                className="btn btn-primary"
              >
                Load More Recommendations
              </button>
            </div>
          )}

          {/* Loading More Indicator */}
          {loading && hasMore && (
            <div className="col-span-full text-center py-4">
              <div className="flex items-center justify-center gap-3">
                <div className="h-4 w-4 rounded border border-primary/50 animate-spin" />
                <span className="text-sm text-muted-foreground">Loading more recommendations...</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}