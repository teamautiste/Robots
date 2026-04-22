'use client';

import { useEffect, useRef } from 'react';
import type { LogEntry } from '@/types';

const levelColors: Record<string, string> = {
  ok:   'text-success-text',
  err:  'text-danger-text',
  warn: 'text-warn-text',
  info: 'text-text-secondary',
};

interface Props {
  logs: LogEntry[];
  className?: string;
}

export default function LogBox({ logs, className = '' }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div
      className={`min-h-[80px] max-h-[130px] overflow-y-auto bg-bg-secondary border border-border-secondary rounded-md p-2 text-[11px] font-mono text-text-secondary ${className}`}
    >
      {logs.length === 0 && (
        <span className="text-text-muted italic">Sin entradas de registro.</span>
      )}
      {logs.map((entry) => (
        <div
          key={entry.id}
          className={`py-px border-b border-border-secondary last:border-b-0 ${levelColors[entry.level] ?? 'text-text-secondary'}`}
        >
          {entry.message}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
