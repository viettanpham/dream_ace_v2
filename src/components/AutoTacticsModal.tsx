import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  GripVertical,
  Plus,
  RotateCcw,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { BALANCE_CONFIG } from '../data/balance';
import { getSkillById } from '../data/skills';
import { getSkillsForClass } from '../engine/skills';
import {
  createDefaultSimpleTactics,
  MAX_PRIORITY_SKILLS,
  TACTICS_BUFF_OPTIONS,
  TACTICS_CONDITION_KINDS,
  TACTICS_TARGET_SELECTORS,
} from '../engine/tactics';
import { sanitizeLidarAutoConfig } from '../engine/lidarAuto';
import { sanitizeFluxAutoConfig } from '../engine/fluxAuto';
import {
  AUTO_SUPPLIES_MAX_PCT,
  AUTO_SUPPLIES_MIN_PCT,
  sanitizeAutoSuppliesConfig,
} from '../engine/supplyAi';
import {
  formatSimpleTacticsSummary,
  formatTacticsRuleSentence,
  getClassName,
  getSkillName,
  getStatusLabel,
  getTacticsPresetLabel,
  getTacticsTargetLabel,
  useI18n,
} from '../i18n';
import { useGameStore } from '../store/useGameStore';
import type {
  SimpleElitePolicy,
  SimpleLowHpAction,
  SimpleSkillUsage,
  SimpleTacticsPresetId,
  SimpleTargetPref,
  StatusEffectType,
  TacticsConditionKind,
  TacticsPresetId,
  TacticsRule,
  TacticsTargetSelector,
} from '../types/game';
import { SkillIcon } from './SkillIcon';

const ADVANCED_PRESET_IDS: TacticsPresetId[] = [
  'class_default',
  'balanced',
  'focus_weak',
  'defensive',
];

const SIMPLE_PRESET_IDS: SimpleTacticsPresetId[] = [
  'balanced',
  'aggressive',
  'defensive',
  'support_team',
  'save_sp',
];

const SIMPLE_TARGETS: SimpleTargetPref[] = [
  'weakest',
  'strongest',
  'support_first',
  'sniper_first',
  'front_row',
];

const SIMPLE_SKILL_USAGE: SimpleSkillUsage[] = [
  'always',
  'save_sp_50',
  'needed_only',
];

const SIMPLE_LOW_HP_ACTIONS: SimpleLowHpAction[] = [
  'defend',
  'heal',
  'retreat',
  'nothing',
];

const SIMPLE_ELITE_POLICIES: SimpleElitePolicy[] = [
  'immediate',
  'boss_only',
  'off',
];

function conditionNeedsNumber(kind: TacticsConditionKind): boolean {
  return (
    kind === 'my_hp_below' ||
    kind === 'my_sp_gte' ||
    kind === 'my_sp_lt' ||
    kind === 'my_sp_pct_gte' ||
    kind === 'any_ally_hp_below' ||
    kind === 'enemy_count_gte' ||
    kind === 'target_hp_below' ||
    kind === 'round_eq'
  );
}

function defaultNumberForCondition(kind: TacticsConditionKind): number {
  switch (kind) {
    case 'my_hp_below':
    case 'any_ally_hp_below':
      return 40;
    case 'target_hp_below':
    case 'my_sp_pct_gte':
      return 50;
    case 'my_sp_gte':
    case 'my_sp_lt':
      return 15;
    case 'enemy_count_gte':
      return 2;
    case 'round_eq':
      return 1;
    default:
      return 0;
  }
}

function defaultTargetForSkill(
  skillId: string,
  skillMods?: Parameters<typeof getSkillById>[1]
): TacticsTargetSelector {
  const sk = getSkillById(skillId, skillMods);
  if (!sk) return 'lowest_hp_enemy';
  switch (sk.targetType) {
    case 'self':
      return 'self';
    case 'single_ally':
      return 'lowest_hp_ally';
    case 'all_allies':
      return 'all_allies';
    default:
      return 'lowest_hp_enemy';
  }
}

