// components/Section.tsx
'use client';

import React, { useState } from 'react';
import { Collapse } from './Collapse';
import { CollapseBtn } from './CollapseBtn';

type Props = {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children?: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
};

export default function Section({ title, subtitle, defaultOpen = true, children, className = '', actions }: Props) {
  const [open, setOpen] = useState<boolean>(defaultOpen);
  return (
    <div className={`border rounded bg-white p-4 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium">{title}</div>
          {subtitle && <div className="text-xs text-gray-500">{subtitle}</div>}
        </div>

        <div className="flex items-center gap-2">
          {actions}
          <CollapseBtn open={open} onClick={() => setOpen(s => !s)} />
        </div>
      </div>

      <Collapse open={open}>
        <div className="mt-3">
          {children}
        </div>
      </Collapse>
    </div>
  );
}
