import type {
  ActiveStatusEffect,
  CombatUnit,
  IconCatalogKind,
  IconCatalogModRow,
  IconCatalogRow,
  Language,
  StatusEffectType,
} from '../types/game';
import { BALANCE_CONFIG } from './balance';
import { getCatalogRow } from './iconCatalog';

export interface StatusRegistryLookupInfo {
  id: string;
  nameVi: string;
  nameEn: string;
  iconId: string;
  polarity: 'buff' | 'debuff' | 'neutral';
  stat?: string;
  mode: 'flat' | 'percent';
  defaultValue: number;
  tickTiming?: 'turnStart' | 'turnEnd';
  controlType?: string;
}

type RegistryEntryResolver = (id: string) => StatusRegistryLookupInfo | undefined;
let registryEntryResolver: RegistryEntryResolver | null = null;

/**
 * Internal hook registered by `src/data/statusEffects.ts` on load so `statusIconMap.ts`
 * can resolve registry-only statuses without introducing a circular module import.
 */
export function registerStatusRegistryResolver(resolver: RegistryEntryResolver): void {
  registryEntryResolver = resolver;
}

/**
 * Maps engine StatusEffectType IDs to catalog IDs in `iconCatalog.json`.
 * Effects without an accurate semantic match in the 99-row catalog are intentionally
 * kept `null` (neutral Lucide icon fallback) — never invent catalog rows.
 */
export const STATUS_TO_CATALOG_ID: Record<StatusEffectType, string | null> = {
  burn: 'DT01',
  shield_break: 'DB10',
  shield_cracked: 'DB12',
  slow: 'DB05',
  silence: 'CC04',
  stealth: 'BF18',
  vulnerable: 'DB09',
  def_up: 'BF03',
  def_down: 'DB02',
  eva_up: 'BF04',
  atk_up: 'BF02',
  spd_up: 'BF07',
  primary_dmg_up: 'BF02',
  skill_dmg_up: 'BF02',
  sure_hit: 'BF16',
  counter: 'BF15',
  evade_all: null,
  invincible: null,
  regen_hp: 'BF09',
  siege_mode: null,
  siege_defense: null,
  charging: null,
  registry_effect: null,
};

/**
 * Explicit allowlist of engine status IDs without a matching row in iconCatalog.json.
 * Tests fail if any StatusEffectType is missing from STATUS_TO_CATALOG_ID or neither
 * mapped to a catalog row nor listed here.
 */
export const UNMAPPED_STATUS_ALLOWLIST: readonly StatusEffectType[] = [
  'evade_all',
  'invincible',
  'siege_mode',
  'siege_defense',
  'charging',
  'registry_effect',
] as const;

export const ALL_ENGINE_STATUS_TYPES: readonly StatusEffectType[] = [
  'burn',
  'shield_break',
  'shield_cracked',
  'slow',
  'silence',
  'stealth',
  'vulnerable',
  'def_up',
  'def_down',
  'eva_up',
  'atk_up',
  'spd_up',
  'primary_dmg_up',
  'skill_dmg_up',
  'sure_hit',
  'counter',
  'evade_all',
  'invincible',
  'regen_hp',
  'siege_mode',
  'siege_defense',
  'charging',
  'registry_effect',
] as const;

export function getCatalogRowForStatus(
  type: StatusEffectType,
  mods?: readonly IconCatalogModRow[] | null
): IconCatalogRow | null {
  const catalogId = STATUS_TO_CATALOG_ID[type];
  if (!catalogId) return null;
  return getCatalogRow(catalogId, mods) ?? null;
}

/**
 * S1a: Reads `registryId` first (via statusEffects registry), then falls back to the
 * legacy `STATUS_TO_CATALOG_ID[status.type]` path.
 */
export function getCatalogRowForActiveStatus(
  status: Pick<ActiveStatusEffect, 'type' | 'registryId'>,
  mods?: readonly IconCatalogModRow[] | null
): IconCatalogRow | null {
  if (status.registryId) {
    const entry = registryEntryResolver?.(status.registryId);
    if (entry) {
      if (entry.iconId.startsWith('lucide:')) return null;
      return getCatalogRow(entry.iconId, mods) ?? null;
    }
    const directRow = getCatalogRow(status.registryId, mods);
    if (directRow) return directRow;
  }
  return getCatalogRowForStatus(status.type, mods);
}

