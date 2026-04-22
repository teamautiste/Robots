'use client';

import { useState, useCallback } from 'react';
import Badge from '@/components/ui/Badge';
import { useAppStore } from '@/hooks/useAppStore';
import {
  apiGetConfig, apiSaveConfig, apiConnectRobot,
  apiListRecipes, apiGetRecipe, apiCreateRecipe,
  apiDeleteRecipe, apiSaveRecipe,
} from '@/lib/api';
import type { IpConfig, RecipeData, Point } from '@/types';

export default function ConfigTab() {
  const robots = useAppStore((s) => s.robots);
  const recipes = useAppStore((s) => s.recipes);
  const setRecipes = useAppStore((s) => s.setRecipes);
  const selectedRecipe = useAppStore((s) => s.selectedRecipe);
  const setSelectedRecipe = useAppStore((s) => s.setSelectedRecipe);
  const selectedRobotTab = useAppStore((s) => s.selectedRobotTab);
  const setSelectedRobotTab = useAppStore((s) => s.setSelectedRobotTab);
  const selectedPointRow = useAppStore((s) => s.selectedPointRow);
  const setSelectedPointRow = useAppStore((s) => s.setSelectedPointRow);
  const currentRecipeData = useAppStore((s) => s.currentRecipeData);
  const setCurrentRecipeData = useAppStore((s) => s.setCurrentRecipeData);
  const generalParams = useAppStore((s) => s.generalParams);
  const setGeneralParams = useAppStore((s) => s.setGeneralParams);

  const [ipConfig, setIpConfig] = useState<IpConfig>({});
  const [newRecipeName, setNewRecipeName] = useState('');
  const [recipeError, setRecipeError] = useState('');
  const [ipFeedback, setIpFeedback] = useState('');
  const [pointsFeedback, setPointsFeedback] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [configError, setConfigError] = useState('');

  const loadAll = useCallback(async () => {
    const [cfg, recs] = await Promise.all([apiGetConfig(), apiListRecipes()]);
    setIpConfig(cfg.ips ?? {});
    setGeneralParams(cfg.general_params ?? {});
    setRecipes(Array.isArray(recs) ? recs : []);
  }, [setRecipes, setGeneralParams]);

  useState(() => { loadAll(); });

  async function handleCreateRecipe() {
    setRecipeError('');
    const name = newRecipeName.trim();
    if (!name) { setRecipeError('Ingresa un nombre para la receta'); return; }
    const res = await apiCreateRecipe(name);
    if (res.success) {
      setNewRecipeName('');
      await loadAll();
      handleSelectRecipe(name);
    } else {
      setRecipeError(res.error ?? 'Error al crear receta');
    }
  }

  async function handleDeleteRecipe() {
    if (!selectedRecipe) { setRecipeError('Selecciona una receta'); return; }
    if (!deleteConfirm) { setDeleteConfirm(true); return; }
    await apiDeleteRecipe(selectedRecipe);
    setSelectedRecipe('');
    setCurrentRecipeData(null);
    setDeleteConfirm(false);
    await loadAll();
  }

  async function handleSelectRecipe(name: string) {
    setSelectedRecipe(name);
    setSelectedPointRow(-1);
    setDeleteConfirm(false);
    try {
      const data = await apiGetRecipe(name);
      setCurrentRecipeData(data);
    } catch {
      setCurrentRecipeData(null);
    }
  }

  // ── Points helpers ─────────────────────────────────────────────────────
  const robotKey = `Robot ${selectedRobotTab}`;
  const points: Point[] = currentRecipeData?.[robotKey] ?? [];

  function mutatePoints(updater: (pts: Point[]) => Point[]) {
    if (!currentRecipeData) return;
    const next: RecipeData = {
      ...currentRecipeData,
      [robotKey]: updater([...points]),
    };
    setCurrentRecipeData(next);
  }

  function addPointRow() {
    mutatePoints((pts) => [...pts, { name: `Punto ${pts.length + 1}`, coords: [0, 0, 0, 0, 0, 0] }]);
  }

  function deletePointRow() {
    if (selectedPointRow < 0) return;
    mutatePoints((pts) => { pts.splice(selectedPointRow, 1); return pts; });
    setSelectedPointRow(Math.max(0, selectedPointRow - 1));
  }

  function movePointRow(dir: -1 | 1) {
    if (selectedPointRow < 0) return;
    mutatePoints((pts) => {
      const ni = selectedPointRow + dir;
      if (ni < 0 || ni >= pts.length) return pts;
      [pts[selectedPointRow], pts[ni]] = [pts[ni], pts[selectedPointRow]];
      return pts;
    });
    setSelectedPointRow(Math.max(0, selectedPointRow + dir));
  }

  function updatePointName(i: number, val: string) {
    mutatePoints((pts) => { pts[i] = { ...pts[i], name: val }; return pts; });
  }

  function updatePointCoord(i: number, j: number, val: string) {
    mutatePoints((pts) => {
      const coords = [...pts[i].coords];
      coords[j] = parseFloat(val) || 0;
      pts[i] = { ...pts[i], coords };
      return pts;
    });
  }

  async function savePoints() {
    if (!selectedRecipe || !currentRecipeData) return;
    await apiSaveRecipe(selectedRecipe, currentRecipeData);
    setPointsFeedback('✓ Puntos guardados');
    setTimeout(() => setPointsFeedback(''), 2000);
  }

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

        <div className="bg-bg-primary border border-border-secondary rounded-lg p-[16px_20px]">
          {sectionLabel('Gestión de recetas')}
          <div className="flex gap-2 mb-[10px]">
            <input
              type="text" value={newRecipeName} placeholder="Nombre de receta..."
              onChange={(e) => { setNewRecipeName(e.target.value); setRecipeError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateRecipe()}
              className={`${inputCls} flex-1`}
            />
            <button onClick={handleCreateRecipe}
              className={`${btnCls} bg-accent border-accent text-white hover:bg-accent-hover`}>
              Nueva
            </button>
            <button onClick={handleDeleteRecipe}
              className={`${btnCls} ${deleteConfirm ? 'bg-danger border-danger text-white' : 'bg-danger-light border-danger text-danger-text hover:bg-[#f8d4d4]'}`}>
              {deleteConfirm ? '¿Confirmar?' : 'Eliminar'}
            </button>
          </div>
          {recipeError && <p className="text-[11px] text-danger-text mb-2">⚠ {recipeError}</p>}
          <div className="min-h-[100px] max-h-[160px] overflow-y-auto border border-border-secondary rounded-md bg-bg-primary">
            {recipes.length === 0 ? (
              <div className="p-4 text-center text-text-muted text-[12px]">Sin recetas. Crea una nueva.</div>
            ) : recipes.map((r) => (
              <div key={r} onClick={() => handleSelectRecipe(r)}
                className={`px-[14px] py-2 text-[12px] cursor-pointer border-b border-border-secondary last:border-b-0 flex items-center justify-between transition-colors ${selectedRecipe === r ? 'bg-accent-light text-accent font-semibold' : 'text-text-primary hover:bg-bg-secondary'
                  }`}>
                <span>{r}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-bg-primary border border-border-secondary rounded-lg p-[16px_20px]">
          {sectionLabel(`Puntos de receta — ${selectedRecipe || 'sin selección'}`)}

          <div className="flex gap-1 flex-wrap mb-[10px]">
            {Array.from({ length: 8 }, (_, i) => i + 1).map((n) => (
              <button key={n} onClick={() => { setSelectedRobotTab(n); setSelectedPointRow(-1); }}
                className={`px-3 py-1 text-[11px] font-medium rounded-full border transition-all ${selectedRobotTab === n ? 'bg-accent border-accent text-white' : 'bg-transparent border-border-primary text-text-secondary hover:bg-bg-secondary'
                  }`}>
                R{n}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto max-h-[160px] overflow-y-auto">
            <table className="w-full border-collapse text-[11px] table-fixed">
              <thead>
                <tr>
                  {['Punto', 'J1', 'J2', 'J3', 'J4', 'J5', 'J6'].map((h) => (
                    <th key={h} className="bg-bg-secondary px-[6px] py-[6px] text-center text-[10px] font-semibold text-text-secondary border border-border-secondary">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {points.map((p, i) => (
                  <tr key={i} onClick={() => setSelectedPointRow(i)}
                    className={`cursor-pointer ${i === selectedPointRow ? 'bg-accent-light' : 'hover:bg-bg-secondary'}`}>
                    <td className="border border-border-secondary px-[6px] py-1">
                      <input value={p.name} onChange={(e) => updatePointName(i, e.target.value)}
                        className="w-full border-none bg-transparent text-center text-[11px] font-mono text-text-primary outline-none focus:bg-accent-light rounded" />
                    </td>
                    {p.coords.map((v, j) => (
                      <td key={j} className="border border-border-secondary px-[6px] py-1">
                        <input type="number" step="0.01" value={v.toFixed(2)}
                          onChange={(e) => updatePointCoord(i, j, e.target.value)}
                          className="w-full border-none bg-transparent text-center text-[11px] font-mono text-text-primary outline-none focus:bg-accent-light rounded" />
                      </td>
                    ))}
                  </tr>
                ))}
                {points.length === 0 && (
                  <tr><td colSpan={7} className="px-3 py-4 text-center text-text-muted border border-border-secondary">Sin puntos</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Points actions */}
          <div className="flex gap-[6px] mt-[10px] flex-wrap items-center">
            <button onClick={addPointRow} className={`${btnCls} bg-accent border-accent text-white hover:bg-accent-hover h-[26px] px-[10px] text-[11px]`}>+ Punto</button>
            <button onClick={deletePointRow} className={`${btnCls} bg-danger-light border-danger text-danger-text hover:bg-[#f8d4d4] h-[26px] px-[10px] text-[11px]`}>Eliminar</button>
            <button onClick={() => movePointRow(-1)} className={`${btnCls} bg-bg-primary border-border-primary text-text-primary hover:bg-bg-secondary h-[26px] px-[10px] text-[11px]`}>▲ Subir</button>
            <button onClick={() => movePointRow(1)} className={`${btnCls} bg-bg-primary border-border-primary text-text-primary hover:bg-bg-secondary h-[26px] px-[10px] text-[11px]`}>▼ Bajar</button>
            <button onClick={savePoints} className={`${btnCls} bg-success-light border-success text-success-text hover:bg-[#c2ead9] h-[26px] px-[10px] text-[11px] ml-auto`}>Guardar puntos</button>
          </div>
          {pointsFeedback && <p className="text-[11px] text-success-text mt-1">{pointsFeedback}</p>}
        </div>
      </div>

      {/* ── Row 2: IP config + General params ─────────────────────────── */}
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
