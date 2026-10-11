import type { User, WatchlistEntry, LikedElement, MovieScore, APIError, APISuccess, TMDBMovie, TMDBMovieDetails } from '../types/db';
import type { UserFormula, FormulaEvolutionStep, ScoredMovie, MovieFeatures, FormulaParameters } from '../types/formula';
import { extractMovieFeatures, computeMovieScore, initializeDefaultFormula, updateFormulaFromRating, updateFormulaFromFavorite, evolveFormulaFromPatterns, adjustFormulaFromPrompt } from './formula';
import type { FormulaComputationInput } from '../types/formula';
import { appLogger } from './logger';
import { GENRE_MAP } from './tmdb';

/**
 * LocalStorage-based storage layer for local development
 * In production, replace with SQLite/PostgreSQL + Prisma
 */

const STORAGE_KEYS = {
  USER_ID: 'movie_app_user_id',
  WATCHLIST: 'movie_app_watchlist',
  FORMULA: 'movie_app_formula',
  SCORE_CACHE: 'movie_app_score_cache',
  EVOLUTION_HISTORY: 'movie_app_evolution_history',
  SETTINGS: 'movie_app_settings',
  RECOMMENDATION_HISTORY: 'movie_app_recommendation_history',
} as const;

export interface RecommendationHistoryEntry {
  tmdb_id: number;
  title: string;
  shown_at: string;
  favorite: boolean;
}

// Utility functions
function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function now(): Date {
  return new Date();
}

// Storage helpers
function getItem<T>(key: string): T | null {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch (error) {
    appLogger.error('Unable to read local browser storage.');
    return null;
  }
}

function setItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    appLogger.error('Unable to write local browser storage.');
    throw new Error('Failed to store data locally. Consider enabling browser storage.');
  }
}

// LocalStorage wrapper to work in both client and server
export const localStore = {
  get: <T>(key: string): T | null => {
    if (typeof window === 'undefined') return null;
    return getItem<T>(key);
  },
  set: <T>(key: string, value: T): void => {
    if (typeof window === 'undefined') return;
    setItem<T>(key, value);
  }
};

// --- Database Service ---

export class DBService {
  private static userId: string | null = null;

  /**
   * Get or create user ID for local storage
   */
  static getUserId(): string {
    if (this.userId) return this.userId;
    let userId = localStore.get<string>(STORAGE_KEYS.USER_ID);
    if (!userId) {
      userId = generateId();
      localStore.set(STORAGE_KEYS.USER_ID, userId);
    }
    this.userId = userId;
    return userId;
  }

  static getCurrentUser(): User {
    return {
      id: this.getUserId(),
      name: 'User',
      email: 'user@example.com',
      image: null,
      created_at: new Date(),
      updated_at: new Date()
    };
  }

  /**
   * --- Formula Operations ---
   */

  static getFormula(): UserFormula {
    const userId = this.getUserId();
    const formula = localStore.get<UserFormula>(`${STORAGE_KEYS.FORMULA}_${userId}`);
    if (!formula) {
      return initializeDefaultFormula(userId);
    }
    return formula;
  }

  static saveFormula(formula: UserFormula): void {
    const userId = this.getUserId();
    const currentFormula = this.getFormula();
    const mergedFormula: UserFormula = {
      ...formula,
      id: formula.id,
      user_id: userId,
      updated_at: new Date(),
      formula_text: generateFormulaLaTeX(formula.parameters)
    };
    localStore.set(`${STORAGE_KEYS.FORMULA}_${userId}`, mergedFormula);
  }

  static updateFormulaFromRating(
    movieFeatures: MovieFeatures,
    userRating: number,
    learningRate = 0.1
  ): UserFormula {
    const currentFormula = this.getFormula();
    const newFormula = updateFormulaFromRating(currentFormula, movieFeatures, userRating, learningRate);
    this.saveFormula(newFormula);
    return newFormula;
  }

