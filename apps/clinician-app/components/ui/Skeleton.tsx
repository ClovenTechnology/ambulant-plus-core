import React from 'react';

export function Skeleton({ height = 'h-32', className }: { height?: string; className?: string }) {
  return (
    <div
      className={`w-full ${height} rounded-md bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 animate-pulse motion-reduce:animate-none ${className || ''}`}
    />
  );
}
