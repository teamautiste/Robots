'use client';

type Variant = 'accent' | 'success' | 'danger';

const barColors: Record<Variant, string> = {
  accent:  'bg-accent',
  success: 'bg-success',
  danger:  'bg-danger',
};

interface Props {
  percent: number;
  variant?: Variant;
  className?: string;
}

export default function ProgressBar({ percent, variant = 'accent', className = '' }: Props) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className={`h-1 bg-border-secondary rounded-full overflow-hidden ${className}`}>
      <div
        className={`h-full rounded-full transition-[width] duration-300 ease-out ${barColors[variant]}`}
        style={{ width: `${clamped}%` }}
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
      />
    </div>
  );
}
