import type { MovieFeatures, FormulaParameters, UserFormula, FormulaComputationInput, FormulaComputationOutput, ScoredMovie, PromptAnalysis } from '../types/formula';
import type { TMDBMovie, TMDBMovieDetails } from '../types/db';

/**
 * Mathematical Formula Engine for Personalized Movie Recommendations
 *
 * This module implements:
 * 1. Feature extraction from movie data
 * 2. Formula computation (weighted sum of features)
 * 3. Parameter updating based on user feedback (Bayesian updating)
 * 4. Formula evolution based on patterns
 * 5. Prompt-based parameter adjustment
 */

/**
 * Extract features from TMDB movie data for formula computation
 */
export function extractMovieFeatures(movie: TMDBMovieDetails | TMDBMovie): MovieFeatures {
  // Get detailed info if available, otherwise use basic info
  const details = 'genres' in movie && Array.isArray((movie as TMDBMovieDetails).genres)
    ? movie as TMDBMovieDetails
    : { ...movie, genres: [], credits: { cast: [], crew: [] }, keywords: { keywords: [] } } as TMDBMovieDetails;

  // Extract genres
  const genres = details.genres?.map(g => g.name.toLowerCase()) ||
                 (details.genre_ids?.map(id => {
                   // Map genre IDs to names (simplified mapping)
                   const genreMap: Record<number, string> = {
                     28: 'action', 12: 'adventure', 16: 'animation', 35: 'comedy',
                     80: 'crime', 99: 'documentary', 18: 'drama', 10751: 'family',
                     14: 'fantasy', 36: 'history', 27: 'horror', 10402: 'music',
                     9648: 'mystery', 10749: 'romance', 878: 'sci_fi', 10770: 'tv_movie',
                     53: 'thriller', 10752: 'war', 37: 'western'
                   };
                   return genreMap[id] || 'unknown';
                 }) || []);

  // Extract keywords
  const keywords = details.keywords?.keywords?.map(k => k.name.toLowerCase()) || [];

  // Detect female lead (check top 3 cast members)
  const has_female_lead = details.credits.cast.slice(0, 3).some(castMember => castMember.gender === 1);

  // Detect female director
  const female_director = details.credits.crew.some(
    crewMember => crewMember.job === 'Director' && crewMember.gender === 1
  );

  // Calculate complexity score (simplified based on vote count variance and overview length)
  const complexity = Math.min(10, Math.max(1,
    5 +
    (details.overview?.length || 0) / 200 -  // Longer overviews suggest complexity
    (details.vote_count > 10000 ? 2 : 0)    // Very popular movies might be less complex
  ));

  // Runtime optimal (90-150 minutes preferred)
  const runtime_optimal = details.runtime && details.runtime >= 90 && details.runtime <= 150 ? 1 : 0;

  // Rating popularity (normalized log scale)
  const rating_popularity = Math.log10((details.vote_average || 0) + 1) / 2;

  // Vote count weight (normalized)
  const vote_count_weight = Math.min(1, Math.log10((details.vote_count || 0) + 1) / 5);

  // Release year recency (newer movies get slight boost)
  const currentYear = new Date().getFullYear();
  const releaseYear = new Date(details.release_date || '').getFullYear() || currentYear;
  const release_year_recency = Math.max(0, 1 - (currentYear - releaseYear) / 50); // 50-year decay

  return {
    genres,
    runtime: details.runtime || 0,
    vote_average: details.vote_average || 0,
    vote_count: details.vote_count || 0,
    keywords,
    has_female_lead,
    female_director,
    runtime_optimal,
    rating_popularity,
    vote_count_weight,
    complexity,
    release_year: releaseYear,
    director_id: details.credits.crew.find(c => c.job === 'Director')?.id,
    director_name: details.credits.crew.find(c => c.job === 'Director')?.name,
    cast: details.credits.cast,
    overview: details.overview || '',
    title: details.title,
    tmdb_id: details.id
  };
}

/**
 * Compute movie score using user's formula
 */