  static evolveFormulaFromRatings(
    recentRatings: Array<{ movieFeatures: MovieFeatures; rating: number }>,
    threshold = 0.3
  ): UserFormula {
    const currentFormula = this.getFormula();
    const newFormula = evolveFormulaFromPatterns(currentFormula, recentRatings, threshold);
    this.saveFormula(newFormula);
    return newFormula;
  }

  static adjustFormulaFromPrompt(
    promptAnalysis: {
      extracted_features: Record<string, number>;
      genre_preferences: string[];
      explicit_constraints: string[];
      adjusted_parameters: Record<string, number>;
      confidence: number;
    }
  ): UserFormula {
    const currentFormula = this.getFormula();
    const newFormula = adjustFormulaFromPrompt(currentFormula, promptAnalysis);
    this.saveFormula(newFormula);
    return newFormula;
  }

  /**
   * --- Watchlist Operations ---
   */

  static getWatchlist(): WatchlistEntry[] {
    const userId = this.getUserId();
    return localStore.get<WatchlistEntry[]>(`${STORAGE_KEYS.WATCHLIST}_${userId}`) || [];
  }

  static getWatchlistMovie(tmdbId: number): WatchlistEntry | null {
    const userId = this.getUserId();
    const watchlist = this.getWatchlist();
    return watchlist.find(entry => entry.tmdb_id === tmdbId) || null;
  }

  static addMovieToWatchlist(movie: TMDBMovieDetails): WatchlistEntry {
    const userId = this.getUserId();
    const watchlist = this.getWatchlist();

    const normalizedTitle = movie.title.trim().toLocaleLowerCase();
    const existingIndex = watchlist.findIndex(entry =>
      entry.tmdb_id === movie.id ||
      (movie.id < 0 && entry.title.trim().toLocaleLowerCase() === normalizedTitle)
    );
    if (existingIndex !== -1) {
      const existing = watchlist[existingIndex];
      const features = extractMovieFeatures(movie);
      const updatedEntry: WatchlistEntry = {
        ...existing,
        tmdb_id: movie.id,
        title: movie.title,
        overview: movie.overview,
        poster_path: movie.poster_path,
        backdrop_path: movie.backdrop_path,
        release_date: movie.release_date,
        vote_average: movie.vote_average,
        vote_count: movie.vote_count,
        genres: movie.genres.map(genre => genre.name),
        runtime: movie.runtime,
        keywords: movie.keywords?.keywords?.map(keyword => keyword.name.toLowerCase()) || [],
        cast: movie.credits.cast.map(member => member.name),
        lead_actor: movie.metadata_source === 'wikimedia' ? undefined : movie.credits.cast[0]?.name,
        directors: movie.credits.crew.filter(member => member.job === 'Director').map(member => member.name),
        metadata_sources: movie.metadata_sources,
        lookup_status: movie.lookup_status ?? 'complete',
        has_female_lead: features.has_female_lead,
        complexity: features.complexity,
        updated_at: now(),
      };
      watchlist[existingIndex] = updatedEntry;
      localStore.set(`${STORAGE_KEYS.WATCHLIST}_${userId}`, watchlist);
      return updatedEntry;
    }

    const features = extractMovieFeatures(movie);
    const newEntry: WatchlistEntry = {
      id: generateId(),
      user_id: userId,
      tmdb_id: movie.id,
      title: movie.title,
      overview: movie.overview,
      poster_path: movie.poster_path,
      backdrop_path: movie.backdrop_path,
      release_date: movie.release_date,
      vote_average: movie.vote_average,
      vote_count: movie.vote_count,
      genres: movie.genres.map(g => g.name),
      runtime: movie.runtime,
      keywords: movie.keywords?.keywords?.map(k => k.name.toLowerCase()) || [],
      cast: movie.credits.cast.map(member => member.name),
      lead_actor: movie.metadata_source === 'wikimedia' ? undefined : movie.credits.cast[0]?.name,
      directors: movie.credits.crew.filter(member => member.job === 'Director').map(member => member.name),
      metadata_sources: movie.metadata_sources,
      lookup_status: movie.lookup_status ?? 'complete',
      has_female_lead: features.has_female_lead,
      complexity: features.complexity,
      rating: null,
      review: null,
      liked_elements: [],
      watched: false,
      watched_at: null,
      added_at: now(),
      updated_at: now()
    };

    watchlist.push(newEntry);
    localStore.set(`${STORAGE_KEYS.WATCHLIST}_${userId}`, watchlist);
    return newEntry;
  }

