'use client';

import { useEffect, useState } from 'react';
import type { UserFormula, FormulaParameters } from '@/types/formula';
import { DBService } from '@/lib/storage';

interface FormulaVisualizerProps {
  formula: UserFormula | null;
  onUpdate?: () => void;
}

export default function FormulaVisualizer({
  formula,
  onUpdate
}: FormulaVisualizerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [parameters, setParameters] = useState<FormulaParameters>(createDefaultParameters);

  // Initialize parameters from formula
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (formula) {
      setParameters({ ...formula.parameters });
    }
  }, [formula]);

  const handleResetToDefaults = () => {
    const defaultParams = createDefaultParameters();
    setParameters(defaultParams);
    saveFormula();
  };

  const handleSaveFormula = () => {
    saveFormula();
    setIsEditing(false);
    if (onUpdate) onUpdate();
  };

  const saveFormula = () => {
    DBService.saveFormula({
      ...formula!,
      parameters,
      formula_text: generateFormulaLaTeX(parameters),
      version: formula!.version + 1,
      updated_at: new Date()
    });
  };

  const handleParameterChange = (param: keyof FormulaParameters, value: number) => {
    setParameters(prev => ({
      ...prev,
      [param]: value
    }));
  };

  const handleKeywordChange = (keyword: string, value: number) => {
    setParameters(prev => ({
      ...prev,
      keyword_weights: {
        ...prev.keyword_weights,
        [keyword]: value
      }
    }));
  };

  if (!formula) {
    return (
      <div className="card p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          Your Taste Formula
        </h2>
        <div className="empty-state py-8">
          <div className="flex items-center justify-center mb-4">
            <svg className="h-10 w-10 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path className="stroke-2" strokeLinecap="round" strokeLinejoin="round" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12 12c-4.416 0-8 3.584-8 8s3.584 8 8 8 8-3.584 8-8-3.584-8-8-8z"></path>
            </svg>
          </div>
          <p className="text-center text-muted-foreground">
            Add and rate movies to build your personalized taste formula
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-6">
      <div className="flex justify-between items-start mb-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          Your Taste Formula
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Version {formula.version} • Updated {new Date(formula.updated_at).toLocaleDateString()}
          </span>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="btn btn-outline btn-sm"
            >
              Edit Formula
            </button>
          )}
        </div>
      </div>

      {isEditing ? (
        <FormulaEditor
          formula={formula}
          parameters={parameters}
          onParameterChange={handleParameterChange}
          onKeywordChange={handleKeywordChange}
          onSave={handleSaveFormula}
          onCancel={() => setIsEditing(false)}
          onReset={handleResetToDefaults}
        />
      ) : (
        <FormulaDisplay
          formula={formula}
          onEdit={() => setIsEditing(true)}
        />
      )}
    </div>
  );
}

// --- Default Parameters ---
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