export function getStatusVisualKind(
  st: ActiveStatusEffect,
  catalogRow: IconCatalogRow | null
): IconCatalogKind {
  if (catalogRow) return catalogRow.kind;
  if (st.registryId) {
    const entry = registryEntryResolver?.(st.registryId);
    if (entry) {
      if (entry.polarity === 'debuff') return 'debuff';
      if (entry.polarity === 'buff') return 'buff';
      return 'normal';
    }
  }
  if (st.isDebuff || st.type === 'shield_cracked') return 'debuff';
  return 'normal';
}

/**
 * Sorts status effects for status areas:
 * 1) Debuffs first, then neutral/normal, then buffs
 * 2) Shorter turns remaining first (earliest to expire first)
 */
export function sortStatusEffects(
  statuses: readonly ActiveStatusEffect[],
  mods?: readonly IconCatalogModRow[] | null
): ActiveStatusEffect[] {
  const kindRank = (st: ActiveStatusEffect): number => {
    const row = getCatalogRowForActiveStatus(st, mods);
    const kind = getStatusVisualKind(st, row);
    if (kind === 'debuff') return 0;
    if (kind === 'normal') return 1;
    return 2;
  };

  return [...statuses].sort((a, b) => {
    const rankDiff = kindRank(a) - kindRank(b);
    if (rankDiff !== 0) return rankDiff;
    const turnsDiff = a.turnsRemaining - b.turnsRemaining;
    if (turnsDiff !== 0) return turnsDiff;
    return (a.registryId ?? a.type).localeCompare(b.registryId ?? b.type);
  });
}

function getStatShortLabel(lang: Language, stat?: string): string {
  const isVi = lang === 'vi';
  switch (stat) {
    case 'attack':
      return isVi ? 'ST' : 'ATK';
    case 'defense':
      return isVi ? 'Giáp' : 'DEF';
    case 'dodge':
      return isVi ? 'Né' : 'EVA';
    case 'speed':
      return isVi ? 'Tốc' : 'SPD';
    case 'critChance':
      return isVi ? 'CM' : 'CRIT';
    case 'critDamage':
      return isVi ? 'STCM' : 'CDMG';
    case 'accuracy':
      return isVi ? 'CX' : 'ACC';
    case 'hp':
      return 'HP';
    case 'shield':
      return isVi ? 'Khiên' : 'SHD';
    case 'sp':
      return 'SP';
    case 'damageTaken':
      return isVi ? 'ST nhận' : 'DMG';
    case 'lifesteal':
      return isVi ? 'Hút' : 'LS';
    case 'healing':
      return isVi ? 'Hồi' : 'HEAL';
    case 'range':
      return isVi ? 'Tầm' : 'RNG';
    default:
      return '';
  }
}

