'use client';

import useSWR from 'swr';
import { useEffect } from 'react';
import { fetcher } from '@/lib/api';
import { useAppStore } from './useAppStore';
import type { Robot } from '@/types';

/**
 * Polls /api/robots every 1 500 ms and merges results into the Zustand store.
 * Socket.IO events update individual robot entries in real-time;
 * this poll provides the baseline and catches any missed events.
 */
export function useRobots() {
  const { data, error, isLoading } = useSWR<Robot[]>('/api/robots', fetcher, {
    refreshInterval: 1500,
    revalidateOnFocus: false,
  });

  const setRobots = useAppStore((s) => s.setRobots);

  useEffect(() => {
    if (data) setRobots(data);
  }, [data, setRobots]);

  return { robots: data, error, isLoading };
}
