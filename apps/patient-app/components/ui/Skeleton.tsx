'use client';

import * as React from 'react';
import clsx from 'clsx';

export default function Skeleton(props: { className?: string }) {
  return (
    <div
      className={clsx(
        'animate-pulse rounded-xl bg-slate-200/70',
        props.className
      )}
    />
  );
}