function formatRegistryEffectShortValue(
  lang: Language,
  st: ActiveStatusEffect,
  unit?: CombatUnit | null
): string {
  const isVi = lang === 'vi';
  const entry = st.registryId ? registryEntryResolver?.(st.registryId) : undefined;
  const stStacks =
    Number.isFinite(st.stacks) && (st.stacks as number) >= 2
      ? Math.floor(st.stacks as number)
      : 1;
  const stackSuffix = stStacks > 1 ? ` x${stStacks}` : '';

  if (!entry) {
    const fallback = st.registryId ?? (isVi ? 'Hiệu ứng' : 'Effect');
    return `${fallback}${stackSuffix}`;
  }

  const rawVal = Number.isFinite(st.magnitude)
    ? (st.magnitude as number)
    : entry.defaultValue;
  const sign = entry.polarity === 'debuff' ? '-' : '+';

  if (entry.tickTiming) {
    const totalVal = rawVal * stStacks;
    const perTurn = isVi ? '/lượt' : '/t';
    if (entry.stat === 'hp' && entry.mode === 'percent') {
      const maxHp = unit?.derived?.maxHp ?? 0;
      if (maxHp > 0) {
        const amt = Math.max(1, Math.round(maxHp * totalVal));
        return `${sign}${amt} HP${perTurn}${stackSuffix}`;
      }
      return `${sign}${Math.round(totalVal * 100)}% HP${perTurn}${stackSuffix}`;
    }
    if (entry.stat === 'shield' && entry.mode === 'percent') {
      const maxShd = unit?.derived?.maxShield ?? 0;
      if (maxShd > 0) {
        const amt = Math.max(1, Math.round(maxShd * totalVal));
        return `${sign}${amt} ${isVi ? 'Khiên' : 'SHD'}${perTurn}${stackSuffix}`;
      }
      return `${sign}${Math.round(totalVal * 100)}% ${isVi ? 'Khiên' : 'SHD'}${perTurn}${stackSuffix}`;
    }
    const res = getStatShortLabel(lang, entry.stat) || 'HP';
    if (entry.mode === 'percent') {
      return `${sign}${Math.round(totalVal * 100)}% ${res}${perTurn}${stackSuffix}`;
    }
    return `${sign}${Math.round(totalVal)} ${res}${perTurn}${stackSuffix}`;
  }

  if (entry.stat && entry.polarity !== 'neutral') {
    const statLabel = getStatShortLabel(lang, entry.stat);
    const totalVal = rawVal * stStacks;
    const effectiveSign =
      entry.stat === 'damageTaken'
        ? entry.polarity === 'debuff'
          ? '+'
          : '-'
        : sign;
    const amountStr =
      entry.mode === 'percent'
        ? `${effectiveSign}${Math.round(totalVal * 100)}%`
        : `${effectiveSign}${Math.round(totalVal)}`;
    return `${amountStr}${statLabel ? ` ${statLabel}` : ''}${stackSuffix}`;
  }

  const label = isVi ? entry.nameVi : entry.nameEn;
  return `${label}${stackSuffix}`;
}

/**
 * Computes the short value text ONLY (no effect name, no "(N lượt)") for a StatusChip.
 * Examples: "+30% ST", "+184 HP/lượt", "-30% Tốc", "Khóa Khiên".
 * When `allowStack` is true and `stacks >= 2`, numeric amounts/percentages are multiplied
 * by `stacks` to show the stacked total (e.g. 92/stack * 2 = +184 HP/lượt).
 * S1a: When `st.stacks > 1` on the status itself, shows "xN" via this formatter.
 */
