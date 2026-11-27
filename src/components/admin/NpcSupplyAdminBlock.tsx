import { useEffect, useState } from 'react';
import { Package } from 'lucide-react';
import {
  MAX_NPC_SUPPLY_QTY,
  MAX_NPC_SUPPLY_TYPES,
  MAX_SUPPLY_MAX_PER_TYPE_PER_BATTLE,
  MIN_NPC_SUPPLY_QTY,
  MIN_NPC_SUPPLY_TYPES,
  MIN_SUPPLY_MAX_PER_TYPE_PER_BATTLE,
  sanitizeNpcSupplyConfig,
  sanitizeSupplyMaxPerTypePerBattle,
} from '../../engine/npcSupply';
import { useI18n } from '../../i18n';
import { useGameStore } from '../../store/useGameStore';

interface NpcSupplyAdminBlockProps {
  flash?: (msg: string) => void;
}

interface DraftNumberFieldProps {
  testId: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onCommit: (nextVal: number) => void;
}

function DraftNumberField({
  testId,
  label,
  value,
  min,
  max,
  step = 1,
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
    const clamped = Math.max(min, Math.min(max, parsed));
    setDraft(String(clamped));
    onCommit(clamped);
  };

  return (
    <label className="space-y-1 block min-w-0">
      <span className="text-[11px] text-slate-400 block">{label}</span>
      <input
        type="number"
        data-testid={testId}
        min={min}
        max={max}
        step={step}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
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
  );
}