// --- Formula Display ---
function FormulaDisplay({
  formula,
  onEdit
}: {
  formula: UserFormula;
  onEdit: () => void;
}) {
  const features: Array<{
    key: Exclude<keyof FormulaParameters, 'keyword_weights'>;
    label: string;
  }> = [
    { key: 'has_female_lead', label: 'Female Lead' },
    { key: 'female_director', label: 'Female Director' },
    { key: 'complexity', label: 'Complexity' },
    { key: 'runtime_optimal', label: 'Optimal Runtime' },
    { key: 'rating_popularity', label: 'Rating Popularity' },
    { key: 'vote_count_weight', label: 'Vote Count' },
    { key: 'release_year_recency', label: 'Release Recency' }
  ];

  return (
    <div className="space-y-4">
      <div className="formula-container space-y-3">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">How your score is calculated</h3>
        <p className="text-sm text-muted-foreground">
          Each factor adds to or subtracts from a movie’s personalized score. Larger weights have more influence.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <FormulaFactor label="Starting score" weight={formula.parameters.baseline} />
          {features
            .filter(feature => Math.abs(formula.parameters[feature.key]) > 0.001)
            .map(feature => (
              <FormulaFactor
                key={feature.key}
                label={feature.label}
                weight={formula.parameters[feature.key]}
              />
            ))}
          {Object.entries(formula.parameters)
            .filter(([key, weight]) => key.startsWith('genre_') && Math.abs(weight) > 0.001)
            .map(([key, weight]) => (
              <FormulaFactor key={key} label={`${key.slice(6)} genre`} weight={weight} />
            ))}
          {Object.entries(formula.parameters.keyword_weights || {})
            .filter(([, weight]) => Math.abs(weight) > 0.001)
            .map(([keyword, weight]) => (
              <FormulaFactor key={keyword} label={`“${keyword}” keyword`} weight={weight} />
            ))}
        </div>
      </div>

      {/* Parameter Summary */}
      <div className="space-y-3">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
          Parameter Summary
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {/* Genre Preferences */}
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground mb-1">
              Genre Preferences
            </h4>
            <div className="flex flex-wrap gap-1">
              {Object.entries(formula.parameters)
                .filter(([key, value]) => key.startsWith('genre_') && Math.abs(value) > 0.1)
                .map(([genre, weight]) => (
                  <span
                    key={genre}
                    className={`px-2 py-0.5 rounded text-xs ${
                      weight > 0 ? 'bg-green-50 text-green-700 border border-green-200' :
                      weight < 0 ? 'bg-red-50 text-red-700 border border-red-200' :
                      'bg-muted/50 text-muted-foreground'
                    }`}
                  >
                    {genre.replace('genre_', '')}: {weight.toFixed(2)}
                  </span>
                ))}
            </div>
          </div>

          {/* Feature Weights */}
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground mb-1">
              Feature Preferences
            </h4>
            <div className="flex flex-wrap gap-1">
              {features.map(feature => {
                const value = formula.parameters[feature.key];
                if (Math.abs(value) > 0.1) {
                  return (
                    <span
                      key={feature.key}
                      className={`px-2 py-0.5 rounded text-xs ${
                        value > 0 ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                        value < 0 ? 'bg-red-50 text-red-700 border border-red-200' :
                        'bg-muted/50 text-muted-foreground'
                      }`}
                    >
                      {feature.label}: {value.toFixed(2)}
                    </span>
                  );
                }

                function FormulaFactor({ label, weight }: { label: string; weight: number }) {
                  return (
                    <div className="rounded-md border border-border bg-background/50 p-3">
                      <p className="text-sm font-medium">{label}</p>
                      <p className={`mt-1 text-sm font-mono ${weight < 0 ? 'text-red-600' : 'text-green-700'}`}>
                        {weight > 0 ? '+' : ''}{weight.toFixed(3)} weight
                      </p>
                    </div>
                  );
                }
                return null;
              }).filter(Boolean)}
            </div>
          </div>

          {/* Top Keywords */}
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground mb-1">
              Keyword Preferences
            </h4>
            <div className="flex flex-wrap gap-1">
              {Object.entries(formula.parameters.keyword_weights || {})
                .filter(([_, weight]) => Math.abs(weight) > 0.1)
                .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a))
                .slice(0, 6)
                .map(([keyword, weight]) => (
                  <span
                    key={keyword}
                    className={`px-2 py-0.5 rounded text-xs ${
                      weight > 0 ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                      weight < 0 ? 'bg-pink-50 text-pink-700 border border-pink-200' :
                      'bg-muted/50 text-muted-foreground'
                    }`}
                  >
                    {keyword}: {weight.toFixed(2)}
                  </span>
                ))}
            </div>
          </div>
        </div>
      </div>

      {/* Evolution History */}
      {formula.evolution_history && formula.evolution_history.length > 0 && (
        <div className="border-t border-border pt-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-3">
            Formula Evolution
          </h3>
          <div className="space-y-2">
            {formula.evolution_history.slice(-3).reverse().map((step, index) => (
              <div
                key={index}
                className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/50"
              >
                <div className="flex-shrink-0 text-xs">
                  <span className="text-muted-foreground">
                    {new Date(step.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-sm">{step.description}</p>
                  {step.changes.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {step.changes.map(change => (
                        <span
                          key={change.parameter}
                          className={`px-1 py-0 rounded text-xs ${
                            change.delta > 0 ? 'bg-green-50 text-green-700' :
                            change.delta < 0 ? 'bg-red-50 text-red-700' :
                            'bg-muted/50 text-muted-foreground'
                          }`}
                        >
                          {change.parameter}: {change.delta.toFixed(2)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FormulaFactor({ label, weight }: { label: string; weight: number }) {
  return (
    <div className="rounded-md border border-border bg-background/50 p-3">
      <p className="text-sm font-medium">{label}</p>
      <p className={`mt-1 text-sm font-mono ${weight < 0 ? 'text-red-600' : 'text-green-700'}`}>
        {weight > 0 ? '+' : ''}{weight.toFixed(3)} weight
      </p>
    </div>
  );
}

// --- Formula Editor ---
function FormulaEditor({
  formula,
  parameters,
  onParameterChange,
  onKeywordChange,
  onSave,
  onCancel,
  onReset
}: {
  formula: UserFormula;
  parameters: FormulaParameters;
  onParameterChange: (param: keyof FormulaParameters, value: number) => void;
  onKeywordChange: (keyword: string, value: number) => void;
  onSave: () => void;
  onCancel: () => void;
  onReset: () => void;
}) {
  const [sliderValues, setSliderValues] = useState<Record<string, number>>({});

  // Initialize slider values
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const initialValues: Record<string, number> = {};
    Object.keys(parameters).forEach(key => {
      const value = parameters[key as keyof FormulaParameters];
      if (typeof value === 'number') {
        initialValues[key] = value;
      }
    });
    setSliderValues(initialValues);
  }, [parameters]);

  const handleSliderChange = (param: string, value: number) => {
    setSliderValues(prev => ({ ...prev, [param]: value }));
    onParameterChange(param as keyof FormulaParameters, value);
  };

  const handleKeywordChange = (keyword: string, weight: number) => {
    setSliderValues(prev => ({ ...prev, [`keyword_${keyword}`]: weight }));
    onKeywordChange(keyword, weight);
  };

  return (
    <div className="space-y-4">
      <div className="formula-container mb-4">
        <h3 className="font-medium">Adjust recommendation factors</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Positive weights favor a factor, negative weights reduce its influence, and zero leaves it neutral.
          Your updated factor weights are shown on the Taste Formula page after saving.
        </p>
      </div>

      {/* Tabs for different parameter groups */}
      <div className="tabs-list">
        <button
          onClick={() => {/* Set active tab to genres */}}
          className="tab-trigger"
          aria-selected="true"
        >
          Genres
        </button>
        <button
          onClick={() => {/* Set active tab to features */}}
          className="tab-trigger"
          aria-selected="false"
        >
          Features
        </button>
        <button
          onClick={() => {/* Set active tab to keywords */}}
          className="tab-trigger"
          aria-selected="false"
        >
          Keywords
        </button>
      </div>

      {/* Genre Controls */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-3">
          Genre Preferences
        </h3>
        <div className="space-y-2">
          {([
            'action', 'adventure', 'comedy', 'drama', 'sci_fi', 'thriller',
            'horror', 'romance', 'fantasy', 'animation', 'documentary',
            'crime', 'mystery', 'history', 'war', 'western', 'music', 'family'
          ] as const).map(genre => (
            <div
              key={genre}
              className="flex items-start gap-3 p-3 rounded-lg border border-border"
            >
              <div className="flex-shrink-0 w-20">
                <span className="font-medium text-xs">{genre}</span>
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm">Weight:</span>
                  <input
                    type="range"
                    min="-2"
                    max="2"
                    step="0.1"
                    value={sliderValues[`genre_${genre}`] ?? parameters[`genre_${genre}` as keyof FormulaParameters] as number}
                    onChange={(e) => handleSliderChange(`genre_${genre}`, Number(e.target.value))}
                    className="w-full"
                  />
                  <span className="text-xs ml-1">
                    {(sliderValues[`genre_${genre}`] ?? parameters[`genre_${genre}` as keyof FormulaParameters] as number).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Feature Controls */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-3">
          Feature Preferences
        </h3>
        <div className="space-y-2">
          {[
            { key: 'has_female_lead', label: 'Female Lead' },
            { key: 'female_director', label: 'Female Director' },
            { key: 'complexity', label: 'Complexity' },
            { key: 'runtime_optimal', label: 'Optimal Runtime (90-150 min)' },
            { key: 'rating_popularity', label: 'Rating Popularity' },
            { key: 'vote_count_weight', label: 'Vote Count Weight' },
            { key: 'release_year_recency', label: 'Release Year Recency' }
          ].map(feature => (
            <div
              key={feature.key}
              className="flex items-start gap-3 p-3 rounded-lg border border-border"
            >
              <div className="flex-shrink-0 w-20">
                <span className="font-medium text-xs">{feature.label}</span>
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm">Weight:</span>
                  <input
                    type="range"
                    min="-2"
                    max="2"
                    step="0.1"
                    value={sliderValues[feature.key] ?? parameters[feature.key as keyof FormulaParameters] ?? 0}
                    onChange={(e) => handleSliderChange(feature.key, Number(e.target.value))}
                    className="w-full"
                  />
                  <span className="text-xs ml-1">
                    {(sliderValues[feature.key] ?? parameters[feature.key as keyof FormulaParameters] ?? 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Keyword Controls */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-3">
          Keyword Preferences
        </h3>
        <div className="space-y-2">
          <div className="flex items-start gap-3 mb-3">
            <input
              type="text"
              placeholder="Enter keyword..."
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
            <button
              onClick={() => {
                // In a full implementation, this would add a new keyword slider
                alert('Adding keyword sliders would be implemented in full version');
              }}
              className="btn btn-outline btn-sm"
            >
              Add Keyword
            </button>
          </div>
          {Object.entries(parameters.keyword_weights || {}).map(([keyword, weight]) => (
            <div
              key={keyword}
              className="flex items-start gap-3 p-3 rounded-lg border border-border"
            >
              <div className="flex-shrink-0 w-20">
                <span className="font-medium text-xs">{keyword}</span>
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm">Weight:</span>
                  <input
                    type="range"
                    min="-2"
                    max="2"
                    step="0.1"
                    value={sliderValues[`keyword_${keyword}`] ?? weight}
                    onChange={(e) => handleKeywordChange(keyword, Number(e.target.value))}
                    className="w-full"
                  />
                  <span className="text-xs ml-1">
                    {(sliderValues[`keyword_${keyword}`] ?? weight).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Baseline Control */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-3">
          Baseline Score
        </h3>
        <div className="flex items-start gap-3 p-3 rounded-lg border border-border">
          <div className="flex-shrink-0 w-20">
            <span className="font-medium text-xs">Baseline</span>
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm">Weight:</span>
              <input
                type="range"
                min="-5"
                max="5"
                step="0.1"
                value={sliderValues.baseline ?? parameters.baseline}
                onChange={(e) => handleSliderChange('baseline', Number(e.target.value))}
                className="w-full"
              />
              <span className="text-xs ml-1">
                {(sliderValues.baseline ?? parameters.baseline).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-3 mt-6">
        <button
          onClick={onCancel}
          className="btn btn-outline"
        >
          Cancel
        </button>
        <button
          onClick={onReset}
          className="btn btn-outline"
        >
          Reset to Defaults
        </button>
        <button
          onClick={onSave}
          className="btn btn-primary"
        >
          Save Formula
        </button>
      </div>
    </div>
  );
}

// --- Helper: Generate LaTeX ---
function generateFormulaLaTeX(params: FormulaParameters): string {
  const terms: string[] = [];

  if (params.baseline !== 0) {
    terms.push(`${params.baseline.toFixed(3)}`);
  }

  // Genre terms
  Object.entries(params).forEach(([key, value]) => {
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
    const value = params[feature as Exclude<keyof FormulaParameters, 'keyword_weights'>];
    if (Math.abs(value) > 0.01) {
      terms.push(`${value.toFixed(3)} \\cdot ${latex}`);
    }
  });

  // Keyword terms
  Object.entries(params.keyword_weights || {}).forEach(([keyword, weight]) => {
    if (Math.abs(weight) > 0.01) {
      terms.push(`${weight.toFixed(3)} \\cdot \\mathbf{1}_{${keyword}}`);
    }
  });

  return terms.length > 0 ? terms.join(' + ') : '0';
}
