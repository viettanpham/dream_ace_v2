import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import {
  computeNpcBuffTierCap,
  NPC_BUFF_CARD_KINDS,
  sanitizeNpcBuffCardsConfig,
} from '../../engine/buffCards';
import { getBuffCardKindLabel, useI18n } from '../../i18n';
import { useGameStore } from '../../store/useGameStore';
import type { NpcBuffCardKind, NpcBuffCardsConfig } from '../../types/game';

interface DraftNumberFieldProps {
  testId: string;
  label: string;
  example: string;
  exampleTestId: string;
  value: number;
  min: number;
  max: number;
  onCommit: (nextVal: number) => void;
}

function DraftNumberField({
  testId,
  label,
  example,
  exampleTestId,
  value,
  min,
  max,
  onCommit,
}: DraftNumberFieldProps) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = (rawStr: string) => {
    const trimmed = rawStr.trim();
    const parsed = Number(trimmed);
    if (trimmed === '' || !Number.isFinite(parsed)) {
      setDraft(String(value));
      return;
    }
    const clamped = Math.max(min, Math.min(max, Math.round(parsed)));
    setDraft(String(clamped));
    onCommit(clamped);
  };

  return (
    <div className="space-y-1 min-w-0 p-2 rounded border border-slate-800/80 bg-slate-900/40">
      <label className="space-y-1 block min-w-0">
        <span className="text-[11px] text-slate-300 block">{label}</span>
        <input
          type="number"
          data-testid={testId}
          min={min}
          max={max}
          step={1}
          value={draft}
          onChange={(e) => {
            const rawVal = e.target.value;
            setDraft(rawVal);
            const trimmed = rawVal.trim();
            if (trimmed !== '') {
              const parsed = Number(trimmed);
              if (Number.isFinite(parsed) && parsed >= min && parsed <= max) {
                onCommit(Math.round(parsed));
              }
            }
          }}
          onBlur={(e) => commit(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              commit(e.currentTarget.value);
              (e.currentTarget as HTMLInputElement).blur();
            }
          }}
          className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
        />
      </label>
      <div
        data-testid={exampleTestId}
        className="text-[11px] text-cyan-300/90 leading-snug"
      >
        {example}
      </div>
    </div>
  );
}

