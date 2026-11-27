import { type ReactNode, useMemo, useState } from 'react';
import {
  ArrowUpCircle,
  Award,
  Check,
  ChevronRight,
  KeyRound,
  Lock,
  Plus,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import {
  getEffectiveSkillMaxLevel,
  getPassiveSlotUnlockGearLevel,
  getUnlockedPassiveSlots,
  sanitizePassiveSlotsConfig,
} from '../data/balance';
import { getCatalogRow } from '../data/iconCatalog';
import { getSkillById } from '../data/skills';
import {
  getEffectiveSpCost,
  getRequiredGearLevelForSkillLevel,
  getSkillLearnOrUpgradeCost,
  getSkillsForClass,
  MAX_ACTIVE_SKILL_BAR,
  validateEquipPassiveSkill,
  validateEquipSkillOnBar,
  validateLearnOrUpgradeSkill,
} from '../engine/skills';
import {
  getClassCode,
  getClassName,
  getSkillCategoryLabel,
  getSkillDesc,
  getSkillName,
  useI18n,
} from '../i18n';
import { useGameStore } from '../store/useGameStore';
import type {
  IconCatalogModRow,
  SkillCategory,
  SkillDefinition,
} from '../types/game';
import {
  formatSkillRealSummary,
  type SkillRealSummary,
} from '../utils/skillDisplay';
import { BottomSheet } from './BottomSheet';
import { CatalogIcon } from './CatalogIcon';
import { FighterSvg } from './FighterSvg';
import { ClassIcon } from './GameIcons';
import { SkillIcon } from './SkillIcon';

type SkillFilter = 'all' | 'class' | 'general' | 'special_elite';

function getCategoryStyle(category: SkillCategory): string {
  switch (category) {
    case 'elite':
      return 'border-amber-400/70 bg-amber-500/15 text-amber-300';
    case 'special':
      return 'border-purple-400/70 bg-purple-500/15 text-purple-300';
    case 'passive':
      return 'border-emerald-400/70 bg-emerald-500/15 text-emerald-300';
    default:
      return 'border-slate-700 bg-slate-800/80 text-slate-300';
  }
}

function SkillSummaryInline({
  summary,
  mods,
  compact = false,
}: {
  summary: SkillRealSummary;
  mods?: readonly IconCatalogModRow[] | null;
  compact?: boolean;
}) {
  return (
    <div
      className={
        compact
          ? 'flex flex-wrap items-center gap-1.5 text-[11px] font-mono-nums text-slate-200'
          : 'rounded border border-slate-800/80 bg-[#080C14]/80 px-2.5 py-1.5 space-y-1 text-[11px] font-mono-nums'
      }
    >
      <div className="flex flex-wrap items-center gap-1.5 text-slate-200">
        {summary.iconIds.map((iconId) => {
          const row = getCatalogRow(iconId, mods) ?? null;
          return row ? (
            <CatalogIcon
              key={iconId}
              row={row}
              size="xs"
              showBadges={false}
              showArrowBadge={false}
              className="shrink-0"
            />
          ) : null;
        })}
        <span>{summary.primaryText}</span>
      </div>
      {!compact && summary.nextLine && (
        <div className="text-emerald-400 font-semibold">
          {summary.nextLine}
        </div>
      )}
    </div>
  );
}

export function SkillView() {
  const { lang, t } = useI18n();
  const pilot = useGameStore((s) => s.pilot);
  const adminConfig = useGameStore((s) => s.adminConfig);
  const learnOrUpgradeSkill = useGameStore((s) => s.learnOrUpgradeSkill);
  const equipSkillToBar = useGameStore((s) => s.equipSkillToBar);
  const unequipSkillFromBar = useGameStore((s) => s.unequipSkillFromBar);
  const equipPassiveSkill = useGameStore((s) => s.equipPassiveSkill);
  const unequipPassiveSkill = useGameStore((s) => s.unequipPassiveSkill);
  const openWarPointShop = useGameStore((s) => s.openWarPointShop);
  const setTacticsModalOpen = useGameStore((s) => s.setTacticsModalOpen);

  const [filter, setFilter] = useState<SkillFilter>('all');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [mobileSkillId, setMobileSkillId] = useState<string | null>(null);

  const activeGear = pilot.gears[pilot.activeGearId];
  const activeGearName = getClassName(lang, activeGear.classId);
  const skillMaxLevel = getEffectiveSkillMaxLevel(adminConfig);
  const passiveSlotsCfg = useMemo(
    () => sanitizePassiveSlotsConfig(adminConfig.passiveSlots),
    [adminConfig.passiveSlots]
  );
  const unlockedPassiveSlots = getUnlockedPassiveSlots(
    activeGear.level,
    passiveSlotsCfg
  );
  const equippedPassives = Array.isArray(activeGear.equippedPassives)
    ? activeGear.equippedPassives
    : [];
  const activeEquippedPassives = equippedPassives.slice(0, unlockedPassiveSlots);

  const classAndGeneralSkills = useMemo(
    () => getSkillsForClass(activeGear.classId),
    [activeGear.classId]
  );

  const passiveSkills = useMemo(
    () => classAndGeneralSkills.filter((s) => s.category === 'passive'),
    [classAndGeneralSkills]
  );

  const activeCatalogSkills = useMemo(
    () => classAndGeneralSkills.filter((s) => s.category !== 'passive'),
    [classAndGeneralSkills]
  );

  const filteredActiveSkills = useMemo(() => {
    return activeCatalogSkills.filter((s) => {
      if (filter === 'class') return s.classScope === activeGear.classId;
      if (filter === 'general') return s.classScope === 'general';
      if (filter === 'special_elite') {
        return s.category === 'special' || s.category === 'elite';
      }
      return true;
    });
  }, [activeCatalogSkills, filter, activeGear.classId]);

  const classOnlyCount = useMemo(
    () =>
      activeCatalogSkills.filter((s) => s.classScope === activeGear.classId)
        .length,
    [activeCatalogSkills, activeGear.classId]
  );
  const generalCount = useMemo(
    () => activeCatalogSkills.filter((s) => s.classScope === 'general').length,
    [activeCatalogSkills]
  );
  const specialEliteCount = useMemo(
    () =>
      activeCatalogSkills.filter(
        (s) => s.category === 'special' || s.category === 'elite'
      ).length,
    [activeCatalogSkills]
  );

  const handleLearnOrUpgrade = (skill: SkillDefinition) => {
    const prevLv = activeGear.skillLevels[skill.id] ?? 0;
    const res = learnOrUpgradeSkill(skill.id);
    if (res.validation.ok) {
      setFeedback(
        t(
          prevLv === 0 ? 'skill.learnedFeedback' : 'skill.upgradedFeedback',
          {
            skill: getSkillName(lang, skill.id),
            level: res.newLevel,
            gear: activeGearName,
          }
        )
      );
    }
  };

  const handleEquip = (skill: SkillDefinition) => {
    const res = equipSkillToBar(skill.id);
    if (res.ok) {
      setFeedback(
        t('skill.equippedFeedback', {
          skill: getSkillName(lang, skill.id),
          gear: activeGearName,
        })
      );
    }
  };

  const handleUnequip = (skillId: string) => {
    unequipSkillFromBar(skillId);
    setFeedback(
      t('skill.unequippedFeedback', {
        skill: getSkillName(lang, skillId),
        gear: activeGearName,
      })
    );
  };

  const handleEquipPassive = (skill: SkillDefinition) => {
    const res = equipPassiveSkill(skill.id);
    if (res.ok) {
      setFeedback(
        t('skill.passiveEquippedFeedback', {
          skill: getSkillName(lang, skill.id),
          gear: activeGearName,
        })
      );
    }
  };

  const handleUnequipPassive = (skillId: string) => {
    unequipPassiveSkill(skillId);
    setFeedback(
      t('skill.passiveUnequippedFeedback', {
        skill: getSkillName(lang, skillId),
        gear: activeGearName,
      })
    );
  };

  const mobileSelectedSkill = mobileSkillId
    ? getSkillById(mobileSkillId) ?? null
    : null;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-5 space-y-4 sm:space-y-5">
      {/* Header + Active Gear Identity + Balances */}
      <div className="rounded-lg border border-slate-800/90 bg-[#0C121D]/95 p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="hidden sm:flex w-16 h-16 shrink-0 rounded-lg border border-slate-800 bg-[#070B12] items-center justify-center">
            <FighterSvg
              classId={activeGear.classId}
              side="ally"
              facing="right"
              size="sm"
              className="w-14 h-14"
            />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <ClassIcon classId={activeGear.classId} className="w-3.5 h-3.5 shrink-0" />
              <span className="font-semibold text-amber-400">
                {activeGearName} {t('common.levelShort')}
                {activeGear.level}
              </span>
              <span>·</span>
              <span>{getClassCode(lang, activeGear.classId)}</span>
            </div>
            <h1 className="font-display text-2xl font-bold tracking-wide text-slate-100 mt-0.5">
              {t('skill.pageTitle', { gear: activeGearName })}
            </h1>
            <p className="text-sm md:text-xs text-slate-400 mt-0.5">
              {t('skill.pageSubtitle', {
                gear: activeGearName,
                max: skillMaxLevel,
              })}
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-4 shrink-0">
          <div className="text-right font-mono-nums">
            <div className="text-[11px] text-slate-400">
              {t('shop.availableCredits')}
            </div>
            <div className="text-base font-bold text-amber-400">
              {pilot.credits.toLocaleString()} CR
            </div>
          </div>

          <div className="text-right font-mono-nums pl-4 border-l border-slate-800">
            <div className="text-[11px] text-slate-400">
              {t('shop.availableWp')}
            </div>
            <div className="text-base font-bold text-purple-300 flex items-center justify-end gap-1">
              <Award className="w-4 h-4 text-purple-400" />
              <span>{(pilot.warPoints ?? 0).toLocaleString()} WP</span>
            </div>
          </div>
        </div>
      </div>

      {feedback && (
        <div className="rounded border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 flex items-center justify-between gap-3 text-sm md:text-xs text-emerald-200">
          <span>{feedback}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="min-w-[36px] min-h-[36px] flex items-center justify-center text-slate-400 hover:text-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 1. ACTIVE SKILL BAR (6 SLOTS) */}
      <section className="rounded-lg border border-amber-500/40 bg-[#0C121D]/95 p-3.5 sm:p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-bold tracking-wide text-slate-100">
              {t('skill.barTitle', {
                used: activeGear.equippedSkillBar.length,
                max: MAX_ACTIVE_SKILL_BAR,
              })}
            </h2>
            <p className="text-xs text-slate-400">{t('skill.barHint')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setTacticsModalOpen(true)}
              className="min-h-[44px] md:min-h-0 md:h-8 px-3 inline-flex items-center gap-1.5 rounded-lg md:rounded border border-emerald-500/50 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200 text-xs font-semibold transition-colors cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>
                {t('auto.tacticsBtn')} ({activeGear.tactics.rules.length})
              </span>
            </button>
            <button
              type="button"
              onClick={openWarPointShop}
              className="min-h-[44px] md:min-h-0 md:h-8 px-3 inline-flex items-center gap-1.5 rounded-lg md:rounded border border-purple-500/50 bg-purple-500/15 hover:bg-purple-500/25 text-purple-200 text-xs font-semibold transition-colors cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>{t('skill.getCardInWpShop')}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {Array.from({ length: MAX_ACTIVE_SKILL_BAR }).map((_, idx) => {
            const skillId = activeGear.equippedSkillBar[idx];
            const skill = skillId ? getSkillById(skillId) : undefined;
            const rawLv = skill ? activeGear.skillLevels[skill.id] ?? 1 : 0;
            const lv = skill ? Math.min(skillMaxLevel, rawLv) : 0;

            if (!skill) {
              return (
                <div
                  key={`empty-${idx}`}
                  className="min-h-[76px] md:min-h-[88px] rounded-md border border-dashed border-slate-800 bg-[#080C14]/70 p-2.5 flex flex-col items-center justify-center text-slate-600 text-xs"
                >
                  <span className="font-mono-nums text-[10px] mb-1">
                    #{idx + 1}
                  </span>
                  <span>{t('skill.emptySlot')}</span>
                </div>
              );
            }

            const slotSp = getEffectiveSpCost(skill, activeGear, adminConfig);
            const slotSummary = formatSkillRealSummary(
              skill,
              rawLv,
              lang,
              adminConfig,
              slotSp
            );

            return (
              <div
                key={skill.id}
                title={slotSummary.tooltipText}
                onClick={() => {
                  if (window.innerWidth < 768) {
                    setMobileSkillId(skill.id);
                  }
                }}
                className={`min-h-[76px] md:min-h-[88px] rounded-md border p-2.5 flex flex-col justify-between gap-1.5 bg-[#080C14] relative cursor-pointer md:cursor-default ${
                  skill.category === 'elite'
                    ? 'border-amber-400/70'
                    : skill.category === 'special'
                    ? 'border-purple-400/70'
                    : 'border-sky-500/40'
                }`}
              >
                <div className="flex items-start justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-7 h-7 rounded bg-slate-900 border border-slate-700 flex items-center justify-center text-amber-300 shrink-0">
                      <SkillIcon icon={skill.icon} className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-100 leading-tight truncate">
                        {getSkillName(lang, skill.id)}
                      </div>
                      <div className="text-[11px] font-mono-nums text-sky-300">
                        Lv.{lv} · {slotSp} SP
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUnequip(skill.id);
                    }}
                    title={t('skill.unequipBtn')}
                    className="w-7 h-7 md:w-5 md:h-5 rounded bg-slate-800 hover:bg-red-500/80 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
                  >
                    <X className="w-3.5 h-3.5 md:w-3 md:h-3" />
                  </button>
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono-nums">
                  <span>
                    {skill.oncePerBattle
                      ? t('skill.oncePerBattle')
                      : skill.isToggle
                      ? t('skill.toggleTag')
                      : skill.cooldown > 0
                      ? t('skill.cooldown', { turns: skill.cooldown })
                      : t('skill.noCooldown')}
                  </span>
                  <span className="text-slate-500">#{idx + 1}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 2. PASSIVE MODULES */}
      {passiveSkills.length > 0 && (
        <section className="rounded-lg border border-emerald-500/35 bg-[#0C121D]/95 p-3.5 sm:p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <h2 className="font-display text-lg font-bold tracking-wide text-slate-100">
                  {t('skill.passivesTitle', {
                    used: activeEquippedPassives.length,
                    max: unlockedPassiveSlots,
                  })}
                </h2>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {t('skill.passiveSlotsHint')}
              </p>
            </div>
            <span className="text-xs font-mono-nums text-emerald-300">
              {t('skill.passiveSlotsTitle', {
                used: activeEquippedPassives.length,
                unlocked: unlockedPassiveSlots,
                max: passiveSlotsCfg.max,
              })}
            </span>
          </div>

          {/* Passive Slot Row */}
          <div
            data-testid="passive-slots-row"
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2"
          >
            {Array.from({ length: passiveSlotsCfg.max }).map((_, idx) => {
              const isUnlocked = idx < unlockedPassiveSlots;
              const slotSkillId = isUnlocked ? equippedPassives[idx] : undefined;
              const slotSkill = slotSkillId ? getSkillById(slotSkillId) : undefined;
              const unlockGearLv = getPassiveSlotUnlockGearLevel(
                idx,
                passiveSlotsCfg
              );

              if (!isUnlocked) {
                return (
                  <div
                    key={`passive-locked-${idx}`}
                    data-testid={`passive-slot-${idx}`}
                    className="min-h-[68px] rounded-md border border-dashed border-slate-800/80 bg-[#070B12]/70 p-2 flex flex-col items-center justify-center text-slate-500 text-[11px] font-mono-nums text-center gap-1"
                  >
                    <Lock className="w-3.5 h-3.5 text-slate-600" />
                    <span>
                      {t('skill.passiveSlotLocked', { level: unlockGearLv })}
                    </span>
                  </div>
                );
              }

              if (!slotSkill) {
                return (
                  <div
                    key={`passive-empty-${idx}`}
                    data-testid={`passive-slot-${idx}`}
                    className="min-h-[68px] rounded-md border border-dashed border-emerald-500/30 bg-[#08120F]/60 p-2 flex flex-col items-center justify-center text-slate-500 text-xs"
                  >
                    <span className="font-mono-nums text-[10px] mb-0.5">
                      P#{idx + 1}
                    </span>
                    <span>{t('skill.passiveSlotEmpty')}</span>
                  </div>
                );
              }

              const slotRawLv = activeGear.skillLevels[slotSkill.id] ?? 1;
              const slotEffLv = Math.min(skillMaxLevel, slotRawLv);
              const slotSummary = formatSkillRealSummary(
                slotSkill,
                slotRawLv,
                lang,
                adminConfig,
                0
              );

              return (
                <div
                  key={`passive-filled-${slotSkill.id}`}
                  data-testid={`passive-slot-${idx}`}
                  title={slotSummary.tooltipText}
                  className="min-h-[68px] rounded-md border border-emerald-500/60 bg-[#08120F] p-2 flex flex-col justify-between gap-1"
                >
                  <div className="flex items-start justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="w-6 h-6 rounded bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-300 shrink-0">
                        <SkillIcon icon={slotSkill.icon} className="w-3.5 h-3.5" />
                      </span>
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold text-slate-100 leading-tight truncate">
                          {getSkillName(lang, slotSkill.id)}
                        </div>
                        <div className="text-[10px] font-mono-nums text-emerald-300">
                          Lv.{slotEffLv}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUnequipPassive(slotSkill.id)}
                      title={t('skill.passiveUnequipBtn')}
                      className="w-6 h-6 md:w-5 md:h-5 rounded bg-slate-800 hover:bg-red-500/80 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <SkillSummaryInline
                    summary={slotSummary}
                    mods={adminConfig.iconCatalogMods}
                    compact
                  />
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {passiveSkills.map((skill) => {
              const currentLv = activeGear.skillLevels[skill.id] ?? 0;
              const effectiveLv =
                currentLv >= 1 ? Math.min(skillMaxLevel, currentLv) : 0;
              const isLearned = currentLv >= 1;
              const isMax = currentLv >= skillMaxLevel;
              const nextLv = Math.min(skillMaxLevel, currentLv + 1);
              const reqGearLv = getRequiredGearLevelForSkillLevel(
                skill,
                nextLv,
                skillMaxLevel
              );
              const cost = getSkillLearnOrUpgradeCost(skill, nextLv);
              const validation = validateLearnOrUpgradeSkill(
                pilot,
                activeGear.classId,
                skill.id,
                adminConfig
              );
              const isEquippedInActiveSlot = activeEquippedPassives.includes(
                skill.id
              );
              const isEquippedInOverflowSlot =
                !isEquippedInActiveSlot && equippedPassives.includes(skill.id);
              const equipPassiveVal = validateEquipPassiveSkill(
                activeGear,
                skill.id,
                adminConfig
              );
              const summary = formatSkillRealSummary(
                skill,
                currentLv,
                lang,
                adminConfig,
                0
              );

              return (
                <div
                  key={skill.id}
                  title={summary.tooltipText}
                  onClick={() => {
                    if (window.innerWidth < 768) setMobileSkillId(skill.id);
                  }}
                  className={`rounded-md border p-3.5 flex flex-col justify-between gap-3 cursor-pointer md:cursor-default ${
                    isEquippedInActiveSlot
                      ? 'border-emerald-500/60 bg-[#08120F]'
                      : isLearned
                      ? 'border-emerald-500/25 bg-[#0A111A]'
                      : 'border-slate-800 bg-[#080C14]/80 opacity-85'
                  }`}
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-md border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 flex items-center justify-center shrink-0">
                          <SkillIcon icon={skill.icon} className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-display text-lg font-bold text-slate-100 leading-tight">
                              {getSkillName(lang, skill.id)}
                            </h3>
                            {isEquippedInActiveSlot && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                {t('skill.passiveSlotActive')}
                              </span>
                            )}
                            {isEquippedInOverflowSlot && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                {t('skill.passiveOverCapTag')}
                              </span>
                            )}
                            {isLearned &&
                              !isEquippedInActiveSlot &&
                              !isEquippedInOverflowSlot && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                                  {t('skill.passiveUnequippedTag')}
                                </span>
                              )}
                          </div>
                          <p className="text-sm md:text-xs text-slate-400 mt-1">
                            {getSkillDesc(lang, skill.id)}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-mono-nums text-xs font-bold text-emerald-300 block">
                          {isLearned
                            ? t('skill.levelLabel', {
                                level: effectiveLv,
                                max: skillMaxLevel,
                              })
                            : t('skill.notLearned')}
                        </span>
                        {currentLv > skillMaxLevel && (
                          <span className="font-mono-nums text-[10px] text-amber-300 block">
                            ({t('skill.storedLevelNote', { stored: currentLv })})
                          </span>
                        )}
                      </div>
                    </div>

                    <SkillSummaryInline
                      summary={summary}
                      mods={adminConfig.iconCatalogMods}
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-xs">
                    <span className="text-slate-400 font-mono-nums">
                      {isMax
                        ? t('skill.maxLevel', { max: skillMaxLevel })
                        : t('skill.reqGearLv', { level: reqGearLv })}
                    </span>

                    <div className="flex flex-wrap items-center gap-2">
                      {!isMax && (
                        <button
                          type="button"
                          disabled={!validation.ok}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLearnOrUpgrade(skill);
                          }}
                          className="min-h-[44px] md:min-h-0 md:h-8 px-3 inline-flex items-center gap-1.5 rounded-lg md:rounded bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-slate-950 font-semibold text-xs transition-colors cursor-pointer"
                        >
                          <ArrowUpCircle className="w-3.5 h-3.5" />
                          <span>
                            {isLearned
                              ? t('skill.upgradeBtn', {
                                  next: nextLv,
                                  cost: cost.toLocaleString(),
                                })
                              : t('skill.learnBtn', {
                                  cost: cost.toLocaleString(),
                                })}
                          </span>
                        </button>
                      )}

                      {isLearned &&
                        (isEquippedInActiveSlot || isEquippedInOverflowSlot ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUnequipPassive(skill.id);
                            }}
                            className="min-h-[44px] md:min-h-0 md:h-8 px-2.5 inline-flex items-center gap-1 rounded-lg md:rounded border border-emerald-400/60 bg-emerald-500/15 hover:bg-red-500/20 hover:border-red-400/60 text-emerald-200 hover:text-red-200 text-xs font-semibold transition-colors cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>{t('skill.passiveEquippedBtn')}</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={!equipPassiveVal.ok}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEquipPassive(skill);
                            }}
                            className="min-h-[44px] md:min-h-0 md:h-8 px-2.5 inline-flex items-center gap-1 rounded-lg md:rounded border border-sky-500/50 bg-sky-500/15 hover:bg-sky-500/25 disabled:bg-slate-900 disabled:border-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-sky-200 text-xs font-semibold transition-colors cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>
                              {equipPassiveVal.reason === 'passive_slots_full'
                                ? t('skill.passiveSlotsFull', {
                                    used: equippedPassives.length,
                                    max: unlockedPassiveSlots,
                                  })
                                : t('skill.passiveEquipBtn')}
                            </span>
                          </button>
                        ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 3. ACTIVE SKILL CATALOG */}
      <section className="space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
          <h2 className="font-display text-lg font-bold tracking-wide text-slate-100">
            {t('skill.catalogTitle', { gear: activeGearName })}
          </h2>

          <div
            data-testid="skill-filter-tabs"
            className="flex flex-wrap items-center gap-1.5"
            role="tablist"
          >
            {(
              [
                {
                  id: 'all',
                  label: t('skill.filterAll', {
                    count: activeCatalogSkills.length,
                  }),
                  icon: <ClassIcon classId="all" className="w-3.5 h-3.5 shrink-0" />,
                },
                {
                  id: 'class',
                  label: t('skill.filterClass', {
                    className: activeGearName,
                    count: classOnlyCount,
                  }),
                  icon: (
                    <ClassIcon
                      classId={activeGear.classId}
                      className="w-3.5 h-3.5 shrink-0"
                    />
                  ),
                },
                {
                  id: 'general',
                  label: t('skill.filterGeneral', { count: generalCount }),
                  icon: (
                    <ClassIcon classId="general" className="w-3.5 h-3.5 shrink-0" />
                  ),
                },
                {
                  id: 'special_elite',
                  label: t('skill.filterSpecialElite', {
                    count: specialEliteCount,
                  }),
                  icon: (
                    <Award className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  ),
                },
              ] as Array<{ id: SkillFilter; label: string; icon: ReactNode }>
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                data-testid={`skill-filter-tab-${opt.id}`}
                onClick={() => setFilter(opt.id)}
                className={`min-h-[44px] md:min-h-0 md:h-8 px-3 rounded-lg md:rounded border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap inline-flex items-center gap-1.5 ${
                  filter === opt.id
                    ? 'bg-slate-800 border-amber-400/80 text-slate-50'
                    : 'bg-slate-900/70 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {opt.icon}
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Mobile List Rows (< md) -> Detail + Actions in BottomSheet */}
        <div className="md:hidden divide-y divide-slate-800/80 rounded-lg border border-slate-800 bg-[#0C121D]/95 overflow-hidden">
          {filteredActiveSkills.map((skill) => {
            const currentLv = activeGear.skillLevels[skill.id] ?? 0;
            const effectiveLv =
              currentLv >= 1 ? Math.min(skillMaxLevel, currentLv) : 0;
            const isLearned = currentLv >= 1;
            const nextLv = Math.min(skillMaxLevel, currentLv + 1);
            const reqGearLv = getRequiredGearLevelForSkillLevel(
              skill,
              nextLv,
              skillMaxLevel
            );
            const isEquipped = activeGear.equippedSkillBar.includes(skill.id);
            const needsCard =
              !isLearned &&
              Boolean(skill.openingCardId) &&
              !pilot.ownedOpeningCards.includes(skill.openingCardId!);
            const isLevelLocked = activeGear.level < reqGearLv;
            const isGreyedOut = !isLearned && (needsCard || isLevelLocked);
            const spCost = getEffectiveSpCost(skill, activeGear, adminConfig);
            const summary = formatSkillRealSummary(
              skill,
              currentLv,
              lang,
              adminConfig,
              spCost
            );

            return (
              <button
                key={skill.id}
                type="button"
                title={summary.tooltipText}
                onClick={() => setMobileSkillId(skill.id)}
                className={`w-full min-h-[68px] px-3.5 py-3 flex items-center justify-between gap-3 text-left active:bg-slate-800/70 cursor-pointer ${
                  isGreyedOut ? 'opacity-70' : ''
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 ${
                      isGreyedOut
                        ? 'border-slate-800 bg-slate-900 text-slate-500'
                        : skill.category === 'elite'
                        ? 'border-amber-400/60 bg-amber-500/15 text-amber-300'
                        : skill.category === 'special'
                        ? 'border-purple-400/60 bg-purple-500/15 text-purple-300'
                        : 'border-sky-500/40 bg-sky-500/10 text-sky-300'
                    }`}
                  >
                    {isGreyedOut ? (
                      <Lock className="w-4 h-4" />
                    ) : (
                      <SkillIcon icon={skill.icon} className="w-5 h-5" />
                    )}
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-slate-100 truncate">
                        {getSkillName(lang, skill.id)}
                      </span>
                      {isEquipped && (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold shrink-0">
                          {t('skill.equippedBtn')}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 truncate">
                      {getSkillCategoryLabel(lang, skill.category)} · {spCost} SP ·{' '}
                      {isLearned ? `Lv.${effectiveLv}/${skillMaxLevel}` : t('skill.notLearned')}
                    </div>
                    <SkillSummaryInline
                      summary={summary}
                      mods={adminConfig.iconCatalogMods}
                      compact
                    />
                  </div>
                </div>

                <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
              </button>
            );
          })}
        </div>

        {/* Desktop Multi-Column Grid (>= md) */}
        <div className="hidden md:grid grid-cols-2 xl:grid-cols-3 gap-3.5">
          {filteredActiveSkills.map((skill) => {
            const currentLv = activeGear.skillLevels[skill.id] ?? 0;
            const effectiveLv =
              currentLv >= 1 ? Math.min(skillMaxLevel, currentLv) : 0;
            const isLearned = currentLv >= 1;
            const isMax = currentLv >= skillMaxLevel;
            const nextLv = Math.min(skillMaxLevel, currentLv + 1);
            const reqGearLv = getRequiredGearLevelForSkillLevel(
              skill,
              nextLv,
              skillMaxLevel
            );
            const cost = getSkillLearnOrUpgradeCost(skill, nextLv);
            const learnVal = validateLearnOrUpgradeSkill(
              pilot,
              activeGear.classId,
              skill.id,
              adminConfig
            );
            const isEquipped = activeGear.equippedSkillBar.includes(skill.id);
            const equipVal = validateEquipSkillOnBar(activeGear, skill.id);
            const needsCard =
              !isLearned &&
              Boolean(skill.openingCardId) &&
              !pilot.ownedOpeningCards.includes(skill.openingCardId!);
            const hasCard =
              Boolean(skill.openingCardId) &&
              pilot.ownedOpeningCards.includes(skill.openingCardId!);
            const isLevelLocked = activeGear.level < reqGearLv;
            const isGreyedOut = !isLearned && (needsCard || isLevelLocked);
            const spCost = getEffectiveSpCost(skill, activeGear, adminConfig);
            const summary = formatSkillRealSummary(
              skill,
              currentLv,
              lang,
              adminConfig,
              spCost
            );

            return (
              <div
                key={skill.id}
                title={summary.tooltipText}
                className={`rounded-lg border p-4 flex flex-col justify-between gap-3 transition-colors ${
                  isEquipped
                    ? 'border-amber-400/70 bg-[#0D1524]'
                    : isGreyedOut
                    ? 'border-slate-800/70 bg-[#080B12]/70 opacity-75'
                    : 'border-slate-800 bg-[#0C121D]/95'
                }`}
              >
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-md border flex items-center justify-center shrink-0 ${
                          isGreyedOut
                            ? 'border-slate-800 bg-slate-900 text-slate-500'
                            : skill.category === 'elite'
                            ? 'border-amber-400/60 bg-amber-500/15 text-amber-300'
                            : skill.category === 'special'
                            ? 'border-purple-400/60 bg-purple-500/15 text-purple-300'
                            : 'border-sky-500/40 bg-sky-500/10 text-sky-300'
                        }`}
                      >
                        {isGreyedOut ? (
                          <Lock className="w-4 h-4" />
                        ) : (
                          <SkillIcon icon={skill.icon} className="w-5 h-5" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${getCategoryStyle(
                              skill.category
                            )}`}
                          >
                            {getSkillCategoryLabel(lang, skill.category)}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {skill.classScope === 'general'
                              ? t('skill.scope.general')
                              : activeGearName}
                          </span>
                        </div>
                        <h3 className="font-display text-lg font-bold text-slate-100 leading-tight mt-0.5">
                          {getSkillName(lang, skill.id)}
                        </h3>
                      </div>
                    </div>

                    <div className="text-right font-mono-nums shrink-0">
                      <div className="text-xs font-bold text-amber-400">
                        {spCost} SP
                      </div>
                      <div
                        className={`text-[11px] font-semibold ${
                          isLearned ? 'text-sky-300' : 'text-slate-500'
                        }`}
                      >
                        {isLearned
                          ? t('skill.levelLabel', {
                              level: effectiveLv,
                              max: skillMaxLevel,
                            })
                          : t('skill.notLearned')}
                      </div>
                      {currentLv > skillMaxLevel && (
                        <div className="text-[10px] text-amber-300">
                          ({t('skill.storedLevelNote', { stored: currentLv })})
                        </div>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    {getSkillDesc(lang, skill.id)}
                  </p>

                  <SkillSummaryInline
                    summary={summary}
                    mods={adminConfig.iconCatalogMods}
                  />

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono-nums text-slate-400">
                    <span>{summary.targetText}</span>
                    <span>·</span>
                    <span>{summary.cooldownText}</span>
                  </div>

                  {!isMax && (needsCard || isLevelLocked || hasCard) && (
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      {isLevelLocked && (
                        <span className="px-2 py-0.5 rounded bg-red-500/10 border border-red-500/30 text-red-300 font-mono-nums">
                          {t('common.reqLevel', { level: reqGearLv })}
                        </span>
                      )}
                      {needsCard && (
                        <span className="px-2 py-0.5 rounded bg-purple-500/15 border border-purple-500/40 text-purple-200 inline-flex items-center gap-1">
                          <KeyRound className="w-3 h-3" />
                          <span>{t('skill.needOpeningCard')}</span>
                        </span>
                      )}
                      {!isLearned && hasCard && (
                        <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 inline-flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          <span>{t('skill.cardOwned')}</span>
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="pt-2.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
                  {needsCard ? (
                    <button
                      type="button"
                      onClick={openWarPointShop}
                      className="h-8 px-3 inline-flex items-center gap-1 rounded border border-purple-500/50 bg-purple-500/15 hover:bg-purple-500/25 text-purple-200 font-semibold text-xs transition-colors cursor-pointer"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>{t('skill.getCardInWpShop')}</span>
                    </button>
                  ) : isMax ? (
                    <span className="h-8 px-2.5 inline-flex items-center rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 font-semibold text-xs">
                      {t('skill.maxLevel', { max: skillMaxLevel })}
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={!learnVal.ok}
                      onClick={() => handleLearnOrUpgrade(skill)}
                      className="h-8 px-3 inline-flex items-center gap-1.5 rounded bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-slate-950 font-semibold text-xs transition-colors cursor-pointer"
                    >
                      <ArrowUpCircle className="w-3.5 h-3.5" />
                      <span>
                        {isLearned
                          ? t('skill.upgradeBtn', {
                              next: nextLv,
                              cost: cost.toLocaleString(),
                            })
                          : t('skill.learnBtn', {
                              cost: cost.toLocaleString(),
                            })}
                      </span>
                    </button>
                  )}

                  {isLearned &&
                    (isEquipped ? (
                      <button
                        type="button"
                        onClick={() => handleUnequip(skill.id)}
                        className="h-8 px-2.5 inline-flex items-center gap-1 rounded border border-amber-400/60 bg-amber-500/15 hover:bg-red-500/20 hover:border-red-400/60 text-amber-200 hover:text-red-200 text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{t('skill.equippedBtn')}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={!equipVal.ok}
                        onClick={() => handleEquip(skill)}
                        className="h-8 px-2.5 inline-flex items-center gap-1 rounded border border-sky-500/50 bg-sky-500/15 hover:bg-sky-500/25 disabled:bg-slate-900 disabled:border-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-sky-200 text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>
                          {equipVal.reason === 'bar_full'
                            ? t('skill.barFull')
                            : t('skill.equipBtn')}
                        </span>
                      </button>
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Mobile Skill Detail BottomSheet (< md) */}
      <div className="md:hidden">
        <BottomSheet
          open={Boolean(mobileSelectedSkill)}
          onClose={() => setMobileSkillId(null)}
          title={
            mobileSelectedSkill
              ? getSkillName(lang, mobileSelectedSkill.id)
              : ''
          }
          subtitle={
            mobileSelectedSkill
              ? `${getSkillCategoryLabel(
                  lang,
                  mobileSelectedSkill.category
                )} · ${getEffectiveSpCost(
                  mobileSelectedSkill,
                  activeGear,
                  adminConfig
                )} SP`
              : undefined
          }
        >
          {mobileSelectedSkill && (() => {
            const skill = mobileSelectedSkill;
            const currentLv = activeGear.skillLevels[skill.id] ?? 0;
            const effectiveLv =
              currentLv >= 1 ? Math.min(skillMaxLevel, currentLv) : 0;
            const isLearned = currentLv >= 1;
            const isMax = currentLv >= skillMaxLevel;
            const nextLv = Math.min(skillMaxLevel, currentLv + 1);
            const reqGearLv = getRequiredGearLevelForSkillLevel(
              skill,
              nextLv,
              skillMaxLevel
            );
            const cost = getSkillLearnOrUpgradeCost(skill, nextLv);
            const learnVal = validateLearnOrUpgradeSkill(
              pilot,
              activeGear.classId,
              skill.id,
              adminConfig
            );
            const isEquipped = activeGear.equippedSkillBar.includes(skill.id);
            const equipVal = validateEquipSkillOnBar(activeGear, skill.id);
            const isPassiveEquipped = equippedPassives.includes(skill.id);
            const passiveEquipVal = validateEquipPassiveSkill(
              activeGear,
              skill.id,
              adminConfig
            );
            const needsCard =
              !isLearned &&
              Boolean(skill.openingCardId) &&
              !pilot.ownedOpeningCards.includes(skill.openingCardId!);
            const isLevelLocked = activeGear.level < reqGearLv;
            const spCost = getEffectiveSpCost(skill, activeGear, adminConfig);
            const summary = formatSkillRealSummary(
              skill,
              currentLv,
              lang,
              adminConfig,
              spCost
            );

            return (
              <div className="space-y-4">
                <p className="text-sm text-slate-200 leading-relaxed">
                  {getSkillDesc(lang, skill.id)}
                </p>

                <SkillSummaryInline
                  summary={summary}
                  mods={adminConfig.iconCatalogMods}
                />

                <div className="grid grid-cols-2 gap-2 text-xs font-mono-nums">
                  <div className="rounded-lg border border-slate-800 bg-[#080C14] p-2.5">
                    <div className="text-slate-400">{t('skill.targeting')}</div>
                    <div className="text-slate-100 font-semibold mt-0.5">
                      {summary.targetText} · {summary.cooldownText}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-[#080C14] p-2.5">
                    <div className="text-slate-400">{t('common.level')}</div>
                    <div className="text-sky-300 font-semibold mt-0.5">
                      {isLearned
                        ? t('skill.levelLabel', {
                            level: effectiveLv,
                            max: skillMaxLevel,
                          })
                        : t('skill.notLearned')}
                    </div>
                  </div>
                </div>

                {!isMax && (needsCard || isLevelLocked) && (
                  <div className="flex flex-wrap gap-2 text-xs">
                    {isLevelLocked && (
                      <span className="px-2.5 py-1 rounded bg-red-500/10 border border-red-500/30 text-red-300 font-mono-nums">
                        {t('common.reqLevel', { level: reqGearLv })}
                      </span>
                    )}
                    {needsCard && (
                      <span className="px-2.5 py-1 rounded bg-purple-500/15 border border-purple-500/40 text-purple-200 inline-flex items-center gap-1">
                        <KeyRound className="w-3.5 h-3.5" />
                        <span>{t('skill.needOpeningCard')}</span>
                      </span>
                    )}
                  </div>
                )}

                <div className="flex flex-col gap-2 pt-2 border-t border-slate-800">
                  {needsCard ? (
                    <button
                      type="button"
                      onClick={() => {
                        setMobileSkillId(null);
                        openWarPointShop();
                      }}
                      className="w-full min-h-[48px] px-4 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm cursor-pointer"
                    >
                      {t('skill.getCardInWpShop')}
                    </button>
                  ) : !isMax ? (
                    <button
                      type="button"
                      disabled={!learnVal.ok}
                      onClick={() => handleLearnOrUpgrade(skill)}
                      className="w-full min-h-[48px] px-4 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-slate-950 font-bold text-sm cursor-pointer"
                    >
                      {isLearned
                        ? t('skill.upgradeBtn', {
                            next: nextLv,
                            cost: cost.toLocaleString(),
                          })
                        : t('skill.learnBtn', { cost: cost.toLocaleString() })}
                    </button>
                  ) : (
                    <div className="text-center py-2 text-sm font-bold text-emerald-400">
                      {t('skill.maxLevel', { max: skillMaxLevel })}
                    </div>
                  )}

                  {skill.category !== 'passive' &&
                    isLearned &&
                    (isEquipped ? (
                      <button
                        type="button"
                        onClick={() => handleUnequip(skill.id)}
                        className="w-full min-h-[48px] px-4 rounded-lg border border-red-500/50 bg-red-500/15 text-red-200 font-semibold text-sm cursor-pointer"
                      >
                        {t('skill.unequipBtn')}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={!equipVal.ok}
                        onClick={() => handleEquip(skill)}
                        className="w-full min-h-[48px] px-4 rounded-lg border border-sky-500/50 bg-sky-500/15 disabled:bg-slate-900 disabled:text-slate-500 text-sky-200 font-semibold text-sm cursor-pointer"
                      >
                        {equipVal.reason === 'bar_full'
                          ? t('skill.barFull')
                          : t('skill.equipBtn')}
                      </button>
                    ))}

                  {skill.category === 'passive' &&
                    isLearned &&
                    (isPassiveEquipped ? (
                      <button
                        type="button"
                        onClick={() => handleUnequipPassive(skill.id)}
                        className="w-full min-h-[48px] px-4 rounded-lg border border-red-500/50 bg-red-500/15 text-red-200 font-semibold text-sm cursor-pointer"
                      >
                        {t('skill.passiveUnequipBtn')}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={!passiveEquipVal.ok}
                        onClick={() => handleEquipPassive(skill)}
                        className="w-full min-h-[48px] px-4 rounded-lg border border-emerald-500/50 bg-emerald-500/15 disabled:bg-slate-900 disabled:text-slate-500 text-emerald-200 font-semibold text-sm cursor-pointer"
                      >
                        {passiveEquipVal.reason === 'passive_slots_full'
                          ? t('skill.passiveSlotsFull', {
                              used: equippedPassives.length,
                              max: unlockedPassiveSlots,
                            })
                          : t('skill.passiveEquipBtn')}
                      </button>
                    ))}
                </div>
              </div>
            );
          })()}
        </BottomSheet>
      </div>
    </div>
  );
}