  static updateMovieMetadata(entryId: string, movie: TMDBMovieDetails): WatchlistEntry | null {
    const userId = this.getUserId();
    const watchlist = this.getWatchlist();
    const index = watchlist.findIndex(entry => entry.id === entryId);
    if (index === -1) return null;

    const existing = watchlist[index];
    const features = extractMovieFeatures(movie);
    const updatedEntry: WatchlistEntry = {
      ...existing,
      tmdb_id: movie.id,
      title: movie.title,
      overview: movie.overview,
      poster_path: movie.poster_path,
      backdrop_path: movie.backdrop_path,
      release_date: movie.release_date,
      vote_average: movie.vote_average,
      vote_count: movie.vote_count,
      genres: movie.genres.map(genre => genre.name),
      runtime: movie.runtime,
      keywords: movie.keywords.keywords.map(keyword => keyword.name.toLowerCase()),
      cast: movie.credits.cast.map(member => member.name),
      lead_actor: movie.metadata_source === 'wikimedia' ? undefined : movie.credits.cast[0]?.name,
      directors: movie.credits.crew.filter(member => member.job === 'Director').map(member => member.name),
      metadata_sources: movie.metadata_sources,
      lookup_status: 'complete',
      lookup_message: undefined,
      has_female_lead: features.has_female_lead,
      complexity: features.complexity,
      updated_at: now(),
    };
    watchlist[index] = updatedEntry;
    localStore.set(`${STORAGE_KEYS.WATCHLIST}_${userId}`, watchlist);
    return updatedEntry;
  }

  static updateMovieLookupProgress(
    entryId: string,
    status: NonNullable<WatchlistEntry['lookup_status']>,
    message: string
  ): WatchlistEntry | null {
    const userId = this.getUserId();
    const watchlist = this.getWatchlist();
    const index = watchlist.findIndex(entry => entry.id === entryId);
    if (index === -1) return null;

    const updatedEntry = {
      ...watchlist[index],
      lookup_status: status,
      lookup_message: message,
      updated_at: now(),
    };
    watchlist[index] = updatedEntry;
    localStore.set(`${STORAGE_KEYS.WATCHLIST}_${userId}`, watchlist);
    return updatedEntry;
  }

  static removeWatchlistEntry(entryId: string): boolean {
    const userId = this.getUserId();
    const watchlist = this.getWatchlist();
    const remaining = watchlist.filter(entry => entry.id !== entryId);
    if (remaining.length === watchlist.length) return false;
    localStore.set(`${STORAGE_KEYS.WATCHLIST}_${userId}`, remaining);
    return true;
  }

  static removeMovieFromWatchlist(tmdbId: number): boolean {
    const userId = this.getUserId();
    const watchlist = this.getWatchlist();
    const initialLength = watchlist.length;
    const newWatchlist = watchlist.filter(entry => entry.tmdb_id !== tmdbId);
    if (newWatchlist.length === initialLength) return false;
    localStore.set(`${STORAGE_KEYS.WATCHLIST}_${userId}`, newWatchlist);
    return true;
  }

  static toggleWatched(tmdbId: number): boolean | null {
    const userId = this.getUserId();
    const watchlist = this.getWatchlist();
    const entry = watchlist.find(e => e.tmdb_id === tmdbId);
    if (!entry) return null;
    entry.watched = !entry.watched;
    entry.watched_at = entry.watched ? now() : null;
    entry.updated_at = now();
    localStore.set(`${STORAGE_KEYS.WATCHLIST}_${userId}`, watchlist);
    return entry.watched;
  }

