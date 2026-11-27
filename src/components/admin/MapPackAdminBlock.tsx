import { type ChangeEvent, useRef, useState } from 'react';
import { AlertTriangle, Download, Map as MapIcon, RotateCcw, Upload } from 'lucide-react';
import {
  getActiveMap,
  isUsingCustomMapPack,
  validateMapPackDetailed,
} from '../../data/maps';
import { useI18n } from '../../i18n';
import { useGameStore } from '../../store/useGameStore';
import type { MapPackDefinition } from '../../types/game';

export interface MapPackAdminBlockProps {
  onFlash?: (msg: string) => void;
}

type PendingMapAction =
  | { type: 'import'; pack: MapPackDefinition }
  | { type: 'restore'; pack: null };

async function readJsonFileText(file: File): Promise<string> {
  if (typeof file.text === 'function') {
    return file.text();
  }
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

export function MapPackAdminBlock({ onFlash }: MapPackAdminBlockProps) {
  const { t, lang } = useI18n();
  const mapPackInConfig = useGameStore((s) => s.adminConfig.mapPack ?? null);
  const applyMapPack = useGameStore((s) => s.applyMapPack);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingMapAction | null>(null);

  const activeMap = getActiveMap();
  const isCustom = Boolean(mapPackInConfig) || isUsingCustomMapPack();
  const mapName = lang === 'vi' ? activeMap.nameVi : activeMap.nameEn;

  const notify = (msg: string) => {
    setStatusMessage(msg);
    onFlash?.(msg);
  };

  const handleExportJson = () => {
    setErrors([]);
    const json = JSON.stringify(activeMap, null, 2);
    if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeMap.mapId || 'map-pack'}.json`;
      a.click();
      if (typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(url);
      }
    }
    notify(t('admin.mapPack.exportedMsg'));
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setStatusMessage(null);
    let parsed: unknown;
    try {
      const text = await readJsonFileText(file);
      parsed = JSON.parse(text);
    } catch (err) {
      const errText = err instanceof Error ? err.message : String(err);
      setErrors([t('admin.mapPack.errJsonParse', { err: errText })]);
      return;
    }

    const result = validateMapPackDetailed(parsed);
    if (!result.pack) {
      setErrors(
        result.errors.length > 0 ? result.errors : [t('admin.mapPack.errInvalid')]
      );
      return;
    }

    setErrors([]);
    setPendingAction({ type: 'import', pack: result.pack });
  };

  const handleConfirmApply = () => {
    if (!pendingAction) return;
    const targetPack = pendingAction.pack;
    const isRestore = pendingAction.type === 'restore';
    const result = applyMapPack(targetPack);
    setPendingAction(null);

    if (!result.ok) {
      if (result.reason === 'in_battle') {
        setErrors([t('admin.mapPack.errInBattle')]);
      } else if (result.reason === 'auto_repeat_active') {
        setErrors([t('admin.mapPack.errAutoRepeat')]);
      } else {
        setErrors([t('admin.mapPack.errInvalid')]);
      }
      return;
    }

    setErrors([]);
    if (isRestore || targetPack === null) {
      notify(t('admin.mapPack.restoredMsg'));
    } else {
      const appliedName = lang === 'vi' ? targetPack.nameVi : targetPack.nameEn;
      notify(t('admin.mapPack.appliedMsg', { name: appliedName }));
    }
  };

  return (
    <div className="space-y-3 min-w-0" data-testid="map-pack-admin-block">
      <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 space-y-2 min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <MapIcon className="w-4 h-4 text-amber-400 shrink-0" />
            <span
              className="text-sm font-bold text-slate-100 break-words"
              data-testid="map-pack-name"
            >
              {mapName}
            </span>
            <span className="text-[11px] font-mono text-slate-400 break-all">
              ({activeMap.mapId})
            </span>
          </div>
          <span
            data-testid="map-pack-source"
            className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
              isCustom
                ? 'border-amber-500/40 bg-amber-500/15 text-amber-200'
                : 'border-sky-500/40 bg-sky-500/15 text-sky-200'
            }`}
          >
            {t('admin.mapPack.sourceLabel')}{' '}
            {isCustom
              ? t('admin.mapPack.sourceMods')
              : t('admin.mapPack.sourceBuiltin')}
          </span>
        </div>

        <div
          className="text-xs text-slate-300 font-mono-nums"
          data-testid="map-pack-counts"
        >
          {t('admin.mapPack.counts', {
            nodes: activeMap.nodes.length,
            lanes: activeMap.lanes.length,
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-testid="map-pack-export"
          onClick={handleExportJson}
          className="min-h-[36px] px-3 rounded border border-sky-500/40 bg-sky-500/15 hover:bg-sky-500/25 text-sky-200 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5 shrink-0" />
          <span>{t('admin.mapPack.exportJson')}</span>
        </button>

        <button
          type="button"
          data-testid="map-pack-import"
          onClick={() => fileInputRef.current?.click()}
          className="min-h-[36px] px-3 rounded border border-amber-500/40 bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
        >
          <Upload className="w-3.5 h-3.5 shrink-0" />
          <span>{t('admin.mapPack.importJson')}</span>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          data-testid="map-pack-file-input"
          onChange={handleFileChange}
          className="hidden"
        />

        <button
          type="button"
          data-testid="map-pack-restore"
          onClick={() => {
            setErrors([]);
            setStatusMessage(null);
            setPendingAction({ type: 'restore', pack: null });
          }}
          className="min-h-[36px] px-3 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5 shrink-0" />
          <span>{t('admin.mapPack.restoreBuiltin')}</span>
        </button>
      </div>

      {statusMessage && (
        <div
          data-testid="map-pack-status"
          className="text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded px-2.5 py-1.5"
        >
          {statusMessage}
        </div>
      )}

      {errors.length > 0 && (
        <div
          data-testid="map-pack-errors"
          role="alert"
          className="rounded-lg border border-rose-500/40 bg-rose-950/40 p-2.5 space-y-1 text-xs text-rose-200"
        >
          <div className="font-bold flex items-center gap-1.5 text-rose-300">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>{t('admin.mapPack.errValidationTitle')}</span>
          </div>
          <ul className="list-disc pl-4 space-y-0.5 break-words">
            {errors.map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {pendingAction && (
        <div
          className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={t('admin.mapPack.confirmTitle')}
          data-testid="map-pack-confirm-dialog"
        >
          <div className="w-full max-w-md rounded-xl border border-amber-500/40 bg-[#0D1422] text-slate-100 p-4 space-y-3 shadow-2xl">
            <div className="flex items-start gap-2 text-amber-300 font-bold text-sm">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{t('admin.mapPack.confirmTitle')}</span>
            </div>
            <p className="text-xs text-slate-200 leading-relaxed break-words">
              {t('admin.mapPack.confirmDesc')}
            </p>
            {pendingAction.pack && (
              <div className="rounded border border-slate-800 bg-slate-950/70 px-2.5 py-2 text-xs text-slate-300 space-y-0.5">
                <div className="font-semibold text-slate-100">
                  {lang === 'vi'
                    ? pendingAction.pack.nameVi
                    : pendingAction.pack.nameEn}
                </div>
                <div className="text-[11px] text-slate-400">
                  {t('admin.mapPack.counts', {
                    nodes: pendingAction.pack.nodes.length,
                    lanes: pendingAction.pack.lanes.length,
                  })}
                </div>
              </div>
            )}
            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <button
                type="button"
                data-testid="map-pack-confirm-cancel"
                onClick={() => setPendingAction(null)}
                className="min-h-[36px] px-3 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold cursor-pointer"
              >
                {t('admin.mapPack.confirmCancel')}
              </button>
              <button
                type="button"
                data-testid="map-pack-confirm-apply"
                onClick={handleConfirmApply}
                className="min-h-[36px] px-3 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer"
              >
                {t('admin.mapPack.confirmApply')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