export function formatStatusChipShortValue(
  lang: Language,
  st: ActiveStatusEffect,
  unit?: CombatUnit | null,
  stacks = 1,
  allowStack = false
): string {
  if (st.type === 'registry_effect') {
    return formatRegistryEffectShortValue(lang, st, unit);
  }

  const isVi = lang === 'vi';
  const effectiveStacks =
    allowStack && Number.isFinite(stacks) && stacks >= 2 ? Math.floor(stacks) : 1;
  const embeddedStacks =
    Number.isFinite(st.stacks) && (st.stacks as number) >= 2
      ? Math.floor(st.stacks as number)
      : 1;
  const stackSuffix = embeddedStacks > 1 ? ` x${embeddedStacks}` : '';
  const maxHp = unit?.derived?.maxHp ?? 0;

  let base: string;
  switch (st.type) {
    case 'burn': {
      if (maxHp > 0) {
        const perStack = Math.max(
          5,
          Math.round(maxHp * BALANCE_CONFIG.burnDamageRatio)
        );
        const total = perStack * effectiveStacks;
        base = isVi ? `-${total} HP/lượt` : `-${total} HP/t`;
      } else {
        const pct = Math.round(BALANCE_CONFIG.burnDamageRatio * 100) * effectiveStacks;
        base = isVi ? `-${pct}% HP/lượt` : `-${pct}% HP/t`;
      }
      break;
    }
    case 'regen_hp': {
      const ratio = st.magnitude ?? 0.1;
      if (maxHp > 0) {
        const perStack = Math.max(4, Math.round(maxHp * ratio));
        const total = perStack * effectiveStacks;
        base = isVi ? `+${total} HP/lượt` : `+${total} HP/t`;
      } else {
        const pct = Math.round(ratio * 100) * effectiveStacks;
        base = isVi ? `+${pct}% HP/lượt` : `+${pct}% HP/t`;
      }
      break;
    }
    case 'slow': {
      const pct =
        Math.round((st.magnitude ?? BALANCE_CONFIG.slowSpeedPenalty) * 100) *
        effectiveStacks;
      base = isVi ? `-${pct}% Tốc` : `-${pct}% SPD`;
      break;
    }
    case 'spd_up': {
      const pct = Math.round((st.magnitude ?? 0.5) * 100) * effectiveStacks;
      base = isVi ? `+${pct}% Tốc` : `+${pct}% SPD`;
      break;
    }
    case 'def_up': {
      const pct = Math.round((st.magnitude ?? 0.25) * 100) * effectiveStacks;
      base = isVi ? `+${pct}% Giáp` : `+${pct}% DEF`;
      break;
    }
    case 'def_down': {
      const pct = Math.round((st.magnitude ?? 0.3) * 100) * effectiveStacks;
      base = isVi ? `-${pct}% Giáp` : `-${pct}% DEF`;
      break;
    }
    case 'atk_up': {
      const pct = Math.round((st.magnitude ?? 0.2) * 100) * effectiveStacks;
      base = isVi ? `+${pct}% ST` : `+${pct}% ATK`;
      break;
    }
    case 'primary_dmg_up': {
      const pct = Math.round((st.magnitude ?? 0.3) * 100) * effectiveStacks;
      base = isVi ? `+${pct}% ST` : `+${pct}% DMG`;
      break;
    }
    case 'skill_dmg_up': {
      const pct = Math.round((st.magnitude ?? 0.3) * 100) * effectiveStacks;
      base = isVi ? `+${pct}% KN` : `+${pct}% SKL`;
      break;
    }
    case 'eva_up': {
      const bonusPct = Math.round((st.magnitude ?? 0.25) * 40) * effectiveStacks;
      base = isVi ? `+${bonusPct}% Né` : `+${bonusPct}% EVA`;
      break;
    }
    case 'vulnerable': {
      const pct = Math.round((st.magnitude ?? 0.15) * 100) * effectiveStacks;
      base = isVi ? `+${pct}% ST nhận` : `+${pct}% DMG`;
      break;
    }
    case 'shield_break':
      base = isVi ? 'KhiênVỡ' : 'ShdDown';
      break;
    case 'shield_cracked': {
      const mult =
        st.magnitude && st.magnitude >= 1 ? Number(st.magnitude.toFixed(2)) : 1.3;
      base = `x${mult}`;
      break;
    }
    case 'silence':
      base = isVi ? 'Khóa KN' : 'No Skill';
      break;
    case 'stealth':
      base = isVi ? 'Ẩn thân' : 'Stealth';
      break;
    case 'evade_all':
      base = isVi ? 'Né 100%' : '100% EVA';
      break;
    case 'invincible':
      base = isVi ? 'Miễn ST' : '0 DMG';
      break;
    case 'sure_hit': {
      const charges = (st.charges ?? 1) * effectiveStacks;
      base = isVi ? `Chắc trúng ${charges}x` : `Hit ${charges}x`;
      break;
    }
    case 'counter': {
      const pct = Math.round((st.magnitude ?? 1.0) * 100);
      base = isVi ? `Phản ${pct}%` : `Ctr ${pct}%`;
      break;
    }
    case 'siege_mode': {
      const dmgPct = Math.round((st.magnitude ?? 0.6) * 100);
      base = isVi ? `+${dmgPct}% ST` : `+${dmgPct}% DMG`;
      break;
    }
    case 'siege_defense': {
      const defPct = Math.round((st.magnitude ?? 0.8) * 100);
      base = isVi ? `+${defPct}% Giáp` : `+${defPct}% DEF`;
      break;
    }
    case 'charging': {
      const multPct = Math.round((st.magnitude ?? 2.2) * 100);
      base = isVi ? `Nạp ${multPct}%` : `Chg ${multPct}%`;
      break;
    }
  }
  return `${base}${stackSuffix}`;
}

export function getFirstExpiringTurns(
  st: ActiveStatusEffect,
  stackTurns?: readonly number[],
  allowStack = false
): number | null {
  if (allowStack && Array.isArray(stackTurns) && stackTurns.length > 0) {
    const valid = stackTurns.filter((n) => Number.isFinite(n) && n > 0 && n < 50);
    if (valid.length > 0) return Math.min(...valid);
  }
  if (st.turnsRemaining > 0 && st.turnsRemaining < 50) {
    return st.turnsRemaining;
  }
  return null;
}
