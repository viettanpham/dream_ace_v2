import { RotateCcw } from 'lucide-react';
import {
  cloneSkillTiersConfig,
  DEFAULT_SKILL_CARD_PRICE_MULT,
  DEFAULT_SKILL_TIERS_CONFIG,
  DEFAULT_SKILL_WP_COST_FACTOR,
  sanitizeSkillCardPriceMult,
  sanitizeSkillWpCostFactor,
} from '../../data/balance';
import {
  getClassKindCatalogSkills,
  getSkillCardPrice,
  getSkillTier,
  sanitizeSkillTiersConfig,
} from '../../data/skills';
import { getClassName, useI18n } from '../../i18n';
import { useGameStore } from '../../store/useGameStore';
import type { MechClassId } from '../../types/game';

const TIER_CLASSES: readonly MechClassId[] = [
  'striker',
  'siege',
  'interceptor',
  'support',
];

const TIER_KINDS: readonly ('active' | 'passive')[] = ['active', 'passive'];

export function SkillTiersAdminBlock() {
  const { lang, t } = useI18n();
  const adminConfig = useGameStore((s) => s.adminConfig);
  const adminUpdateConfig = useGameStore((s) => s.adminUpdateConfig);

  const skillTiers = sanitizeSkillTiersConfig(adminConfig.skillTiers);
  const wpFactor = sanitizeSkillWpCostFactor(adminConfig.skillWpCostFactor);
  const cardMult = sanitizeSkillCardPriceMult(adminConfig.skillCardPriceMult);

  const strikerPassives = getClassKindCatalogSkills('striker', 'passive');
  const strikerPassiveItems = strikerPassives
    .map((s) => {
      const tier = getSkillTier(s, 'striker', skillTiers);
      return `Lv${s.unlockLevel} ${t(`skill.tier.${tier}`)}`;
    })
    .join(', ');

  const wpExample = Math.max(1, Math.ceil(5000 * wpFactor * cardMult));
  const cardPriceExample = getSkillCardPrice({ warPointCost: 1000 }, cardMult);

  const handleCellChange = (
    classId: MechClassId,
    kind: 'active' | 'passive',
    field: 'creditCount' | 'cardCount',
    rawVal: string
  ) => {
    const parsed = Number(rawVal);
    if (!Number.isFinite(parsed)) return;
    const next = cloneSkillTiersConfig(skillTiers);
    const total = getClassKindCatalogSkills(classId, kind).length;
    const val = Math.max(0, Math.min(total, Math.floor(parsed)));
    if (field === 'creditCount') {
      next[classId][kind].creditCount = val;
      if (next[classId][kind].creditCount + next[classId][kind].cardCount > total) {
        next[classId][kind].cardCount = Math.max(0, total - val);
      }
    } else {
      next[classId][kind].cardCount = val;
      if (next[classId][kind].creditCount + next[classId][kind].cardCount > total) {
        next[classId][kind].creditCount = Math.max(0, total - val);
      }
    }
    adminUpdateConfig({
      skillTiers: sanitizeSkillTiersConfig(next),
    });
  };

  const handleReset = () => {
    adminUpdateConfig({
      skillTiers: cloneSkillTiersConfig(DEFAULT_SKILL_TIERS_CONFIG),
      skillWpCostFactor: DEFAULT_SKILL_WP_COST_FACTOR,
      skillCardPriceMult: DEFAULT_SKILL_CARD_PRICE_MULT,
    });
  };

  return (
    <div
      data-testid="admin-skill-tiers-block"
      className="space-y-3 text-xs text-slate-200"
    >
      {/* 4x2 grid: Class x (Active / Passive) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {TIER_CLASSES.map((classId) => (
          <div
            key={classId}
            className="rounded-lg border border-slate-800 bg-[#080C14]/80 p-2.5 space-y-2"
          >
            <div className="text-xs font-bold text-amber-300">
              {getClassName(lang, classId)}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {TIER_KINDS.map((kind) => {
                const total = getClassKindCatalogSkills(classId, kind).length;
                const cell = skillTiers[classId][kind];
                const wpCount = Math.max(
                  0,
                  total - cell.creditCount - cell.cardCount
                );
                return (
                  <div
                    key={kind}
                    data-testid={`admin-skill-tier-cell-${classId}-${kind}`}
                    className="rounded border border-slate-800/90 bg-slate-950/60 p-2 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] font-semibold text-slate-200">
                        {t(`admin.skillTiers.${kind}`)} ({total})
                      </span>
                      <span
                        data-testid={`admin-skill-tier-wp-${classId}-${kind}`}
                        className="text-[11px] font-mono-nums font-bold text-purple-300"
                      >
                        {t('admin.skillTiers.wpDerived', { count: wpCount })}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <label className="block space-y-0.5">
                        <span className="text-[10px] text-amber-300/90 block">
                          {t('admin.skillTiers.creditCount')}
                        </span>
                        <input
                          type="number"
                          min={0}
                          max={total}
                          data-testid={`admin-skill-tier-credit-${classId}-${kind}`}
                          value={cell.creditCount}
                          onChange={(e) =>
                            handleCellChange(
                              classId,
                              kind,
                              'creditCount',
                              e.target.value
                            )
                          }
                          className="w-full h-8 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
                        />
                      </label>
                      <label className="block space-y-0.5">
                        <span className="text-[10px] text-pink-300/90 block">
                          {t('admin.skillTiers.cardCount')}
                        </span>
                        <input
                          type="number"
                          min={0}
                          max={total}
                          data-testid={`admin-skill-tier-card-${classId}-${kind}`}
                          value={cell.cardCount}
                          onChange={(e) =>
                            handleCellChange(
                              classId,
                              kind,
                              'cardCount',
                              e.target.value
                            )
                          }
                          className="w-full h-8 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
                        />
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Live Striker passive line */}
      <div
        data-testid="admin-skill-tiers-striker-live"
        className="rounded border border-slate-800 bg-[#080C14]/70 px-2.5 py-1.5 text-[11px] font-mono-nums text-sky-300"
      >
        {t('admin.skillTiers.strikerPassiveLive', {
          items: strikerPassiveItems,
        })}
      </div>

      {/* WP Cost Factor & Card Price Multiplier */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <label className="block space-y-1 rounded-lg border border-slate-800 bg-[#080C14]/80 p-2.5">
          <span className="text-[11px] font-semibold text-purple-300 block">
            {t('admin.skillTiers.wpFactorLabel')}
          </span>
          <span className="text-[11px] text-slate-400 leading-snug block">
            {t('admin.skillTiers.wpFactorDesc')}
          </span>
          <input
            type="number"
            min={0.0001}
            max={1}
            step={0.0001}
            data-testid="admin-skill-wp-factor"
            value={wpFactor}
            onChange={(e) => {
              const raw = Number(e.target.value);
              if (!Number.isFinite(raw)) return;
              adminUpdateConfig({
                skillWpCostFactor: sanitizeSkillWpCostFactor(raw),
              });
            }}
            className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
          />
          <span
            data-testid="admin-skill-wp-factor-example"
            className="text-[11px] font-mono-nums text-emerald-300 block"
          >
            {t('admin.skillTiers.wpFactorExample', {
              wp: wpExample.toLocaleString(),
            })}
          </span>
        </label>

        <label className="block space-y-1 rounded-lg border border-slate-800 bg-[#080C14]/80 p-2.5">
          <span className="text-[11px] font-semibold text-pink-300 block">
            {t('admin.skillTiers.cardPriceMultLabel')}
          </span>
          <span className="text-[11px] text-slate-400 leading-snug block">
            {t('admin.skillTiers.cardPriceMultDesc')}
          </span>
          <input
            type="number"
            min={0.1}
            max={20}
            step={0.1}
            data-testid="admin-skill-card-price-mult"
            value={cardMult}
            onChange={(e) => {
              const raw = Number(e.target.value);
              if (!Number.isFinite(raw)) return;
              adminUpdateConfig({
                skillCardPriceMult: sanitizeSkillCardPriceMult(raw),
              });
            }}
            className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
          />
          <span
            data-testid="admin-skill-card-price-example"
            className="text-[11px] font-mono-nums text-emerald-300 block"
          >
            {t('admin.skillTiers.cardPriceExample', {
              wp: cardPriceExample.toLocaleString(),
            })}
          </span>
        </label>
      </div>

      {/* Reset button */}
      <div className="flex justify-end">
        <button
          type="button"
          data-testid="admin-skill-tiers-reset"
          onClick={handleReset}
          className="h-8 px-3 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>{t('admin.skillTiers.resetBtn')}</span>
        </button>
      </div>
    </div>
  );
}
