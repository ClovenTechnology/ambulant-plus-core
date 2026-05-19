'use client';

import * as React from 'react';

export interface SuggestionChipItem {
  id?: string;
  label: string;
  disabled?: boolean;
}

export interface SuggestionChipsProps {
  suggestions: Array<string | SuggestionChipItem>;
  onSelect?: (suggestion: string) => void;
  className?: string;
}

function normalizeSuggestion(suggestion: string | SuggestionChipItem): SuggestionChipItem {
  if (typeof suggestion === 'string') {
    return {
      id: suggestion,
      label: suggestion,
    };
  }

  return {
    id: suggestion.id ?? suggestion.label,
    label: suggestion.label,
    disabled: suggestion.disabled,
  };
}

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

export default function SuggestionChips({
  suggestions,
  onSelect,
  className,
}: SuggestionChipsProps) {
  if (!suggestions.length) return null;

  return (
    <div className={cx('mb-4 flex flex-wrap gap-2', className)}>
      {suggestions.map((suggestion) => {
        const item = normalizeSuggestion(suggestion);

        return (
          <button
            key={item.id}
            type="button"
            disabled={item.disabled}
            onClick={() => onSelect?.(item.label)}
            className={cx(
              'rounded-full bg-indigo-100 px-3 py-1 text-sm text-indigo-800 shadow-sm transition-colors',
              item.disabled
                ? 'cursor-not-allowed opacity-50'
                : 'hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:ring-offset-2'
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}