export function NpcSupplyAdminBlock({ flash }: NpcSupplyAdminBlockProps) {
  const { t } = useI18n();
  const npcSupply = useGameStore((s) => s.adminConfig.npcSupply);
  const supplyMaxPerTypePerBattle = useGameStore(
    (s) => s.adminConfig.supplyMaxPerTypePerBattle
  );
  const adminUpdateConfig = useGameStore((s) => s.adminUpdateConfig);
  const adminRefillAllSectorSupply = useGameStore(
    (s) => s.adminRefillAllSectorSupply
  );

  const cfg = sanitizeNpcSupplyConfig(npcSupply);
  const maxPerType = sanitizeSupplyMaxPerTypePerBattle(
    supplyMaxPerTypePerBattle
  );
  const emptyMobPct = Math.round(cfg.noSupplyChance.mob * 100);

  const updateNpcCfg = (patch: Partial<typeof cfg>) => {
    adminUpdateConfig({
      npcSupply: sanitizeNpcSupplyConfig({
        ...cfg,
        ...patch,
      }),
    });
  };

  return (
    <div
      data-testid="admin-npc-supply-section"
      className="p-3.5 rounded-lg border border-slate-800 bg-[#0D1422] space-y-3 min-w-0"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-0.5 min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
            <Package className="w-4 h-4 shrink-0" />
            <span className="truncate">{t('admin.npcSupplyTitle')}</span>
          </div>
          <div className="text-[11px] text-slate-400">
            {t('admin.npcSupplyHint')}
          </div>
        </div>

        <button
          type="button"
          data-testid="admin-npc-supply-refill-all"
          onClick={() => {
            adminRefillAllSectorSupply();
            flash?.(t('admin.npcSupplyRefillAllDone'));
          }}
          className="h-8 px-2.5 rounded border border-amber-500/50 bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 text-[11px] font-semibold cursor-pointer whitespace-nowrap"
        >
          {t('admin.npcSupplyRefillAll')}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <label className="flex items-center justify-between gap-3 px-2.5 py-2 rounded border border-slate-800 bg-slate-900/70 cursor-pointer">
          <span className="text-xs text-slate-200">
            {t('admin.npcSupplyEnabled')}
          </span>
          <input
            type="checkbox"
            data-testid="admin-npc-supply-enabled"
            checked={cfg.enabled}
            onChange={(e) => updateNpcCfg({ enabled: e.target.checked })}
            className="w-4 h-4 accent-amber-400 cursor-pointer shrink-0"
          />
        </label>

        <label className="flex items-center justify-between gap-3 px-2.5 py-2 rounded border border-slate-800 bg-slate-900/70 cursor-pointer">
          <span className="text-xs text-slate-200">
            {t('admin.npcSupplyEmergencyEnabled')}
          </span>
          <input
            type="checkbox"
            data-testid="admin-npc-supply-emergency-enabled"
            checked={cfg.emergency.enabled}
            onChange={(e) =>
              updateNpcCfg({
                emergency: { ...cfg.emergency, enabled: e.target.checked },
              })
            }
            className="w-4 h-4 accent-amber-400 cursor-pointer shrink-0"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <DraftNumberField
          testId="admin-npc-supply-qty-min"
          label={t('admin.npcSupplyQtyMin')}
          value={cfg.qtyMin}
          min={MIN_NPC_SUPPLY_QTY}
          max={MAX_NPC_SUPPLY_QTY}
          onCommit={(v) => updateNpcCfg({ qtyMin: v })}
        />
        <DraftNumberField
          testId="admin-npc-supply-qty-max"
          label={t('admin.npcSupplyQtyMax')}
          value={cfg.qtyMax}
          min={MIN_NPC_SUPPLY_QTY}
          max={MAX_NPC_SUPPLY_QTY}
          onCommit={(v) => updateNpcCfg({ qtyMax: v })}
        />
        <DraftNumberField
          testId="admin-npc-supply-max-per-type"
          label={t('admin.npcSupplyMaxPerType')}
          value={maxPerType}
          min={MIN_SUPPLY_MAX_PER_TYPE_PER_BATTLE}
          max={MAX_SUPPLY_MAX_PER_TYPE_PER_BATTLE}
          onCommit={(v) =>
            adminUpdateConfig({
              supplyMaxPerTypePerBattle:
                sanitizeSupplyMaxPerTypePerBattle(v),
            })
          }
        />
        <DraftNumberField
          testId="admin-npc-supply-types-min"
          label={t('admin.npcSupplyTypesMin')}
          value={cfg.typesMin}
          min={MIN_NPC_SUPPLY_TYPES}
          max={MAX_NPC_SUPPLY_TYPES}
          onCommit={(v) => updateNpcCfg({ typesMin: v })}
        />
        <DraftNumberField
          testId="admin-npc-supply-types-max"
          label={t('admin.npcSupplyTypesMax')}
          value={cfg.typesMax}
          min={MIN_NPC_SUPPLY_TYPES}
          max={MAX_NPC_SUPPLY_TYPES}
          onCommit={(v) => updateNpcCfg({ typesMax: v })}
        />
        <DraftNumberField
          testId="admin-npc-supply-empty-mob-pct"
          label={t('admin.npcSupplyEmptyMobPct')}
          value={emptyMobPct}
          min={0}
          max={100}
          onCommit={(v) =>
            updateNpcCfg({
              noSupplyChance: {
                ...cfg.noSupplyChance,
                mob: Math.max(0, Math.min(100, v)) / 100,
              },
            })
          }
        />
        <DraftNumberField
          testId="admin-npc-supply-thresh-hp"
          label={t('admin.npcSupplyThreshHp')}
          value={cfg.thresholds.hp}
          min={0}
          max={100}
          onCommit={(v) =>
            updateNpcCfg({ thresholds: { ...cfg.thresholds, hp: v } })
          }
        />
        <DraftNumberField
          testId="admin-npc-supply-thresh-shield"
          label={t('admin.npcSupplyThreshShield')}
          value={cfg.thresholds.shield}
          min={0}
          max={100}
          onCommit={(v) =>
            updateNpcCfg({ thresholds: { ...cfg.thresholds, shield: v } })
          }
        />
        <DraftNumberField
          testId="admin-npc-supply-thresh-sp"
          label={t('admin.npcSupplyThreshSp')}
          value={cfg.thresholds.sp}
          min={0}
          max={100}
          onCommit={(v) =>
            updateNpcCfg({ thresholds: { ...cfg.thresholds, sp: v } })
          }
        />
        <DraftNumberField
          testId="admin-npc-supply-drain"
          label={t('admin.npcSupplyDrainPerBattle')}
          value={cfg.sector.drainPerBattle}
          min={0}
          max={100}
          onCommit={(v) =>
            updateNpcCfg({
              sector: { ...cfg.sector, drainPerBattle: v },
            })
          }
        />
        <DraftNumberField
          testId="admin-npc-supply-regen"
          label={t('admin.npcSupplyRegenPerMonth')}
          value={cfg.sector.regenPerMonth}
          min={0}
          max={100}
          onCommit={(v) =>
            updateNpcCfg({
              sector: { ...cfg.sector, regenPerMonth: v },
            })
          }
        />
      </div>
    </div>
  );
}
