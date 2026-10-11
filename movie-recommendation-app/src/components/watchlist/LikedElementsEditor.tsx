'use client';

import { useState } from 'react';
import type { LikedElement } from '@/types/db';

interface LikedElementsEditorProps {
  elements: LikedElement[];
  onChange: (elements: LikedElement[]) => void;
}

const LIKED_ELEMENT_TYPES = [
  { value: 'acting', label: 'Acting/Performance' },
  { value: 'direction', label: 'Direction' },
  { value: 'cinematography', label: 'Cinematography/Visuals' },
  { value: 'story', label: 'Story/Plot' },
  { value: 'music', label: 'Music/Soundtrack' },
  { value: 'vfx', label: 'Special Effects' },
  { value: 'dialogue', label: 'Dialogue/Writing' },
  { value: 'pacing', label: 'Pacing/Editing' },
  { value: 'character', label: 'Character Development' },
  { value: 'theme', label: 'Themes/Messages' },
  { value: 'other', label: 'Other' }
];

export default function LikedElementsEditor({
  elements,
  onChange
}: LikedElementsEditorProps) {
  const [newElementType, setNewElementType] = useState(LIKED_ELEMENT_TYPES[0].value);
  const [newElementDescription, setNewElementDescription] = useState('');
  const [newElementSentiment, setNewElementSentiment] = useState<'positive' | 'negative'>('positive');

  const handleAddElement = () => {
    if (!newElementDescription.trim()) return;

    const newElement: LikedElement = {
      type: newElementType as LikedElement['type'],
      description: newElementDescription.trim(),
      sentiment: newElementSentiment
    };

    onChange([...elements, newElement]);
    setNewElementDescription('');
  };

  const handleRemoveElement = (index: number) => {
    const newElements = [...elements];
    newElements.splice(index, 1);
    onChange(newElements);
  };

  const handleUpdateElement = (index: number, updatedElement: LikedElement) => {
    const newElements = [...elements];
    newElements[index] = updatedElement;
    onChange(newElements);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col space-y-2">
        <label className="text-xs font-medium mb-1">Add a note about this movie:</label>
        <div className="flex flex-wrap gap-2">
          <select
            value={newElementType}
            onChange={(e) => setNewElementType(e.target.value as LikedElement['type'])}
            className="flex-1 min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {LIKED_ELEMENT_TYPES.map(type => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={newElementDescription}
            onChange={(e) => setNewElementDescription(e.target.value)}
            placeholder="Describe what you liked..."
            className="flex-1 min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
          <div className="flex shrink-0 rounded-md border border-input p-1" role="group" aria-label="Like or dislike">
            <button
              type="button"
              aria-pressed={newElementSentiment === 'positive'}
              onClick={() => setNewElementSentiment('positive')}
              className={`rounded px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${newElementSentiment === 'positive' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
            >
              👍 Like
            </button>
            <button
              type="button"
              aria-pressed={newElementSentiment === 'negative'}
              onClick={() => setNewElementSentiment('negative')}
              className={`rounded px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${newElementSentiment === 'negative' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
            >
              👎 Dislike
            </button>
          </div>
          <button
            onClick={handleAddElement}
            disabled={!newElementDescription.trim()}
            className="btn btn-primary px-3"
          >
            Add
          </button>
        </div>
      </div>

      {elements.length > 0 && (
        <div className="border-t border-border pt-4">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Likes & dislikes</h3>
            <button
              onClick={() => onChange([])}
              className="btn btn-outline btn-sm text-destructive/60 hover:text-destructive"
            >
              Clear All
            </button>
          </div>
          <div className="space-y-2">
            {elements.map((element, index) => (
              <div
                key={index}
                className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
              >
                <div className="flex-shrink-0">
                  <div className="flex items-center gap-1 text-xs">
                    <span className="font-medium">
                      {LIKED_ELEMENT_TYPES.find(t => t.value === element.type)?.label || element.type}
                    </span>
                    {element.sentiment !== 'neutral' && (
                      <span className="text-muted-foreground">
                        {element.sentiment === 'positive' ? '👍 Like' : '👎 Dislike'}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-sm">{element.description}</p>
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={() => {
                        const prompt = `Update "${element.description}" to be more positive/negative/stronger/weaker`;
                        // In a full implementation, this would open a modal to edit
                        alert('Editing would open a modal in full implementation');
                      }}
                      className="btn btn-ghost btn-xs text-muted-foreground hover:text-gray-600"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleRemoveElement(index)}
                      className="btn btn-ghost btn-xs text-destructive/60 hover:text-destructive"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}