import {
  getSupplyTemplateById,
  SUPPLY_TEMPLATE_FAMILIES,
} from '../data/consumables';
import { getScaledSkillStats, getSkillById } from '../data/skills';
import type {
  ActiveStatusEffect,
  AdminConfig,
  BattleSupplyUnitState,
  CombatSide,
  CombatUnit,
  Language,
  MechClassId,
  PrestageConfig,
  SkillEffectKind,
  StatusEffectType,
  SupplyFamily,
} from '../types/game';
import { isDebuffType } from '../data/statusEffects';
import { ALL_ENGINE_STATUS_TYPES } from '../data/statusIconMap';
import { applyStatus } from './statusEngine';
import { getSkillStep } from './turnPhase';

export const MIN_PRESTAGE_COUNTDOWN_SEC = 0;
export const MAX_PRESTAGE_COUNTDOWN_SEC = 10;
export const MIN_PRESTAGE_GROUP_FROM_SIZE = 4;
export const MAX_PRESTAGE_GROUP_FROM_SIZE = 50;
export const DEFAULT_PRESTAGE_GROUP_FROM_SIZE = 10;

export const DEFAULT_PRESTAGE_CONFIG: PrestageConfig = {
  enabled: true,
  countdownSec: 3,
  groupFromSize: DEFAULT_PRESTAGE_GROUP_FROM_SIZE,
};

export function clonePrestageConfig(cfg: PrestageConfig): PrestageConfig {
  return { ...sanitizePrestageConfig(cfg) };
}

export function sanitizePrestageConfig(raw: unknown): Required<PrestageConfig> {
  const obj =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const enabled =
    typeof obj.enabled === 'boolean'
      ? obj.enabled
      : DEFAULT_PRESTAGE_CONFIG.enabled;
  const rawSec = Number(obj.countdownSec);
  const countdownSec = Number.isFinite(rawSec)
    ? Math.max(
        MIN_PRESTAGE_COUNTDOWN_SEC,
        Math.min(MAX_PRESTAGE_COUNTDOWN_SEC, Math.round(rawSec))
      )
    : DEFAULT_PRESTAGE_CONFIG.countdownSec;
  const rawGroup = Number(obj.groupFromSize);
  const groupFromSize = Number.isFinite(rawGroup)
    ? Math.max(
        MIN_PRESTAGE_GROUP_FROM_SIZE,
        Math.min(MAX_PRESTAGE_GROUP_FROM_SIZE, Math.round(rawGroup))
      )
    : DEFAULT_PRESTAGE_GROUP_FROM_SIZE;
  return {
    enabled,
    countdownSec,
    groupFromSize,
  };
}

export const DEBUFF_TYPES = new Set<StatusEffectType>(
  ALL_ENGINE_STATUS_TYPES.filter(
    (t) => t !== 'registry_effect' && isDebuffType(t)
  )
);

export function addOrRefreshStatus(
  statuses: ActiveStatusEffect[],
  entry: ActiveStatusEffect
): ActiveStatusEffect[] {
  return applyStatus(statuses, entry);
}

const PURE_STAT_BUFF_EFFECTS: Readonly<
  Partial<Record<SkillEffectKind, StatusEffectType>>
> = {
  buff_def: 'def_up',
  buff_eva: 'eva_up',
  buff_primary_dmg: 'primary_dmg_up',
  buff_skill_dmg: 'skill_dmg_up',
  buff_speed: 'spd_up',
  team_atk_up: 'atk_up',
  team_def_up: 'def_up',
  team_eva_up: 'eva_up',
};

export function isPureStatBuffEffect(effectKind: SkillEffectKind): boolean {
  return effectKind in PURE_STAT_BUFF_EFFECTS;
}

export interface ApplyPrestageBuffsResult {
  units: CombatUnit[];
  appliedByUnit: Record<string, string[]>;
}

