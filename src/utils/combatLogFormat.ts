import { ALLY_PILOT_POOL } from '../data/pilots';
import { getSkillById } from '../data/skills';
import { getStatusEntry, isDebuffType } from '../data/statusEffects';
import {
  formatCombatLogMessage,
  getClassName,
  getSkillName,
  getStatShort,
  getStatusDisplayName,
  getStatusLabel,
  translate,
} from '../i18n';
import type {
  BattleState,
  BattleStatsSummary,
  CombatLogEntry,
  CombatSide,
  CombatUnit,
  IconCatalogModRow,
  Language,
  MechClassId,
  StatusEffectType,
  UnitBattleStats,
} from '../types/game';
import { SP_COLOR_TOKENS } from './battleDisplay';
import {
  FX_SETTINGS_STORAGE_KEY,
  readFxSettings,
  updateFxSettings,
} from './battleVfx';
import {
  getCardPopupSymbol,
  type CardPopupIconKind,
} from './cardPopupQueue';

export type CombatLogChannel = 'all' | 'ally' | 'enemy' | 'system';
export type CombatLogDisplayMode = 'docked' | 'popup';
export type SidebarCombatLogMode = 'line' | 'expanded';
export type CombatLogOrder = 'newest' | 'oldest';
export type CombatLogActionKind =
  | 'attack'
  | 'skill'
  | 'heal'
  | 'shield'
  | 'buff'
  | 'debuff'
  | 'kill'
  | 'move-row'
  | 'system';
export type CombatLogValueTone =
  | 'damage'
  | 'heal'
  | 'shield'
  | 'buff'
  | 'debuff'
  | 'neutral';

export const DOCKED_LOG_MAX_ENTRIES = 200;
export const POPUP_LOG_PAGE_SIZE = 200;
export const LOG_MODE_STORAGE_KEY = 'dreamAce.logMode.v1';
export const LOG_ORDER_STORAGE_KEY = 'dreamAce.logOrder.v1';
export const COMBAT_LOG_MODE_STORAGE_KEY = 'starfront_combat_log_mode_v1';
export const COMBAT_LOG_EXPAND_ALL_STORAGE_KEY =
  'starfront_combat_log_expand_all_v1';
export const SHOW_STATUS_LABELS_STORAGE_KEY = FX_SETTINGS_STORAGE_KEY;
export const COMBAT_LOG_CHROME_HEIGHTS = {
  row1Px: 36,
  row2Px: 36,
  totalPx: 72,
  maxTotalPx: 76,
} as const;

function isStatusEffectDebuff(
  status: StatusEffectType,
  registryId?: string
): boolean {
  if (registryId) {
    return getStatusEntry(registryId)?.polarity === 'debuff';
  }
  return isDebuffType(status);
}

export type CombatLogStrongTone =
  | 'crit'
  | 'kill'
  | 'shield-break'
  | 'heal'
  | 'heavy';

export interface StructuredCombatLogRow {
  id: string;
  round: number;
  turnLabel: string;
  faction: 'ally' | 'enemy' | 'system';
  actorName: string;
  autoBadge: string | null;
  actionKind: CombatLogActionKind;
  actionLabel: string;
  targetName: string | null;
  valueText: string | null;
  valueTone: CombatLogValueTone;
  fallbackText: string;
  /** Natural readable sentence for G3d log readability */
  sentence: string;
  /** Separate dim skill SP cost (null when basic/passive/0 SP) */
  spCost: number | null;
  /** Highlights major combat moments (crit, big damage, shield break, kill, big heal) */
  isStrong: boolean;
  strongTone: CombatLogStrongTone | null;
  /** Avatar rendering metadata */
  isPilotActor: boolean;
  actorClassId: MechClassId;
  actorFactionRole: 'me' | 'ally' | 'enemy' | 'boss' | 'system';
}

export interface CombatLogRoundGroup {
  round: number;
  entries: CombatLogEntry[];
}

export interface KillTimelineItem {
  id: string;
  round: number;
  turn: number;
  killerId: string;
  killerName: string;
  killerSide: CombatSide | 'system';
  victimId: string;
  victimName: string;
  victimSide: CombatSide | 'system';
}

export interface LiveBattleProgress {
  round: number;
  turn: number;
  allyAlive: number;
  allyTotal: number;
  enemyAlive: number;
  enemyTotal: number;
  allyDamageDealt: number;
  allyDamageTaken: number;
  enemyDamageDealt: number;
  enemyDamageTaken: number;
  topDamageDealers: UnitBattleStats[];
  topHealers: UnitBattleStats[];
  activeBuffsCount: number;
  activeDebuffsCount: number;
  allyActiveBuffs: number;
  allyActiveDebuffs: number;
  enemyActiveBuffs: number;
  enemyActiveDebuffs: number;
  killTimeline: KillTimelineItem[];
}

export function readSidebarLogMode(): SidebarCombatLogMode {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return 'expanded';
    }
    const raw = window.localStorage.getItem(LOG_MODE_STORAGE_KEY);
    return raw === 'line' ? 'line' : 'expanded';
  } catch {
    return 'expanded';
  }
}

export function writeSidebarLogMode(mode: SidebarCombatLogMode): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(LOG_MODE_STORAGE_KEY, mode);
  } catch {
    // Ignore storage quota or private mode failures
  }
}

export function readCombatLogOrder(): CombatLogOrder {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return 'newest';
    }
    const raw = window.localStorage.getItem(LOG_ORDER_STORAGE_KEY);
    return raw === 'oldest' ? 'oldest' : 'newest';
  } catch {
    return 'newest';
  }
}

export function writeCombatLogOrder(order: CombatLogOrder): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(LOG_ORDER_STORAGE_KEY, order);
  } catch {
    // Ignore storage quota or private mode failures
  }
}

export function readCombatLogMode(): CombatLogDisplayMode {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return 'docked';
    const raw = window.localStorage.getItem(COMBAT_LOG_MODE_STORAGE_KEY);
    return raw === 'popup' ? 'popup' : 'docked';
  } catch {
    return 'docked';
  }
}

export function writeCombatLogMode(mode: CombatLogDisplayMode): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(COMBAT_LOG_MODE_STORAGE_KEY, mode);
  } catch {
    // Ignore storage quota or private mode failures
  }
}

export function readCombatLogExpandAll(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    return (
      window.localStorage.getItem(COMBAT_LOG_EXPAND_ALL_STORAGE_KEY) === '1'
    );
  } catch {
    return false;
  }
}