export function computeMovieScore(input: FormulaComputationInput): FormulaComputationOutput {
  const { movie_features, user_formula } = input;
  const { parameters } = user_formula;

  let totalScore = parameters.baseline || 0;
  const breakdown: Record<string, number> = {};
  const matchedFeatures: string[] = [];

  // Genre contributions
  movie_features.genres.forEach(genre => {
    const paramKey = `genre_${genre}` as keyof FormulaParameters;
    const contribution = parameters[paramKey];
    if (typeof contribution === 'number') {
      totalScore += contribution;
      breakdown[paramKey] = contribution;
      if (contribution > 0.1) matchedFeatures.push(genre);
    }
  });

  // Feature contributions
  const featureMap: Record<string, { value: number | boolean; param: keyof FormulaParameters }> = {
    has_female_lead: { value: movie_features.has_female_lead ? 1 : 0, param: 'has_female_lead' },
    female_director: { value: movie_features.female_director ? 1 : 0, param: 'female_director' },
    complexity: { value: movie_features.complexity / 10, param: 'complexity' }, // Normalize 1-10 to 0-1
    runtime_optimal: { value: movie_features.runtime_optimal, param: 'runtime_optimal' },
    rating_popularity: { value: movie_features.rating_popularity, param: 'rating_popularity' },
    vote_count_weight: { value: movie_features.vote_count_weight, param: 'vote_count_weight' },
    release_year_recency: { value: Math.max(0, 1 - (new Date().getFullYear() - movie_features.release_year) / 50), param: 'release_year_recency' }
  };

  Object.entries(featureMap).forEach(([featureName, { value, param }]) => {
    const weight = parameters[param];
    if (typeof weight === 'number') {
      const contribution = weight * Number(value);
      totalScore += contribution;
      breakdown[param] = contribution;
      if (contribution > 0.05) matchedFeatures.push(featureName);
    }
  });

  // Keyword contributions
  movie_features.keywords.forEach(keyword => {
    const weight = parameters.keyword_weights?.[keyword] || 0;
    if (weight !== 0) {
      totalScore += weight;
      breakdown[`keyword_${keyword}`] = weight;
      if (weight > 0.05) matchedFeatures.push(keyword);
    }
  });

  // Normalize score to 0-100 range
  const normalizedScore = Math.max(0, Math.min(100, totalScore * 10)); // Scale factor for readability

  return {
    score: normalizedScore,
    breakdown,
    matched_features: [...new Set(matchedFeatures)]
  };
}

/**
 * Update formula parameters based on user rating (Bayesian updating)
 */
export function updateFormulaFromRating(
  currentFormula: UserFormula,
  movieFeatures: MovieFeatures,
  userRating: number, // 1-10 scale
  learningRate = 0.1
): UserFormula {
  const { parameters } = currentFormula;

  // Predict rating using current formula (convert 0-100 score to 1-10 scale)
  const predictionInput: FormulaComputationInput = { movie_features: movieFeatures, user_formula: currentFormula };
  const predictionOutput = computeMovieScore(predictionInput);
  const predictedRating = predictionOutput.score / 10; // Convert 0-100 to 1-10

  // Calculate error
  const error = userRating - predictedRating;

  // Create new parameters object
  const newParameters = { ...parameters };

  // Update genre weights
  movieFeatures.genres.forEach(genre => {
    const paramKey = `genre_${genre}` as keyof FormulaParameters;
    const weight = newParameters[paramKey];
    if (typeof weight === 'number') {
      const updatedWeight = weight + learningRate * error;
      Object.assign(newParameters, {
        [paramKey]: Math.max(-2, Math.min(2, updatedWeight))
      });
    }
  });

  // Update feature weights
  const featureUpdates = [
    { feature: 'has_female_lead', value: movieFeatures.has_female_lead ? 1 : 0 },
    { feature: 'female_director', value: movieFeatures.female_director ? 1 : 0 },
    { feature: 'complexity', value: movieFeatures.complexity / 10 },
    { feature: 'runtime_optimal', value: movieFeatures.runtime_optimal },
    { feature: 'rating_popularity', value: movieFeatures.rating_popularity },
    { feature: 'vote_count_weight', value: movieFeatures.vote_count_weight },
    { feature: 'release_year_recency', value: Math.max(0, 1 - (new Date().getFullYear() - movieFeatures.release_year) / 50) }
  ];

  featureUpdates.forEach(({ feature, value }) => {
    const paramKey = feature as Exclude<keyof FormulaParameters, 'keyword_weights'>;
    const weight = newParameters[paramKey];
    if (typeof weight === 'number') {
      const updatedWeight = weight + learningRate * error * value;
      Object.assign(newParameters, {
        [paramKey]: Math.max(-2, Math.min(2, updatedWeight))
      });
    }
  });

  // Update keyword weights
  movieFeatures.keywords.forEach(keyword => {
    if (newParameters.keyword_weights?.[keyword] !== undefined) {
      newParameters.keyword_weights[keyword] += learningRate * error * 1;
      newParameters.keyword_weights[keyword] = Math.max(-2, Math.min(2, newParameters.keyword_weights[keyword]));
    }
  });

  // Update baseline
  newParameters.baseline += learningRate * error * 1;
  newParameters.baseline = Math.max(-5, Math.min(5, newParameters.baseline));

  // Create evolved formula
  const evolvedFormula: UserFormula = {
    ...currentFormula,
    parameters: newParameters,
    formula_text: generateFormulaLaTeX(newParameters),
    version: currentFormula.version + 1,
    updated_at: new Date(),
    evolution_history: [
      ...(currentFormula.evolution_history || []),
      {
        timestamp: new Date(),
        trigger: 'rating',
        movie_tmdb_id: movieFeatures.tmdb_id,
        changes: calculateParameterChanges(parameters, newParameters),
        description: `Updated based on rating ${userRating}/10 for "${movieFeatures.title}" (predicted: ${predictedRating.toFixed(1)}/10)`
      }
    ]
  };

  return evolvedFormula;
}

