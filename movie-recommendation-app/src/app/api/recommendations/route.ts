import { NextRequest, NextResponse } from 'next/server';
import { DBService } from '../../../lib/storage';
import { tmdbClient } from '../../../lib/tmdb';
import type { ScoredMovie } from '../../../types/formula';

/**
 * Recommendations API Routes
 * GET /api/recommendations - Get personalized movie recommendations
 * POST /api/recommendations/search - Search with natural language prompt
 * GET /api/recommendations/trending - Get trending movies adjusted by formula
 */

/**
 * Get personalized movie recommendations
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50);
    const excludeWatched = url.searchParams.get('exclude') !== 'false';
    const minScore = url.searchParams.get('min_score') || '30';

    if (url.searchParams.get('mode') === 'random') {
      const [trendingMovies, popularMovies] = await Promise.all([
        tmdbClient.getTrendingMovies(1),
        tmdbClient.getPopularMovies(1),
      ]);
      const candidates = dedupeMovies([...trendingMovies, ...popularMovies]);
      for (let index = candidates.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [candidates[index], candidates[swapIndex]] = [candidates[swapIndex], candidates[index]];
      }
      const formula = DBService.getFormula();
      const movies: ScoredMovie[] = [];
      for (const movie of candidates.slice(0, 10)) {
        movies.push(await scoreMovie(movie, formula));
      }

      return NextResponse.json({
        data: {
          movies,
          page: 1,
          limit: 10,
          total: movies.length,
          total_pages: 1,
          formula_version: formula.version,
          mode: 'random',
        },
        message: 'Random movies loaded for discovery',
      });
    }

    // Get current formula
    const formula = DBService.getFormula();
    if (!formula) {
      return NextResponse.json(
        { error: 'Formula not found', message: 'Please add a movie first' },
        { status: 404 }
      );
    }

    // Get watched movie IDs to exclude
    const watchedMovieIds = new Set(
      DBService.getWatchlist().filter(entry => entry.watched).map(entry => entry.tmdb_id)
    );

    // Fetch trending/popular movies
    const movies = await tmdbClient.getTrendingMovies(page);
    const popularMovies = await tmdbClient.getPopularMovies(page);

    // Combine and deduplicate movies
    const allMovies = dedupeMovies([...movies, ...popularMovies]);

    // Filter out watched movies
    const candidateMovies = allMovies.filter(movie => !watchedMovieIds.has(movie.id));

    // Score each candidate movie
    const scoredMovies: ScoredMovie[] = [];

    for (const movie of candidateMovies.slice(0, 100)) {
      const scoredMovie = await scoreMovie(movie, formula);
      if (scoredMovie.score >= Number(minScore)) {
        scoredMovies.push(scoredMovie);
      }
    }

    // Sort by score (descending)
    scoredMovies.sort((a, b) => b.score - a.score);

    // Cache results
    DBService.saveScoreCache(scoredMovies);

    // Paginate
    const startIndex = (page - 1) * limit;
    const paginatedMovies = scoredMovies.slice(startIndex, startIndex + limit);

    return NextResponse.json({
      data: {
        movies: paginatedMovies,
        page,
        limit,
        total: scoredMovies.length,
        total_pages: Math.ceil(scoredMovies.length / limit),
        formula_version: formula.version
      },
      message: 'Recommendations generated successfully'
    });
  } catch (error) {
    console.error('Recommendations error:', error);
    return NextResponse.json(
      { error: 'Failed to generate recommendations', message: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * Search recommendations with natural language prompt
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, page = 1, limit = 20 } = body;

    if (!prompt || prompt.trim().length < 3) {
      return NextResponse.json(
        { error: 'Invalid prompt', message: 'Please provide a search prompt' },
        { status: 400 }
      );
    }

    // Get current formula
    const currentFormula = DBService.getFormula();
    if (!currentFormula) {
      return NextResponse.json(
        { error: 'Formula not found', message: 'Please add a movie first' },
        { status: 404 }
      );
    }

    // Simulate LLM-based prompt analysis (in production, this would call OpenAI/Anthropic)
    const promptAnalysis = analyzePrompt(prompt);

    // Adjust formula based on prompt
    const adjustedFormula = DBService.adjustFormulaFromPrompt(promptAnalysis);

    // Search for relevant movies
    const query = extractSearchQuery(prompt);
    const searchResults = await tmdbClient.searchMovies(query, page);

    // Get watched movie IDs to exclude
    const watchedMovieIds = new Set(
      DBService.getWatchlist().filter(entry => entry.watched).map(entry => entry.tmdb_id)
    );

    // Filter out watched movies
    const candidateMovies = searchResults.results.filter(
      movie => !watchedMovieIds.has(movie.id)
    );

    // Score each candidate movie
    const scoredMovies: ScoredMovie[] = [];

    for (const movie of candidateMovies) {
      const scoredMovie = await scoreMovie(movie, adjustedFormula);
      scoredMovies.push(scoredMovie);
    }

    // Sort by score (descending)
    scoredMovies.sort((a, b) => b.score - a.score);

    // Paginate
    const startIndex = (page - 1) * limit;
    const paginatedMovies = scoredMovies.slice(startIndex, startIndex + limit);

    return NextResponse.json({
      data: {
        movies: paginatedMovies,
        prompt_analysis: promptAnalysis,
        formula_adjustments: adjustedFormula.evolution_history?.slice(-1)[0],
        page,
        limit,
        total: scoredMovies.length,
        total_pages: Math.ceil(scoredMovies.length / limit)
      },
      message: 'Recommendations generated based on prompt'
    });
  } catch (error) {
    console.error('Prompt search error:', error);
    return NextResponse.json(
      { error: 'Failed to generate recommendations', message: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * Get trending movies adjusted by formula
 */
