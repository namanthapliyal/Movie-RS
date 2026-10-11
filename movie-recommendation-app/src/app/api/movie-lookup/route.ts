import { NextRequest, NextResponse } from 'next/server';
import { searchWikimediaMovies } from '@/lib/wikimedia';
import { tmdbClient } from '@/lib/tmdb';
import { isConfidentMovieTitleMatch, rankMovieTitleMatches } from '@/lib/movie-title-match';

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object' || !('query' in body) || typeof body.query !== 'string') {
      return NextResponse.json({ error: 'A movie title is required.' }, { status: 400 });
    }

    const query = body.query.trim();
    if (query.length < 1 || query.length > 120) {
      return NextResponse.json({ error: 'Movie title must be between 1 and 120 characters.' }, { status: 400 });
    }

    if (tmdbClient.isConfigured()) {
      try {
        const search = await tmdbClient.searchMovies(query);
        const bestMatch = rankMovieTitleMatches(query, search.results)[0];
        if (bestMatch && isConfidentMovieTitleMatch(query, bestMatch.candidate.title, bestMatch.score)) {
          const details = await tmdbClient.getMovieDetails(bestMatch.candidate.id);
          return NextResponse.json({
            source: 'tmdb',
            candidates: [{ ...details, metadata_source: 'tmdb' as const }],
          });
        }
      } catch (error) {
        console.error('TMDB lookup unavailable; trying Wikimedia:', error);
      }
    }

    const candidates = await searchWikimediaMovies(query);
    return NextResponse.json({ source: 'wikimedia', candidates });
  } catch (error) {
    console.error('Movie fallback lookup failed:', error);
    return NextResponse.json(
      { error: 'The movie lookup service is temporarily unavailable.' },
      { status: 502 }
    );
  }
}