export function updateFormulaFromFavorite(
  currentFormula: UserFormula,
  movieFeatures: MovieFeatures
): UserFormula {
  const parameters = {
    ...currentFormula.parameters,
    keyword_weights: { ...currentFormula.parameters.keyword_weights },
  };
  const change = 0.12;

  movieFeatures.genres.forEach(genre => {
    const key = `genre_${genre}` as keyof FormulaParameters;
    if (typeof parameters[key] === 'number') {
      Object.assign(parameters, {
        [key]: Math.min(2, parameters[key] + change),
      });
    }
  });
  movieFeatures.keywords.slice(0, 8).forEach(keyword => {
    parameters.keyword_weights[keyword] = Math.min(
      2,
      (parameters.keyword_weights[keyword] || 0) + change / 2
    );
  });

  const evolvedFormula: UserFormula = {
    ...currentFormula,
    parameters,
    formula_text: generateFormulaLaTeX(parameters),
    version: currentFormula.version + 1,
    updated_at: new Date(),
    evolution_history: [
      ...(currentFormula.evolution_history || []),
      {
        timestamp: new Date(),
        trigger: 'manual',
        movie_tmdb_id: movieFeatures.tmdb_id,
        changes: calculateParameterChanges(currentFormula.parameters, parameters),
        description: `Taste profile updated after favoriting "${movieFeatures.title}"`,
      },
    ],
  };

  return evolvedFormula;
}

/**
 * Generate LaTeX representation of formula
 */
