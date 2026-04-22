'use client';

import { useState } from 'react';
import StatusDot from '@/components/ui/StatusDot';
import Badge from '@/components/ui/Badge';
import ProgressBar from '@/components/ui/ProgressBar';
import { useAppStore } from '@/hooks/useAppStore';
import { apiStartSequence, apiStopSequence } from '@/lib/api';

export default function MainTab() {
  const robots          = useAppStore((s) => s.robots);
  const runSpeed        = useAppStore((s) => s.runSpeed);
  const setRunSpeed     = useAppStore((s) => s.setRunSpeed);
  const selectedRecipe  = useAppStore((s) => s.selectedRecipe);
  const setSelectedRecipe = useAppStore((s) => s.setSelectedRecipe);
  const recipes         = useAppStore((s) => s.recipes);
  const isRunning       = useAppStore((s) => s.isRunning);
  const setIsRunning    = useAppStore((s) => s.setIsRunning);
  const addLog          = useAppStore((s) => s.addLog);

  const [actionError, setActionError] = useState('');

  const connected = robots.filter((r) => r.connected).length;
  const errors    = robots.filter((r) => r.status === 'error').length;

  async function handleStart() {
    setActionError('');
    if (!selectedRecipe) { setActionError('Selecciona una receta primero.'); return; }
    try {
      const res = await apiStartSequence(selectedRecipe, runSpeed);
      if (res.success) {
        setIsRunning(true);
        addLog('ok', `[SEQ] Iniciando '${selectedRecipe}' a ${runSpeed}%`);
      } else {
        setActionError(res.error ?? 'Error al iniciar secuencia');
      }
    } catch {
      setActionError('Error de conexión con el servidor');
    }
  }

  async function handleStop() {
    try {
      await apiStopSequence();
      setIsRunning(false);
    } catch {
      setActionError('Error al detener secuencia');
    }
  }

  return (
    <div className="p-5 h-full overflow-y-auto">
      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-[10px] mb-4">
        {[
          { label: 'Robots conectados', value: `${connected} / 8`, cls: '' },
          { label: 'Velocidad de ejecución', value: `${runSpeed}%`, cls: '' },
          { label: 'Errores activos', value: String(errors), cls: errors > 0 ? 'text-danger' : '' },
        ].map(({ label, value, cls }) => (
          <div key={label} className="bg-bg-secondary border border-border-secondary rounded-lg p-[14px_16px]">
            <div className="text-[11px] text-text-secondary mb-1">{label}</div>
            <div className={`text-[24px] font-semibold leading-none text-text-primary ${cls}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-[10px] items-end mb-[14px]">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-medium text-text-secondary uppercase tracking-[.05em]">Receta</label>
          <select
            id="main-recipe-select"
            value={selectedRecipe}
            onChange={(e) => { setSelectedRecipe(e.target.value); setActionError(''); }}
            className="h-8 px-[10px] border border-border-primary rounded-md bg-bg-primary text-text-primary text-[12px] outline-none focus:border-accent focus:ring-2 focus:ring-accent-light min-w-[200px]"
          >
            <option value="">— Seleccionar —</option>
            {recipes.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
          <label className="text-[10px] font-medium text-text-secondary uppercase tracking-[.05em]">Velocidad del robot</label>
          <div className="flex items-center gap-2">
            <input type="range" min={1} max={100} value={runSpeed} onChange={(e) => setRunSpeed(Number(e.target.value))} className="flex-1" />
            <span className="text-[13px] font-semibold min-w-[36px] text-right">{runSpeed}%</span>
          </div>
        </div>

        <button id="run-btn" onClick={handleStart} disabled={isRunning}
          className="h-10 px-5 rounded-md bg-accent border border-accent text-white text-[13px] font-medium disabled:opacity-45 hover:bg-accent-hover transition-colors">
          ▶ Iniciar
        </button>
        <button id="stop-btn" onClick={handleStop} disabled={!isRunning}
          className="h-10 px-5 rounded-md bg-danger-light border border-danger text-danger-text text-[13px] font-medium disabled:opacity-45 hover:bg-[#f8d4d4] transition-colors">
          ◼ Detener
        </button>
      </div>

      {actionError && <p className="text-[11px] text-danger-text mb-3">⚠ {actionError}</p>}

      {/* Robot table */}
      <div className="text-[10px] font-semibold text-text-secondary uppercase tracking-[.07em] mb-[10px]">Estado de robots</div>
      <div className="overflow-x-auto border border-border-secondary rounded-md">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr>
              {['Robot', 'Estado', 'Progreso secuencia', 'Error'].map((h) => (
                <th key={h} className="bg-bg-secondary px-3 py-2 text-left text-[10px] font-semibold text-text-secondary uppercase tracking-[.05em] border-b border-border-secondary whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {robots.map((r) => {
              const prog = r.sequenceProgress;
              const pct  = prog && prog.total > 0 ? Math.round((prog.step / prog.total) * 100) : 0;
              const barV = prog?.status === 'Error' ? 'danger' : prog?.status === 'Done' ? 'success' : 'accent';
              return (
                <tr key={r.id} className="hover:bg-bg-secondary border-b border-border-secondary last:border-b-0">
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-[7px] font-medium">
                      <StatusDot status={r.status} />Robot {r.id}
                    </span>
                  </td>
                  <td className="px-3 py-2"><Badge variant={r.status} /></td>
                  <td className="px-3 py-2">
                    {prog ? (
                      <div className="flex items-center gap-2">
                        <ProgressBar percent={pct} variant={barV} className="flex-1" />
                        <span className="text-[10px] text-text-secondary min-w-[40px] text-right">{prog.step}/{prog.total}</span>
                      </div>
                    ) : <span className="text-text-muted">—</span>}
                  </td>
                  <td className="px-3 py-2 text-[11px] text-danger-text">{r.error ?? '—'}</td>
                </tr>
              );
            })}
            {robots.length === 0 && (
              <tr><td colSpan={4} className="px-3 py-6 text-center text-text-muted">Sin robots configurados</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
