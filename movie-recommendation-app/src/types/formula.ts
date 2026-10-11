/**
 * Formula-related TypeScript types for the movie recommendation system
 */

// Movie features extracted for formula scoring
export interface MovieFeatures {
  genres: string[];
  runtime: number;
  vote_average: number;
  vote_count: number;
  keywords: string[];
  has_female_lead: boolean;
  female_director: boolean;
  runtime_optimal: number;
  rating_popularity: number;
  vote_count_weight: number;
  complexity: number; // 1-10 scale
  release_year: number;
  director_id?: number;
  director_name?: string;
  cast: Array<{
    id: number;
    name: string;
    gender: number; // 1 = female, 2 = male
    order: number;
  }>;
  overview: string;
  title: string;
  tmdb_id: number;
}

// User's taste formula parameters
export interface FormulaParameters {
  // Genre weights
  genre_action: number;
  genre_adventure: number;
  genre_comedy: number;
  genre_drama: number;
  genre_sci_fi: number;
  genre_thriller: number;
  genre_horror: number;
  genre_romance: number;
  genre_fantasy: number;
  genre_animation: number;
  genre_documentary: number;
  genre_crime: number;
  genre_mystery: number;
  genre_history: number;
  genre_war: number;
  genre_western: number;
  genre_music: number;
  genre_family: number;

  // Special feature weights
  has_female_lead: number;
  female_director: number;
  complexity: number;
  runtime_optimal: number; // 90-150 min preferred
  rating_popularity: number;
  vote_count_weight: number;
  release_year_recency: number;

  // Keyword-based weights (dynamic)
  keyword_weights: Record<string, number>;

  // Baseline constant
  baseline: number;
}

// Complete formula object
export interface UserFormula {
  id: string;
  user_id: string;
  formula_text: string; // LaTeX representation
  parameters: FormulaParameters;
  version: number;
  created_at: Date;
  updated_at: Date;
  evolution_history?: FormulaEvolutionStep[];
}

// Single step in formula evolution
export interface FormulaEvolutionStep {
  timestamp: Date;
  trigger: 'rating' | 'review' | 'watched' | 'prompt' | 'manual';
  movie_tmdb_id?: number;
  changes: ParameterChange[];
  description: string;
}

// Individual parameter change
export interface ParameterChange {
  parameter: string;
  old_value: number;
  new_value: number;
  delta: number;
  reason: string;
}

// Formula scoring result
export interface ScoredMovie {
  tmdb_id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  vote_count: number;
  genres: string[];
  runtime: number;
  score: number; // 0-100
  matched_features: string[];
  formula_version: number;
}

// Formula computation input/output
export interface FormulaComputationInput {
  movie_features: MovieFeatures;
  user_formula: UserFormula;
}

export interface FormulaComputationOutput {
  score: number;
  breakdown: Record<string, number>; // feature -> contribution
  matched_features: string[];
}

// Natural language prompt analysis
export interface PromptAnalysis {
  extracted_features: Partial<FormulaParameters>;
  genre_preferences: string[];
  explicit_constraints: string[];
  adjusted_parameters: Record<string, number>;
  confidence: number;
}

// Function calling schema for OpenAI/Anthropic
export interface ScoreMovieFunction {
  name: 'score_movie_with_formula';
  description: 'Score a movie based on user\'s personalized taste formula';
  parameters: {
    type: 'object';
    properties: {
      movie_features: {
        type: 'object';
        properties: {
          genres: { type: 'array', items: { type: 'string' } };
          runtime: { type: 'number' };
          vote_average: { type: 'number' };
          vote_count: { type: 'number' };
          keywords: { type: 'array', items: { type: 'string' } };
          has_female_lead: { type: 'boolean' };
          complexity: { type: 'number' };
          release_year: { type: 'number' };
        };
        required: ['genres', 'runtime', 'vote_average', 'keywords', 'has_female_lead', 'complexity', 'release_year'];
      };
      user_formula: {
        type: 'object';
        properties: {
          weights: {
            type: 'object';
            additionalProperties: { type: 'number' };
          };
          baseline: { type: 'number' };
        };
        required: ['weights', 'baseline'];
      };
    };
    required: ['movie_features', 'user_formula'];
  };
}