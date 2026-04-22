'use client';

import useSWR from 'swr';
import { useEffect } from 'react';
import { fetcher } from '@/lib/api';
import { useAppStore } from './useAppStore';
import type { RobotPosition } from '@/types';

/**
 * Polls /api/robots/:id/position every 250 ms when a robot is selected.
 * Updates Zustand store's currentPosition so the position table re-renders reactively.
 */
export function useRobotPosition(robotId: number | null) {
  const url = robotId != null ? `/api/robots/${robotId}/position` : null;

  const { data, error } = useSWR<RobotPosition>(url, fetcher, {
    refreshInterval: 250,
    revalidateOnFocus: false,
    // Don't throw on error — robot may not be connected
    shouldRetryOnError: false,
  });

  const setCurrentPosition = useAppStore((s) => s.setCurrentPosition);

  useEffect(() => {
    if (data?.connected) {
      setCurrentPosition(data);
    } else if (robotId == null) {
      setCurrentPosition(null);
    }
  }, [data, robotId, setCurrentPosition]);

  return { position: data, error };
}
