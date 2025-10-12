'use client';
import React from 'react';

type Props = {
  title: React.ReactNode;
  children: React.ReactNode;
  toolbar?: React.ReactNode;
  className?: string;
  dense?: boolean;
  gradient?: boolean;
};
export function Card({ title, children, toolbar, className, dense, gradient }: Props) {
  return (
    <section className={`border rounded bg-white ${className || ''}`}>
      <div className={`flex items-center justify-between ${dense ? 'px-2 py-1.5' : 'px-3 py-2'} border-b ${gradient ? 'bg-gradient-to-b from-gray-50 to-white' : 'bg-gray-50'} rounded-t min-h-[42px]`}>
        <div className="text-sm font-medium">{title}</div>
        {toolbar ? <div>{toolbar}</div> : null}
      </div>
      <div className={`${dense ? 'p-2 space-y-1.5' : 'p-3 space-y-2'}`}>{children}</div>
    </section>
  );
}
