'use client';

import * as React from 'react';

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement>;

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { className, ...props },
  ref
) {
  return (
    <span
      ref={ref}
      className={cx(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
        className
      )}
      {...props}
    />
  );
});

export default Badge;