  static markAsWatched(tmdbId: number): void {
    const userId = this.getUserId();
    const watchlist = this.getWatchlist();
    const entry = watchlist.find(e => e.tmdb_id === tmdbId);
    if (!entry) return;
    entry.watched = true;
    entry.watched_at = now();
    entry.updated_at = now();
    localStore.set(`${STORAGE_KEYS.WATCHLIST}_${userId}`, watchlist);
  }

  static updateReviewByEntryId(
    entryId: string,
    rating: number | null,
    review: string,
    likedElements: LikedElement[]
  ): void {
    const watchlist = this.getWatchlist();
    const entry = watchlist.find(item => item.id === entryId);
    if (!entry) return;
    entry.rating = rating;
    entry.review = review;
    entry.liked_elements = likedElements;
    entry.updated_at = now();
    localStore.set(`${STORAGE_KEYS.WATCHLIST}_${entry.user_id}`, watchlist);
    if (rating !== null) {
      this.updateReview(entry.tmdb_id, rating, review, likedElements);
    }
  }

  static updateReview(tmdbId: number, rating: number | null, review: string, likedElements: LikedElement[]): void {
    const userId = this.getUserId();
    const watchlist = this.getWatchlist();
    const entry = watchlist.find(e => e.tmdb_id === tmdbId);
    if (entry) {
      entry.rating = rating;
      entry.review = review;
      entry.liked_elements = likedElements;
      entry.updated_at = now();
      localStore.set(`${STORAGE_KEYS.WATCHLIST}_${userId}`, watchlist);

      if (rating !== null) {
        const features = extractMovieFeatures({
          id: tmdbId,
          title: entry.title,
          overview: entry.overview || '',
          poster_path: entry.poster_path,
          backdrop_path: entry.backdrop_path,
          release_date: entry.release_date || '',
          vote_average: entry.vote_average || 0,
          vote_count: entry.vote_count || 0,
          genre_ids: entry.genres.map(g => 18)
        } as TMDBMovie);
        this.updateFormulaFromRating(features, rating);

        const recentRatings = watchlist
          .filter(e => e.rating !== null)
          .map(e => ({ movieFeatures: features, rating: e.rating! }));
        if (recentRatings.length >= 3) {
          this.evolveFormulaFromRatings(recentRatings);
        }
      }
    }
  }

  static addLikedElement(tmdbId: number, element: LikedElement): void {
    const userId = this.getUserId();
    const watchlist = this.getWatchlist();
    const entry = watchlist.find(e => e.tmdb_id === tmdbId);
    if (entry) {
      entry.liked_elements.push(element);
      entry.updated_at = now();
      localStore.set(`${STORAGE_KEYS.WATCHLIST}_${userId}`, watchlist);
    }
  }

  /**
   * --- Score Cache Operations ---
   */

  static getScoreCache(tmdbId: number): ScoredMovie | null {
    const userId = this.getUserId();
    const cache = localStore.get<ScoredMovie[]>(`${STORAGE_KEYS.SCORE_CACHE}_${userId}`) || [];
    return cache.find(score => score.tmdb_id === tmdbId) || null;
  }

  static saveScoreCache(scores: ScoredMovie[]): void {
    const userId = this.getUserId();
    localStore.set(`${STORAGE_KEYS.SCORE_CACHE}_${userId}`, scores);
  }

  static getRecommendationHistory(): RecommendationHistoryEntry[] {
    const userId = this.getUserId();
    return localStore.get<RecommendationHistoryEntry[]>(
      `${STORAGE_KEYS.RECOMMENDATION_HISTORY}_${userId}`
    ) || [];
  }