async function getTrendingRecommendations(request: NextRequest) {
  try {
    const page = parseInt(request.nextUrl.searchParams.get('page') || '1');
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '20');

    // Get current formula
    const formula = DBService.getFormula();
    if (!formula) {
      return NextResponse.json(
        { error: 'Formula not found', message: 'Please add a movie first' },
        { status: 404 }
      );
    }

    const trendingMovies = await tmdbClient.getTrendingMovies(page);
    const watchedMovieIds = new Set(
      DBService.getWatchlist().filter(entry => entry.watched).map(entry => entry.tmdb_id)
    );

    const scoredMovies: ScoredMovie[] = [];

    for (const movie of trendingMovies) {
      if (!watchedMovieIds.has(movie.id)) {
        const scoredMovie = await scoreMovie(movie, formula);
        scoredMovies.push(scoredMovie);
      }
    }

    scoredMovies.sort((a, b) => b.score - a.score);

    return NextResponse.json({
      data: scoredMovies.slice(0, limit),
      message: 'Trending recommendations generated successfully'
    });
  } catch (error) {
    console.error('Trending error:', error);
    return NextResponse.json(
      { error: 'Failed to generate trending recommendations', message: (error as Error).message },
      { status: 500 }
    );
  }
}

// --- Helper functions ---

async function scoreMovie(movie: any, formula: any): Promise<ScoredMovie> {
  // Extract features from movie
  const features = {
    genres: movie.genres?.map((g: any) => g.name.toLowerCase()) ||
             movie.genre_ids?.map((id: number) => ({ id, name: '' })) || [],
    runtime: movie.runtime || 0,
    vote_average: movie.vote_average || 0,
    vote_count: movie.vote_count || 0,
    keywords: movie.keywords?.keywords?.map((k: any) => k.name.toLowerCase()) || [],
    has_female_lead: false,
    complexity: 5,
    release_year: new Date(movie.release_date || '').getFullYear(),
    cast: [],
    overview: movie.overview || '',
    title: movie.title,
    tmdb_id: movie.id
  };

  // Simulate formula scoring (in production, use the actual formula engine)
  let score = 0;
  score += (formula.parameters?.baseline || 0.5) * 20;
  score += (formula.parameters?.rating_popularity || 0.5) * 20;
  score += (formula.parameters?.release_year_recency || 0.2) * 15;
  score += (formula.parameters?.vote_count_weight || 0.3) * 15;
  score += (formula.parameters?.complexity || 0) * 10;
  score += (formula.parameters?.has_female_lead || 0) * 10;

  // Scale to 0-100
  const normalizedScore = Math.max(0, Math.min(100, score));

  return {
    tmdb_id: movie.id,
    title: movie.title,
    overview: movie.overview,
    poster_path: movie.poster_path,
    backdrop_path: movie.backdrop_path,
    release_date: movie.release_date,
    vote_average: movie.vote_average,
    vote_count: movie.vote_count,
    genres: movie.genres?.map((g: any) => g.name) || [],
    runtime: movie.runtime,
    score: normalizedScore,
    matched_features: [],
    formula_version: formula.version
  };
}

