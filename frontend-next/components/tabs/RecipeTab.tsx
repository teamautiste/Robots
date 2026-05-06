'use client';

import { useState, useCallback } from 'react';
import { useAppStore } from '@/hooks/useAppStore';
import {
    apiListRecipes, apiGetRecipe, apiCreateRecipe,
    apiDeleteRecipe, apiSaveRecipe,
} from '@/lib/api';
import type { RecipeData, Point } from '@/types';

export default function RecipeTab() {
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

    const [newRecipeName, setNewRecipeName] = useState('');
    const [recipeError, setRecipeError] = useState('');
    const [pointsFeedback, setPointsFeedback] = useState('');
    const [deleteConfirm, setDeleteConfirm] = useState(false);

    const loadRecipes = useCallback(async () => {
        const recs = await apiListRecipes();
        setRecipes(Array.isArray(recs) ? recs : []);
    }, [setRecipes]);

    useState(() => { loadRecipes(); });

    async function handleCreateRecipe() {
        setRecipeError('');
        const name = newRecipeName.trim();
        if (!name) { setRecipeError('Ingresa un nombre para la receta'); return; }
        const res = await apiCreateRecipe(name);
        if (res.success) {
            setNewRecipeName('');
            await loadRecipes();
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
        await loadRecipes();
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

    const sectionLabel = (text: string) => (
        <div className="text-[10px] font-semibold text-text-secondary uppercase tracking-[.07em] mb-[10px]">{text}</div>
    );

    const inputCls = "h-8 px-[10px] border border-border-primary rounded-md bg-bg-primary text-text-primary text-[12px] outline-none focus:border-accent focus:ring-2 focus:ring-accent-light w-full";
    const btnCls = "h-8 px-[14px] rounded-md border text-[12px] font-medium transition-colors";

    return (
        <div className="p-5 h-full overflow-y-auto space-y-[14px]">
            <div className="flex flex-row gap-4 ">
                <div className=" bg-bg-primary border border-border-secondary rounded-lg gap-2 p-[20px_20px] min-w-[280px] max-h-[300px]">
                    {sectionLabel('Gestión de recetas')}

                    <div className="flex flex-col gap-4 ">

                        <div className="flex flex-col gap-2 ">
                            <input
                                type="text" value={newRecipeName} placeholder="Nombre de receta..."
                                onChange={(e) => { setNewRecipeName(e.target.value); setRecipeError(''); }}
                                onKeyDown={(e) => e.key === 'Enter' && handleCreateRecipe()}
                                className={`${inputCls}`}
                            />
                            <div className="flex flex-row justify-center gap-2">
                                <button onClick={handleCreateRecipe}
                                    className={`${btnCls}  bg-accent border-accent text-white hover:bg-accent-hover`}>
                                    Nueva
                                </button>
                                <button onClick={handleDeleteRecipe}
                                    className={`${btnCls} ${deleteConfirm ? ' bg-danger border-danger text-white' : 'bg-danger-light border-danger text-danger-text hover:bg-[#f8d4d4]'}`}>
                                    {deleteConfirm ? '¿Confirmar?' : 'Eliminar'}
                                </button>
                            </div>
                        </div>
                        {recipeError && <p className="text-[11px] text-danger-text mb-1"> ⚠ {recipeError}</p>}
                        <div className="row-span-2 col-start-1 min-h-[100px] max-h-[160px] overflow-y-auto border border-border-secondary rounded-md bg-bg-primary">
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

                </div>

                <div className="bg-bg-primary border col-span-2 border-border-secondary rounded-lg p-[16px_20px] overflow-y-auto">
                    {sectionLabel(`Puntos de receta — ${selectedRecipe || 'sin selección'}`)}

                    <div className="flex gap-1 flex-wrap mb-[10px]">
                        {Array.from({ length: 8 }, (_, i) => i + 1).map((n) => (
                            <button key={n} onClick={() => { setSelectedRobotTab(n); setSelectedPointRow(-1); }}
                                className={`px-3 py-1 text-[11px] font-medium rounded-full border transition-all ${selectedRobotTab === n ? 'bg-accent border-accent text-white' : 'bg-transparent border-border-primary text-text-secondary hover:bg-bg-secondary'
                                    }`}>
                                Robot {n}
                            </button>
                        ))}
                    </div>

                    <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
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
        </div>
    );
}
