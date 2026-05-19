'use client';

import * as React from 'react';

export type CardProps = React.HTMLAttributes<HTMLDivElement>;

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={cx(
        'rounded-2xl border border-slate-200 bg-white shadow-sm',
        className
      )}
      {...props}
    />
  );
});

export default Card;