export function applyPrestageBuffs(
  units: CombatUnit[],
  adminConfig?: Partial<AdminConfig>
): ApplyPrestageBuffsResult {
  const cfg = sanitizePrestageConfig(adminConfig?.prestage);
  const nextUnits = units.map((u) => ({
    ...u,
    statuses: [...u.statuses],
  }));
  const appliedByUnit: Record<string, string[]> = {};

  if (!cfg.enabled) {
    return { units: nextUnits, appliedByUnit };
  }

  const recordApplied = (unitId: string, skillId: string) => {
    const list = appliedByUnit[unitId] ?? [];
    if (!list.includes(skillId)) {
      appliedByUnit[unitId] = [...list, skillId];
    }
  };

  for (let i = 0; i < nextUnits.length; i++) {
    const caster = nextUnits[i];
    if (!caster.alive) continue;

    for (const skillId of caster.equippedSkillIds) {
      const skill = getSkillById(skillId, adminConfig);
      if (!skill || skill.category === 'passive') continue;
      if (getSkillStep(skill) !== 2) continue;

      const statusType = PURE_STAT_BUFF_EFFECTS[skill.effectKind];
      if (!statusType) continue;

      const skillLevel = caster.skillLevels[skill.id] ?? caster.skillLevel ?? 1;
      const scaled = getScaledSkillStats(skill, skillLevel, adminConfig);
      const turnsRemaining = skill.duration ?? 3;
      const statusEntry: ActiveStatusEffect = {
        type: statusType,
        turnsRemaining,
        magnitude: scaled.buffMagnitude,
        sourceSkillId: skill.id,
      };

      if (skill.targetType === 'all_allies') {
        for (let j = 0; j < nextUnits.length; j++) {
          const ally = nextUnits[j];
          if (ally.side !== caster.side || !ally.alive) continue;
          nextUnits[j] = {
            ...ally,
            statuses: addOrRefreshStatus(ally.statuses, statusEntry),
          };
          recordApplied(ally.id, skill.id);
        }
      } else if (
        skill.targetType === 'self' ||
        skill.targetType === 'single_ally'
      ) {
        const currentCaster = nextUnits[i];
        nextUnits[i] = {
          ...currentCaster,
          statuses: addOrRefreshStatus(currentCaster.statuses, statusEntry),
        };
        recordApplied(currentCaster.id, skill.id);
      }
    }
  }

  return { units: nextUnits, appliedByUnit };
}

export interface PrestageStatusCount {
  type: StatusEffectType;
  count: number;
}

export interface PrestageClassSummary {
  classId: MechClassId;
  count: number;
  levelMin: number;
  levelMax: number;
  levelAvg: number;
  avgHpPct: number;
  avgShieldPct: number;
  statuses: PrestageStatusCount[];
}

export interface PrestageSideSummary {
  total: number;
  byClass: PrestageClassSummary[];
  commander: CombatUnit | null;
}

export function shouldUseGroupedPrestage(
  units: readonly CombatUnit[],
  adminConfig?: Partial<AdminConfig>
): boolean {
  const { groupFromSize } = sanitizePrestageConfig(adminConfig?.prestage);
  let allyAlive = 0;
  let enemyAlive = 0;
  for (const u of units) {
    if (!u.alive) continue;
    if (u.side === 'ally') allyAlive += 1;
    else enemyAlive += 1;
  }
  return Math.max(allyAlive, enemyAlive) > groupFromSize;
}

export function buildPrestageSummary(
  units: readonly CombatUnit[],
  side: CombatSide,
  revealStatuses: boolean
): PrestageSideSummary {
  const sideUnits = units.filter((u) => u.side === side && u.alive);
  const total = sideUnits.length;

  let commander: CombatUnit | null = null;
  if (side === 'ally') {
    commander = sideUnits.find((u) => u.isPlayer) ?? null;
  } else {
    for (const u of sideUnits) {
      if (
        !commander ||
        u.level > commander.level ||
        (u.level === commander.level && u.isBoss && !commander.isBoss)
      ) {
        commander = u;
      }
    }
  }

  const byClassMap = new Map<MechClassId, CombatUnit[]>();
  for (const u of sideUnits) {
    const arr = byClassMap.get(u.classId);
    if (arr) arr.push(u);
    else byClassMap.set(u.classId, [u]);
  }

  const byClass: PrestageClassSummary[] = [];
  for (const [classId, group] of byClassMap.entries()) {
    const count = group.length;
    let levelMin = Infinity;
    let levelMax = -Infinity;
    let levelSum = 0;
    let hpPctSum = 0;
    let shieldPctSum = 0;
    const statusCountMap = new Map<StatusEffectType, number>();

    for (const u of group) {
      if (u.level < levelMin) levelMin = u.level;
      if (u.level > levelMax) levelMax = u.level;
      levelSum += u.level;
      const hpPct = u.derived.maxHp > 0 ? (u.hp / u.derived.maxHp) * 100 : 0;
      const shdPct =
        u.derived.maxShield > 0 ? (u.shield / u.derived.maxShield) * 100 : 0;
      hpPctSum += hpPct;
      shieldPctSum += shdPct;

      if (revealStatuses) {
        const seenTypes = new Set<StatusEffectType>();
        for (const st of u.statuses) {
          if (st.turnsRemaining <= 0 || seenTypes.has(st.type)) continue;
          seenTypes.add(st.type);
          statusCountMap.set(st.type, (statusCountMap.get(st.type) ?? 0) + 1);
        }
      }
    }

    const statuses: PrestageStatusCount[] = revealStatuses
      ? Array.from(statusCountMap.entries())
          .map(([type, stCount]) => ({ type, count: stCount }))
          .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type))
      : [];

    byClass.push({
      classId,
      count,
      levelMin: Number.isFinite(levelMin) ? levelMin : 1,
      levelMax: Number.isFinite(levelMax) ? levelMax : 1,
      levelAvg: Math.round(levelSum / count),
      avgHpPct: Math.round(hpPctSum / count),
      avgShieldPct: Math.round(shieldPctSum / count),
      statuses,
    });
  }

  byClass.sort(
    (a, b) =>
      b.count - a.count ||
      b.levelMax - a.levelMax ||
      a.classId.localeCompare(b.classId)
  );

  return {
    total,
    byClass,
    commander,
  };
}

