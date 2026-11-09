'use client';

import useSWR from 'swr';
import { useState } from 'react';
import {
  apiCameraServiceStart,
  apiCameraServiceStatus,
  apiCameraServiceStop,
  type CameraServiceStatus,
} from '@/lib/cameras';


export function useCameraService() {
  const { data, error, mutate } = useSWR<CameraServiceStatus>(
    'camera-supervisor/status',
    apiCameraServiceStatus,
    {

      refreshInterval: (latest) =>
        latest?.state === 'starting' || latest?.state === 'stopping' ? 1000 : 3000,
      revalidateOnFocus: true,
      shouldRetryOnError: true,
    },
  );
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  async function act(action: () => Promise<unknown>) {
    setBusy(true);
    setActionError('');
    try {
      await action();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'No se pudo completar la operación');
    } finally {
      await mutate();
      setBusy(false);
    }
  }

  const status = error ? undefined : data;
  return {
    status,
    loading: !data && !error,
    supervisorDown: !!error,
    running: status?.state === 'running',
    busy,
    actionError,
    start: () => act(apiCameraServiceStart),
    stop: () => act(apiCameraServiceStop),
    refresh: mutate,
  };
}
