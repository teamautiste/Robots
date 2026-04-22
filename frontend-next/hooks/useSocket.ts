'use client';

import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAppStore } from './useAppStore';
import type {
  LogEvent,
  RobotStatusEvent,
  SequenceDoneEvent,
  SequenceProgressEvent,
  UpsAlertEvent,
} from '@/types';

let socketInstance: Socket | null = null;

export function useSocket(url: string = '') {
  const socketRef = useRef<Socket | null>(null);

  const {
    updateRobotStatus,
    updateSequenceProgress,
    setIsRunning,
    clearSequenceProgress,
    addLog,
    setUpsState,
  } = useAppStore();

  useEffect(() => {
    // Reuse a singleton socket across re-renders / StrictMode double invocation
    if (!socketInstance) {
      socketInstance = io(url, {
        path: '/socket.io',
        transports: ['websocket', 'polling'],
      });
    }
    socketRef.current = socketInstance;
    const socket = socketInstance;

    socket.on('connect', () => {
      addLog('info', '[WS] Conectado al servidor');
    });

    socket.on('disconnect', () => {
      addLog('warn', '[WS] Desconectado del servidor');
    });

    socket.on('robot_status', (data: RobotStatusEvent) => {
      updateRobotStatus(data.robot_id, data.status, data.error);
      if (data.status === 'connected') {
        addLog('ok', `[OK] Robot ${data.robot_id} conectado (${data.ip})`);
      }
      if (data.status === 'error') {
        addLog('err', `[ERR] Robot ${data.robot_id}: ${data.error ?? 'Error desconocido'}`);
      }
    });

    socket.on('sequence_progress', (data: SequenceProgressEvent) => {
      updateSequenceProgress(data.robot_id, {
        step: data.step,
        total: data.total,
        status: data.status,
      });
    });

    socket.on('sequence_done', (data: SequenceDoneEvent) => {
      setIsRunning(false);
      clearSequenceProgress();
      addLog('ok', `[OK] Secuencia '${data.recipe}' finalizada`);
    });

    socket.on('log', (entry: LogEvent) => {
      addLog(entry.level, `${entry.ts} ${entry.message}`);
    });

    socket.on('ups_alert', (data: UpsAlertEvent) => {
      if (data.type === 'lost') {
        setUpsState({ status: 'lost', battery: data.battery });
        setIsRunning(false);
        addLog('err', `[UPS] Corte de energía. Batería al ${data.battery ?? '?'}%`);
      } else {
        setUpsState({ status: 'ok' });
        addLog('ok', '[UPS] Energía AC restaurada');
      }
    });

    return () => {
      // Remove only listeners added in this effect — keep the socket alive
      socket.off('connect');
      socket.off('disconnect');
      socket.off('robot_status');
      socket.off('sequence_progress');
      socket.off('sequence_done');
      socket.off('log');
      socket.off('ups_alert');
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  return socketRef.current;
}
