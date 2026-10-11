import { NextRequest, NextResponse } from 'next/server';
import { DBService } from '../../../lib/storage';
import type { UserFormula, FormulaParameters } from '../../../types/formula';

/**
 * Formula API Routes
 * GET /api/formula - Get user's current formula
 * POST /api/formula - Update formula parameters
 * POST /api/formula/evolve - Trigger formula evolution based on new ratings
 */

interface FormulaResponse {
  formula: UserFormula;
}

export async function GET(request: NextRequest) {
  try {
    const formula = DBService.getFormula();

    if (!formula) {
      return NextResponse.json(
        { error: 'Formula not found', message: 'No formula found for user. Creating default.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: formula,
      message: 'Formula retrieved successfully'
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to retrieve formula', message: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { parameters, baseline, genre_weights, keyword_weights, reset } = body;

    // Get current formula
    const currentFormula = DBService.getFormula();
    if (!currentFormula) {
      return NextResponse.json(
        { error: 'Formula not found', message: 'Could not retrieve current formula' },
        { status: 404 }
      );
    }

    let newFormula = { ...currentFormula };

    if (reset) {
      // Reset to defaults
      const defaultParams = createDefaultParameters();
      newFormula = {
        ...currentFormula,
        parameters: defaultParams,
        formula_text: generateFormulaLaTeX(defaultParams),
        version: currentFormula.version + 1,
        updated_at: new Date()
      };
    } else {
      // Update specific parameters
      const updatedParams = { ...currentFormula.parameters };

      // Handle genre weight updates
      if (genre_weights) {
        Object.entries(genre_weights).forEach(([genre, weight]) => {
          const key = `genre_${genre}`;
          if (isNumericFormulaParameter(key)) {
            updatedParams[key] = Number(weight);
          }
        });
      }

      // Handle keyword weight updates
      if (keyword_weights) {
        updatedParams.keyword_weights = {
          ...(updatedParams.keyword_weights || {}),
          ...keyword_weights
        };
      }

      // Handle individual parameter updates
      if (parameters) {
        Object.entries(parameters).forEach(([key, value]) => {
          if (isNumericFormulaParameter(key)) {
            const paramKey = key;
            updatedParams[paramKey] = Number(value);
          }
        });
      }

      // Handle baseline update
      if (baseline !== undefined) {
        updatedParams.baseline = Number(baseline);
      }

      newFormula = {
        ...currentFormula,
        parameters: updatedParams,
        formula_text: generateFormulaLaTeX(updatedParams),
        version: currentFormula.version + 1,
        updated_at: new Date()
      };
    }

    // Save formula
    DBService.saveFormula(newFormula);

    return NextResponse.json({
      data: newFormula,
      message: 'Formula updated successfully'
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update formula', message: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * Create default formula parameters
 */
function createDefaultParameters(): FormulaParameters {
  return {
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
    has_female_lead: 0.0,
    female_director: 0.0,
    complexity: 0.0,
    runtime_optimal: 0.0,
    rating_popularity: 0.5,
    vote_count_weight: 0.3,
    release_year_recency: 0.2,
    keyword_weights: {},
    baseline: 0.5
  };
}

function isNumericFormulaParameter(
  key: string
): key is Exclude<keyof FormulaParameters, 'keyword_weights'> {
  return typeof createDefaultParameters()[key as keyof FormulaParameters] === 'number';
}

/**
 * Generate LaTeX representation of formula
 */
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

  // Keyword terms
  Object.entries(parameters.keyword_weights || {}).forEach(([keyword, weight]) => {
    if (Math.abs(weight) > 0.01) {
      terms.push(`${weight.toFixed(3)} \\cdot \\mathbf{1}_{${keyword}}`);
    }
  });

  return `Score = ${terms.length > 0 ? terms.join(' + ') : '0'}`;
}
