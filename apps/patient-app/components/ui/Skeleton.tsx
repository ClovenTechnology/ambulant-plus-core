'use client';

import * as React from 'react';

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

export default function Skeleton(props: { className?: string }) {
  return (
    <div
      className={cx(
        'animate-pulse rounded-xl bg-slate-200/70',
        props.className
      )}
    />
  );
}