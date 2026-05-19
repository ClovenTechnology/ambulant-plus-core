'use client';

import * as React from 'react';

export type IconBtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'ghost' | 'soft';
};

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

const IconBtn = React.forwardRef<HTMLButtonElement, IconBtnProps>(function IconBtn(
  { className, variant = 'soft', type = 'button', disabled, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      className={cx(
        'inline-flex h-10 w-10 items-center justify-center rounded-2xl transition',
        'focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2',
        disabled ? 'opacity-50 cursor-not-allowed' : 'hover:brightness-95 active:brightness-90',
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