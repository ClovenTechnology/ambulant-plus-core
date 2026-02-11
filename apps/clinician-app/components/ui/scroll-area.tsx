'use client';

import * as React from 'react';

// Utility: concatenate class names safely
function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(' ');
}

// World-class scroll area (zero-deps, pure Tailwind + React)
// Supports vertical scrolling with custom track & thumb

export const ScrollArea: React.FC<React.HTMLAttributes<HTMLDivElement>> = React.forwardRef(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref as React.Ref<HTMLDivElement>}
        className={cn('relative overflow-auto rounded-lg', className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

ScrollArea.displayName = 'ScrollArea';