function dedupeMovies(movies: any[]): any[] {
  const seen = new Set<number>();
  const deduped = [];
  for (const movie of movies) {
    if (!seen.has(movie.id)) {
      seen.add(movie.id);
      deduped.push(movie);
    }
  }
  return deduped;
}

/**
 * Analyze prompt for feature preferences (mock LLM analysis)
 * In production, this would call OpenAI/Anthropic with function calling
 */
function analyzePrompt(prompt: string): any {
  const lowerPrompt = prompt.toLowerCase();

  const genrePreferences: string[] = [];
  const genreWeights: Record<string, number> = {};
  const explicitConstraints: string[] = [];
  const adjustedParameters: Record<string, number> = {};

  // Detect genres
  const genreKeywords: Record<string, string[]> = {
    action: ['action', 'explosion', 'fight', 'hero'],
    thriller: ['thriller', 'suspense', 'mystery', 'twist', 'tense'],
    sci_fi: ['sci-fi', 'science fiction', 'space', 'robot', 'future', 'alien'],
    drama: ['drama', 'emotional', 'serious', 'touching'],
    comedy: ['comedy', 'funny', 'humor', 'laugh'],
    horror: ['horror', 'scary', 'terrifying', 'supernatural'],
    romance: ['romance', 'love', 'relationship', 'heartwarming'],
    adventure: ['adventure', 'quest', 'journey', 'exploration']
  };

  Object.entries(genreKeywords).forEach(([genre, keywords]) => {
    if (keywords.some(kw => lowerPrompt.includes(kw))) {
      genrePreferences.push(genre);
      genreWeights[genre] = 1.0;
    }
  });

  // Detect explicit constraints
  if (lowerPrompt.includes('female lead') || lowerPrompt.includes('woman')) {
    explicitConstraints.push('female lead');
    adjustedParameters.has_female_lead = 1.0;
  }
  if (lowerPrompt.includes('female director') || lowerPrompt.includes('directed by woman')) {
    explicitConstraints.push('female director');
    adjustedParameters.female_director = 1.0;
  }
  if (lowerPrompt.includes('complex')) {
    explicitConstraints.push('complex plot');
    adjustedParameters.complexity = 1.0;
  }
  if (lowerPrompt.includes('older') || lowerPrompt.includes('classic') || lowerPrompt.includes('vintage')) {
    explicitConstraints.push('older movie');
    adjustedParameters.release_year_recency = 0.0;
  }
  if (lowerPrompt.includes('new') || lowerPrompt.includes('recent') || lowerPrompt.includes('202')) {
    explicitConstraints.push('recent movie');
    adjustedParameters.release_year_recency = 1.0;
  }

  // Detect complexity
  if (lowerPrompt.includes('mind-bending') || lowerPrompt.includes('intricate') || lowerPrompt.includes('deep')) {
    explicitConstraints.push('complex narrative');
    adjustedParameters.complexity = 1.0;
  }

  // Calculate confidence based on how many features were detected
  const detectedCount = genrePreferences.length + explicitConstraints.length;
  const confidence = Math.min(1.0, detectedCount / 3);

  return {
    extracted_features: {
      genres: genrePreferences,
      keywords: lowerPrompt.split(' ').filter(w => w.length > 3)
    },
    genre_preferences: genrePreferences,
    explicit_constraints: explicitConstraints,
    adjusted_parameters: adjustedParameters,
    confidence: confidence
  };
}

/**
 * Extract search query from prompt
 */
function extractSearchQuery(prompt: string): string {
  // Remove genre and preference modifiers
  const excludePatterns = [
    /\b(action|thriller|sci-fi|drama|comedy|horror|romance|adventure)\b/gi,
    /\b(female lead|female director|complex|mindest-bending|old|new|recent|202\d)\b/gi,
    /\b(with|and|the|a|an|that|like)\b/gi
  ];

  let query = prompt;
  excludePatterns.forEach(pattern => {
    query = query.replace(pattern, '');
  });

  return query.trim().replace(/\s+/g, ' ');
}