export function writeCombatLogExpandAll(expandAll: boolean): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    if (expandAll) {
      window.localStorage.setItem(COMBAT_LOG_EXPAND_ALL_STORAGE_KEY, '1');
    } else {
      window.localStorage.removeItem(COMBAT_LOG_EXPAND_ALL_STORAGE_KEY);
    }
  } catch {
    // Ignore storage quota or private mode failures
  }
}

export function readShowStatusLabels(): boolean {
  return readFxSettings().showStatusLabels;
}

export function writeShowStatusLabels(enabled: boolean): void {
  updateFxSettings({ showStatusLabels: enabled });
}

export function isSystemOrKillLogEntry(entry: CombatLogEntry): boolean {
  return (
    !entry.actorSide ||
    entry.tag === 'SYSTEM' ||
    entry.tag === 'KO' ||
    entry.templateKey === 'log.destroyed' ||
    entry.templateKey === 'log.battleStart' ||
    entry.templateKey === 'log.sectorSupply' ||
    entry.templateKey === 'log.prestageConfirm' ||
    entry.templateKey === 'log.retreat' ||
    entry.templateKey === 'log.invalidTarget' ||
    entry.templateKey === 'log.autoRepeatStopped'
  );
}

/**
 * Filters combat log entries by channel:
 * - all: every entry
 * - ally / enemy: entries whose actor belongs to that faction
 * - system: neutral/system messages AND kills (KO / destroyed)
 */
export function filterCombatLogEntries(
  entries: CombatLogEntry[],
  channel: CombatLogChannel
): CombatLogEntry[] {
  if (channel === 'all') return entries;
  if (channel === 'ally') {
    return entries.filter((e) => e.actorSide === 'ally');
  }
  if (channel === 'enemy') {
    return entries.filter((e) => e.actorSide === 'enemy');
  }
  return entries.filter(isSystemOrKillLogEntry);
}

function getRowLabel(lang: Language, rawRow: unknown): string {
  const key =
    rawRow === 'front'
      ? 'common.frontRow'
      : rawRow === 'middle'
      ? 'common.middleRow'
      : 'common.backRow';
  return translate(lang, key);
}

const PILOT_FIRST_SET = new Set(ALLY_PILOT_POOL.firstNames);
const PILOT_CALLSIGN_SET = new Set(ALLY_PILOT_POOL.callsigns);

/**
 * Groups combat log entries chronologically by round number for collapsible Vòng N headers.
 */
export function groupCombatLogEntriesByRound(
  entries: CombatLogEntry[],
  order: CombatLogOrder = 'oldest'
): CombatLogRoundGroup[] {
  const groups: CombatLogRoundGroup[] = [];
  const byRound = new Map<number, CombatLogRoundGroup>();

  for (const entry of entries) {
    const r = Math.max(1, Number(entry.round ?? 1));
    let grp = byRound.get(r);
    if (!grp) {
      grp = { round: r, entries: [] };
      byRound.set(r, grp);
      groups.push(grp);
    }
    grp.entries.push(entry);
  }

  if (order === 'newest') {
    return groups
      .map((grp) => ({
        round: grp.round,
        entries: [...grp.entries].reverse(),
      }))
      .sort((a, b) => b.round - a.round);
  }

  return groups;
}

function resolveActorAvatarMeta(
  entry: CombatLogEntry,
  actorName: string,
  faction: 'ally' | 'enemy' | 'system',
  units?: CombatUnit[]
): {
  isPilotActor: boolean;
  actorClassId: MechClassId;
  actorFactionRole: 'me' | 'ally' | 'enemy' | 'boss' | 'system';
} {
  if (faction === 'system') {
    return {
      isPilotActor: false,
      actorClassId: 'striker',
      actorFactionRole: 'system',
    };
  }

  const matched =
    units?.find(
      (u) =>
        u.name === actorName &&
        (entry.actorSide ? u.side === entry.actorSide : true)
    ) ?? units?.find((u) => u.name === actorName);

  if (matched) {
    return {
      isPilotActor:
        matched.isPlayer || (matched.side === 'ally' && !matched.isStructure),
      actorClassId: matched.classId,
      actorFactionRole: matched.isPlayer
        ? 'me'
        : matched.isBoss
        ? 'boss'
        : matched.side,
    };
  }

  const isPilot =
    Boolean(entry.actorIsPlayer) ||
    faction === 'ally' ||
    PILOT_FIRST_SET.has(actorName) ||
    PILOT_CALLSIGN_SET.has(actorName);

  const pClass = entry.params?.classId;
  const fallbackClass: MechClassId =
    pClass === 'interceptor' ||
    pClass === 'siege' ||
    pClass === 'support' ||
    pClass === 'striker'
      ? pClass
      : 'striker';

  return {
    isPilotActor: isPilot,
    actorClassId: fallbackClass,
    actorFactionRole: entry.actorIsPlayer
      ? 'me'
      : entry.actorIsBoss
      ? 'boss'
      : faction,
  };
}

/**
 * Parses a CombatLogEntry into structured display fields + natural sentence + SP tag + avatar metadata.
 */
