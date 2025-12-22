'use client';

import * as React from 'react';
import clsx from 'clsx';

export type IconBtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'ghost' | 'soft';
};

const IconBtn = React.forwardRef<HTMLButtonElement, IconBtnProps>(function IconBtn(
  { className, variant = 'soft', type = 'button', ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={clsx(
        'inline-flex h-10 w-10 items-center justify-center rounded-2xl transition',
        'focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2',
        props.disabled ? 'opacity-50 cursor-not-allowed' : 'hover:brightness-95 active:brightness-90',
        variant === 'soft'
          ? 'bg-white border border-slate-200 shadow-sm'
          : 'bg-transparent border border-transparent hover:bg-slate-100',
        className
      )}
      {...props}
    />
  );
});

export default IconBtn;
