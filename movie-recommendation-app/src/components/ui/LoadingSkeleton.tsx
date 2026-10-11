'use client';

import { useEffect, useState } from 'react';

interface LoadingSkeletonProps {
  width?: string | number;
  height?: string | number;
  count?: number;
  className?: string;
}

export default function LoadingSkeleton({
  width = '100%',
  height = '1rem',
  count = 1,
  className = ''
}: LoadingSkeletonProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <div className={`animate-pulse bg-muted rounded ${className}`} style={{ width, height }} />
  );
}

export function LoadingSkeletonText({
  width = '100%',
  height = '1rem',
  count = 3,
  className = ''
}: { width?: string | number; height?: string | number; count?: number; className?: string }) {
  return (
    <div className={className}>
      {Array.from({ length: count }).map((_, i) => (
        <LoadingSkeleton
          key={i}
          width={width}
          height={height}
        />
      ))}
    </div>
  );
}

export function LoadingSkeletonAvatar({
  size = '8',
  className = ''
}: { size?: string | number; className?: string }) {
  return (
    <LoadingSkeleton
      width={Array.isArray(size) ? size[0] : size}
      height={Array.isArray(size) ? size[1] : size}
      className={`rounded-full ${className}`}
    />
  );
}

export function LoadingSkeletonCircle({
  size = '2rem',
  className = ''
}: { size?: string | number; className?: string }) {
  return (
    <LoadingSkeleton
      width={size}
      height={size}
      className={`rounded-full ${className}`}
    />
  );
}