export function AutoTacticsModal() {
  const { lang, t } = useI18n();
  const open = useGameStore((s) => s.tacticsModalOpen);
  const pilot = useGameStore((s) => s.pilot);
  const skillMods = useGameStore((s) => s.adminConfig.skillMods);
  const setTacticsModalOpen = useGameStore((s) => s.setTacticsModalOpen);
  const loadTacticsPreset = useGameStore((s) => s.loadTacticsPreset);
  const addTacticsRule = useGameStore((s) => s.addTacticsRule);
  const updateTacticsRule = useGameStore((s) => s.updateTacticsRule);
  const deleteTacticsRule = useGameStore((s) => s.deleteTacticsRule);
  const reorderTacticsRules = useGameStore((s) => s.reorderTacticsRules);
  const updateTacticsSafety = useGameStore((s) => s.updateTacticsSafety);
  const applySimpleTactics = useGameStore((s) => s.applySimpleTactics);
  const applySimpleTacticsPreset = useGameStore(
    (s) => s.applySimpleTacticsPreset
  );
  const resetTacticsToSimple = useGameStore((s) => s.resetTacticsToSimple);

  const [activeTab, setActiveTab] = useState<'simple' | 'advanced'>('simple');
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const activeGear = pilot.gears[pilot.activeGearId];
  const gearName = getClassName(lang, activeGear.classId);

  // Strictly class-allowed active skills (bar skills listed first)
  const allowedActiveSkills = useMemo(() => {
    const all = getSkillsForClass(activeGear.classId, skillMods).filter(
      (s) => s.category !== 'passive'
    );
    const barSet = new Set(activeGear.equippedSkillBar);
    const onBar = activeGear.equippedSkillBar
      .map((id) => getSkillById(id, skillMods))
      .filter((s): s is NonNullable<typeof s> => Boolean(s));
    const others = all.filter((s) => !barSet.has(s.id));
    return [...onBar, ...others];
  }, [activeGear.classId, activeGear.equippedSkillBar, skillMods]);

  const equippedBarSkills = useMemo(() => {
    return activeGear.equippedSkillBar
      .map((id) => getSkillById(id, skillMods))
      .filter((s): s is NonNullable<typeof s> => Boolean(s));
  }, [activeGear.equippedSkillBar, skillMods]);

  const simpleConfig =
    activeGear.tactics.simple ??
    createDefaultSimpleTactics(
      activeGear.classId,
      activeGear.equippedSkillBar
    );
  const lidarCfg = sanitizeLidarAutoConfig(simpleConfig.lidarAuto);
  const fluxCfg = sanitizeFluxAutoConfig(simpleConfig.fluxAuto);
  const suppliesCfg = sanitizeAutoSuppliesConfig(simpleConfig.autoSupplies);

  const [fluxAllyDraft, setFluxAllyDraft] = useState<string>(() =>
    String(fluxCfg.allySpBelowPct)
  );
  const [fluxKeepDraft, setFluxKeepDraft] = useState<string>(() =>
    String(fluxCfg.keepSelfPct)
  );
  const [supHpDraft, setSupHpDraft] = useState<string>(() =>
    String(suppliesCfg.hpBelowPct)
  );
  const [supShieldDraft, setSupShieldDraft] = useState<string>(() =>
    String(suppliesCfg.shieldBelowPct)
  );
  const [supSpDraft, setSupSpDraft] = useState<string>(() =>
    String(suppliesCfg.spBelowPct)
  );

  useEffect(() => {
    setFluxAllyDraft(String(fluxCfg.allySpBelowPct));
  }, [fluxCfg.allySpBelowPct, open]);

  useEffect(() => {
    setFluxKeepDraft(String(fluxCfg.keepSelfPct));
  }, [fluxCfg.keepSelfPct, open]);

  useEffect(() => {
    setSupHpDraft(String(suppliesCfg.hpBelowPct));
  }, [suppliesCfg.hpBelowPct, open]);

  useEffect(() => {
    setSupShieldDraft(String(suppliesCfg.shieldBelowPct));
  }, [suppliesCfg.shieldBelowPct, open]);

  useEffect(() => {
    setSupSpDraft(String(suppliesCfg.spBelowPct));
  }, [suppliesCfg.spBelowPct, open]);

  if (!open) return null;

  const { rules, safety } = activeGear.tactics;
  const isCustomMode = activeGear.tactics.mode === 'custom';
  const maxRules = BALANCE_CONFIG.maxTacticsRules;

  const parseFluxPctDraft = (raw: string): number | null => {
    const trimmed = raw.trim();
    if (trimmed === '') return null;
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) return null;
    return Math.round(parsed);
  };

  const commitFluxAllyPct = () => {
    const next = parseFluxPctDraft(fluxAllyDraft);
    if (next === null) {
      setFluxAllyDraft(String(fluxCfg.allySpBelowPct));
      return;
    }
    setFluxAllyDraft(String(next));
    applySimpleTactics({
      fluxAuto: {
        ...fluxCfg,
        allySpBelowPct: next,
      },
    });
  };

  const commitFluxKeepPct = () => {
    const next = parseFluxPctDraft(fluxKeepDraft);
    if (next === null) {
      setFluxKeepDraft(String(fluxCfg.keepSelfPct));
      return;
    }
    setFluxKeepDraft(String(next));
    applySimpleTactics({
      fluxAuto: {
        ...fluxCfg,
        keepSelfPct: next,
      },
    });
  };

  const commitSupplyPct = (
    field: 'hpBelowPct' | 'shieldBelowPct' | 'spBelowPct',
    draft: string,
    setDraft: (v: string) => void
  ) => {
    const trimmed = draft.trim();
    const parsed = Number(trimmed);
    if (
      trimmed === '' ||
      !Number.isFinite(parsed) ||
      parsed < AUTO_SUPPLIES_MIN_PCT ||
      parsed > AUTO_SUPPLIES_MAX_PCT
    ) {
      setDraft(String(suppliesCfg[field]));
      return;
    }
    const next = Math.round(parsed);
    setDraft(String(next));
    applySimpleTactics({
      autoSupplies: {
        ...suppliesCfg,
        [field]: next,
      },
    });
  };

  const handleTogglePrioritySkill = (skillId: string) => {
    const cur = [...simpleConfig.prioritySkillIds];
    const existingIdx = cur.indexOf(skillId);
    if (existingIdx >= 0) {
      cur.splice(existingIdx, 1);
    } else if (cur.length < MAX_PRIORITY_SKILLS) {
      cur.push(skillId);
    } else {
      cur[cur.length - 1] = skillId;
    }
    applySimpleTactics({ prioritySkillIds: cur });
  };

  const handleMovePrioritySkill = (index: number, delta: -1 | 1) => {
    const targetIdx = index + delta;
    const cur = [...simpleConfig.prioritySkillIds];
    if (targetIdx < 0 || targetIdx >= cur.length) return;
    const [moved] = cur.splice(index, 1);
    cur.splice(targetIdx, 0, moved);
    applySimpleTactics({ prioritySkillIds: cur });
  };

  const handleConditionKindChange = (
    rule: TacticsRule,
    nextKind: TacticsConditionKind
  ) => {
    const nextCond: TacticsRule['condition'] = { kind: nextKind };
    if (conditionNeedsNumber(nextKind)) {
      nextCond.value = defaultNumberForCondition(nextKind);
    }
    if (nextKind === 'my_buff_not_active') {
      nextCond.buffType = rule.condition.buffType ?? 'def_up';
    }
    if (nextKind === 'skill_off_cooldown') {
      nextCond.skillId =
        rule.action.type === 'skill' && rule.action.skillId
          ? rule.action.skillId
          : activeGear.equippedSkillBar[0] ?? allowedActiveSkills[0]?.id;
    }
    updateTacticsRule(rule.id, { condition: nextCond });
  };

  const handleActionSelect = (rule: TacticsRule, rawVal: string) => {
    if (rawVal === 'attack') {
      updateTacticsRule(rule.id, {
        action: { type: 'attack' },
        targetSelector:
          rule.targetSelector === 'self' ||
          rule.targetSelector === 'lowest_hp_ally' ||
          rule.targetSelector === 'all_allies'
            ? 'lowest_hp_enemy'
            : rule.targetSelector,
      });
    } else if (rawVal === 'defend') {
      updateTacticsRule(rule.id, {
        action: { type: 'defend' },
        targetSelector: 'self',
      });
    } else if (rawVal.startsWith('skill:')) {
      const skillId = rawVal.slice('skill:'.length);
      updateTacticsRule(rule.id, {
        action: { type: 'skill', skillId },
        targetSelector: defaultTargetForSkill(skillId, skillMods),
      });
    }
  };

  const getConditionOptionLabel = (kind: TacticsConditionKind): string => {
    switch (kind) {
      case 'my_hp_below':
        return t('auto.cond.my_hp_below', { value: 'X' });
      case 'my_sp_gte':
        return t('auto.cond.my_sp_gte', { value: 'X' });
      case 'my_sp_lt':
        return t('auto.cond.my_sp_lt', { value: 'X' });
      case 'my_sp_pct_gte':
        return t('auto.cond.my_sp_pct_gte', { value: 'X' });
      case 'any_ally_hp_below':
        return t('auto.cond.any_ally_hp_below', { value: 'X' });
      case 'enemy_count_gte':
        return t('auto.cond.enemy_count_gte', { value: 'N' });
      case 'target_hp_below':
        return t('auto.cond.target_hp_below', { value: 'X' });
      case 'round_eq':
        return t('auto.cond.round_eq', { value: 'N' });
      case 'my_buff_not_active':
        return t('auto.cond.my_buff_not_active', { buff: '...' });
      case 'skill_off_cooldown':
        return t('auto.cond.skill_off_cooldown', { skill: '...' });
      default:
        return t(`auto.cond.${kind}` as never);
    }
  };

  const priorityRankLabels = Array.from(
    { length: MAX_PRIORITY_SKILLS },
    (_, i) => String.fromCharCode(65 + i)
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auto-tactics-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) setTacticsModalOpen(false);
      }}
    >
      <div className="w-full sm:max-w-3xl max-h-[90dvh] flex flex-col rounded-t-2xl sm:rounded-lg border-t sm:border border-slate-700 bg-[#0C121E] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="shrink-0 px-4 sm:px-5 py-3 border-b border-slate-800 flex items-start justify-between gap-3 bg-[#090E18]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-emerald-400 shrink-0" />
              <h2
                id="auto-tactics-title"
                className="font-display text-xl sm:text-2xl font-bold tracking-wide text-slate-50 truncate"
              >
                {t('auto.tacticsTitle', { gear: gearName })}
              </h2>
              <span className="font-mono-nums text-xs px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 shrink-0">
                {t('auto.rulesCount', { count: rules.length, max: maxRules })}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {t('auto.tacticsSubtitle')}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setTacticsModalOpen(false)}
            aria-label={t('common.close')}
            className="min-h-[40px] min-w-[40px] rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Switcher Tabs: Simple (default) | Advanced */}
        <div className="shrink-0 px-4 sm:px-5 py-2 border-b border-slate-800/90 bg-[#080C15] flex items-center justify-between gap-3">
          <div
            className="inline-flex items-center rounded-lg border border-slate-700 bg-slate-950 p-0.5"
            role="tablist"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'simple'}
              onClick={() => setActiveTab('simple')}
              className={`min-h-[38px] px-4 rounded-md text-xs sm:text-sm font-semibold transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
                activeTab === 'simple'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{t('auto.tabSimple')}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'advanced'}
              onClick={() => setActiveTab('advanced')}
              className={`min-h-[38px] px-4 rounded-md text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
                activeTab === 'advanced'
                  ? 'bg-sky-500 text-slate-950'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              {t('auto.tabAdvanced')}
            </button>
          </div>

          <span className="text-[11px] font-mono-nums text-slate-400">
            {t('auto.simple.generatedCount', { count: rules.length })}
          </span>
        </div>

        {activeTab === 'simple' ? (
          /* ================= SIMPLE MODE TAB ================= */
          <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4 tactical-scroll pb-safe">
            {/* Custom Tactics Warning Banner (when user edited rules in Advanced) */}
            {isCustomMode && (
              <div className="rounded-lg border border-amber-500/50 bg-amber-500/12 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-start gap-2 text-xs text-amber-200 leading-relaxed">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>{t('auto.simple.customBanner')}</span>
                </div>
                <button
                  type="button"
                  onClick={resetTacticsToSimple}
                  className="min-h-[40px] px-3 rounded border border-amber-400/70 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{t('auto.simple.resetBtn')}</span>
                </button>
              </div>
            )}

            {/* Live Plain-Language Summary Card */}
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/8 p-3.5 space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300">
                {t('auto.simple.summaryTitle')}
              </div>
              <p className="text-sm text-slate-100 leading-relaxed">
                {formatSimpleTacticsSummary(lang, simpleConfig)}
              </p>
            </div>

            {/* 5 Simple Style Presets */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-300">
                {t('auto.simple.presetTitle')}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {SIMPLE_PRESET_IDS.map((pid) => {
                  const isActive =
                    !isCustomMode && simpleConfig.presetId === pid;
                  return (
                    <button
                      key={pid}
                      type="button"
                      onClick={() => applySimpleTacticsPreset(pid)}
                      className={`min-h-[44px] px-2.5 py-2 rounded-lg border text-xs font-semibold transition-colors cursor-pointer text-center ${
                        isActive
                          ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                          : 'border-slate-700 bg-slate-900/90 hover:bg-slate-800 text-slate-200'
                      }`}
                    >
                      {t(`auto.simple.preset.${pid}` as never)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Control 1: Preferred Target */}
            <div className="rounded-lg border border-slate-800 bg-[#090E18] p-3.5 space-y-2">
              <div>
                <div className="text-sm font-semibold text-slate-100">
                  {t('auto.simple.targetLabel')}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {t('auto.simple.targetHelp')}
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                {SIMPLE_TARGETS.map((pref) => {
                  const active = simpleConfig.preferredTarget === pref;
                  return (
                    <button
                      key={pref}
                      type="button"
                      onClick={() =>
                        applySimpleTactics({ preferredTarget: pref })
                      }
                      className={`min-h-[42px] px-2.5 py-1.5 rounded border text-xs font-medium transition-colors cursor-pointer ${
                        active
                          ? 'border-sky-400 bg-sky-500/20 text-sky-100 font-semibold'
                          : 'border-slate-700/90 bg-slate-950/70 hover:border-slate-600 text-slate-300'
                      }`}
                    >
                      {t(`auto.simple.target.${pref}` as never)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Control 2: Skill Usage */}
            <div className="rounded-lg border border-slate-800 bg-[#090E18] p-3.5 space-y-2">
              <div>
                <div className="text-sm font-semibold text-slate-100">
                  {t('auto.simple.skillUsageLabel')}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {t('auto.simple.skillUsageHelp')}
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                {SIMPLE_SKILL_USAGE.map((mode) => {
                  const active = simpleConfig.skillUsage === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => applySimpleTactics({ skillUsage: mode })}
                      className={`min-h-[42px] px-3 py-1.5 rounded border text-xs font-medium transition-colors cursor-pointer ${
                        active
                          ? 'border-sky-400 bg-sky-500/20 text-sky-100 font-semibold'
                          : 'border-slate-700/90 bg-slate-950/70 hover:border-slate-600 text-slate-300'
                      }`}
                    >
                      {t(`auto.simple.skillUsage.${mode}` as never)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Control 3: When My HP < X% */}
            <div className="rounded-lg border border-slate-800 bg-[#090E18] p-3.5 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-slate-100">
                    {t('auto.simple.lowHpLabel', {
                      pct: simpleConfig.lowHpThresholdPct,
                    })}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {t('auto.simple.lowHpHelp')}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={10}
                    max={70}
                    step={5}
                    value={simpleConfig.lowHpThresholdPct}
                    onChange={(e) =>
                      applySimpleTactics({
                        lowHpThresholdPct: Number(e.target.value),
                      })
                    }
                    className="w-24 sm:w-28 accent-emerald-500 cursor-pointer"
                    aria-label="Low HP threshold percentage"
                  />
                  <span className="font-mono-nums text-xs font-bold text-amber-300 w-10 text-right">
                    {simpleConfig.lowHpThresholdPct}%
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {SIMPLE_LOW_HP_ACTIONS.map((act) => {
                  const active = simpleConfig.lowHpAction === act;
                  return (
                    <button
                      key={act}
                      type="button"
                      onClick={() => applySimpleTactics({ lowHpAction: act })}
                      className={`min-h-[42px] px-2.5 py-1.5 rounded border text-xs font-medium transition-colors cursor-pointer ${
                        active
                          ? 'border-emerald-400 bg-emerald-500/20 text-emerald-100 font-semibold'
                          : 'border-slate-700/90 bg-slate-950/70 hover:border-slate-600 text-slate-300'
                      }`}
                    >
                      {t(`auto.simple.lowHp.${act}` as never)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Control 4: Elite & Special Skills */}
            <div className="rounded-lg border border-slate-800 bg-[#090E18] p-3.5 space-y-2">
              <div>
                <div className="text-sm font-semibold text-slate-100">
                  {t('auto.simple.eliteLabel')}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {t('auto.simple.eliteHelp')}
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                {SIMPLE_ELITE_POLICIES.map((pol) => {
                  const active = simpleConfig.elitePolicy === pol;
                  return (
                    <button
                      key={pol}
                      type="button"
                      onClick={() => applySimpleTactics({ elitePolicy: pol })}
                      className={`min-h-[42px] px-3 py-1.5 rounded border text-xs font-medium transition-colors cursor-pointer ${
                        active
                          ? 'border-amber-400 bg-amber-500/20 text-amber-100 font-semibold'
                          : 'border-slate-700/90 bg-slate-950/70 hover:border-slate-600 text-slate-300'
                      }`}
                    >
                      {t(`auto.simple.elite.${pol}` as never)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Control 5: Priority Skills (A > B > C) */}
            <div className="rounded-lg border border-slate-800 bg-[#090E18] p-3.5 space-y-2.5">
              <div>
                <div className="text-sm font-semibold text-slate-100">
                  {t('auto.simple.priorityLabel', { max: MAX_PRIORITY_SKILLS })}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {t('auto.simple.priorityHelp')}
                </p>
              </div>

              {/* Selected A > B > C Order Strip */}
              {simpleConfig.prioritySkillIds.length === 0 ? (
                <div className="rounded border border-dashed border-slate-700/90 bg-slate-950/60 px-3 py-2 text-xs text-slate-400">
                  {t('auto.simple.priorityEmpty')}
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  {simpleConfig.prioritySkillIds.map((sid, idx) => {
                    const sk = getSkillById(sid, skillMods);
                    if (!sk) return null;
                    return (
                      <div
                        key={sid}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/50 bg-emerald-500/12 px-2.5 py-1.5 text-xs"
                      >
                        <span className="font-mono-nums font-bold px-1.5 py-0.5 rounded bg-emerald-500 text-slate-950 text-[10px]">
                          {priorityRankLabels[idx] ?? idx + 1}
                        </span>
                        <SkillIcon
                          icon={sk.icon}
                          className="w-3.5 h-3.5 text-emerald-300 shrink-0"
                        />
                        <span className="font-semibold text-slate-100">
                          {getSkillName(sk, lang)}
                        </span>
                        {idx > 0 && (
                          <button
                            type="button"
                            onClick={() => handleMovePrioritySkill(idx, -1)}
                            aria-label={t('auto.moveUp')}
                            className="p-1 text-slate-300 hover:text-white cursor-pointer"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                        )}
                        {idx < simpleConfig.prioritySkillIds.length - 1 && (
                          <button
                            type="button"
                            onClick={() => handleMovePrioritySkill(idx, 1)}
                            aria-label={t('auto.moveDown')}
                            className="p-1 text-slate-300 hover:text-white cursor-pointer"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleTogglePrioritySkill(sid)}
                          aria-label={t('auto.deleteRule')}
                          className="p-1 text-red-300 hover:text-red-200 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Equipped Skill Bar Picker */}
              {equippedBarSkills.length === 0 ? (
                <div className="text-xs text-slate-500">
                  {t('auto.simple.noEquippedSkills')}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {equippedBarSkills.map((sk) => {
                    const rankIdx = simpleConfig.prioritySkillIds.indexOf(sk.id);
                    const picked = rankIdx >= 0;
                    return (
                      <button
                        key={sk.id}
                        type="button"
                        onClick={() => handleTogglePrioritySkill(sk.id)}
                        className={`min-h-[44px] px-2.5 py-1.5 rounded border text-left flex items-center justify-between gap-1.5 transition-colors cursor-pointer ${
                          picked
                            ? 'border-emerald-400 bg-emerald-500/18 text-emerald-100'
                            : 'border-slate-700/90 bg-slate-950/70 hover:border-slate-500 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <SkillIcon
                            icon={sk.icon}
                            className="w-3.5 h-3.5 shrink-0"
                          />
                          <span className="text-xs font-medium truncate">
                            {getSkillName(sk, lang)}
                          </span>
                        </div>
                        {picked ? (
                          <span className="font-mono-nums text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500 text-slate-950 shrink-0">
                            {priorityRankLabels[rankIdx]}
                          </span>
                        ) : (
                          <span className="font-mono-nums text-[10px] text-amber-300 shrink-0">
                            {sk.spCost}SP
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Control 6: Auto Lidar */}
            <div
              data-testid="auto-lidar-section"
              className="rounded-lg border border-slate-800 bg-[#090E18] p-3.5 space-y-2.5"
            >
              <div className="flex items-center justify-between gap-2 min-w-0">
                <span className="text-sm font-semibold text-slate-100 truncate">
                  {t('auto.simple.lidarLabel')}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={lidarCfg.enabled}
                  aria-label={t('auto.simple.lidarLabel')}
                  data-testid="auto-lidar-toggle"
                  onClick={() =>
                    applySimpleTactics({
                      lidarAuto: {
                        ...lidarCfg,
                        enabled: !lidarCfg.enabled,
                      },
                    })
                  }
                  className={`min-h-[36px] min-w-[52px] px-2.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                    lidarCfg.enabled
                      ? 'border-emerald-400 bg-emerald-500/25 text-emerald-200'
                      : 'border-slate-700 bg-slate-900 text-slate-400'
                  }`}
                >
                  {lidarCfg.enabled ? 'ON' : 'OFF'}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {(['smart', 'fixed'] as const).map((mode) => {
                  const active = lidarCfg.mode === mode;
                  const labelKey =
                    mode === 'smart'
                      ? 'auto.simple.lidarModeSmart'
                      : 'auto.simple.lidarModeFixed';
                  return (
                    <button
                      key={mode}
                      type="button"
                      data-testid={`auto-lidar-mode-${mode}`}
                      onClick={() =>
                        applySimpleTactics({
                          lidarAuto: {
                            ...lidarCfg,
                            mode,
                          },
                        })
                      }
                      className={`min-h-[40px] px-3 py-1.5 rounded border text-xs font-medium transition-colors cursor-pointer ${
                        active
                          ? 'border-cyan-400 bg-cyan-500/20 text-cyan-100 font-semibold'
                          : 'border-slate-700/90 bg-slate-950/70 hover:border-slate-600 text-slate-300'
                      }`}
                    >
                      {t(labelKey)}
                    </button>
                  );
                })}
              </div>

              {lidarCfg.mode === 'fixed' && (
                <label className="flex items-center justify-between gap-2 min-w-0 pt-0.5">
                  <span className="text-xs text-slate-300 shrink-0">
                    {t('auto.simple.lidarMinSpLabel')}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <input
                      type="number"
                      data-testid="auto-lidar-min-sp-input"
                      min={0}
                      max={100}
                      step={5}
                      value={lidarCfg.minSpPct}
                      onChange={(e) =>
                        applySimpleTactics({
                          lidarAuto: {
                            ...lidarCfg,
                            minSpPct: Math.max(
                              0,
                              Math.min(
                                100,
                                Math.round(Number(e.target.value) || 0)
                              )
                            ),
                          },
                        })
                      }
                      className="w-20 h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums text-slate-100 text-right"
                    />
                    <span className="text-xs font-mono-nums text-slate-400">
                      %
                    </span>
                  </div>
                </label>
              )}
            </div>

            {/* Control 7: Auto Flux Transfer (Support only) */}
            {activeGear.classId === 'support' && (
              <div
                data-testid="auto-flux-section"
                className="rounded-lg border border-slate-800 bg-[#090E18] p-3.5 space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <span className="text-sm font-semibold text-slate-100 truncate">
                    {t('auto.simple.fluxLabel')}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={fluxCfg.enabled}
                    aria-label={t('auto.simple.fluxLabel')}
                    data-testid="auto-flux-toggle"
                    onClick={() =>
                      applySimpleTactics({
                        fluxAuto: {
                          ...fluxCfg,
                          enabled: !fluxCfg.enabled,
                        },
                      })
                    }
                    className={`min-h-[36px] min-w-[52px] px-2.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                      fluxCfg.enabled
                        ? 'border-emerald-400 bg-emerald-500/25 text-emerald-200'
                        : 'border-slate-700 bg-slate-900 text-slate-400'
                    }`}
                  >
                    {fluxCfg.enabled ? 'ON' : 'OFF'}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  {(['smart', 'fixed'] as const).map((mode) => {
                    const active = fluxCfg.mode === mode;
                    const labelKey =
                      mode === 'smart'
                        ? 'auto.simple.fluxModeSmart'
                        : 'auto.simple.fluxModeFixed';
                    return (
                      <button
                        key={mode}
                        type="button"
                        data-testid={`auto-flux-mode-${mode}`}
                        onClick={() =>
                          applySimpleTactics({
                            fluxAuto: {
                              ...fluxCfg,
                              mode,
                            },
                          })
                        }
                        className={`min-h-[40px] px-3 py-1.5 rounded border text-xs font-medium transition-colors cursor-pointer ${
                          active
                            ? 'border-cyan-400 bg-cyan-500/20 text-cyan-100 font-semibold'
                            : 'border-slate-700/90 bg-slate-950/70 hover:border-slate-600 text-slate-300'
                        }`}
                      >
                        {t(labelKey)}
                      </button>
                    );
                  })}
                </div>

                {fluxCfg.mode === 'smart' && (
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    {t('auto.simple.fluxSmartDesc')}
                  </p>
                )}

                {fluxCfg.enabled && fluxCfg.mode === 'fixed' && (
                  <div className="space-y-2 pt-0.5">
                    <label className="flex items-center justify-between gap-2 min-w-0">
                      <span className="text-xs text-slate-300 leading-snug min-w-0 flex-1">
                        {t('auto.simple.fluxAllySpLabel')}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <input
                          type="number"
                          data-testid="auto-flux-ally-sp-input"
                          min={0}
                          max={100}
                          value={fluxAllyDraft}
                          onChange={(e) => setFluxAllyDraft(e.target.value)}
                          onBlur={commitFluxAllyPct}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              commitFluxAllyPct();
                            }
                          }}
                          className="w-16 sm:w-20 h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums text-slate-100 text-right"
                        />
                        <span className="text-xs font-mono-nums text-slate-400 whitespace-nowrap">
                          % SP
                        </span>
                      </div>
                    </label>

                    <label className="flex items-center justify-between gap-2 min-w-0">
                      <span className="text-xs text-slate-300 leading-snug min-w-0 flex-1">
                        {t('auto.simple.fluxKeepSelfPrefix')}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <input
                          type="number"
                          data-testid="auto-flux-keep-self-input"
                          min={0}
                          max={100}
                          value={fluxKeepDraft}
                          onChange={(e) => setFluxKeepDraft(e.target.value)}
                          onBlur={commitFluxKeepPct}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              commitFluxKeepPct();
                            }
                          }}
                          className="w-16 sm:w-20 h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums text-slate-100 text-right"
                        />
                        <span className="text-xs font-mono-nums text-slate-400 whitespace-nowrap">
                          {t('auto.simple.fluxKeepSelfSuffix')}
                        </span>
                      </div>
                    </label>
                  </div>
                )}
              </div>
            )}

            {/* Control 8: Auto-use Supplies */}
            <div
              data-testid="auto-supplies-section"
              className="rounded-lg border border-slate-800 bg-[#090E18] p-3.5 space-y-2.5"
            >
              <div className="flex items-center justify-between gap-2 min-w-0">
                <span className="text-sm font-semibold text-slate-100 truncate">
                  {t('auto.simple.suppliesLabel')}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={suppliesCfg.enabled}
                  aria-label={t('auto.simple.suppliesLabel')}
                  data-testid="auto-supplies-toggle"
                  onClick={() =>
                    applySimpleTactics({
                      autoSupplies: {
                        ...suppliesCfg,
                        enabled: !suppliesCfg.enabled,
                      },
                    })
                  }
                  className={`min-h-[36px] min-w-[52px] px-2.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                    suppliesCfg.enabled
                      ? 'border-emerald-400 bg-emerald-500/25 text-emerald-200'
                      : 'border-slate-700 bg-slate-900 text-slate-400'
                  }`}
                >
                  {suppliesCfg.enabled ? 'ON' : 'OFF'}
                </button>
              </div>

              {suppliesCfg.enabled && (
                <div className="space-y-2 pt-0.5">
                  {(
                    [
                      {
                        field: 'hpBelowPct' as const,
                        testId: 'auto-supplies-hp-input',
                        labelKey: 'auto.simple.suppliesHpLabel',
                        draft: supHpDraft,
                        setDraft: setSupHpDraft,
                      },
                      {
                        field: 'shieldBelowPct' as const,
                        testId: 'auto-supplies-shield-input',
                        labelKey: 'auto.simple.suppliesShieldLabel',
                        draft: supShieldDraft,
                        setDraft: setSupShieldDraft,
                      },
                      {
                        field: 'spBelowPct' as const,
                        testId: 'auto-supplies-sp-input',
                        labelKey: 'auto.simple.suppliesSpLabel',
                        draft: supSpDraft,
                        setDraft: setSupSpDraft,
                      },
                    ] as const
                  ).map((row) => (
                    <label
                      key={row.field}
                      className="flex items-center justify-between gap-2 min-w-0"
                    >
                      <span className="text-xs text-slate-300 leading-snug min-w-0 flex-1 truncate">
                        {t(row.labelKey)}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <input
                          type="number"
                          data-testid={row.testId}
                          min={AUTO_SUPPLIES_MIN_PCT}
                          max={AUTO_SUPPLIES_MAX_PCT}
                          value={row.draft}
                          onChange={(e) => row.setDraft(e.target.value)}
                          onBlur={() =>
                            commitSupplyPct(row.field, row.draft, row.setDraft)
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              commitSupplyPct(row.field, row.draft, row.setDraft);
                            }
                          }}
                          className="w-16 sm:w-20 h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums text-slate-100 text-right"
                        />
                        <span className="text-xs font-mono-nums text-slate-400">
                          %
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              )}

              <p className="text-[11px] text-slate-400 leading-relaxed">
                {t('auto.simple.suppliesHelp')}
              </p>
            </div>
          </div>
        ) : (
          /* ================= ADVANCED MODE TAB ================= */
          <>
            {/* Preset Strip + Add Rule */}
            <div className="shrink-0 px-4 sm:px-5 py-2.5 border-b border-slate-800/80 bg-[#0A0F1A] flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-semibold text-slate-400 mr-1">
                  {t('auto.presetsLabel')}
                </span>
                {ADVANCED_PRESET_IDS.map((pid) => (
                  <button
                    key={pid}
                    type="button"
                    onClick={() => loadTacticsPreset(pid)}
                    className="min-h-[34px] px-2.5 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 hover:border-slate-500 text-[11px] font-medium text-slate-200 transition-colors cursor-pointer"
                  >
                    {getTacticsPresetLabel(lang, pid)}
                  </button>
                ))}
              </div>

              <button
                type="button"
                disabled={rules.length >= maxRules}
                onClick={addTacticsRule}
                className="min-h-[36px] px-3 inline-flex items-center gap-1.5 rounded bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-slate-950 font-semibold text-xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t('auto.addRule')}</span>
              </button>
            </div>

            {/* Scrollable Body: Rules List + Safety Stops */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4 tactical-scroll pb-safe">
              {rules.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-700 bg-[#080C14] p-6 text-center text-xs text-slate-400">
                  {t('auto.emptyRules')}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {rules.map((rule, index) => {
                    const actionSelectVal =
                      rule.action.type === 'skill' && rule.action.skillId
                        ? `skill:${rule.action.skillId}`
                        : rule.action.type;
                    const isDragging = dragIndex === index;
                    const isDragOver =
                      dragOverIndex === index && dragIndex !== index;

                    return (
                      <div
                        key={rule.id}
                        draggable
                        onDragStart={() => setDragIndex(index)}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setDragOverIndex(index);
                        }}
                        onDragLeave={() => {
                          if (dragOverIndex === index) setDragOverIndex(null);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (dragIndex !== null && dragIndex !== index) {
                            reorderTacticsRules(dragIndex, index);
                          }
                          setDragIndex(null);
                          setDragOverIndex(null);
                        }}
                        onDragEnd={() => {
                          setDragIndex(null);
                          setDragOverIndex(null);
                        }}
                        className={`rounded-lg border p-3 transition-colors space-y-2.5 ${
                          !rule.enabled
                            ? 'border-slate-800/70 bg-[#080B12]/70 opacity-60'
                            : isDragOver
                            ? 'border-emerald-400 bg-emerald-500/10'
                            : 'border-slate-800 bg-[#090E18]'
                        } ${isDragging ? 'opacity-50' : ''}`}
                      >
                        {/* Top Line: Drag Handle + Priority # + Readable Sentence + Controls */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span
                              title={t('auto.dragHint')}
                              className="hidden sm:inline-flex text-slate-500 hover:text-slate-300 cursor-grab active:cursor-grabbing shrink-0"
                            >
                              <GripVertical className="w-4 h-4" />
                            </span>

                            <input
                              type="checkbox"
                              checked={rule.enabled}
                              onChange={(e) =>
                                updateTacticsRule(rule.id, {
                                  enabled: e.target.checked,
                                })
                              }
                              aria-label={`Enable rule #${index + 1}`}
                              className="h-4 w-4 accent-emerald-500 cursor-pointer shrink-0"
                            />

                            <span className="font-mono-nums text-[11px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-emerald-300 shrink-0">
                              #{index + 1}
                            </span>

                            <span className="text-xs font-medium text-slate-100 truncate">
                              {formatTacticsRuleSentence(lang, rule)}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              disabled={index === 0}
                              onClick={() =>
                                reorderTacticsRules(index, index - 1)
                              }
                              aria-label={t('auto.moveUp')}
                              title={t('auto.moveUp')}
                              className="h-8 w-8 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 disabled:opacity-35 disabled:cursor-not-allowed text-slate-300 flex items-center justify-center cursor-pointer"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={index === rules.length - 1}
                              onClick={() =>
                                reorderTacticsRules(index, index + 1)
                              }
                              aria-label={t('auto.moveDown')}
                              title={t('auto.moveDown')}
                              className="h-8 w-8 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 disabled:opacity-35 disabled:cursor-not-allowed text-slate-300 flex items-center justify-center cursor-pointer"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteTacticsRule(rule.id)}
                              aria-label={t('auto.deleteRule')}
                              title={t('auto.deleteRule')}
                              className="h-8 w-8 rounded border border-red-500/40 bg-red-500/10 hover:bg-red-500/20 text-red-300 flex items-center justify-center cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Controls Grid: IF (Condition + param) | DO (Action) | TARGET */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                          {/* Condition */}
                          <div className="md:col-span-5 flex items-center gap-1.5">
                            <span className="text-[10px] font-mono-nums font-bold text-slate-400 w-7 shrink-0">
                              {t('auto.colIf')}
                            </span>
                            <select
                              value={rule.condition.kind}
                              onChange={(e) =>
                                handleConditionKindChange(
                                  rule,
                                  e.target.value as TacticsConditionKind
                                )
                              }
                              className="flex-1 min-w-0 h-9 px-2 rounded border border-slate-700 bg-[#060910] text-xs text-slate-100 focus:outline-none focus:border-emerald-400"
                            >
                              {TACTICS_CONDITION_KINDS.map((kind) => (
                                <option key={kind} value={kind}>
                                  {getConditionOptionLabel(kind)}
                                </option>
                              ))}
                            </select>

                            {conditionNeedsNumber(rule.condition.kind) && (
                              <input
                                type="number"
                                min={1}
                                max={
                                  rule.condition.kind.includes('hp_below') ||
                                  rule.condition.kind === 'my_sp_pct_gte'
                                    ? 100
                                    : 200
                                }
                                value={rule.condition.value ?? 0}
                                onChange={(e) =>
                                  updateTacticsRule(rule.id, {
                                    condition: {
                                      ...rule.condition,
                                      value: Math.max(
                                        1,
                                        Math.round(Number(e.target.value) || 1)
                                      ),
                                    },
                                  })
                                }
                                className="w-16 h-9 px-2 rounded border border-slate-700 bg-[#060910] font-mono-nums text-xs text-slate-100 text-right focus:outline-none focus:border-emerald-400"
                              />
                            )}

                            {rule.condition.kind === 'my_buff_not_active' && (
                              <select
                                value={rule.condition.buffType ?? 'def_up'}
                                onChange={(e) =>
                                  updateTacticsRule(rule.id, {
                                    condition: {
                                      ...rule.condition,
                                      buffType: e.target
                                        .value as StatusEffectType,
                                    },
                                  })
                                }
                                className="w-32 h-9 px-1.5 rounded border border-slate-700 bg-[#060910] text-xs text-slate-100 focus:outline-none focus:border-emerald-400"
                              >
                                {TACTICS_BUFF_OPTIONS.map((b) => (
                                  <option key={b} value={b}>
                                    {getStatusLabel(lang, b)}
                                  </option>
                                ))}
                              </select>
                            )}

                            {rule.condition.kind === 'skill_off_cooldown' && (
                              <select
                                value={
                                  rule.condition.skillId ??
                                  allowedActiveSkills[0]?.id ??
                                  ''
                                }
                                onChange={(e) =>
                                  updateTacticsRule(rule.id, {
                                    condition: {
                                      ...rule.condition,
                                      skillId: e.target.value,
                                    },
                                  })
                                }
                                className="w-32 h-9 px-1.5 rounded border border-slate-700 bg-[#060910] text-xs text-slate-100 focus:outline-none focus:border-emerald-400"
                              >
                                {allowedActiveSkills.map((sk) => (
                                  <option key={sk.id} value={sk.id}>
                                    {getSkillName(sk, lang)}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>

                          {/* Action */}
                          <div className="md:col-span-4 flex items-center gap-1.5">
                            <span className="text-[10px] font-mono-nums font-bold text-slate-400 shrink-0">
                              {t('auto.colDo')}
                            </span>
                            <select
                              value={actionSelectVal}
                              onChange={(e) =>
                                handleActionSelect(rule, e.target.value)
                              }
                              className="flex-1 min-w-0 h-9 px-2 rounded border border-slate-700 bg-[#060910] text-xs text-slate-100 focus:outline-none focus:border-emerald-400"
                            >
                              <option value="attack">
                                {t('auto.actionAttack')}
                              </option>
                              <option value="defend">
                                {t('auto.actionDefend')}
                              </option>
                              {allowedActiveSkills.map((sk) => {
                                const onBar =
                                  activeGear.equippedSkillBar.includes(sk.id);
                                return (
                                  <option key={sk.id} value={`skill:${sk.id}`}>
                                    {getSkillName(sk, lang)} ({sk.spCost} SP)
                                    {onBar ? '' : ` ${t('auto.notOnBar')}`}
                                  </option>
                                );
                              })}
                            </select>
                          </div>

                          {/* Target Selector */}
                          <div className="md:col-span-3 flex items-center gap-1.5">
                            <span className="text-[10px] font-mono-nums font-bold text-slate-400 shrink-0">
                              →
                            </span>
                            <select
                              value={rule.targetSelector}
                              onChange={(e) =>
                                updateTacticsRule(rule.id, {
                                  targetSelector: e.target
                                    .value as TacticsTargetSelector,
                                })
                              }
                              className="flex-1 min-w-0 h-9 px-2 rounded border border-slate-700 bg-[#060910] text-xs text-slate-100 focus:outline-none focus:border-emerald-400"
                            >
                              {TACTICS_TARGET_SELECTORS.map((sel) => (
                                <option key={sel} value={sel}>
                                  {getTacticsTargetLabel(lang, sel)}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Safety Stops Section */}
              <div className="rounded-lg border border-slate-800 bg-[#090E18] p-3.5 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                  <ShieldAlert className="w-4 h-4 text-orange-400" />
                  <span>{t('auto.safetyTitle')}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-slate-300">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={safety.stopOnLowHpEnabled}
                      onChange={(e) =>
                        updateTacticsSafety({
                          stopOnLowHpEnabled: e.target.checked,
                        })
                      }
                      className="h-4 w-4 accent-emerald-500 cursor-pointer"
                    />
                    <span>{t('auto.safetyLowHp')}</span>
                    <input
                      type="number"
                      min={5}
                      max={90}
                      value={safety.stopOnLowHpPct}
                      onChange={(e) =>
                        updateTacticsSafety({
                          stopOnLowHpPct: Math.max(
                            5,
                            Math.min(
                              90,
                              Math.round(Number(e.target.value) || 25)
                            )
                          ),
                        })
                      }
                      className="w-14 h-7 px-1.5 rounded border border-slate-700 bg-[#060910] font-mono-nums text-xs text-right text-slate-100"
                    />
                    <span>%</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={safety.stopOnEliteReady}
                      onChange={(e) =>
                        updateTacticsSafety({
                          stopOnEliteReady: e.target.checked,
                        })
                      }
                      className="h-4 w-4 accent-emerald-500 cursor-pointer"
                    />
                    <span>{t('auto.safetyEliteReady')}</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={safety.stopOnBossPresent}
                      onChange={(e) =>
                        updateTacticsSafety({
                          stopOnBossPresent: e.target.checked,
                        })
                      }
                      className="h-4 w-4 accent-emerald-500 cursor-pointer"
                    />
                    <span>{t('auto.safetyBossPresent')}</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={safety.autoRetreatLowHpEnabled}
                      onChange={(e) =>
                        updateTacticsSafety({
                          autoRetreatLowHpEnabled: e.target.checked,
                        })
                      }
                      className="h-4 w-4 accent-orange-500 cursor-pointer"
                    />
                    <span>{t('auto.safetyAutoRetreat')}</span>
                    <input
                      type="number"
                      min={5}
                      max={75}
                      value={safety.autoRetreatLowHpPct}
                      onChange={(e) =>
                        updateTacticsSafety({
                          autoRetreatLowHpPct: Math.max(
                            5,
                            Math.min(
                              75,
                              Math.round(Number(e.target.value) || 15)
                            )
                          ),
                        })
                      }
                      className="w-14 h-7 px-1.5 rounded border border-slate-700 bg-[#060910] font-mono-nums text-xs text-right text-slate-100"
                    />
                    <span>%</span>
                  </label>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