  static recordShownRecommendations(movies: ScoredMovie[]): void {
    const userId = this.getUserId();
    const history = this.getRecommendationHistory();
    const entries = new Map(history.map(entry => [entry.tmdb_id, entry]));
    movies.forEach(movie => {
      const existing = entries.get(movie.tmdb_id);
      entries.set(movie.tmdb_id, {
        tmdb_id: movie.tmdb_id,
        title: movie.title,
        shown_at: existing?.shown_at || new Date().toISOString(),
        favorite: existing?.favorite || false,
      });
    });
    localStore.set(
      `${STORAGE_KEYS.RECOMMENDATION_HISTORY}_${userId}`,
      [...entries.values()].slice(-1000)
    );
  }

  static favoriteRecommendation(movie: ScoredMovie): boolean {
    const history = this.getRecommendationHistory();
    const existing = history.find(entry => entry.tmdb_id === movie.tmdb_id);
    if (existing?.favorite) return false;

    this.recordShownRecommendations([movie]);
    const userId = this.getUserId();
    const updatedHistory = this.getRecommendationHistory().map(entry => entry.tmdb_id === movie.tmdb_id
      ? { ...entry, favorite: true }
      : entry
    );
    localStore.set(`${STORAGE_KEYS.RECOMMENDATION_HISTORY}_${userId}`, updatedHistory);

    const genreIds = movie.genres.flatMap(genre => {
      const match = Object.entries(GENRE_MAP).find(([, name]) =>
        name === genre.toLowerCase().replace(/[\s-]+/g, '_')
      );
      return match ? [Number(match[0])] : [];
    });
    const features = extractMovieFeatures({
      id: movie.tmdb_id,
      title: movie.title,
      original_title: movie.title,
      overview: movie.overview,
      poster_path: movie.poster_path,
      backdrop_path: movie.backdrop_path,
      release_date: movie.release_date || '',
      vote_average: movie.vote_average,
      vote_count: movie.vote_count,
      genre_ids: genreIds,
      runtime: movie.runtime,
      adult: false,
      original_language: '',
      popularity: 0,
    });
    this.saveFormula(updateFormulaFromFavorite(this.getFormula(), features));
    return true;
  }

}

export default DBService;

// Helper function to generate LaTeX from parameters
function generateFormulaLaTeX(parameters: FormulaParameters): string {
  const terms: string[] = [];

  if (parameters.baseline !== 0) {
    terms.push(`${parameters.baseline.toFixed(3)}`);
  }

  // Genre terms
  Object.entries(parameters).forEach(([key, value]) => {
    if (key.startsWith('genre_') && Math.abs(value) > 0.01) {
      const genreName = key.replace('genre_', '');
      terms.push(`${value.toFixed(3)} \\cdot \\mathbf{1}_{${genreName}}`);
    }
  });

  // Feature terms
  const featureMap: Record<string, string> = {
    has_female_lead: '\\mathbf{1}_{female\\ lead}',
    female_director: '\\mathbf{1}_{female\\ director}',
    complexity: '\\frac{complexity}{10}',
    runtime_optimal: '\\mathbf{1}_{90\\leq runtime\\leq 150}',
    rating_popularity: '\\frac{\\log_{10}(rating+1)}{2}',
    vote_count_weight: '\\min\\left(1, \\frac{\\log_{10}(votes+1)}{5}\\right)',
    release_year_recency: '\\max\\left(0, 1 - \\frac{current\\ year - release\\ year}{50}\\right)'
  };

  Object.entries(featureMap).forEach(([feature, latex]) => {
    const value = parameters[feature as Exclude<keyof FormulaParameters, 'keyword_weights'>];
    if (Math.abs(value) > 0.01) {
      terms.push(`${value.toFixed(3)} \\cdot ${latex}`);
    }
  });

  // Keyword terms
  Object.entries(parameters.keyword_weights || {}).forEach(([keyword, weight]) => {
    if (Math.abs(weight) > 0.01) {
      terms.push(`${weight.toFixed(3)} \\cdot \\mathbf{1}_{${keyword}}`);
    }
  });

  return terms.length > 0 ? terms.join(' + ') : '0';
}