export function parseStructuredCombatLogRow(
  lang: Language,
  entry: CombatLogEntry,
  units?: CombatUnit[]
): StructuredCombatLogRow {
  const isVi = lang === 'vi';
  const p = entry.params ?? {};
  const round = Math.max(1, Number(entry.round ?? 1));
  const turnLabel = `R${round}`;
  const faction: 'ally' | 'enemy' | 'system' =
    entry.actorSide === 'ally'
      ? 'ally'
      : entry.actorSide === 'enemy'
      ? 'enemy'
      : 'system';
  const fallbackText = formatCombatLogMessage(lang, entry);
  const autoBadge =
    entry.autoRuleNumber !== undefined
      ? entry.autoRuleNumber > 0
        ? `AUTO #${entry.autoRuleNumber}`
        : 'AUTO'
      : null;

  const actorFromParams =
    typeof p.actor === 'string' && p.actor.trim().length > 0
      ? p.actor
      : entry.actorName || '';
  const targetFromParams =
    typeof p.target === 'string' && p.target.trim().length > 0
      ? p.target
      : null;
  const skillId =
    typeof p.skillId === 'string' && p.skillId.trim().length > 0
      ? p.skillId
      : '';
  const skillDef = skillId ? getSkillById(skillId) : undefined;
  const skillLabel = skillId ? getSkillName(lang, skillId) : '';
  const explicitSpCost = Number(p.spCost ?? 0);
  const resolvedSkillSpCost =
    explicitSpCost > 0
      ? explicitSpCost
      : skillDef && skillDef.spCost > 0
      ? skillDef.spCost
      : null;

  const targetUnit =
    targetFromParams && units
      ? units.find((u) => u.name === targetFromParams)
      : undefined;
  const targetMaxHp = targetUnit?.derived.maxHp ?? 0;

  const avatarMeta = resolveActorAvatarMeta(
    entry,
    actorFromParams,
    faction,
    units
  );

  switch (entry.templateKey) {
    case 'log.damage': {
      const shd = Number(p.shieldAbsorbed ?? p.shieldDmg ?? 0);
      const hp = Number(p.hullDamage ?? p.hpDmg ?? p.dmg ?? 0);
      const total =
        shd + hp > 0 ? shd + hp : Math.max(0, Number(p.damage ?? 0));
      const isCrit = Number(p.isCrit ?? 0) > 0;
      const isDefending = Number(p.isDefending ?? 0) > 0;
      const hitIndex = Number(p.hitIndex ?? 0);
      const totalHits = Number(p.totalHits ?? 1);
      const baseAction = skillLabel || translate(lang, 'log.primaryWeapons');
      const actionLabel =
        totalHits > 1 ? `${baseAction} (${hitIndex}/${totalHits})` : baseAction;
      const valParts = [total > 0 ? `-${total}` : '0'];
      if (shd > 0 && hp > 0) valParts.push(`(${shd} SHD)`);
      else if (shd > 0) valParts.push('SHD');
      if (isCrit) valParts.push('CRIT!');

      const breakdownText =
        shd > 0 && hp > 0
          ? isVi
            ? `khiên -${shd}, HP -${hp}`
            : `shield -${shd}, HP -${hp}`
          : shd > 0
          ? isVi
            ? `khiên -${shd}`
            : `shield -${shd}`
          : `HP -${hp}`;
      const critSuffix = isCrit ? translate(lang, 'log.critTag') : '';
      const defSuffix = isDefending ? translate(lang, 'log.defendTag') : '';
      const targetDisp = targetFromParams ?? '—';

      const sentence = isVi
        ? skillId
          ? `${actorFromParams} bắn ${actionLabel} vào ${targetDisp}, gây ${total} sát thương (${breakdownText})${critSuffix}${defSuffix}`
          : `${actorFromParams} bắn ${baseAction} trúng ${targetDisp}, gây ${total} sát thương (${breakdownText})${critSuffix}${defSuffix}`
        : `${actorFromParams} hits ${targetDisp} with ${actionLabel} for ${total} damage (${breakdownText})${critSuffix}${defSuffix}`;

      const isBigDmg =
        total >= 250 || (targetMaxHp > 0 && total >= targetMaxHp * 0.28);
      const isStrong = isCrit || isBigDmg;
      const strongTone: CombatLogStrongTone | null = isCrit
        ? 'crit'
        : isBigDmg
        ? 'heavy'
        : null;

      return {
        id: entry.id,
        round,
        turnLabel,
        faction,
        actorName: actorFromParams,
        autoBadge,
        actionKind: skillId ? 'skill' : 'attack',
        actionLabel,
        targetName: targetFromParams,
        valueText: valParts.join(' '),
        valueTone: shd > 0 && hp === 0 ? 'shield' : 'damage',
        fallbackText,
        sentence,
        spCost:
          skillId && (hitIndex <= 1 || !hitIndex) ? resolvedSkillSpCost : null,
        isStrong,
        strongTone,
        ...avatarMeta,
      };
    }

    case 'log.splashDamage': {
      const dmg = Number(p.damage ?? 0);
      const isBig =
        dmg >= 220 || (targetMaxHp > 0 && dmg >= targetMaxHp * 0.25);
      const sentence = isVi
        ? `${actorFromParams} nổ lan vào ${targetFromParams ?? '—'}, gây ${dmg} sát thương`
        : `${actorFromParams} splashes ${targetFromParams ?? '—'} for ${dmg} damage`;
      return {
        id: entry.id,
        round,
        turnLabel,
        faction,
        actorName: actorFromParams,
        autoBadge,
        actionKind: 'skill',
        actionLabel: translate(lang, 'log.actionSplash'),
        targetName: targetFromParams,
        valueText: `-${dmg}`,
        valueTone: 'damage',
        fallbackText,
        sentence,
        spCost: null,
        isStrong: isBig,
        strongTone: isBig ? 'heavy' : null,
        ...avatarMeta,
      };
    }

    case 'log.counterAttack': {
      const dmg = Number(p.damage ?? 0);
      const counterActor = targetFromParams ?? actorFromParams;
      const counterTarget = targetFromParams ? actorFromParams : null;
      const isBig = dmg >= 200;
      const counterAvatar = resolveActorAvatarMeta(
        entry,
        counterActor,
        faction,
        units
      );
      const sentence = isVi
        ? `${counterActor} phản kích ${counterTarget ?? ''}, gây ${dmg} sát thương`
        : `${counterActor} counters ${counterTarget ?? ''}, dealing ${dmg} damage`;
      return {
        id: entry.id,
        round,
        turnLabel,
        faction,
        actorName: counterActor,
        autoBadge,
        actionKind: 'attack',
        actionLabel: translate(lang, 'log.actionCounter'),
        targetName: counterTarget,
        valueText: `-${dmg}`,
        valueTone: 'damage',
        fallbackText,
        sentence,
        spCost: null,
        isStrong: isBig,
        strongTone: isBig ? 'heavy' : null,
        ...counterAvatar,
      };
    }

    case 'log.evade': {
      const usedAction = skillLabel || translate(lang, 'log.primaryWeapons');
      const sentence = isVi
        ? `${actorFromParams} bắn ${usedAction} vào ${targetFromParams ?? '—'}, bị né`
        : `${actorFromParams} fires ${usedAction} at ${targetFromParams ?? '—'}, evaded`;
      return {
        id: entry.id,
        round,
        turnLabel,
        faction,
        actorName: actorFromParams,
        autoBadge,
        actionKind: skillId ? 'skill' : 'attack',
        actionLabel: usedAction,
        targetName: targetFromParams,
        valueText: translate(lang, 'log.actionEvade'),
        valueTone: 'neutral',
        fallbackText,
        sentence,
        spCost: skillId ? resolvedSkillSpCost : null,
        isStrong: false,
        strongTone: null,
        ...avatarMeta,
      };
    }

    case 'log.invincibleBlock': {
      const sentence = isVi
        ? `${targetFromParams ?? '—'} chặn toàn bộ sát thương từ ${actorFromParams}`
        : `${targetFromParams ?? '—'} blocks all damage from ${actorFromParams}`;
      return {
        id: entry.id,
        round,
        turnLabel,
        faction,
        actorName: actorFromParams,
        autoBadge,
        actionKind: 'shield',
        actionLabel: translate(lang, 'log.actionBlocked'),
        targetName: targetFromParams,
        valueText: '0 DMG',
        valueTone: 'shield',
        fallbackText,
        sentence,
        spCost: null,
        isStrong: false,
        strongTone: null,
        ...avatarMeta,
      };
    }

    case 'log.healSingle': {
      const amount = Number(p.amount ?? 0);
      const usedSkill = skillLabel || getSkillName(lang, 'sup_nanite_mend');
      const isBigHeal =
        amount >= 150 || (targetMaxHp > 0 && amount >= targetMaxHp * 0.25);
      const sentence = isVi
        ? `${actorFromParams} dùng ${usedSkill} lên ${targetFromParams ?? '—'}, hồi ${amount} HP`
        : `${actorFromParams} uses ${usedSkill} on ${targetFromParams ?? '—'}, healing ${amount} HP`;
      return {
        id: entry.id,
        round,
        turnLabel,
        faction,
        actorName: actorFromParams,
        autoBadge,
        actionKind: 'heal',
        actionLabel: usedSkill,
        targetName: targetFromParams,
        valueText: `+${amount} HP`,
        valueTone: 'heal',
        fallbackText,
        sentence,
        spCost: resolvedSkillSpCost,
        isStrong: isBigHeal,
        strongTone: isBigHeal ? 'heal' : null,
        ...avatarMeta,
      };
    }

    case 'log.healSquad': {
      const total = Number(p.total ?? 0);
      const usedSkill = skillLabel || getSkillName(lang, 'sup_aegis_field');
      const isBigHeal = total >= 200;
      const sentence = isVi
        ? `${actorFromParams} dùng ${usedSkill} cho toàn đội, hồi ${total} HP`
        : `${actorFromParams} uses ${usedSkill} on squad, healing ${total} HP`;
      return {
        id: entry.id,
        round,
        turnLabel,
        faction,
        actorName: actorFromParams,
        autoBadge,
        actionKind: 'heal',
        actionLabel: usedSkill,
        targetName: translate(lang, 'stats.teamAlly'),
        valueText: `+${total}`,
        valueTone: 'heal',
        fallbackText,
        sentence,
        spCost: resolvedSkillSpCost,
        isStrong: isBigHeal,
        strongTone: isBigHeal ? 'heal' : null,
        ...avatarMeta,
      };
    }

    case 'log.regenTick': {
      const amount = Number(p.amount ?? 0);
      const unitName = targetFromParams ?? actorFromParams;
      const regenAvatar = resolveActorAvatarMeta(entry, unitName, faction, units);
      const sentence = isVi
        ? `${unitName} tự hồi ${amount} HP`
        : `${unitName} self-repairs ${amount} HP`;
      return {
        id: entry.id,
        round,
        turnLabel,
        faction,
        actorName: unitName,
        autoBadge,
        actionKind: 'heal',
        actionLabel: translate(lang, 'stats.regenTick'),
        targetName: null,
        valueText: `+${amount} HP`,
        valueTone: 'heal',
        fallbackText,
        sentence,
        spCost: null,
        isStrong: false,
        strongTone: null,
        ...regenAvatar,
      };
    }

    case 'log.shieldRegen': {
      const amount = Number(p.amount ?? 0);
      const unitName = targetFromParams ?? actorFromParams;
      const regenAvatar = resolveActorAvatarMeta(entry, unitName, faction, units);
      return {
        id: entry.id,
        round,
        turnLabel,
        faction,
        actorName: unitName,
        autoBadge,
        actionKind: 'shield',
        actionLabel: translate(lang, 'log.tag.SHIELD'),
        targetName: null,
        valueText: `+${amount} SHD`,
        valueTone: 'shield',
        fallbackText,
        sentence: fallbackText,
        spCost: null,
        isStrong: false,
        strongTone: null,
        ...regenAvatar,
      };
    }

    case 'log.defend': {
      const shd = Number(p.shieldRecovered ?? 0);
      const sp = Number(p.spRecovered ?? 0);
      const parts: string[] = [];
      if (shd > 0) parts.push(`+${shd} SHD`);
      if (sp > 0) parts.push(`+${sp} SP`);
      const shdText =
        shd > 0 ? `, +${shd} ${getStatShort(lang, 'shield')}` : '';
      const spText = sp > 0 ? `, +${sp} SP` : '';
      const sentence = isVi
        ? `${actorFromParams} vào thế phòng thủ${shdText}${spText}`
        : `${actorFromParams} braces defense${shdText}${spText}`;
      return {
        id: entry.id,
        round,
        turnLabel,
        faction,
        actorName: actorFromParams,
        autoBadge,
        actionKind: 'shield',
        actionLabel: translate(lang, 'stats.defendAction'),
        targetName: null,
        valueText: parts.join(' ') || translate(lang, 'stats.defendAction'),
        valueTone: 'shield',
        fallbackText,
        sentence,
        spCost: null,
        isStrong: false,
        strongTone: null,
        ...avatarMeta,
      };
    }

    case 'log.energize': {
      const amount = Number(p.amount ?? 0);
      const usedSkill = skillLabel || getSkillName(lang, 'sup_flux_transfer');
      const sentence = isVi
        ? `${actorFromParams} dùng ${usedSkill} lên ${targetFromParams ?? '—'}, hồi +${amount} SP`
        : `${actorFromParams} uses ${usedSkill} on ${targetFromParams ?? '—'}, restoring +${amount} SP`;
      return {
        id: entry.id,
        round,
        turnLabel,
        faction,
        actorName: actorFromParams,
        autoBadge,
        actionKind: 'shield',
        actionLabel: usedSkill,
        targetName: targetFromParams,
        valueText: `+${amount} SP`,
        valueTone: 'shield',
        fallbackText,
        sentence,
        spCost: resolvedSkillSpCost,
        isStrong: false,
        strongTone: null,
        ...avatarMeta,
      };
    }

    case 'log.spTransfer': {
      const amount = Number(p.amount ?? 0);
      const count = Number(p.count ?? 0);
      const fee = Number(p.fee ?? 0);
      const usedSkill = skillLabel || getSkillName(lang, 'sup_flux_transfer');
      const sentence = isVi
        ? `${actorFromParams} truyền ${amount} SP cho ${count} đồng đội (phí ${fee})`
        : `${actorFromParams} transfers ${amount} SP to ${count} allies (fee ${fee})`;
      return {
        id: entry.id,
        round,
        turnLabel,
        faction,
        actorName: actorFromParams,
        autoBadge,
        actionKind: 'shield',
        actionLabel: usedSkill,
        targetName: null,
        valueText: `+${amount} SP`,
        valueTone: 'shield',
        fallbackText,
        sentence,
        spCost: resolvedSkillSpCost,
        isStrong: false,
        strongTone: null,
        ...avatarMeta,
      };
    }

    case 'log.useSupply': {
      const tplId = String(p.templateId ?? '');
      const supplyKey = `supply.${tplId}.name` as Parameters<typeof translate>[1];
      const supplyLabelRaw = translate(lang, supplyKey);
      const supplyName =
        supplyLabelRaw === supplyKey ? tplId : supplyLabelRaw;
      const hp = Math.max(0, Number(p.hp ?? 0));
      const shield = Math.max(0, Number(p.shield ?? 0));
      const sp = Math.max(0, Number(p.sp ?? 0));
      const parts: string[] = [];
      if (hp > 0) parts.push(`HP +${hp}`);
      if (shield > 0) parts.push(`SHD +${shield}`);
      if (sp > 0) parts.push(`SP +${sp}`);
      const valueText = parts.length > 0 ? parts.join(', ') : 'HP +0';
      return {
        id: entry.id,
        round,
        turnLabel,
        faction,
        actorName: actorFromParams,
        autoBadge,
        actionKind: hp > 0 ? 'heal' : 'shield',
        actionLabel: supplyName,
        targetName: null,
        valueText,
        valueTone: hp > 0 ? 'heal' : shield > 0 ? 'shield' : 'buff',
        fallbackText,
        sentence: fallbackText,
        spCost: null,
        isStrong: false,
        strongTone: null,
        ...avatarMeta,
      };
    }

    case 'log.supplyScanReveal':
    case 'log.supplyScanNone': {
      const tplId = String(p.templateId ?? 'sup_scan_t1');
      const supplyKey = `supply.${tplId}.name` as Parameters<typeof translate>[1];
      const supplyLabelRaw = translate(lang, supplyKey);
      const supplyName =
        supplyLabelRaw === supplyKey ? tplId : supplyLabelRaw;
      const revealed = Number(p.revealed ?? 0);
      const revealedNames = String(p.revealedNames ?? '').trim();
      return {
        id: entry.id,
        round,
        turnLabel,
        faction,
        actorName: actorFromParams,
        autoBadge,
        actionKind: 'buff',
        actionLabel: supplyName,
        targetName: revealedNames || null,
        valueText: revealed > 0 ? `${revealed}` : null,
        valueTone: 'buff',
        fallbackText,
        sentence: fallbackText,
        spCost: null,
        isStrong: false,
        strongTone: null,
        ...avatarMeta,
      };
    }

    case 'log.buffApplied': {
      const usedSkill = skillLabel || translate(lang, 'log.actionStatus');
      const sentence = isVi
        ? targetFromParams
          ? `${actorFromParams} dùng ${usedSkill} lên ${targetFromParams}`
          : `${actorFromParams} dùng ${usedSkill}`
        : targetFromParams
        ? `${actorFromParams} uses ${usedSkill} on ${targetFromParams}`
        : `${actorFromParams} uses ${usedSkill}`;
      return {
        id: entry.id,
        round,
        turnLabel,
        faction,
        actorName: actorFromParams,
        autoBadge,
        actionKind: 'buff',
        actionLabel: usedSkill,
        targetName: targetFromParams,
        valueText: null,
        valueTone: 'buff',
        fallbackText,
        sentence,
        spCost: resolvedSkillSpCost,
        isStrong: false,
        strongTone: null,
        ...avatarMeta,
      };
    }

    case 'log.stanceToggle': {
      const usedSkill = skillLabel || translate(lang, 'log.actionStatus');
      const state = String(p.state ?? 'ON');
      const sentence = isVi
        ? `${actorFromParams} chuyển ${usedSkill}: ${state}`
        : `${actorFromParams} toggles ${usedSkill}: ${state}`;
      return {
        id: entry.id,
        round,
        turnLabel,
        faction,
        actorName: actorFromParams,
        autoBadge,
        actionKind: 'buff',
        actionLabel: usedSkill,
        targetName: null,
        valueText: state,
        valueTone: 'buff',
        fallbackText,
        sentence,
        spCost: resolvedSkillSpCost,
        isStrong: false,
        strongTone: null,
        ...avatarMeta,
      };
    }

    case 'log.charging': {
      const usedSkill = skillLabel || getSkillName(lang, 'str_solar_capacitor');
      const sentence = isVi
        ? `${actorFromParams} tụ năng lượng ${usedSkill}, khai hỏa lượt sau`
        : `${actorFromParams} charges ${usedSkill}, firing next turn`;
      return {
        id: entry.id,
        round,
        turnLabel,
        faction,
        actorName: actorFromParams,
        autoBadge,
        actionKind: 'buff',
        actionLabel: usedSkill,
        targetName: null,
        valueText: getStatusLabel(lang, 'charging'),
        valueTone: 'buff',
        fallbackText,
        sentence,
        spCost: resolvedSkillSpCost,
        isStrong: false,
        strongTone: null,
        ...avatarMeta,
      };
    }

    case 'log.statusCleansed': {
      const sentence = isVi
        ? `${actorFromParams} giải toàn bộ hiệu ứng xấu cho đồng minh`
        : `${actorFromParams} purges all debuffs from allies`;
      return {
        id: entry.id,
        round,
        turnLabel,
        faction,
        actorName: actorFromParams,
        autoBadge,
        actionKind: 'buff',
        actionLabel: translate(lang, 'log.actionCleanse'),
        targetName: null,
        valueText: translate(lang, 'log.actionCleanse'),
        valueTone: 'buff',
        fallbackText,
        sentence,
        spCost: resolvedSkillSpCost,
        isStrong: false,
        strongTone: null,
        ...avatarMeta,
      };
    }

    case 'log.scanReveal':
    case 'log.scanRevealNone': {
      const revealed = Number(p.revealed ?? 0);
      const revealedNames = String(p.revealedNames ?? '').trim();
      const usedSkill = skillLabel || getSkillName(lang, 'sup_lidar_sweep');
      const sentence =
        revealedNames.length > 0
          ? isVi
            ? `${actorFromParams} dùng ${usedSkill}, phát hiện ${revealedNames}`
            : `${actorFromParams} uses ${usedSkill}, revealing ${revealedNames}`
          : isVi
          ? `${actorFromParams} dùng ${usedSkill}, không phát hiện tàng hình`
          : `${actorFromParams} uses ${usedSkill}, no cloaked targets`;
      return {
        id: entry.id,
        round,
        turnLabel,
        faction,
        actorName: actorFromParams,
        autoBadge,
        actionKind: 'buff',
        actionLabel: usedSkill,
        targetName: revealedNames || null,
        valueText: revealed > 0 ? `${revealed}` : null,
        valueTone: 'buff',
        fallbackText,
        sentence,
        spCost: resolvedSkillSpCost,
        isStrong: false,
        strongTone: null,
        ...avatarMeta,
      };
    }

    case 'log.statusApplied': {
      const status = String(p.status ?? 'burn') as StatusEffectType;
      const registryId = p.registryId ? String(p.registryId) : undefined;
      const isDebuff = isStatusEffectDebuff(status, registryId);
      const turns = Number(p.turns ?? 2);
      const statusLabel = getStatusDisplayName(lang, status, registryId);
      const subject = targetFromParams ?? actorFromParams;
      const subjectAvatar = resolveActorAvatarMeta(
        entry,
        subject,
        faction,
        units
      );
      const isShieldBreak = status === 'shield_break';
      const sentence = isVi
        ? isDebuff
          ? `${subject} bị ${statusLabel} (${turns} lượt)`
          : `${subject} nhận ${statusLabel} (${turns} lượt)`
        : isDebuff
        ? `${subject} afflicted with ${statusLabel} (${turns}t)`
        : `${subject} gains ${statusLabel} (${turns}t)`;
      return {
        id: entry.id,
        round,
        turnLabel,
        faction,
        actorName: subject,
        autoBadge,
        actionKind: isDebuff ? 'debuff' : 'buff',
        actionLabel: statusLabel,
        targetName:
          targetFromParams && targetFromParams !== actorFromParams
            ? targetFromParams
            : null,
        valueText: `${statusLabel} (${turns}t)`,
        valueTone: isDebuff ? 'debuff' : 'buff',
        fallbackText,
        sentence,
        spCost: null,
        isStrong: isShieldBreak,
        strongTone: isShieldBreak ? 'shield-break' : null,
        ...subjectAvatar,
      };
    }

    case 'log.registryDotTick': {
      const dmg = Number(p.damage ?? 0);
      const resource = String(p.resource ?? 'HP');
      const registryId = p.registryId ? String(p.registryId) : undefined;
      const statusLabel = getStatusDisplayName(
        lang,
        'registry_effect',
        registryId
      );
      const subject = targetFromParams ?? actorFromParams;
      const subjectAvatar = resolveActorAvatarMeta(
        entry,
        subject,
        faction,
        units
      );
      const sentence = isVi
        ? `${subject} chịu ${dmg} ${resource} từ ${statusLabel}`
        : `${subject} suffers ${dmg} ${resource} from ${statusLabel}`;
      return {
        id: entry.id,
        round,
        turnLabel,
        faction,
        actorName: subject,
        autoBadge,
        actionKind: 'debuff',
        actionLabel: statusLabel,
        targetName: null,
        valueText: `-${dmg} ${resource}`,
        valueTone: 'damage',
        fallbackText,
        sentence,
        spCost: null,
        isStrong: dmg >= 220,
        strongTone: dmg >= 220 ? 'heavy' : null,
        ...subjectAvatar,
      };
    }

    case 'log.registryHotTick': {
      const amount = Number(p.amount ?? 0);
      const resource = String(p.resource ?? 'HP');
      const registryId = p.registryId ? String(p.registryId) : undefined;
      const statusLabel = getStatusDisplayName(
        lang,
        'registry_effect',
        registryId
      );
      const subject = targetFromParams ?? actorFromParams;
      const subjectAvatar = resolveActorAvatarMeta(
        entry,
        subject,
        faction,
        units
      );
      const sentence = isVi
        ? `${subject} hồi +${amount} ${resource} từ ${statusLabel}`
        : `${subject} recovers +${amount} ${resource} from ${statusLabel}`;
      return {
        id: entry.id,
        round,
        turnLabel,
        faction,
        actorName: subject,
        autoBadge,
        actionKind: resource === 'HP' ? 'heal' : 'buff',
        actionLabel: statusLabel,
        targetName: null,
        valueText: `+${amount} ${resource}`,
        valueTone: resource === 'HP' ? 'heal' : 'buff',
        fallbackText,
        sentence,
        spCost: null,
        isStrong: false,
        strongTone: null,
        ...subjectAvatar,
      };
    }

    case 'log.controlResisted': {
      const registryId = p.registryId ? String(p.registryId) : undefined;
      const statusLabel = getStatusDisplayName(
        lang,
        'registry_effect',
        registryId
      );
      const subject = targetFromParams ?? actorFromParams;
      const subjectAvatar = resolveActorAvatarMeta(
        entry,
        subject,
        faction,
        units
      );
      const sentence = isVi
        ? `Kháng: ${statusLabel}`
        : `Resisted: ${statusLabel}`;
      return {
        id: entry.id,
        round,
        turnLabel,
        faction,
        actorName: subject,
        autoBadge,
        actionKind: 'system',
        actionLabel: statusLabel,
        targetName: null,
        valueText: sentence,
        valueTone: 'neutral',
        fallbackText,
        sentence,
        spCost: null,
        isStrong: false,
        strongTone: null,
        ...subjectAvatar,
      };
    }

    case 'log.burnTick': {
      const dmg = Number(p.damage ?? 0);
      const subject = targetFromParams ?? actorFromParams;
      const burnAvatar = resolveActorAvatarMeta(entry, subject, faction, units);
      const sentence = isVi
        ? `${subject} chịu ${dmg} sát thương Thiêu đốt`
        : `${subject} suffers ${dmg} Burn damage`;
      return {
        id: entry.id,
        round,
        turnLabel,
        faction,
        actorName: subject,
        autoBadge,
        actionKind: 'debuff',
        actionLabel: translate(lang, 'log.actionBurn'),
        targetName: null,
        valueText: `-${dmg} HP`,
        valueTone: 'damage',
        fallbackText,
        sentence,
        spCost: null,
        isStrong: dmg >= 220,
        strongTone: dmg >= 220 ? 'heavy' : null,
        ...burnAvatar,
      };
    }

    case 'log.silencedBlocked': {
      const sentence = isVi
        ? `${actorFromParams} bị Câm lặng, chuyển sang Pháo Chính`
        : `${actorFromParams} is Silenced, defaulting to Primary Lasers`;
      return {
        id: entry.id,
        round,
        turnLabel,
        faction,
        actorName: actorFromParams,
        autoBadge,
        actionKind: 'debuff',
        actionLabel: getStatusLabel(lang, 'silence'),
        targetName: null,
        valueText: getStatusLabel(lang, 'silence'),
        valueTone: 'debuff',
        fallbackText,
        sentence,
        spCost: null,
        isStrong: false,
        strongTone: null,
        ...avatarMeta,
      };
    }

    case 'log.destroyed': {
      const classId = String(p.classId ?? 'striker') as MechClassId;
      const classLabel = getClassName(lang, classId);
      const targetLabel = targetFromParams ?? actorFromParams;
      const sentence = isVi
        ? `${targetLabel} (${classLabel}) đã phát nổ!`
        : `${targetLabel} (${classLabel}) was destroyed!`;
      return {
        id: entry.id,
        round,
        turnLabel,
        faction,
        actorName: actorFromParams,
        autoBadge,
        actionKind: 'kill',
        actionLabel: translate(lang, 'log.actionKill'),
        targetName: targetFromParams,
        valueText: 'KO',
        valueTone: 'damage',
        fallbackText,
        sentence,
        spCost: null,
        isStrong: true,
        strongTone: 'kill',
        ...avatarMeta,
      };
    }

    case 'log.unitMovesRow': {
      const rowStr = getRowLabel(lang, p.row);
      const sentence = isVi
        ? `${actorFromParams} di chuyển sang ${rowStr}`
        : `${actorFromParams} moves to ${rowStr}`;
      return {
        id: entry.id,
        round,
        turnLabel,
        faction,
        actorName: actorFromParams,
        autoBadge,
        actionKind: 'move-row',
        actionLabel: translate(lang, 'log.actionMoveRow'),
        targetName: rowStr,
        valueText: null,
        valueTone: 'neutral',
        fallbackText,
        sentence,
        spCost: null,
        isStrong: false,
        strongTone: null,
        ...avatarMeta,
      };
    }

    case 'log.battleStart':
    case 'log.sectorSupply':
    case 'log.prestageConfirm':
    case 'log.emergencyResupplyAlly':
    case 'log.emergencyResupplyEnemy':
    case 'log.retreat':
    case 'log.wingmanChat':
    default: {
      return {
        id: entry.id,
        round,
        turnLabel,
        faction,
        actorName:
          entry.templateKey === 'log.battleStart' ||
          entry.templateKey === 'log.sectorSupply' ||
          entry.templateKey === 'log.prestageConfirm' ||
          entry.templateKey === 'log.emergencyResupplyAlly' ||
          entry.templateKey === 'log.emergencyResupplyEnemy'
            ? translate(lang, 'log.actionSystem')
            : actorFromParams,
        autoBadge,
        actionKind: 'system',
        actionLabel: fallbackText,
        targetName: null,
        valueText: null,
        valueTone: 'neutral',
        fallbackText,
        sentence: fallbackText,
        spCost: null,
        isStrong: false,
        strongTone: null,
        ...avatarMeta,
      };
    }
  }
}

