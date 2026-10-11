import { NextRequest, NextResponse } from 'next/server';
import { tmdbClient } from '../../../lib/tmdb';

/**
 * TMDB API Routes (proxy to avoid exposing API key on client)
 * GET /api/tmdb/search?query=...&page=... - Search movies
 * GET /api/tmdb/movie/[id] - Get movie details by TMDB ID
 * GET /api/tmdb/popular?page=... - Get popular movies
 * GET /api/tmdb/trending?page=... - Get trending movies
 * GET /api/tmdb/discover?with_genres=...&page=... - Discover movies
 * GET /api/tmdb/genres - Get genre list
 */

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const searchParams = url.searchParams;
    const query = searchParams.get('q') || searchParams.get('query');
    const action = searchParams.get('action') || 'search';

    switch (action) {
      case 'search':
        if (!query) {
          return NextResponse.json(
            { error: 'Query required', message: 'Search query parameter "q" or "query" is required' },
            { status: 400 }
          );
        }
        const page = parseInt(searchParams.get('page') || '1');
        const searchResponse = await tmdbClient.searchMovies(query, page);
        return NextResponse.json({
          source: 'tmdb',
          data: searchResponse,
          message: `Found ${searchResponse.total_results} movies for "${query}"`,
        });

      case 'movie':
        const movieId = parseInt(searchParams.get('id') || '0');
        if (!movieId) {
          return NextResponse.json(
            { error: 'Movie ID required', message: 'Movie ID parameter "id" is required' },
            { status: 400 }
          );
        }
        const movie = await tmdbClient.getMovieDetails(movieId);
        return NextResponse.json({
          data: movie,
          message: 'Movie details retrieved successfully'
        });

      case 'popular':
        const popularPage = parseInt(searchParams.get('page') || '1');
        const popularMovies = await tmdbClient.getPopularMovies(popularPage);
        return NextResponse.json({
          data: popularMovies,
          page: popularPage,
          message: 'Popular movies retrieved successfully'
        });

      case 'trending':
        const trendingPage = parseInt(searchParams.get('page') || '1');
        const trendingMovies = await tmdbClient.getTrendingMovies(trendingPage);
        return NextResponse.json({
          data: trendingMovies,
          page: trendingPage,
          message: 'Trending movies retrieved successfully'
        });

      case 'discover':
        const discoverParams: Record<string, string | number> = {};
        searchParams.forEach((value, key) => {
          if (key !== 'action' && key !== 'page') {
            discoverParams[key] = value;
          }
        });
        const discoverPage = parseInt(searchParams.get('page') || '1');
        const discoveredMovies = await tmdbClient.getDiscoverMovies(discoverParams, discoverPage);
        return NextResponse.json({
          data: discoveredMovies,
          page: discoverPage,
          message: 'Discovered movies retrieved successfully'
        });

      case 'genres':
        const genres = tmdbClient.getGenres();
        return NextResponse.json({
          data: genres,
          message: 'Genres retrieved successfully'
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action', message: 'Valid actions: search, movie, popular, trending, discover, genres' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('TMDB API error:', error);
    return NextResponse.json(
      { error: 'TMDB API error', message: (error as Error).message },
      { status: 500 }
    );
  }
}
