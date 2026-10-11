'use client';

import { useState } from 'react';
import { appLogger } from '@/lib/logger';

interface PromptInputProps {
  onSearch: (prompt: string) => Promise<void>;
  placeholder?: string;
  disabled?: boolean;
}

export default function PromptInput({
  onSearch,
  placeholder = 'Describe what kind of movie you\'re in the mood for...',
  disabled = false
}: PromptInputProps) {
  const [prompt, setPrompt] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isSearching) return;

    setIsSearching(true);
    try {
      await onSearch(prompt);
    } catch (error) {
      appLogger.error('Recommendation prompt search failed.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPrompt(value);
    // Update suggestions based on input
    setSuggestions(generateSuggestions(value));
  };

  const handleSuggestionClick = (suggestion: string) => {
    setPrompt(suggestion);
    setSuggestions([]);
  };

  const handleClear = () => {
    setPrompt('');
    setSuggestions([]);
  };

  const generateSuggestions = (input: string): string[] => {
    if (!input || input.length < 2) return [];

    const lowerInput = input.toLowerCase();
    const baseSuggestions = [
      "I want a mind-bending sci-fi movie",
      "Show me comedies with great dialogue",
      "I'm in the mood for a thrilling mystery",
      "Give me emotional dramas with strong characters",
      "I want to watch something visually stunning",
      "Show me movies with great cinematography",
      "I'm looking for a movie with a strong female lead",
      "Give me something uplifting and hopeful",
      "I want a classic film from the golden age",
      "Show me movies with incredible soundtracks"
    ];

    return baseSuggestions
      .filter(suggestion => suggestion.toLowerCase().includes(lowerInput))
      .slice(0, 5);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
          What kind of movie are you in the mood for?
        </h3>
        {prompt && !isSearching && (
          <button
            onClick={handleClear}
            className="btn btn-ghost btn-xs text-muted-foreground hover:text-gray-600"
          >
            Clear
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={prompt}
          onChange={handleInputChange}
          placeholder={placeholder}
          disabled={disabled || isSearching}
          className="flex-1 prompt-input"
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={!prompt.trim() || isSearching || disabled}
          className="btn btn-primary px-4"
        >
          {isSearching ? 'Searching...' : 'Get Recommendations'}
        </button>
      </form>

      {suggestions.length > 0 && !isSearching && prompt.length > 0 && (
        <div className="mt-2">
          <p className="text-xs font-medium text-muted-foreground mb-1">
            Suggestions:
          </p>
          <div className="flex flex-wrap gap-1">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => handleSuggestionClick(suggestion)}
                className="btn btn-outline btn-xs text-xs p-1 hover:bg-primary/10"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {isSearching && (
        <div className="flex items-center justify-center py-3">
          <div className="h-4 w-4 rounded border border-primary/50 animate-spin" />
          <span className="ml-2 text-sm text-muted-foreground">Generating recommendations...</span>
        </div>
      )}
    </div>
  );
}