export function countAppliedPrestageBuffs(
  units: readonly CombatUnit[],
  side: CombatSide = 'ally'
): number {
  let count = 0;
  for (const unit of units) {
    if (!unit.alive || unit.side !== side) continue;
    for (const st of unit.statuses) {
      if (st.turnsRemaining > 0) {
        count += 1;
      }
    }
  }
  return count;
}

export function formatPrestageBuffChip(
  st: ActiveStatusEffect,
  lang: Language
): string {
  switch (st.type) {
    case 'atk_up': {
      const pct = Math.round((st.magnitude ?? 0.2) * 100);
      return `⬆+${pct}% ATK`;
    }
    case 'def_up': {
      const pct = Math.round((st.magnitude ?? 0.25) * 100);
      return `⬆+${pct}% DEF`;
    }
    case 'eva_up': {
      const pct = Math.round((st.magnitude ?? 0.25) * 40);
      return `⬆+${pct}% EVA`;
    }
    case 'spd_up': {
      const pct = Math.round((st.magnitude ?? 0.5) * 100);
      return `⬆+${pct}% SPD`;
    }
    case 'primary_dmg_up': {
      const pct = Math.round((st.magnitude ?? 0.3) * 100);
      return `⬆+${pct}% DMG`;
    }
    case 'skill_dmg_up': {
      const pct = Math.round((st.magnitude ?? 0.3) * 100);
      return `⬆+${pct}% SKL`;
    }
    case 'regen_hp': {
      const pct = Math.round((st.magnitude ?? 0.1) * 100);
      return `⬆+${pct}% HP`;
    }
    case 'evade_all':
      return '⬆100% EVA';
    case 'invincible':
      return lang === 'vi' ? '⬆Miễn ST' : '⬆Invincible';
    case 'stealth':
      return lang === 'vi' ? '⬆Ẩn thân' : '⬆Stealth';
    case 'sure_hit':
      return lang === 'vi' ? '⬆Chắc trúng' : '⬆Sure Hit';
    default:
      return `⬆${st.type}`;
  }
}

export interface PrestageSupplyBagEntry {
  family: SupplyFamily;
  tier: number;
  count: number;
}

export function buildAllySupplyBagSummary(
  units: readonly CombatUnit[],
  supplyByUnit?: Record<string, BattleSupplyUnitState> | null,
  playerSupplyRows?: readonly { templateId: string | null; stock: number }[] | null
): PrestageSupplyBagEntry[] {
  const totalsByKey = new Map<string, PrestageSupplyBagEntry>();

  const addTemplateStock = (templateId: string, rawQty: number) => {
    const qty = Math.floor(rawQty);
    if (!Number.isFinite(qty) || qty <= 0) return;
    const tpl = getSupplyTemplateById(templateId);
    if (!tpl) return;
    const key = `${tpl.family}:${tpl.tier}`;
    const prev = totalsByKey.get(key);
    if (prev) {
      prev.count += qty;
    } else {
      totalsByKey.set(key, {
        family: tpl.family,
        tier: tpl.tier,
        count: qty,
      });
    }
  };

  for (const unit of units) {
    if (!unit.alive || unit.side !== 'ally') continue;
    const unitSupply = supplyByUnit?.[unit.id];
    const stockMap = unitSupply?.stockByTemplate;
    if (stockMap !== undefined) {
      for (const [tplId, qty] of Object.entries(stockMap)) {
        addTemplateStock(tplId, qty);
      }
    } else if (unit.isPlayer && playerSupplyRows && playerSupplyRows.length > 0) {
      const seenPlayerTemplates = new Set<string>();
      for (const row of playerSupplyRows) {
        if (!row.templateId || seenPlayerTemplates.has(row.templateId)) continue;
        seenPlayerTemplates.add(row.templateId);
        addTemplateStock(row.templateId, row.stock);
      }
    }
  }

  return Array.from(totalsByKey.values()).sort((a, b) => {
    const famA = SUPPLY_TEMPLATE_FAMILIES.indexOf(a.family);
    const famB = SUPPLY_TEMPLATE_FAMILIES.indexOf(b.family);
    const orderA = famA === -1 ? 999 : famA;
    const orderB = famB === -1 ? 999 : famB;
    return orderA - orderB || a.tier - b.tier;
  });
}
