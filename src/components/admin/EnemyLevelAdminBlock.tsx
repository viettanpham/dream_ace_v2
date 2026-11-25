import { RotateCcw } from 'lucide-react';
import {
  cloneEnemyLevelConfig,
  DEFAULT_ENEMY_LEVEL_CONFIG,
  ENEMY_LEVEL_RANGE_KINDS,
  MAX_ENEMY_LEVEL_CAP_OVER_MAX,
  MAX_ENEMY_LEVEL_OFFSET,
  MAX_ENEMY_LEVEL_PEAK_CHANCE_PCT,
  MIN_ENEMY_LEVEL_CAP_OVER_MAX,
  MIN_ENEMY_LEVEL_OFFSET,
  MIN_ENEMY_LEVEL_PEAK_CHANCE_PCT,
  sanitizeEnemyLevelConfig,
} from '../../engine/enemyLevel';
import { useI18n } from '../../i18n';
import { useGameStore } from '../../store/useGameStore';
import type { EnemyLevelRange, EnemyLevelRangeKind } from '../../types/game';

const KIND_LABEL_KEYS = {
  patrol: 'admin.enemyLevelKindPatrol',
  pirate: 'admin.enemyLevelKindPirate',
  assault: 'admin.enemyLevelKindAssault',
  defend: 'admin.enemyLevelKindDefend',
  boss: 'admin.enemyLevelKindBoss',
} as const satisfies Record<EnemyLevelRangeKind, string>;

export function EnemyLevelAdminBlock() {
  const { t } = useI18n();
  const enemyLevel = useGameStore((s) => s.adminConfig.enemyLevel);
  const adminUpdateConfig = useGameStore((s) => s.adminUpdateConfig);

  const cfg = sanitizeEnemyLevelConfig(enemyLevel);

  const updateGlobal = (
    patch: Partial<Pick<typeof cfg, 'peakChancePct' | 'enemyLevelCapOverMax'>>
  ) => {
    adminUpdateConfig({
      enemyLevel: sanitizeEnemyLevelConfig({
        ...cfg,
        ...patch,
      }),
    });
  };

  const updateRange = (
    kind: EnemyLevelRangeKind,
    patch: Partial<EnemyLevelRange>
  ) => {
    adminUpdateConfig({
      enemyLevel: sanitizeEnemyLevelConfig({
        ...cfg,
        ranges: {
          ...cfg.ranges,
          [kind]: {
            ...cfg.ranges[kind],
            ...patch,
          },
        },
      }),
    });
  };

  return (
    <div
      data-testid="admin-enemy-level-section"
      className="p-3.5 rounded-lg border border-slate-800 bg-[#0D1422] space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-0.5 min-w-0">
          <div className="text-xs font-semibold text-amber-300">
            {t('admin.enemyLevelTitle')}
          </div>
          <div className="text-[11px] text-slate-400">
            {t('admin.enemyLevelHint')}
          </div>
        </div>
        <button
          type="button"
          data-testid="admin-enemy-level-reset"
          onClick={() =>
            adminUpdateConfig({
              enemyLevel: cloneEnemyLevelConfig(DEFAULT_ENEMY_LEVEL_CONFIG),
            })
          }
          className="h-8 px-2.5 rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer shrink-0"
        >
          <RotateCcw className="w-3 h-3 shrink-0" />
          <span>{t('admin.enemyLevelReset')}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="space-y-1 block">
          <span className="text-[11px] text-slate-400 block">
            {t('admin.enemyLevelPeakChance')}
          </span>
          <input
            type="number"
            data-testid="admin-enemy-level-peak-chance"
            min={MIN_ENEMY_LEVEL_PEAK_CHANCE_PCT}
            max={MAX_ENEMY_LEVEL_PEAK_CHANCE_PCT}
            step={1}
            value={cfg.peakChancePct}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v)) updateGlobal({ peakChancePct: v });
            }}
            className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
          />
        </label>

        <label className="space-y-1 block">
          <span className="text-[11px] text-slate-400 block">
            {t('admin.enemyLevelCapOverMax')}
          </span>
          <input
            type="number"
            data-testid="admin-enemy-level-cap-over-max"
            min={MIN_ENEMY_LEVEL_CAP_OVER_MAX}
            max={MAX_ENEMY_LEVEL_CAP_OVER_MAX}
            step={1}
            value={cfg.enemyLevelCapOverMax}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v)) updateGlobal({ enemyLevelCapOverMax: v });
            }}
            className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
          />
        </label>
      </div>

      <div className="space-y-2">
        {ENEMY_LEVEL_RANGE_KINDS.map((kind) => {
          const range = cfg.ranges[kind];
          return (
            <div
              key={kind}
              data-testid={`admin-enemy-level-row-${kind}`}
              className="grid grid-cols-1 sm:grid-cols-[120px_1fr_1fr_1fr] items-center gap-2 p-2 rounded border border-slate-800/80 bg-slate-950/50"
            >
              <span className="text-xs font-semibold text-slate-200">
                {t(KIND_LABEL_KEYS[kind])}
              </span>
              {(['min', 'max', 'peak'] as const).map((field) => {
                const labelKey =
                  field === 'min'
                    ? ('admin.enemyLevelMin' as const)
                    : field === 'max'
                    ? ('admin.enemyLevelMax' as const)
                    : ('admin.enemyLevelPeak' as const);
                return (
                  <label key={field} className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[11px] text-slate-400 w-9 shrink-0">
                      {t(labelKey)}
                    </span>
                    <input
                      type="number"
                      data-testid={`admin-enemy-level-${kind}-${field}`}
                      min={MIN_ENEMY_LEVEL_OFFSET}
                      max={MAX_ENEMY_LEVEL_OFFSET}
                      step={1}
                      value={range[field]}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (Number.isFinite(v)) updateRange(kind, { [field]: v });
                      }}
                      className="w-full h-8 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
                    />
                  </label>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
