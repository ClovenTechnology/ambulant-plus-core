'use client';

import * as React from 'react';
import clsx from 'clsx';

export type CardProps = React.HTMLAttributes<HTMLDivElement>;

const Card = React.forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={clsx(
        // premium soft card
        'rounded-2xl border border-slate-200 bg-white shadow-sm',
        className
      )}
      {...props}
    />
  );
});

export default Card;