export function generateFormulaLaTeX(parameters: FormulaParameters): string {
  const terms: string[] = [];

  // Baseline term
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

/**
 * Calculate parameter changes between two formula versions
 */
export function calculateParameterChanges(
  oldParams: FormulaParameters,
  newParams: FormulaParameters
): ParameterChange[] {
  const changes: ParameterChange[] = [];

  // Check all parameters
  const allKeys = new Set([
    ...Object.keys(oldParams),
    ...Object.keys(newParams)
  ].filter(key => key !== 'keyword_weights'));

  allKeys.forEach(key => {
    const paramKey = key as Exclude<keyof FormulaParameters, 'keyword_weights'>;
    const oldValue = oldParams[paramKey];
    const newValue = newParams[paramKey];

    if (Math.abs(oldValue - newValue) > 0.001) {
      changes.push({
        parameter: paramKey,
        old_value: oldValue,
        new_value: newValue,
        delta: newValue - oldValue,
        reason: 'Bayesian update from user feedback'
      });
    }
  });

  // Check keyword weights separately
  const oldKeywords = oldParams.keyword_weights || {};
  const newKeywords = newParams.keyword_weights || {};
  const allKeywordKeys = new Set([...Object.keys(oldKeywords), ...Object.keys(newKeywords)]);

  allKeywordKeys.forEach(keyword => {
    const oldValue = oldKeywords[keyword] ?? 0;
    const newValue = newKeywords[keyword] ?? 0;

    if (Math.abs(oldValue - newValue) > 0.001) {
      changes.push({
        parameter: `keyword_${keyword}`,
        old_value: oldValue,
        new_value: newValue,
        delta: newValue - oldValue,
        reason: 'Bayesian update from user feedback'
      });
    }
  });

  return changes;
}

/**
 * Evolve formula based on detected patterns (e.g., user consistently likes certain combinations)
 */
export function evolveFormulaFromPatterns(
  currentFormula: UserFormula,
  recentRatings: Array<{ movieFeatures: MovieFeatures; rating: number }>,
  threshold = 0.3
): UserFormula {
  if (recentRatings.length < 3) return currentFormula; // Need minimum data

  const { parameters } = currentFormula;
  const newParameters = { ...parameters };

  // Detect patterns in highly rated movies
  const highRatedMovies = recentRatings.filter(item => item.rating >= 7);
  const lowRatedMovies = recentRatings.filter(item => item.rating <= 4);

  if (highRatedMovies.length === 0) return currentFormula;

  // Analyze genre preferences
  const genrePreferences: Record<string, number> = {};

  highRatedMovies.forEach(item => {
    item.movieFeatures.genres.forEach(genre => {
      genrePreferences[genre] = (genrePreferences[genre] || 0) + 1;
    });
  });

  // Adjust weights based on preferences
  Object.entries(genrePreferences).forEach(([genre, count]) => {
    const preferenceScore = count / highRatedMovies.length;
    if (preferenceScore > threshold) {
      const paramKey = `genre_${genre}` as keyof FormulaParameters;
      const weight = newParameters[paramKey];
      if (typeof weight === 'number') {
        // Increase weight for preferred genres
        Object.assign(newParameters, {
          [paramKey]: Math.max(-2, Math.min(2, weight + 0.2 * (preferenceScore - threshold)))
        });
      }
    }
  });

  // Analyze feature preferences
  const featurePreferences: Record<string, number> = {
    has_female_lead: 0,
    female_director: 0,
    complexity: 0,
    runtime_optimal: 0
  };

  highRatedMovies.forEach(item => {
    if (item.movieFeatures.has_female_lead) featurePreferences.has_female_lead++;
    if (item.movieFeatures.female_director) featurePreferences.female_director++;
    featurePreferences.complexity += item.movieFeatures.complexity / 10;
    if (item.movieFeatures.runtime_optimal)
      featurePreferences.runtime_optimal++;
  });

  Object.entries(featurePreferences).forEach(([feature, count]) => {
    const preferenceScore = count / highRatedMovies.length;
    const paramKey = feature as Exclude<keyof FormulaParameters, 'keyword_weights'>;
    const weight = newParameters[paramKey];
    if (typeof weight === 'number' && preferenceScore > threshold) {
      Object.assign(newParameters, {
        [paramKey]: Math.max(-2, Math.min(2, weight + 0.15 * (preferenceScore - threshold)))
      });
    }
  });

  // Detect new keyword patterns
  const keywordPreferences: Record<string, number> = {};
  highRatedMovies.forEach(item => {
    item.movieFeatures.keywords.forEach(keyword => {
      keywordPreferences[keyword] = (keywordPreferences[keyword] || 0) + 1;
    });
  });

  Object.entries(keywordPreferences).forEach(([keyword, count]) => {
    const preferenceScore = count / highRatedMovies.length;
    if (preferenceScore > threshold && preferenceScore > 0.5) { // Significant pattern
      // Add or increase keyword weight
      if (!newParameters.keyword_weights) newParameters.keyword_weights = {};
      newParameters.keyword_weights[keyword] = (newParameters.keyword_weights[keyword] || 0) + 0.3;
      newParameters.keyword_weights[keyword] = Math.max(-2, Math.min(2, newParameters.keyword_weights[keyword]));
    }
  });

  // Create evolved formula
  const evolvedFormula: UserFormula = {
    ...currentFormula,
    parameters: newParameters,
    formula_text: generateFormulaLaTeX(newParameters),
    version: currentFormula.version + 1,
    updated_at: new Date(),
    evolution_history: [
      ...(currentFormula.evolution_history || []),
      {
        timestamp: new Date(),
        trigger: 'rating',
        movie_tmdb_id: highRatedMovies[0]?.movieFeatures.tmdb_id,
        changes: calculateParameterChanges(parameters, newParameters),
        description: `Pattern-based evolution from ${recentRatings.length} recent ratings (${highRatedMovies.length} high-rated)`
      }
    ]
  };

  return evolvedFormula;
}

/**
 * Adjust formula parameters based on natural language prompt
 */
export function adjustFormulaFromPrompt(
  currentFormula: UserFormula,
  promptAnalysis: PromptAnalysis
): UserFormula {
  const { parameters } = currentFormula;
  const newParameters = { ...parameters };

  // Apply explicit parameter adjustments from prompt
  Object.entries(promptAnalysis.adjusted_parameters || {}).forEach(([paramKeyStr, value]) => {
    const paramKey = paramKeyStr as Exclude<keyof FormulaParameters, 'keyword_weights'>;
    if (typeof newParameters[paramKey] === 'number') {
      Object.assign(newParameters, {
        [paramKey]: Math.max(-2, Math.min(2, value))
      });
    }
  });

  // Create adjusted formula (temporary for this search)
  const adjustedFormula: UserFormula = {
    ...currentFormula,
    parameters: newParameters,
    formula_text: generateFormulaLaTeX(newParameters),
    version: currentFormula.version,  // Don't increment version for temporary adjustments
    updated_at: currentFormula.updated_at,
    evolution_history: [
      ...(currentFormula.evolution_history || []),
      {
        timestamp: new Date(),
        trigger: 'prompt',
        changes: calculateParameterChanges(parameters, newParameters),
        description: `Temporary adjustment based on prompt: "${promptAnalysis.explicit_constraints?.join(', ') || 'unknown'}"`
      }
    ]
  };

  return adjustedFormula;
}

/**
 * Initialize default formula for new user
 */
export function initializeDefaultFormula(userId: string): UserFormula {
  const defaultParameters: FormulaParameters = {
    // Genre weights - start neutral
    genre_action: 0.0,
    genre_adventure: 0.0,
    genre_comedy: 0.0,
    genre_drama: 0.0,
    genre_sci_fi: 0.0,
    genre_thriller: 0.0,
    genre_horror: 0.0,
    genre_romance: 0.0,
    genre_fantasy: 0.0,
    genre_animation: 0.0,
    genre_documentary: 0.0,
    genre_crime: 0.0,
    genre_mystery: 0.0,
    genre_history: 0.0,
    genre_war: 0.0,
    genre_western: 0.0,
    genre_music: 0.0,
    genre_family: 0.0,

    // Feature weights
    has_female_lead: 0.0,
    female_director: 0.0,
    complexity: 0.0,
    runtime_optimal: 0.0,
    rating_popularity: 0.5,  // Slight preference for popular/well-rated movies
    vote_count_weight: 0.3,  // Prefer movies with some votes
    release_year_recency: 0.2, // Slight preference for newer movies

    // Keyword weights (empty initially)
    keyword_weights: {},

    // Baseline
    baseline: 0.5
  };

  return {
    id: `${userId}-formula-${Date.now()}`,
    user_id: userId,
    formula_text: generateFormulaLaTeX(defaultParameters),
    parameters: defaultParameters,
    version: 1,
    created_at: new Date(),
    updated_at: new Date(),
    evolution_history: []
  };
}

// Type for parameter change
export interface ParameterChange {
  parameter: string;
  old_value: number;
  new_value: number;
  delta: number;
  reason: string;
}

export default {
  extractMovieFeatures,
  computeMovieScore,
  updateFormulaFromRating,
  updateFormulaFromFavorite,
  evolveFormulaFromPatterns,
  adjustFormulaFromPrompt,
  initializeDefaultFormula,
  generateFormulaLaTeX,
  calculateParameterChanges
};
