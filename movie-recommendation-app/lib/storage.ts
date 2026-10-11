import type { User, WatchlistEntry, LikedElement, UserFormula, FormulaEvolutionStep, ScoredMovie, MovieScore, APIError, APISuccess, MovieFeatures, TMDBMovie, TMDBMovieDetails } from '../types';
import { extractMovieFeatures, computeMovieScore, initializeDefaultFormula, updateFormulaFromRating, evolveFormulaFromPatterns, adjustFormulaFromPrompt } from './formula';
import type { FormulaComputationInput } from '../types/formula';

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
  SETTINGS: 'movie_app_settings'
} as const;

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
    console.error(`Error reading from localStorage [${key}]:`, error);
    return null;
  }
}

function setItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Error writing to localStorage [${key}]:`, error);
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

  static getFormula(): UserFormula | null {
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

    // Check if already exists
    const existingIndex = watchlist.findIndex(entry => entry.tmdb_id === movie.id);
    if (existingIndex !== -1) {
      const updatedEntry = {
        ...watchlist[existingIndex],
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
        has_female_lead: false,
        complexity: 5,
        rating: null,
        review: null,
        liked_elements: [],
        watched: false,
        watched_at: null,
        added_at: watchlist[existingIndex].added_at,
        updated_at: now()
      } as WatchlistEntry;
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

  static removeMovieFromWatchlist(tmdbId: number): boolean {
    const userId = this.getUserId();
    const watchlist = this.getWatchlist();
    const initialLength = watchlist.length;
    const newWatchlist = watchlist.filter(entry => entry.tmdb_id !== tmdbId);
    if (newWatchlist.length === initialLength) return false;
    localStore.set(`${STORAGE_KEYS.WATCHLIST}_${userId}`, newWatchlist);
    return true;
  }

  static markAsWatched(tmdbId: number): void {
    const userId = this.getUserId();
    const watchlist = this.getWatchlist();
    const entry = watchlist.find(e => e.tmdb_id === tmdbId);
    if (entry) {
      entry.watched = true;
      entry.watched_at = now();
      localStore.set(`${STORAGE_KEYS.WATCHLIST}_${userId}`, watchlist);
    }
  }

  static updateReview(tmdbId: number, rating: number, review: string, likedElements: LikedElement[]): void {
    const userId = this.getUserId();
    const watchlist = this.getWatchlist();
    const entry = watchlist.find(e => e.tmdb_id === tmdbId);
    if (entry) {
      entry.rating = rating;
      entry.review = review;
      entry.liked_elements = likedElements;
      entry.updated_at = now();
      localStore.set(`${STORAGE_KEYS.WATCHLIST}_${userId}`, watchlist);

      // Trigger formula update
      const features = extractMovieFeatures({
        id: tmdbId,
        title: entry.title,
        overview: entry.overview || '',
        poster_path: entry.poster_path,
        backdrop_path: entry.backdrop_path,
        release_date: entry.release_date || '',
        vote_average: entry.vote_average || 0,
        vote_count: entry.vote_count || 0,
        genre_ids: entry.genres.map(g => 18) // Placeholder
      } as TMDBMovie);
      this.updateFormulaFromRating(features, rating);

      // Check for pattern evolution
      const recentRatings = watchlist
        .filter(e => e.rating !== null)
        .map(e => ({ movieFeatures: features, rating: e.rating! }));
      if (recentRatings.length >= 3) {
        this.evolveFormulaFromRatings(recentRatings);
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

  static getFormula(): UserFormula | null {
    return DBService.getFormula();
  }
}

export default DBService;
