/**
 * Database-related TypeScript types
 */

// User from auth (NextAuth/Clerk)
export interface User {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  created_at: Date;
  updated_at: Date;
}

// Watchlist entry
export interface WatchlistEntry {
  id: string;
  user_id: string;
  tmdb_id: number;
  title: string;
  overview: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string | null;
  vote_average: number | null;
  vote_count: number | null;
  genres: string[];
  runtime: number | null;
  keywords: string[];
  cast?: string[];
  lead_actor?: string;
  directors?: string[];
  metadata_sources?: MetadataSource[];
  lookup_status?: 'pending' | 'searching' | 'downloading' | 'processing' | 'complete';
  lookup_message?: string;
  has_female_lead: boolean;
  complexity: number;
  rating: number | null; // 1-10
  review: string | null;
  liked_elements: LikedElement[];
  watched: boolean;
  watched_at: Date | null;
  added_at: Date;
  updated_at: Date;
}

export interface MetadataSource {
  name: string;
  url: string;
}

// Structured liked elements from reviews
export interface LikedElement {
  type: 'acting' | 'direction' | 'cinematography' | 'story' | 'music' | 'vfx' | 'dialogue' | 'pacing' | 'character' | 'theme' | 'other';
  description: string;
  // Neutral is retained for older saved entries; new entries offer like/dislike only.
  sentiment: 'positive' | 'neutral' | 'negative';
}

// Movie data from TMDB
export interface TMDBMovie {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  vote_count: number;
  genre_ids: number[];
  genres?: TMDBGenre[];
  runtime: number | null;
  adult: boolean;
  original_language: string;
  popularity: number;
  metadata_source?: 'tmdb' | 'wikimedia';
  metadata_sources?: MetadataSource[];
  lookup_status?: 'pending' | 'searching' | 'downloading' | 'processing' | 'complete';
  lookup_message?: string;
}

export interface TMDBGenre {
  id: number;
  name: string;
}

export interface TMDBMovieDetails extends TMDBMovie {
  genres: TMDBGenre[];
  runtime: number | null;
  credits: {
    cast: TMDBCast[];
    crew: TMDBCrew[];
  };
  keywords: {
    keywords: TMDBKeyword[];
  };
  videos: {
    results: TMDBVideo[];
  };
}

export interface TMDBCast {
  id: number;
  name: string;
  character: string;
  gender: number; // 1 = female, 2 = male
  order: number;
  profile_path: string | null;
}

export interface TMDBCrew {
  id: number;
  name: string;
  job: string;
  department: string;
  gender: number;
  profile_path: string | null;
}

export interface TMDBKeyword {
  id: number;
  name: string;
}

export interface TMDBVideo {
  id: string;
  key: string;
  name: string;
  site: string;
  type: string;
  official: boolean;
}

export interface TMDBSearchResponse {
  page: number;
  results: TMDBMovie[];
  total_pages: number;
  total_results: number;
}

// Cached movie scores
export interface MovieScore {
  id: string;
  user_id: string;
  tmdb_id: number;
  score: number; // 0-100
  movie_data: ScoredMovieData;
  formula_version: number;
  computed_at: Date;
}

export interface ScoredMovieData {
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  vote_count: number;
  genres: string[];
  runtime: number | null;
  matched_features: string[];
}

// Formula stored in database
export interface DBFormula {
  id: string;
  user_id: string;
  formula_text: string;
  parameters: Record<string, number>;
  version: number;
  created_at: Date;
  updated_at: Date;
}

// Formula evolution history
export interface FormulaEvolution {
  id: string;
  user_id: string;
  formula_id: string;
  trigger: 'rating' | 'review' | 'watched' | 'prompt' | 'manual';
  movie_tmdb_id: number | null;
  changes: Record<string, { old: number; new: number; delta: number }>;
  description: string;
  created_at: Date;
}

// API response types
export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface APIError {
  error: string;
  message: string;
  status_code: number;
}

export interface APISuccess<T> {
  data: T;
  message?: string;
}