export function NpcBuffCardsAdminBlock() {
  const { lang, t } = useI18n();
  const npcBuffCards = useGameStore((s) => s.adminConfig.npcBuffCards);
  const adminUpdateConfig = useGameStore((s) => s.adminUpdateConfig);

  const cfg = sanitizeNpcBuffCardsConfig(npcBuffCards);

  const updateCfg = (patch: Partial<NpcBuffCardsConfig>) => {
    adminUpdateConfig({
      npcBuffCards: sanitizeNpcBuffCardsConfig({
        ...cfg,
        ...patch,
      }),
    });
  };

  const toggleKind = (kind: NpcBuffCardKind, checked: boolean) => {
    updateCfg({
      kinds: {
        ...cfg.kinds,
        [kind]: checked,
      },
    });
  };

  // Live example parameters derived dynamically from current config
  const exampleLv = Math.max(cfg.minLevel + cfg.levelPerTier, 25);
  const exampleCap = computeNpcBuffTierCap(exampleLv, false, cfg);
  const highLv = cfg.minLevel + cfg.levelPerTier * 5;
  const highEnemyCap = computeNpcBuffTierCap(highLv, false, cfg);
  const highBossCap = computeNpcBuffTierCap(highLv, true, cfg);
  const bossChance = cfg.includeBoss
    ? Math.min(100, cfg.enemyChancePct * 2)
    : cfg.enemyChancePct;
  const enabledKindsCount = NPC_BUFF_CARD_KINDS.filter((k) => cfg.kinds[k]).length;
  const effectiveMaxKinds = Math.min(cfg.maxKindsPerUnit, enabledKindsCount);

  return (
    <div
      data-testid="admin-npc-buff-cards-section"
      className="p-3.5 rounded-lg border border-slate-800 bg-[#0D1422] space-y-3 min-w-0"
    >
      <div className="space-y-0.5 min-w-0">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
          <Sparkles className="w-4 h-4 shrink-0" />
          <span className="truncate">{t('admin.npcBuffTitle')}</span>
        </div>
        <div className="text-[11px] text-slate-400">
          {t('admin.npcBuffDesc')}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <label className="flex items-center justify-between gap-2 px-2.5 py-2 rounded border border-slate-800 bg-slate-900/70 cursor-pointer">
          <span className="text-xs text-slate-200">
            {t('admin.npcBuffEnabled')}
          </span>
          <input
            type="checkbox"
            data-testid="admin-npc-buff-enabled"
            checked={cfg.enabled}
            onChange={(e) => updateCfg({ enabled: e.target.checked })}
            className="w-4 h-4 accent-amber-400 cursor-pointer shrink-0"
          />
        </label>

        <label className="flex items-center justify-between gap-2 px-2.5 py-2 rounded border border-slate-800 bg-slate-900/70 cursor-pointer">
          <span className="text-xs text-slate-200">
            {t('admin.npcBuffIncludeBoss')}
          </span>
          <input
            type="checkbox"
            data-testid="admin-npc-buff-include-boss"
            checked={cfg.includeBoss}
            onChange={(e) => updateCfg({ includeBoss: e.target.checked })}
            className="w-4 h-4 accent-amber-400 cursor-pointer shrink-0"
          />
        </label>

        <label className="flex items-center justify-between gap-2 px-2.5 py-2 rounded border border-slate-800 bg-slate-900/70 cursor-pointer">
          <span className="text-xs text-slate-200">
            {t('admin.npcBuffIncludeStructure')}
          </span>
          <input
            type="checkbox"
            data-testid="admin-npc-buff-include-structure"
            checked={cfg.includeStructure}
            onChange={(e) => updateCfg({ includeStructure: e.target.checked })}
            className="w-4 h-4 accent-amber-400 cursor-pointer shrink-0"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        <DraftNumberField
          testId="admin-npc-buff-ally-chance"
          exampleTestId="admin-npc-buff-ex-ally-chance"
          label={t('admin.npcBuffAllyChancePct')}
          value={cfg.allyChancePct}
          min={0}
          max={100}
          example={t('admin.npcBuffExAllyChance', {
            lv: exampleLv,
            pct: cfg.allyChancePct,
          })}
          onCommit={(v) => updateCfg({ allyChancePct: v })}
        />

        <DraftNumberField
          testId="admin-npc-buff-enemy-chance"
          exampleTestId="admin-npc-buff-ex-enemy-chance"
          label={t('admin.npcBuffEnemyChancePct')}
          value={cfg.enemyChancePct}
          min={0}
          max={100}
          example={t('admin.npcBuffExEnemyChance', {
            lv: exampleLv,
            pct: cfg.enemyChancePct,
            bossPct: bossChance,
          })}
          onCommit={(v) => updateCfg({ enemyChancePct: v })}
        />

        <DraftNumberField
          testId="admin-npc-buff-min-level"
          exampleTestId="admin-npc-buff-ex-min-level"
          label={t('admin.npcBuffMinLevel')}
          value={cfg.minLevel}
          min={1}
          max={999}
          example={t('admin.npcBuffExMinLevel', {
            below: Math.max(1, cfg.minLevel - 1),
            at: cfg.minLevel,
          })}
          onCommit={(v) => updateCfg({ minLevel: v })}
        />

        <DraftNumberField
          testId="admin-npc-buff-max-tier"
          exampleTestId="admin-npc-buff-ex-max-tier"
          label={t('admin.npcBuffMaxTier')}
          value={cfg.maxTier}
          min={1}
          max={5}
          example={t('admin.npcBuffExMaxTier', {
            highLv,
            cap: highEnemyCap,
            bossCap: highBossCap,
          })}
          onCommit={(v) => updateCfg({ maxTier: v })}
        />

        <DraftNumberField
          testId="admin-npc-buff-level-per-tier"
          exampleTestId="admin-npc-buff-ex-level-per-tier"
          label={t('admin.npcBuffLevelPerTier')}
          value={cfg.levelPerTier}
          min={1}
          max={200}
          example={t('admin.npcBuffExLevelPerTier', {
            exLv: exampleLv,
            cap: exampleCap,
            minLevel: cfg.minLevel,
            step: cfg.levelPerTier,
            maxKinds: effectiveMaxKinds,
            chance: cfg.enemyChancePct,
          })}
          onCommit={(v) => updateCfg({ levelPerTier: v })}
        />

        <DraftNumberField
          testId="admin-npc-buff-max-kinds"
          exampleTestId="admin-npc-buff-ex-max-kinds"
          label={t('admin.npcBuffMaxKindsPerUnit')}
          value={cfg.maxKindsPerUnit}
          min={0}
          max={NPC_BUFF_CARD_KINDS.length}
          example={t('admin.npcBuffExMaxKinds', {
            maxKinds: effectiveMaxKinds,
            enabledKinds: enabledKindsCount,
          })}
          onCommit={(v) => updateCfg({ maxKindsPerUnit: v })}
        />
      </div>

      <div className="space-y-1.5">
        <div className="text-[11px] font-semibold text-slate-300">
          {t('admin.npcBuffKindsLabel')}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {NPC_BUFF_CARD_KINDS.map((kind) => (
            <label
              key={kind}
              className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded border border-slate-800 bg-slate-900/60 cursor-pointer"
            >
              <span className="text-xs text-slate-200 truncate">
                {getBuffCardKindLabel(lang, kind)}
              </span>
              <input
                type="checkbox"
                data-testid={`admin-npc-buff-kind-${kind}`}
                checked={cfg.kinds[kind]}
                onChange={(e) => toggleKind(kind, e.target.checked)}
                className="w-4 h-4 accent-cyan-400 cursor-pointer shrink-0"
              />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