/**
 * Pure aggregator for the live "Diễn biến" / "Progress" view during an active battle.
 */
export function buildLiveBattleProgress(
  battle: BattleState,
  stats: BattleStatsSummary
): LiveBattleProgress {
  const units = Array.isArray(battle?.units) ? battle.units : [];
  const events = Array.isArray(battle?.events) ? battle.events : [];
  const unitMap = new Map(units.map((u) => [u.id, u]));

  let allyActiveBuffs = 0;
  let allyActiveDebuffs = 0;
  let enemyActiveBuffs = 0;
  let enemyActiveDebuffs = 0;

  for (const u of units) {
    if (!u.alive || !Array.isArray(u.statuses)) continue;
    for (const st of u.statuses) {
      const isDebuff =
        st.isDebuff !== undefined
          ? Boolean(st.isDebuff)
          : isStatusEffectDebuff(st.type, st.registryId);
      if (u.side === 'ally') {
        if (isDebuff) allyActiveDebuffs += 1;
        else allyActiveBuffs += 1;
      } else {
        if (isDebuff) enemyActiveDebuffs += 1;
        else enemyActiveBuffs += 1;
      }
    }
  }

  const topDamageDealers = [...stats.units]
    .filter((u) => u.damageDealt > 0)
    .sort((a, b) => b.damageDealt - a.damageDealt || a.name.localeCompare(b.name))
    .slice(0, 3);

  const topHealers = [...stats.units]
    .filter((u) => u.healingDone > 0)
    .sort((a, b) => b.healingDone - a.healingDone || a.name.localeCompare(b.name))
    .slice(0, 3);

  const killTimeline: KillTimelineItem[] = [];
  for (const ev of events) {
    if (ev.type !== 'kill') continue;
    const killer = ev.actorId ? unitMap.get(ev.actorId) : undefined;
    const victim = ev.targetId ? unitMap.get(ev.targetId) : undefined;
    killTimeline.push({
      id: ev.id,
      round: ev.round,
      turn: ev.turn,
      killerId: ev.actorId ?? '',
      killerName: killer?.name ?? ev.actorId ?? '—',
      killerSide: killer?.side ?? 'system',
      victimId: ev.targetId ?? '',
      victimName: victim?.name ?? ev.targetId ?? '—',
      victimSide: victim?.side ?? 'system',
    });
  }

  return {
    round: battle?.round ?? stats.rounds ?? 1,
    turn: Math.max(0, battle?.turnCounter ?? 0),
    allyAlive: stats.ally.aliveCount,
    allyTotal: stats.ally.totalCount,
    enemyAlive: stats.enemy.aliveCount,
    enemyTotal: stats.enemy.totalCount,
    allyDamageDealt: stats.ally.damageDealt,
    allyDamageTaken: stats.ally.damageTakenTotal,
    enemyDamageDealt: stats.enemy.damageDealt,
    enemyDamageTaken: stats.enemy.damageTakenTotal,
    topDamageDealers,
    topHealers,
    activeBuffsCount: allyActiveBuffs + enemyActiveBuffs,
    activeDebuffsCount: allyActiveDebuffs + enemyActiveDebuffs,
    allyActiveBuffs,
    allyActiveDebuffs,
    enemyActiveBuffs,
    enemyActiveDebuffs,
    killTimeline,
  };
}

