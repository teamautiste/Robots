'use client';

import { useState, useCallback } from 'react';
import Badge from '@/components/ui/Badge';
import { useAppStore } from '@/hooks/useAppStore';
import {
  apiGetConfig, apiSaveConfig, apiConnectRobot,
} from '@/lib/api';
import type { IpConfig } from '@/types';

export default function ConfigTab() {
  const robots = useAppStore((s) => s.robots);
  const generalParams = useAppStore((s) => s.generalParams);
  const setGeneralParams = useAppStore((s) => s.setGeneralParams);

  const [ipConfig, setIpConfig] = useState<IpConfig>({});
  const [ipFeedback, setIpFeedback] = useState('');
  const [configError, setConfigError] = useState('');

  const loadAll = useCallback(async () => {
    const cfg = await apiGetConfig();
    setIpConfig(cfg.ips ?? {});
    setGeneralParams(cfg.general_params ?? {});
  }, [setGeneralParams]);

  useState(() => { loadAll(); });

  // ── IP config ──────────────────────────────────────────────────────────
  async function handleSaveConfig() {
    setConfigError('');
    try {
      await apiSaveConfig({ ips: ipConfig, general_params: generalParams });
      setIpFeedback('✓ Configuración guardada');
      setTimeout(() => setIpFeedback(''), 2000);
    } catch {
      setConfigError('Error al guardar configuración');
    }
  }

  const sectionLabel = (text: string) => (
    <div className="text-[10px] font-semibold text-text-secondary uppercase tracking-[.07em] mb-[10px]">{text}</div>
  );

  const inputCls = "h-8 px-[10px] border border-border-primary rounded-md bg-bg-primary text-text-primary text-[12px] outline-none focus:border-accent focus:ring-2 focus:ring-accent-light w-full";
  const btnCls = "h-8 px-[14px] rounded-md border text-[12px] font-medium transition-colors";

  return (
    <div className="p-5 h-full overflow-y-auto space-y-[14px]">
      <div className="grid grid-cols-2 gap-[14px]">

        {/* IP config */}
        <div className="bg-bg-primary border border-border-secondary rounded-lg p-[16px_20px]">
          {sectionLabel('Configuración IP')}
          <table className="w-full border-collapse text-[12px]">
            <tbody>
              {Array.from({ length: 8 }, (_, i) => {
                const key = `Robot_${i + 1}`;
                const robot = robots.find((r) => r.id === i + 1);
                return (
                  <tr key={key} className="border-b border-border-secondary last:border-b-0">
                    <td className="py-[7px] px-2 font-semibold text-[12px] w-[72px]">Robot {i + 1}</td>
                    <td className="py-[7px] px-2">
                      <input type="text" value={ipConfig[key] ?? `192.168.1.${i + 1}`}
                        onChange={(e) => setIpConfig((prev) => ({ ...prev, [key]: e.target.value }))}
                        className="h-[28px] px-[10px] border border-border-primary rounded-md bg-bg-primary text-text-primary text-[11px] outline-none focus:border-accent w-[150px]"
                      />
                    </td>
                    <td className="py-[7px] px-2">
                      <button onClick={() => apiConnectRobot(i + 1)}
                        className="h-[26px] px-[10px] rounded-md bg-bg-primary border border-border-primary text-text-primary text-[11px] font-medium hover:bg-bg-secondary transition-colors">
                        Conectar
                      </button>
                    </td>
                    <td className="py-[7px] px-2">
                      <Badge variant={robot?.status ?? 'disconnected'} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="flex gap-2 mt-[10px]">
            <button onClick={handleSaveConfig} className={`${btnCls} bg-accent border-accent text-white hover:bg-accent-hover`}>Guardar config.</button>
            <button onClick={loadAll} className={`${btnCls} bg-bg-primary border-border-primary text-text-primary hover:bg-bg-secondary`}>Recargar</button>
          </div>
          {ipFeedback && <p className="text-[11px] text-success-text mt-1">{ipFeedback}</p>}
          {configError && <p className="text-[11px] text-danger-text mt-1">⚠ {configError}</p>}
        </div>

        {/* General params */}
        <div className="bg-bg-primary border border-border-secondary rounded-lg p-[16px_20px]">
          {sectionLabel('Parámetros generales')}
          {/* TODO: wire these inputs to backend when /api/config supports general params */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Vel. máxima (%)', key: 'maxSpeed' as const },
              { label: 'Aceleración (ms)', key: 'acceleration' as const },
              { label: 'Timeout (s)', key: 'timeout' as const },
              { label: 'Reintentos', key: 'retries' as const },
            ].map(({ label, key }) => (
              <div key={key} className="flex flex-col gap-1">
                <label className="text-[10px] font-medium text-text-secondary uppercase tracking-[.05em]">{label}</label>
                <input type="number" value={generalParams[key]}
                  onChange={(e) => setGeneralParams({ [key]: Number(e.target.value) })}
                  className={inputCls}
                />
              </div>
            ))}
            <div className="flex flex-col gap-1 col-span-2">
              <label className="text-[10px] font-medium text-text-secondary uppercase tracking-[.05em]">Puerto de comunicación</label>
              <input type="number" value={generalParams.port}
                onChange={(e) => setGeneralParams({ port: Number(e.target.value) })}
                className={inputCls}
              />
            </div>
          </div>

          <div className="h-px bg-border-secondary my-[14px]" />
          {sectionLabel('UPS / Energía')}
          <div className="flex items-center gap-2 px-3 py-2 bg-bg-secondary border border-border-secondary rounded-md text-[11px] text-text-secondary h-8">
            <span className={`inline-block w-[7px] h-[7px] rounded-full ${useAppStore.getState().upsState.status === 'lost' ? 'bg-danger' : 'bg-success'}`} />
            <span>
              {useAppStore.getState().upsState.status === 'lost'
                ? `En batería (${useAppStore.getState().upsState.battery ?? '?'}%)`
                : 'Energía AC — OK'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
