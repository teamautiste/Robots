'use client';

import type { RobotStatus } from '@/types';

const statusClasses: Record<RobotStatus, string> = {
  connected:    'bg-dot-connected',
  disconnected: 'bg-dot-disconnected',
  error:        'bg-dot-error',
  connecting:   'bg-dot-connecting animate-blink',
};

interface Props {
  status: RobotStatus;
  className?: string;
}

export default function StatusDot({ status, className = '' }: Props) {
  return (
    <span
      className={`inline-block w-[7px] h-[7px] rounded-full flex-shrink-0 transition-colors duration-300 ${statusClasses[status]} ${className}`}
      aria-label={status}
    />
  );
}
