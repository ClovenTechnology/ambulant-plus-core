'use client';

import React from 'react';

interface SuggestionChipsProps {
  suggestions: string[];
}

export default function SuggestionChips({ suggestions }: SuggestionChipsProps) {
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {suggestions.map((s, idx) => (
        <button
          key={idx}
          className="px-3 py-1 rounded-full bg-indigo-100 text-indigo-800 text-sm hover:bg-indigo-200 transition-colors shadow-sm"
          onClick={() => alert(`Action: ${s}`)} // replace with real navigation or action
        >
          {s}
        </button>
      ))}
    </div>
  );
}
