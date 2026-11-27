import { useMemo, useState } from 'react';
import { AlertTriangle, Dices, Globe2 } from 'lucide-react';
import {
  clampGeneratedNodeCount,
  createRandomSeedCode,
  DEFAULT_GENERATED_BASES,
  DEFAULT_MAP_NAME_SET_ID,
  generateMapPack,
  MAP_NAME_SETS,
  MAX_GENERATED_BASES,
  MIN_GENERATED_BASES,
  normalizeSeedText,
} from '../../engine/mapGenerator';
import { useI18n } from '../../i18n';
import { useGameStore } from '../../store/useGameStore';
import type { MapPackDefinition } from '../../types/game';

export interface WorldGenAdminBlockProps {
  onFlash?: (msg: string) => void;
}

interface PendingWorldConfirm {
  pack: MapPackDefinition;
  seed: string;
  count: number;
  resetProgress: boolean;
}

export function WorldGenAdminBlock({ onFlash }: WorldGenAdminBlockProps) {
  const { t, lang } = useI18n();
  const applyMapPack = useGameStore((s) => s.applyMapPack);
  const applyWorldAndResetProgress = useGameStore(
    (s) => s.applyWorldAndResetProgress
  );

  const [nodeCountInput, setNodeCountInput] = useState(
    String(DEFAULT_GENERATED_BASES)
  );
  const [seedInput, setSeedInput] = useState('KESTREL');
  const [nameSetId, setNameSetId] = useState(DEFAULT_MAP_NAME_SET_ID);
  const [resetProgress, setResetProgress] = useState(false);
  const [pending, setPending] = useState<PendingWorldConfirm | null>(null);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const parsedCount = Number(nodeCountInput);
  const effectiveCount = clampGeneratedNodeCount(
    nodeCountInput.trim() !== '' && Number.isFinite(parsedCount)
      ? parsedCount
      : DEFAULT_GENERATED_BASES
  );
  const effectiveSeed = normalizeSeedText(seedInput);

  const previewPack = useMemo(
    () =>
      generateMapPack({
        nodeCount: effectiveCount,
        seed: effectiveSeed,
        lang,
        nameSetId,
      }),
    [effectiveCount, effectiveSeed, lang, nameSetId]
  );

  const initialContestedCount = useMemo(() => {
    const startId = previewPack.defaultSelectedNodeId;
    const adj = new Set<string>();
    for (const lane of previewPack.lanes) {
      if (lane.from === startId) adj.add(lane.to);
      else if (lane.to === startId) adj.add(lane.from);
    }
    return previewPack.nodes.filter(
      (n) =>
        adj.has(n.id) &&
        (n.initialFaction === 'hostile' || n.initialFaction === 'neutral')
    ).length;
  }, [previewPack]);

  const handleOpenCreateDialog = () => {
    setErrorMsg(null);
    setResultMsg(null);
    setResetConfirmText('');
    const pack = generateMapPack({
      nodeCount: effectiveCount,
      seed: effectiveSeed,
      lang,
      nameSetId,
    });
    setPending({
      pack,
      seed: effectiveSeed,
      count: effectiveCount,
      resetProgress,
    });
  };

  const handleConfirm = () => {
    if (!pending) return;
    if (pending.resetProgress && resetConfirmText.trim() !== 'RESET') {
      return;
    }

    const res = pending.resetProgress
      ? applyWorldAndResetProgress(pending.pack)
      : applyMapPack(pending.pack);

    const appliedSeed = pending.seed;
    const appliedCount = pending.count;
    setPending(null);
    setResetConfirmText('');

    if (!res.ok) {
      if (res.reason === 'in_battle') {
        setErrorMsg(t('admin.mapPack.errInBattle'));
      } else if (res.reason === 'auto_repeat_active') {
        setErrorMsg(t('admin.mapPack.errAutoRepeat'));
      } else {
        setErrorMsg(t('admin.mapPack.errInvalid'));
      }
      return;
    }

    const msg = t('admin.worldGen.createdMsg', {
      seed: appliedSeed,
      count: appliedCount,
    });
    setResultMsg(msg);
    onFlash?.(msg);
  };

  const confirmDisabled = Boolean(
    pending?.resetProgress && resetConfirmText.trim() !== 'RESET'
  );

  return (
    <div className="space-y-3 min-w-0" data-testid="world-gen-admin-block">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 min-w-0">
        {/* Node count 12-50 */}
        <label className="p-2.5 rounded border border-slate-800 bg-slate-950/60 space-y-1 block min-w-0">
          <span className="text-xs font-semibold text-slate-200 block">
            {t('admin.worldGen.nodeCount.title')}
          </span>
          <span className="text-[11px] text-slate-400 leading-snug block">
            {t('admin.worldGen.nodeCount.desc')}
          </span>
          <input
            type="number"
            min={MIN_GENERATED_BASES}
            max={MAX_GENERATED_BASES}
            data-testid="world-gen-node-count"
            value={nodeCountInput}
            onChange={(e) => setNodeCountInput(e.target.value)}
            onBlur={() => setNodeCountInput(String(effectiveCount))}
            className="w-full h-9 px-2 mt-1 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums text-slate-100"
          />
          <span
            data-testid="world-gen-node-count-example"
            className="text-[11px] font-mono-nums text-sky-300 leading-snug block pt-0.5 break-words"
          >
            {t('admin.worldGen.nodeCount.ex', {
              nodes: previewPack.nodes.length,
              lanes: previewPack.lanes.length,
              contested: initialContestedCount,
            })}
          </span>
        </label>

        {/* SEED text + Random button */}
        <div className="p-2.5 rounded border border-slate-800 bg-slate-950/60 space-y-1 min-w-0">
          <label
            htmlFor="world-gen-seed-input"
            className="text-xs font-semibold text-slate-200 block"
          >
            {t('admin.worldGen.seed.title')}
          </label>
          <span className="text-[11px] text-slate-400 leading-snug block">
            {t('admin.worldGen.seed.desc')}
          </span>
          <div className="flex flex-wrap items-center gap-2 pt-1 min-w-0">
            <input
              id="world-gen-seed-input"
              type="text"
              data-testid="world-gen-seed-input"
              value={seedInput}
              onChange={(e) => setSeedInput(e.target.value)}
              className="flex-1 min-w-[110px] h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono text-slate-100"
            />
            <button
              type="button"
              data-testid="world-gen-seed-random"
              onClick={() => setSeedInput(createRandomSeedCode(6))}
              className="h-9 px-2.5 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Dices className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span>{t('admin.worldGen.seed.random')}</span>
            </button>
          </div>
        </div>

        {/* Name set dropdown */}
        <label className="md:col-span-2 p-2.5 rounded border border-slate-800 bg-slate-950/60 space-y-1 block min-w-0">
          <span className="text-xs font-semibold text-slate-200 block">
            {t('admin.worldGen.nameSet.title')}
          </span>
          <span className="text-[11px] text-slate-400 leading-snug block">
            {t('admin.worldGen.nameSet.desc')}
          </span>
          <select
            data-testid="world-gen-name-set"
            value={nameSetId}
            onChange={(e) => setNameSetId(e.target.value)}
            className="w-full h-9 px-2 mt-1 rounded border border-slate-700 bg-slate-900 text-xs text-slate-100"
          >
            {MAP_NAME_SETS.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Optional progress reset checkbox */}
      <label className="flex items-start gap-2.5 p-2.5 rounded border border-slate-800 bg-slate-950/60 cursor-pointer min-w-0">
        <input
          type="checkbox"
          data-testid="world-gen-reset-progress-checkbox"
          checked={resetProgress}
          onChange={(e) => setResetProgress(e.target.checked)}
          className="mt-0.5 w-4 h-4 accent-rose-500 cursor-pointer shrink-0"
        />
        <span className="text-xs text-slate-200 leading-snug break-words">
          {t('admin.worldGen.resetProgressLabel')}
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-testid="world-gen-create-btn"
          onClick={handleOpenCreateDialog}
          className="min-h-[36px] px-3.5 rounded border border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
        >
          <Globe2 className="w-3.5 h-3.5 shrink-0" />
          <span>{t('admin.worldGen.createBtn')}</span>
        </button>
      </div>

      {resultMsg && (
        <div
          data-testid="world-gen-result"
          className="text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded px-2.5 py-1.5 break-words"
        >
          {resultMsg}
        </div>
      )}

      {errorMsg && (
        <div
          data-testid="world-gen-error"
          role="alert"
          className="text-xs text-rose-200 bg-rose-950/40 border border-rose-500/40 rounded px-2.5 py-1.5 break-words"
        >
          {errorMsg}
        </div>
      )}

      {pending && (
        <div
          className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={t('admin.worldGen.confirmTitle')}
          data-testid="world-gen-confirm-dialog"
        >
          <div
            className={`w-full max-w-md rounded-xl border p-4 space-y-3 shadow-2xl ${
              pending.resetProgress
                ? 'border-rose-500/70 bg-[#1B0D12] text-rose-50'
                : 'border-amber-500/40 bg-[#0D1422] text-slate-100'
            }`}
          >
            <div
              className={`flex items-start gap-2 font-bold text-sm ${
                pending.resetProgress ? 'text-rose-300' : 'text-amber-300'
              }`}
            >
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{t('admin.worldGen.confirmTitle')}</span>
            </div>

            <p
              data-testid="world-gen-confirm-question"
              className="text-xs leading-relaxed break-words"
            >
              {t('admin.worldGen.confirmQuestion', {
                seed: pending.seed,
                count: pending.count,
              })}
            </p>

            {pending.resetProgress && (
              <div
                data-testid="world-gen-reset-warning-box"
                className="rounded-lg border border-rose-500/50 bg-rose-950/60 p-3 space-y-2"
              >
                <div
                  data-testid="world-gen-reset-warning"
                  className="text-xs font-bold text-rose-200"
                >
                  {t('admin.worldGen.resetWarning')}
                </div>
                <label className="block space-y-1">
                  <span className="text-[11px] text-rose-200/90 block">
                    {t('admin.worldGen.resetTypeHint')}
                  </span>
                  <input
                    type="text"
                    data-testid="world-gen-confirm-reset-input"
                    value={resetConfirmText}
                    onChange={(e) => setResetConfirmText(e.target.value)}
                    placeholder="RESET"
                    className="w-full h-9 px-2.5 rounded border border-rose-500/60 bg-slate-950 text-xs font-mono text-rose-100"
                  />
                </label>
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <button
                type="button"
                data-testid="world-gen-confirm-cancel"
                onClick={() => {
                  setPending(null);
                  setResetConfirmText('');
                }}
                className="min-h-[36px] px-3 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold cursor-pointer"
              >
                {t('admin.worldGen.cancelBtn')}
              </button>
              <button
                type="button"
                data-testid="world-gen-confirm-apply"
                disabled={confirmDisabled}
                onClick={handleConfirm}
                className={`min-h-[36px] px-3 rounded text-xs font-bold ${
                  confirmDisabled
                    ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                    : pending.resetProgress
                      ? 'bg-rose-500 hover:bg-rose-400 text-white cursor-pointer'
                      : 'bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer'
                }`}
              >
                {t('admin.worldGen.confirmBtn')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
