import * as Dialog from '@radix-ui/react-dialog';
import { motion } from 'motion/react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

// ───────────── Button ─────────────

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'live' | 'night';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-gradient-to-r from-accent to-accent-2 text-white shadow-lg shadow-accent/25',
  secondary: 'bg-ink-700/80 text-ink-100 ring-1 ring-white/5 hover:bg-ink-600/80',
  ghost: 'bg-transparent text-ink-300 hover:bg-white/5',
  danger: 'bg-red-500/15 text-red-300 ring-1 ring-red-400/20 hover:bg-red-500/25',
  live: 'bg-live text-white shadow-lg shadow-live/30',
  night: 'bg-night text-white shadow-lg shadow-night/30',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'h-9 px-3 text-sm rounded-xl', md: 'h-12 px-4 text-base rounded-2xl', lg: 'h-14 px-5 text-lg rounded-2xl' };
  return (
    <button
      {...rest}
      className={cx(
        'inline-flex select-none items-center justify-center gap-2 font-semibold transition-[transform,background,opacity] duration-150 active:scale-[0.96] disabled:opacity-40',
        sizes[size],
        VARIANTS[variant],
        className,
      )}
    >
      {children}
    </button>
  );
}

// ───────────── Card ─────────────

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section
      className={cx(
        'rounded-3xl bg-ink-850/80 p-4 ring-1 ring-white/[0.06] shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_20px_40px_-20px_rgba(0,0,0,0.6)] sm:p-5',
        className,
      )}
    >
      {children}
    </section>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-ink-400">{children}</h2>
      {right}
    </div>
  );
}

// ───────────── Chip / Segmented ─────────────

export function Chip({
  active,
  children,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        'h-10 shrink-0 rounded-xl px-3.5 text-sm font-semibold transition active:scale-95',
        active
          ? 'bg-gradient-to-r from-accent to-accent-2 text-white shadow-md shadow-accent/20'
          : 'bg-ink-700/70 text-ink-300 ring-1 ring-white/5 hover:bg-ink-600/70',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={cx('inline-flex rounded-xl bg-ink-800 p-1 ring-1 ring-white/5', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cx(
            'relative h-8 whitespace-nowrap rounded-lg px-3 text-sm font-semibold transition',
            value === o.value ? 'text-white' : 'text-ink-400 hover:text-ink-200',
          )}
        >
          {value === o.value && (
            <motion.span
              layoutId={`seg-${options.map((x) => x.value).join('-')}`}
              className="absolute inset-0 rounded-lg bg-ink-600"
              transition={{ type: 'spring', stiffness: 500, damping: 35 }}
            />
          )}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

// ───────────── Switch ─────────────

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx(
        'relative h-8 w-14 shrink-0 rounded-full transition-colors',
        checked ? 'bg-gradient-to-r from-accent to-accent-2' : 'bg-ink-600',
      )}
    >
      <motion.span
        className="absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow"
        animate={{ x: checked ? 24 : 0 }}
        transition={{ type: 'spring', stiffness: 600, damping: 35 }}
      />
    </button>
  );
}

// ───────────── Sheet (bottom sheet on mobile, dialog on desktop) ─────────────

export function Sheet({
  open,
  onOpenChange,
  title,
  children,
  footer,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm data-[state=open]:animate-[fade-in_.2s_ease-out]" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-[2rem] bg-ink-850 ring-1 ring-white/10 shadow-2xl data-[state=open]:animate-[sheet-up_.28s_cubic-bezier(.22,1,.36,1)] sm:inset-x-auto sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:w-[32rem] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[2rem] sm:data-[state=open]:animate-[fade-in_.2s_ease-out]"
        >
          <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-ink-600 sm:hidden" />
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <Dialog.Title className="font-display text-xl font-bold">{title}</Dialog.Title>
            <Dialog.Close className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-700 text-ink-300 hover:bg-ink-600">
              ✕
            </Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-5 pb-4">{children}</div>
          {footer && <div className="border-t border-white/5 px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="mb-4 block">
      <div className="mb-1.5 text-sm font-semibold text-ink-300">{label}</div>
      {children}
      {hint && <div className="mt-1.5 text-xs text-ink-400">{hint}</div>}
    </label>
  );
}

export const inputCls =
  'h-12 w-full rounded-2xl bg-ink-800 px-4 text-base text-ink-100 ring-1 ring-white/10 outline-none placeholder:text-ink-600 focus:ring-2 focus:ring-accent';

export { cx };
