import { NextRequest, NextResponse } from 'next/server';
import { DBService } from '../../../lib/storage';
import type { WatchlistEntry, LikedElement } from '../../../types/db';

/**
 * Watchlist API Routes
 * GET /api/watchlist - Get user's watchlist
 * POST /api/watchlist - Add movie to watchlist
 * PUT /api/watchlist/[id] - Update review/rating/watched status
 * DELETE /api/watchlist/[id] - Remove movie from watchlist
 */

export async function GET(request: NextRequest) {
  try {
    const watchlist = DBService.getWatchlist();
    return NextResponse.json({
      data: watchlist,
      message: 'Watchlist retrieved successfully'
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to retrieve watchlist', message: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tmdb_id, title, overview, poster_path, backdrop_path, release_date, vote_average, vote_count, genres, runtime, keywords } = body;

    if (!tmdb_id || !title) {
      return NextResponse.json(
        { error: 'Missing required fields', message: 'tmdb_id and title are required' },
        { status: 400 }
      );
    }

    const entry = DBService.addMovieToWatchlist({
      id: tmdb_id,
      title,
      overview,
      poster_path,
      backdrop_path,
      release_date,
      vote_average,
      vote_count,
      genre_ids: genres?.map((g: string) => 18) || [],
      genres: genres?.map((g: string) => ({ id: 18, name: g })) || [],
      runtime,
      keywords: { keywords: keywords?.map((k: string) => ({ id: 0, name: k })) || [] },
      credits: { cast: [], crew: [] },
      videos: { results: [] },
      adult: false,
      original_language: 'en',
      popularity: 0
    } as any);

    return NextResponse.json({
      data: entry,
      message: 'Movie added to watchlist successfully'
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to add movie to watchlist', message: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { tmdb_id, rating, review, liked_elements, watched } = body;

    if (!tmdb_id) {
      return NextResponse.json(
        { error: 'Missing required field', message: 'tmdb_id is required' },
        { status: 400 }
      );
    }

    if (rating !== undefined && (rating < 1 || rating > 10)) {
      return NextResponse.json(
        { error: 'Invalid rating', message: 'Rating must be between 1 and 10' },
        { status: 400 }
      );
    }

    DBService.updateReview(tmdb_id, rating, review, liked_elements as LikedElement[]);

    return NextResponse.json({
      data: { tmdb_id, rating, review, liked_elements, watched },
      message: 'Watchlist entry updated successfully'
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update watchlist entry', message: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const tmdb_id = parseInt(url.searchParams.get('tmdb_id') || '0');

    if (!tmdb_id) {
      return NextResponse.json(
        { error: 'Missing required field', message: 'tmdb_id is required' },
        { status: 400 }
      );
    }

    const success = DBService.removeMovieFromWatchlist(tmdb_id);

    if (!success) {
      return NextResponse.json(
        { error: 'Movie not found', message: 'Movie not found in watchlist' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: { tmdb_id },
      message: 'Movie removed from watchlist successfully'
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to remove movie from watchlist', message: (error as Error).message },
      { status: 500 }
    );
  }
}