// apps/clinician-app/components/ui/Card.tsx
'use client';
import React from 'react';

type CardProps = {
  title?: React.ReactNode;
  children: React.ReactNode;
  toolbar?: React.ReactNode;
  className?: string;
  dense?: boolean;
  gradient?: boolean;
};

export function Card({ title, children, toolbar, className, dense, gradient }: CardProps) {
  return (
    <section className={`border rounded bg-white ${className || ''}`}>
      {title && (
        <div
          className={`flex items-center justify-between ${
            dense ? 'px-2 py-1.5' : 'px-3 py-2'
          } border-b ${
            gradient ? 'bg-gradient-to-b from-gray-50 to-white' : 'bg-gray-50'
          } rounded-t min-h-[42px]`}
        >
          <div className="text-sm font-medium">{title}</div>
          {toolbar ? <div>{toolbar}</div> : null}
        </div>
      )}

      {children}
    </section>
  );
}

export function CardContent({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`p-3 ${className}`}>{children}</div>;
}
