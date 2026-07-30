import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'accent' | 'secondary' | 'ghost';
type Size = 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Renders a spinner and disables interaction. Label stays visible so the
   *  button does not change width mid-click. */
  loading?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-ink text-white hover:bg-ink-muted disabled:bg-ink-faint disabled:cursor-not-allowed',
  // The one place magenta becomes a solid fill: the action that starts a
  // search. Nothing else in the product competes with it.
  accent:
    'bg-chart text-white hover:brightness-110 disabled:bg-ink-faint disabled:cursor-not-allowed',
  secondary:
    'bg-surface text-ink border border-hairline-strong hover:border-ink disabled:text-ink-faint',
  ghost: 'text-ink-muted hover:text-ink hover:bg-hairline/40',
};

const SIZES: Record<Size, string> = {
  md: 'h-11 px-5 text-sm',
  lg: 'h-14 px-8 text-base',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  className,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-control',
        'font-medium tracking-tight transition-colors duration-150',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
    >
      {loading ? (
        <span
          aria-hidden="true"
          className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : null}
      {children}
    </button>
  );
}
