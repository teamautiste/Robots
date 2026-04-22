'use client';

interface Props {
  axis: string;
  direction: 1 | -1;
  disabled: boolean;
  onJog: () => void;
}

export default function JogButton({ axis, direction, disabled, onJog }: Props) {
  const isPlus = direction === 1;
  return (
    <button
      onClick={onJog}
      disabled={disabled}
      className={`
        h-[54px] flex flex-col items-center justify-center gap-[2px]
        border border-border-primary rounded-md bg-bg-secondary
        text-[15px] font-bold text-text-primary
        transition-all duration-100 select-none
        hover:bg-bg-primary hover:border-[#999] hover:shadow-sm
        disabled:opacity-40 disabled:cursor-not-allowed
        ${isPlus ? 'jog-btn-plus' : 'jog-btn-minus'}
      `}
      aria-label={`${axis} ${isPlus ? '+' : '−'}`}
    >
      <span className="text-[9px] font-semibold text-text-secondary uppercase tracking-[.06em]">
        {axis}
      </span>
      <span>{isPlus ? '+' : '−'}</span>
    </button>
  );
}
