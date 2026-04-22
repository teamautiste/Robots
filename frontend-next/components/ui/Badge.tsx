'use client';

import type { RobotStatus } from '@/types';

type Variant = RobotStatus;

const labels: Record<Variant, string> = {
  connected:    'Conectado',
  disconnected: 'Desconectado',
  error:        'Error',
  connecting:   'Conectando...',
};

const variantClasses: Record<Variant, string> = {
  connected:    'bg-success-light text-success-text',
  disconnected: 'bg-bg-secondary text-text-muted',
  error:        'bg-danger-light text-danger-text',
  connecting:   'bg-warn-light text-warn-text',
};

interface Props {
  variant: Variant;
  label?: string;
  className?: string;
}

export default function Badge({ variant, label, className = '' }: Props) {
  return (
    <span
      className={`inline-flex items-center px-[10px] py-[2px] rounded-full text-[10px] font-semibold ${variantClasses[variant]} ${className}`}
    >
      {label ?? labels[variant]}
    </span>
  );
}
