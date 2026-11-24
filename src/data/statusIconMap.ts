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
] as const;

export function getCatalogRowForStatus(
  type: StatusEffectType,
  mods?: readonly IconCatalogModRow[] | null
): IconCatalogRow | null {
  const catalogId = STATUS_TO_CATALOG_ID[type];
  if (!catalogId) return null;
  return getCatalogRow(catalogId, mods) ?? null;
}

export function getStatusVisualKind(
  st: ActiveStatusEffect,
  catalogRow: IconCatalogRow | null
): IconCatalogKind {
  if (catalogRow) return catalogRow.kind;
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
    const row = getCatalogRowForStatus(st.type, mods);
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
    return a.type.localeCompare(b.type);
  });
}

/**
 * Computes the short value text ONLY (no effect name, no "(N lượt)") for a StatusChip.
 * Examples: "+30% ST", "+184 HP/lượt", "-30% Tốc", "Khóa Khiên".
 * When `allowStack` is true and `stacks >= 2`, numeric amounts/percentages are multiplied
 * by `stacks` to show the stacked total (e.g. 92/stack * 2 = +184 HP/lượt).
 */
export function formatStatusChipShortValue(
  lang: Language,
  st: ActiveStatusEffect,
  unit?: CombatUnit | null,
  stacks = 1,
  allowStack = false
): string {
  const isVi = lang === 'vi';
  const effectiveStacks =
    allowStack && Number.isFinite(stacks) && stacks >= 2 ? Math.floor(stacks) : 1;
  const maxHp = unit?.derived?.maxHp ?? 0;

  switch (st.type) {
    case 'burn': {
      if (maxHp > 0) {
        const perStack = Math.max(
          5,
          Math.round(maxHp * BALANCE_CONFIG.burnDamageRatio)
        );
        const total = perStack * effectiveStacks;
        return isVi ? `-${total} HP/lượt` : `-${total} HP/t`;
      }
      const pct = Math.round(BALANCE_CONFIG.burnDamageRatio * 100) * effectiveStacks;
      return isVi ? `-${pct}% HP/lượt` : `-${pct}% HP/t`;
    }
    case 'regen_hp': {
      const ratio = st.magnitude ?? 0.1;
      if (maxHp > 0) {
        const perStack = Math.max(4, Math.round(maxHp * ratio));
        const total = perStack * effectiveStacks;
        return isVi ? `+${total} HP/lượt` : `+${total} HP/t`;
      }
      const pct = Math.round(ratio * 100) * effectiveStacks;
      return isVi ? `+${pct}% HP/lượt` : `+${pct}% HP/t`;
    }
    case 'slow': {
      const pct =
        Math.round((st.magnitude ?? BALANCE_CONFIG.slowSpeedPenalty) * 100) *
        effectiveStacks;
      return isVi ? `-${pct}% Tốc` : `-${pct}% SPD`;
    }
    case 'spd_up': {
      const pct = Math.round((st.magnitude ?? 0.5) * 100) * effectiveStacks;
      return isVi ? `+${pct}% Tốc` : `+${pct}% SPD`;
    }
    case 'def_up': {
      const pct = Math.round((st.magnitude ?? 0.25) * 100) * effectiveStacks;
      return isVi ? `+${pct}% Giáp` : `+${pct}% DEF`;
    }
    case 'def_down': {
      const pct = Math.round((st.magnitude ?? 0.3) * 100) * effectiveStacks;
      return isVi ? `-${pct}% Giáp` : `-${pct}% DEF`;
    }
    case 'atk_up': {
      const pct = Math.round((st.magnitude ?? 0.2) * 100) * effectiveStacks;
      return isVi ? `+${pct}% ST` : `+${pct}% ATK`;
    }
    case 'primary_dmg_up': {
      const pct = Math.round((st.magnitude ?? 0.3) * 100) * effectiveStacks;
      return isVi ? `+${pct}% ST` : `+${pct}% DMG`;
    }
    case 'skill_dmg_up': {
      const pct = Math.round((st.magnitude ?? 0.3) * 100) * effectiveStacks;
      return isVi ? `+${pct}% KN` : `+${pct}% SKL`;
    }
    case 'eva_up': {
      const bonusPct = Math.round((st.magnitude ?? 0.25) * 40) * effectiveStacks;
      return isVi ? `+${bonusPct}% Né` : `+${bonusPct}% EVA`;
    }
    case 'vulnerable': {
      const pct = Math.round((st.magnitude ?? 0.15) * 100) * effectiveStacks;
      return isVi ? `+${pct}% ST nhận` : `+${pct}% DMG`;
    }
    case 'shield_break':
      return isVi ? 'KhiênVỡ' : 'ShdDown';
    case 'shield_cracked': {
      const mult =
        st.magnitude && st.magnitude >= 1 ? Number(st.magnitude.toFixed(2)) : 1.3;
      return `x${mult}`;
    }
    case 'silence':
      return isVi ? 'Khóa KN' : 'No Skill';
    case 'stealth':
      return isVi ? 'Ẩn thân' : 'Stealth';
    case 'evade_all':
      return isVi ? 'Né 100%' : '100% EVA';
    case 'invincible':
      return isVi ? 'Miễn ST' : '0 DMG';
    case 'sure_hit': {
      const charges = (st.charges ?? 1) * effectiveStacks;
      return isVi ? `Chắc trúng ${charges}x` : `Hit ${charges}x`;
    }
    case 'counter': {
      const pct = Math.round((st.magnitude ?? 1.0) * 100);
      return isVi ? `Phản ${pct}%` : `Ctr ${pct}%`;
    }
    case 'siege_mode': {
      const dmgPct = Math.round((st.magnitude ?? 0.6) * 100);
      return isVi ? `+${dmgPct}% ST` : `+${dmgPct}% DMG`;
    }
    case 'siege_defense': {
      const defPct = Math.round((st.magnitude ?? 0.8) * 100);
      return isVi ? `+${defPct}% Giáp` : `+${defPct}% DEF`;
    }
    case 'charging': {
      const multPct = Math.round((st.magnitude ?? 2.2) * 100);
      return isVi ? `Nạp ${multPct}%` : `Chg ${multPct}%`;
    }
  }
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