export interface CombatLogSentencePart {
  text: string;
  iconKind?: CardPopupIconKind;
  symbol?: string;
  colorClass?: string;
}

function insertSingleIconBeforeMatch(
  sentence: string,
  regex: RegExp,
  prefixGroupIndex: number,
  iconKind: CardPopupIconKind,
  colorClass: string,
  iconMods?: readonly IconCatalogModRow[] | null
): CombatLogSentencePart[] | null {
  const m = regex.exec(sentence);
  if (!m) return null;
  const prefixLen = m[prefixGroupIndex]?.length ?? 0;
  const splitAt = m.index + prefixLen;
  return [
    { text: sentence.slice(0, splitAt) },
    {
      iconKind,
      symbol: getCardPopupSymbol(iconKind, iconMods),
      colorClass,
      text: sentence.slice(splitAt),
    },
  ];
}

export function splitLogSentenceWithIcons(
  entry: Pick<CombatLogEntry, 'templateKey'>,
  row: Pick<StructuredCombatLogRow, 'sentence' | 'strongTone'>,
  iconMods?: readonly IconCatalogModRow[] | null
): CombatLogSentencePart[] {
  const { sentence } = row;
  if (!sentence) return [{ text: '' }];

  switch (entry.templateKey) {
    case 'log.damage': {
      const isCrit = row.strongTone === 'crit';
      return (
        insertSingleIconBeforeMatch(
          sentence,
          /(gây\s+|for\s+)(\d+)/,
          1,
          isCrit ? 'crit' : 'hp',
          isCrit ? 'text-amber-300' : 'text-red-400',
          iconMods
        ) ?? [{ text: sentence }]
      );
    }

    case 'log.splashDamage':
      return (
        insertSingleIconBeforeMatch(
          sentence,
          /(gây\s+|for\s+)(\d+)/,
          1,
          'splash',
          'text-red-400',
          iconMods
        ) ?? [{ text: sentence }]
      );

    case 'log.burnTick':
      return (
        insertSingleIconBeforeMatch(
          sentence,
          /(chịu\s+|suffers\s+)(\d+)/,
          1,
          'burn',
          'text-orange-300',
          iconMods
        ) ?? [{ text: sentence }]
      );

    case 'log.healSingle':
    case 'log.healSquad':
    case 'log.regenTick':
      return (
        insertSingleIconBeforeMatch(
          sentence,
          /(hồi\s+|healing\s+|self-repairs\s+)(\+?\d+)/,
          1,
          'hp_plus',
          'text-emerald-300',
          iconMods
        ) ?? [{ text: sentence }]
      );

    case 'log.shieldRegen':
      return (
        insertSingleIconBeforeMatch(
          sentence,
          /()(\+\d+)/,
          1,
          'shield',
          'text-sky-300',
          iconMods
        ) ?? [{ text: sentence }]
      );

    case 'log.energize':
    case 'log.spTransfer':
      return (
        insertSingleIconBeforeMatch(
          sentence,
          /()(\+?\d+\s*SP)/,
          1,
          'sp',
          SP_COLOR_TOKENS.textClass,
          iconMods
        ) ?? [{ text: sentence }]
      );

    case 'log.defend': {
      const parts: CombatLogSentencePart[] = [];
      const tokenRe = /(\+\d+)\s*(Khiên|Shield|SHD|SP)/g;
      let cursor = 0;
      let match: RegExpExecArray | null;
      while ((match = tokenRe.exec(sentence)) !== null) {
        if (match.index > cursor) {
          parts.push({ text: sentence.slice(cursor, match.index) });
        }
        const isSp = match[2] === 'SP';
        const kind: CardPopupIconKind = isSp ? 'sp' : 'shield';
        parts.push({
          iconKind: kind,
          symbol: getCardPopupSymbol(kind, iconMods),
          colorClass: isSp ? SP_COLOR_TOKENS.textClass : 'text-sky-300',
          text: match[0],
        });
        cursor = match.index + match[0].length;
      }
      if (parts.length === 0) return [{ text: sentence }];
      if (cursor < sentence.length) {
        parts.push({ text: sentence.slice(cursor) });
      }
      return parts;
    }

    case 'log.useSupply': {
      const parts: CombatLogSentencePart[] = [];
      const tokenRe = /(HP|SHD|SP)\s+(\+\d+)/g;
      let cursor = 0;
      let match: RegExpExecArray | null;
      while ((match = tokenRe.exec(sentence)) !== null) {
        if (match.index > cursor) {
          parts.push({ text: sentence.slice(cursor, match.index) });
        }
        const kind: CardPopupIconKind =
          match[1] === 'HP' ? 'hp_plus' : match[1] === 'SHD' ? 'shield' : 'sp';
        const colorClass =
          kind === 'hp_plus'
            ? 'text-emerald-300'
            : kind === 'shield'
            ? 'text-sky-300'
            : SP_COLOR_TOKENS.textClass;
        parts.push({
          iconKind: kind,
          symbol: getCardPopupSymbol(kind, iconMods),
          colorClass,
          text: match[2],
        });
        cursor = match.index + match[0].length;
      }
      if (parts.length === 0) return [{ text: sentence }];
      if (cursor < sentence.length) {
        parts.push({ text: sentence.slice(cursor) });
      }
      return parts;
    }

    default:
      return [{ text: sentence }];
  }
}

