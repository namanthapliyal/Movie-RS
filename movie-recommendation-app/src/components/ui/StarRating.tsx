'use client';

import { useState } from 'react';

interface StarRatingProps {
  rating: number;
  onRatingChange?: (rating: number) => void;
  readOnly?: boolean;
  children?: React.ReactNode;
}

export default function StarRating({
  rating,
  onRatingChange,
  readOnly = false,
  children
}: StarRatingProps) {
  const [hoverRating, setHoverRating] = useState(0);
  const displayRating = readOnly ? rating : hoverRating || rating;

  const handleRatingClick = (newRating: number) => {
    if (!readOnly && onRatingChange) {
      onRatingChange(newRating);
    }
  };

  const handleRatingHover = (newRating: number) => {
    if (!readOnly) {
      setHoverRating(newRating);
    }
  };

  const handleRatingLeave = () => {
    if (!readOnly) {
      setHoverRating(0);
    }
  };

  return (
    <div
      className="star-rating grid w-fit max-w-full grid-cols-5 gap-1 sm:grid-cols-10"
      role="group"
      aria-label="Rate this movie out of 10"
      onMouseLeave={handleRatingLeave}
    >
      {readOnly && children ? children : (
        <>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((starNum) => (
            <button
              type="button"
              key={starNum}
              onClick={() => handleRatingClick(starNum)}
              onMouseEnter={() => handleRatingHover(starNum)}
              aria-label={`Rate ${starNum} out of 10`}
              aria-pressed={rating === starNum}
              disabled={readOnly}
              className={`star cursor-pointer border-0 bg-transparent p-0 leading-none transition-colors duration-200 ${
                displayRating >= starNum ? 'star-filled' : 'star-empty'
              }`}
            >
              ★
            </button>
          ))}
          {!readOnly && children && <span>{children}</span>}
        </>
      )}
    </div>
  );
}