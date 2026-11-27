import type {
  ActiveStatusEffect,
  IconCatalogGroupId,
  StatusEffectType,
} from '../types/game';
import { getCatalog, getCatalogRow } from './iconCatalog';
import {
  registerStatusRegistryResolver,
  STATUS_TO_CATALOG_ID,
} from './statusIconMap';

export type StatusPolarity = 'buff' | 'debuff' | 'neutral';
export type StatusValueMode = 'flat' | 'percent';
export type StatusStackRule = 'refresh' | 'add' | 'highest';
export type StatusTickTiming = 'turnStart' | 'turnEnd';
export type StatusRegistryGroup = 'BF' | 'DB' | 'DT' | 'CC' | 'ENG' | 'IMM';

export interface StatusEffectEntry {
  id: string;
  engineTypes?: StatusEffectType[];
  nameVi: string;
  nameEn: string;
  group: StatusRegistryGroup;
  iconId: string;
  polarity: StatusPolarity;
  stat?: string;
  mode: StatusValueMode;
  defaultValue: number;
  durationTurns: number;
  maxStacks: number;
  stackRule: StatusStackRule;
  tickTiming?: StatusTickTiming;
  ignoresShield?: boolean;
  dispellable: boolean;
  controlType?: string;
}

export const IMM_CONTROL_ID = 'IMM_CONTROL' as const;

export const VALID_LUCIDE_FALLBACK_IDS: ReadonlySet<string> = new Set([
  'lucide:Sparkles',
  'lucide:Sun',
  'lucide:Anchor',
  'lucide:Castle',
  'lucide:BatteryCharging',
  'lucide:Shield',
]);

const STATUS_CATALOG_GROUPS: ReadonlySet<IconCatalogGroupId> = new Set([
  'BF',
  'DB',
  'DT',
  'CC',
]);

const VALID_POLARITIES: ReadonlySet<StatusPolarity> = new Set([
  'buff',
  'debuff',
  'neutral',
]);

const VALID_MODES: ReadonlySet<StatusValueMode> = new Set(['flat', 'percent']);
const VALID_STACK_RULES: ReadonlySet<StatusStackRule> = new Set([
  'refresh',
  'add',
  'highest',
]);
const VALID_GROUPS: ReadonlySet<StatusRegistryGroup> = new Set([
  'BF',
  'DB',
  'DT',
  'CC',
  'ENG',
  'IMM',
]);

export function isValidStatusIconId(iconId: string): boolean {
  if (typeof iconId !== 'string' || iconId.trim().length === 0) return false;
  if (VALID_LUCIDE_FALLBACK_IDS.has(iconId)) return true;
  return Boolean(getCatalogRow(iconId));
}

export function getStatusKey(
  st: Pick<ActiveStatusEffect, 'type' | 'registryId'>
): string {
  return st.registryId ?? st.type;
}

interface CatalogStatusMeta {
  nameEn: string;
  polarity?: StatusPolarity;
  stat?: string;
  mode: StatusValueMode;
  defaultValue: number;
  durationTurns: number;
  maxStacks: number;
  stackRule: StatusStackRule;
  tickTiming?: StatusTickTiming;
  ignoresShield?: boolean;
  dispellable: boolean;
  controlType?: string;
}

const CATALOG_STATUS_META: Readonly<Record<string, CatalogStatusMeta>> = {
  // BF01–BF20 (Buffs)
  BF01: {
    nameEn: 'Flat Damage Up',
    stat: 'attack',
    mode: 'flat',
    defaultValue: 20,
    durationTurns: 2,
    maxStacks: 3,
    stackRule: 'add',
    dispellable: true,
  },
  BF02: {
    nameEn: 'Damage Up (%)',
    stat: 'attack',
    mode: 'percent',
    defaultValue: 0.2,
    durationTurns: 3,
    maxStacks: 1,
    stackRule: 'refresh',
    dispellable: true,
  },
  BF03: {
    nameEn: 'Defense Up',
    stat: 'defense',
    mode: 'percent',
    defaultValue: 0.25,
    durationTurns: 3,
    maxStacks: 1,
    stackRule: 'refresh',
    dispellable: true,
  },
  BF04: {
    nameEn: 'Evasion Up',
    stat: 'dodge',
    mode: 'percent',
    defaultValue: 0.25,
    durationTurns: 3,
    maxStacks: 1,
    stackRule: 'refresh',
    dispellable: true,
  },
  BF05: {
    nameEn: 'Crit Rate Up',
    stat: 'critChance',
    mode: 'percent',
    defaultValue: 0.15,
    durationTurns: 2,
    maxStacks: 1,
    stackRule: 'highest',
    dispellable: true,
  },
  BF06: {
    nameEn: 'Crit Damage Up',
    stat: 'critDamage',
    mode: 'percent',
    defaultValue: 0.25,
    durationTurns: 2,
    maxStacks: 1,
    stackRule: 'highest',
    dispellable: true,
  },
  BF07: {
    nameEn: 'Speed Up',
    stat: 'speed',
    mode: 'percent',
    defaultValue: 0.5,
    durationTurns: 2,
    maxStacks: 1,
    stackRule: 'refresh',
    dispellable: true,
  },
  BF08: {
    nameEn: 'Accuracy Up',
    stat: 'accuracy',
    mode: 'percent',
    defaultValue: 0.15,
    durationTurns: 2,
    maxStacks: 1,
    stackRule: 'highest',
    dispellable: true,
  },
  BF09: {
    nameEn: 'HP Regen',
    stat: 'hp',
    mode: 'percent',
    defaultValue: 0.1,
    durationTurns: 3,
    maxStacks: 1,
    stackRule: 'refresh',
    tickTiming: 'turnStart',
    dispellable: true,
  },
  BF10: {
    nameEn: 'Shield Regen',
    stat: 'shield',
    mode: 'percent',
    defaultValue: 0.08,
    durationTurns: 2,
    maxStacks: 2,
    stackRule: 'add',
    tickTiming: 'turnStart',
    dispellable: true,
  },
  BF11: {
    nameEn: 'SP Regen',
    stat: 'sp',
    mode: 'flat',
    defaultValue: 10,
    durationTurns: 2,
    maxStacks: 2,
    stackRule: 'add',
    tickTiming: 'turnStart',
    dispellable: true,
  },
  BF12: {
    nameEn: 'Temporary Shield',
    stat: 'shield',
    mode: 'flat',
    defaultValue: 100,
    durationTurns: 2,
    maxStacks: 1,
    stackRule: 'highest',
    dispellable: true,
  },
  BF13: {
    nameEn: 'Damage Reduction',
    stat: 'damageTaken',
    mode: 'percent',
    defaultValue: 0.2,
    durationTurns: 2,
    maxStacks: 1,
    stackRule: 'highest',
    dispellable: true,
  },
  BF14: {
    nameEn: 'Lifesteal',
    stat: 'lifesteal',
    mode: 'percent',
    defaultValue: 0.15,
    durationTurns: 2,
    maxStacks: 1,
    stackRule: 'highest',
    dispellable: true,
  },
  BF15: {
    nameEn: 'Counter',
    mode: 'percent',
    defaultValue: 1.0,
    durationTurns: 2,
    maxStacks: 1,
    stackRule: 'refresh',
    dispellable: true,
  },
  BF16: {
    nameEn: 'Target Lock',
    mode: 'flat',
    defaultValue: 1,
    durationTurns: 2,
    maxStacks: 1,
    stackRule: 'refresh',
    dispellable: true,
  },
  BF17: {
    nameEn: 'Speed Boost',
    stat: 'speed',
    mode: 'percent',
    defaultValue: 0.2,
    durationTurns: 2,
    maxStacks: 3,
    stackRule: 'add',
    dispellable: true,
  },
  BF18: {
    nameEn: 'Stealth',
    mode: 'flat',
    defaultValue: 1,
    durationTurns: 2,
    maxStacks: 1,
    stackRule: 'refresh',
    dispellable: true,
  },
  BF19: {
    nameEn: 'Debuff Immunity',
    mode: 'flat',
    defaultValue: 1,
    durationTurns: 2,
    maxStacks: 1,
    stackRule: 'refresh',
    dispellable: true,
  },
  BF20: {
    nameEn: 'Cooldown Reset',
    mode: 'flat',
    defaultValue: 1,
    durationTurns: 1,
    maxStacks: 1,
    stackRule: 'refresh',
    dispellable: false,
  },

  // DB01–DB12 (Stat debuffs)
  DB01: {
    nameEn: 'Attack Down',
    stat: 'attack',
    mode: 'percent',
    defaultValue: 0.2,
    durationTurns: 2,
    maxStacks: 1,
    stackRule: 'highest',
    dispellable: true,
  },
  DB02: {
    nameEn: 'Defense Down',
    stat: 'defense',
    mode: 'percent',
    defaultValue: 0.3,
    durationTurns: 2,
    maxStacks: 1,
    stackRule: 'refresh',
    dispellable: true,
  },
  DB03: {
    nameEn: 'Evasion Down',
    stat: 'dodge',
    mode: 'flat',
    defaultValue: 15,
    durationTurns: 2,
    maxStacks: 2,
    stackRule: 'add',
    dispellable: true,
  },
  DB04: {
    nameEn: 'Crit Rate Down',
    stat: 'critChance',
    mode: 'percent',
    defaultValue: 0.15,
    durationTurns: 2,
    maxStacks: 1,
    stackRule: 'highest',
    dispellable: true,
  },
  DB05: {
    nameEn: 'Slow',
    stat: 'speed',
    mode: 'percent',
    defaultValue: 0.3,
    durationTurns: 2,
    maxStacks: 1,
    stackRule: 'refresh',
    dispellable: true,
  },
  DB06: {
    nameEn: 'Accuracy Down',
    stat: 'accuracy',
    mode: 'percent',
    defaultValue: 0.15,
    durationTurns: 2,
    maxStacks: 1,
    stackRule: 'highest',
    dispellable: true,
  },
  DB07: {
    nameEn: 'Range Down',
    stat: 'range',
    mode: 'flat',
    defaultValue: 1,
    durationTurns: 2,
    maxStacks: 1,
    stackRule: 'refresh',
    dispellable: true,
  },
  DB08: {
    nameEn: 'Healing Down',
    stat: 'healing',
    mode: 'percent',
    defaultValue: 0.4,
    durationTurns: 2,
    maxStacks: 1,
    stackRule: 'highest',
    dispellable: true,
  },
  DB09: {
    nameEn: 'Vulnerable',
    stat: 'damageTaken',
    mode: 'percent',
    defaultValue: 0.15,
    durationTurns: 2,
    maxStacks: 1,
    stackRule: 'refresh',
    dispellable: true,
  },
  DB10: {
    nameEn: 'Shield Break',
    mode: 'flat',
    defaultValue: 1,
    durationTurns: 2,
    maxStacks: 1,
    stackRule: 'refresh',
    dispellable: true,
  },
  DB11: {
    nameEn: 'Marked',
    stat: 'damageTaken',
    mode: 'percent',
    defaultValue: 0.1,
    durationTurns: 2,
    maxStacks: 1,
    stackRule: 'refresh',
    dispellable: true,
  },
  DB12: {
    nameEn: 'Shield Cracked',
    mode: 'percent',
    defaultValue: 1.3,
    durationTurns: 2,
    maxStacks: 1,
    stackRule: 'refresh',
    dispellable: true,
  },

  // DT01–DT06 (Damage over time)
  DT01: {
    nameEn: 'Burn',
    stat: 'hp',
    mode: 'percent',
    defaultValue: 0.08,
    durationTurns: 2,
    maxStacks: 1,
    stackRule: 'refresh',
    tickTiming: 'turnStart',
    ignoresShield: true,
    dispellable: true,
  },
  DT02: {
    nameEn: 'Poison',
    stat: 'hp',
    mode: 'percent',
    defaultValue: 0.05,
    durationTurns: 3,
    maxStacks: 3,
    stackRule: 'add',
    tickTiming: 'turnStart',
    ignoresShield: true,
    dispellable: true,
  },
  DT03: {
    nameEn: 'Corrosion',
    stat: 'hp',
    mode: 'percent',
    defaultValue: 0.06,
    durationTurns: 2,
    maxStacks: 3,
    stackRule: 'add',
    tickTiming: 'turnStart',
    ignoresShield: false,
    dispellable: true,
  },
  DT04: {
    nameEn: 'Radiation',
    stat: 'hp',
    mode: 'percent',
    defaultValue: 0.05,
    durationTurns: 3,
    maxStacks: 2,
    stackRule: 'add',
    tickTiming: 'turnStart',
    ignoresShield: true,
    dispellable: true,
  },
  DT05: {
    nameEn: 'Shield Leak',
    stat: 'shield',
    mode: 'percent',
    defaultValue: 0.1,
    durationTurns: 2,
    maxStacks: 2,
    stackRule: 'add',
    tickTiming: 'turnStart',
    ignoresShield: false,
    dispellable: true,
  },
  DT06: {
    nameEn: 'Fuel Leak',
    stat: 'sp',
    mode: 'flat',
    defaultValue: 8,
    durationTurns: 2,
    maxStacks: 2,
    stackRule: 'add',
    tickTiming: 'turnStart',
    ignoresShield: true,
    dispellable: true,
  },

  // CC01–CC13 (Control & Special)
  CC01: {
    nameEn: 'EMP Shock',
    mode: 'flat',
    defaultValue: 1,
    durationTurns: 1,
    maxStacks: 1,
    stackRule: 'refresh',
    dispellable: true,
    controlType: 'emp',
  },
  CC02: {
    nameEn: 'Stun',
    mode: 'flat',
    defaultValue: 1,
    durationTurns: 1,
    maxStacks: 1,
    stackRule: 'refresh',
    dispellable: true,
    controlType: 'stun',
  },
  CC03: {
    nameEn: 'Blind',
    stat: 'accuracy',
    mode: 'percent',
    defaultValue: 0.35,
    durationTurns: 2,
    maxStacks: 1,
    stackRule: 'refresh',
    dispellable: true,
    controlType: 'blind',
  },
  CC04: {
    nameEn: 'Silence',
    mode: 'flat',
    defaultValue: 1,
    durationTurns: 2,
    maxStacks: 1,
    stackRule: 'refresh',
    dispellable: true,
    controlType: 'silence',
  },
  CC05: {
    nameEn: 'Root',
    stat: 'speed',
    mode: 'percent',
    defaultValue: 0.25,
    durationTurns: 2,
    maxStacks: 1,
    stackRule: 'refresh',
    dispellable: true,
    controlType: 'root',
  },
  CC06: {
    nameEn: 'Overload',
    stat: 'speed',
    mode: 'percent',
    defaultValue: 0.2,
    durationTurns: 2,
    maxStacks: 2,
    stackRule: 'add',
    dispellable: true,
  },
  CC07: {
    nameEn: 'Weapon Overheat',
    stat: 'attack',
    mode: 'percent',
    defaultValue: 0.25,
    durationTurns: 1,
    maxStacks: 1,
    stackRule: 'refresh',
    dispellable: true,
  },
  CC08: {
    nameEn: 'Dispel',
    polarity: 'neutral',
    mode: 'flat',
    defaultValue: 1,
    durationTurns: 1,
    maxStacks: 1,
    stackRule: 'refresh',
    dispellable: false,
  },
  CC09: {
    nameEn: 'Cleanse',
    polarity: 'neutral',
    mode: 'flat',
    defaultValue: 1,
    durationTurns: 1,
    maxStacks: 1,
    stackRule: 'refresh',
    dispellable: false,
  },
  CC10: {
    nameEn: 'Radar Scan',
    polarity: 'neutral',
    mode: 'flat',
    defaultValue: 1,
    durationTurns: 1,
    maxStacks: 1,
    stackRule: 'refresh',
    dispellable: false,
  },
  CC11: {
    nameEn: 'Revealed',
    polarity: 'neutral',
    mode: 'flat',
    defaultValue: 1,
    durationTurns: 1,
    maxStacks: 1,
    stackRule: 'refresh',
    dispellable: false,
  },
  CC12: {
    nameEn: 'Guard',
    polarity: 'neutral',
    mode: 'flat',
    defaultValue: 1,
    durationTurns: 2,
    maxStacks: 1,
    stackRule: 'refresh',
    dispellable: true,
  },
  CC13: {
    nameEn: 'Shot Down',
    polarity: 'neutral',
    mode: 'flat',
    defaultValue: 1,
    durationTurns: 1,
    maxStacks: 1,
    stackRule: 'refresh',
    dispellable: false,
  },
};

const ENGINE_ONLY_STATUS_ENTRIES: readonly StatusEffectEntry[] = [
  {
    id: 'ENG_evade_all',
    engineTypes: ['evade_all'],
    nameVi: 'Ảo Ảnh',
    nameEn: 'Mirage',
    group: 'ENG',
    iconId: 'lucide:Sparkles',
    polarity: 'neutral',
    mode: 'flat',
    defaultValue: 1,
    durationTurns: 1,
    maxStacks: 1,
    stackRule: 'refresh',
    dispellable: true,
  },
  {
    id: 'ENG_invincible',
    engineTypes: ['invincible'],
    nameVi: 'Bất Tử',
    nameEn: 'Stasis',
    group: 'ENG',
    iconId: 'lucide:Sun',
    polarity: 'neutral',
    mode: 'flat',
    defaultValue: 1,
    durationTurns: 1,
    maxStacks: 1,
    stackRule: 'refresh',
    dispellable: false,
  },
  {
    id: 'ENG_siege_mode',
    engineTypes: ['siege_mode'],
    nameVi: 'Chế Độ Pháo',
    nameEn: 'Siege Mode',
    group: 'ENG',
    iconId: 'lucide:Anchor',
    polarity: 'neutral',
    stat: 'attack',
    mode: 'percent',
    defaultValue: 0.6,
    durationTurns: 99,
    maxStacks: 1,
    stackRule: 'refresh',
    dispellable: false,
  },
  {
    id: 'ENG_siege_defense',
    engineTypes: ['siege_defense'],
    nameVi: 'Pháo Đài',
    nameEn: 'Bastion',
    group: 'ENG',
    iconId: 'lucide:Castle',
    polarity: 'neutral',
    stat: 'defense',
    mode: 'percent',
    defaultValue: 0.8,
    durationTurns: 99,
    maxStacks: 1,
    stackRule: 'refresh',
    dispellable: false,
  },
  {
    id: 'ENG_charging',
    engineTypes: ['charging'],
    nameVi: 'Đang Tụ Năng',
    nameEn: 'Charging',
    group: 'ENG',
    iconId: 'lucide:BatteryCharging',
    polarity: 'neutral',
    mode: 'percent',
    defaultValue: 2.2,
    durationTurns: 2,
    maxStacks: 1,
    stackRule: 'refresh',
    dispellable: false,
  },
];

const CONTROL_IMMUNITY_ENTRY: StatusEffectEntry = {
  id: IMM_CONTROL_ID,
  nameVi: 'Kháng khống chế',
  nameEn: 'Control immunity',
  group: 'IMM',
  iconId: 'lucide:Shield',
  polarity: 'neutral',
  mode: 'flat',
  defaultValue: 1,
  durationTurns: 1,
  maxStacks: 1,
  stackRule: 'refresh',
  dispellable: false,
};

function buildEngineTypesByCatalogId(): Map<string, StatusEffectType[]> {
  const map = new Map<string, StatusEffectType[]>();
  for (const [rawType, catalogId] of Object.entries(STATUS_TO_CATALOG_ID) as [
    StatusEffectType,
    string | null,
  ][]) {
    if (rawType === 'registry_effect' || !catalogId) continue;
    const list = map.get(catalogId) ?? [];
    list.push(rawType);
    map.set(catalogId, list);
  }
  return map;
}

function buildRawStatusEntries(): StatusEffectEntry[] {
  const engineTypesByCatalogId = buildEngineTypesByCatalogId();
  const catalogEntries: StatusEffectEntry[] = getCatalog()
    .filter((row) => STATUS_CATALOG_GROUPS.has(row.group))
    .map((row) => {
      const meta = CATALOG_STATUS_META[row.id];
      const engineTypes = engineTypesByCatalogId.get(row.id);
      const defaultPolarity: StatusPolarity =
        row.kind === 'buff'
          ? 'buff'
          : row.kind === 'debuff'
          ? 'debuff'
          : 'neutral';
      const entry: StatusEffectEntry = {
        id: row.id,
        ...(engineTypes && engineTypes.length > 0 ? { engineTypes } : {}),
        nameVi: row.nameVi,
        nameEn: meta?.nameEn ?? row.nameVi,
        group: row.group as StatusRegistryGroup,
        iconId: row.id,
        polarity: meta?.polarity ?? defaultPolarity,
        ...(meta?.stat ? { stat: meta.stat } : {}),
        mode: meta?.mode ?? 'flat',
        defaultValue: meta?.defaultValue ?? 1,
        durationTurns: meta?.durationTurns ?? 2,
        maxStacks: engineTypes && engineTypes.length > 0 ? 1 : (meta?.maxStacks ?? 1),
        stackRule:
          engineTypes && engineTypes.length > 0
            ? 'refresh'
            : (meta?.stackRule ?? 'refresh'),
        ...(meta?.tickTiming ? { tickTiming: meta.tickTiming } : {}),
        ...(meta?.ignoresShield !== undefined
          ? { ignoresShield: meta.ignoresShield }
          : {}),
        dispellable: meta?.dispellable ?? true,
        ...(meta?.controlType ? { controlType: meta.controlType } : {}),
      };
      return entry;
    });

  return [
    ...catalogEntries,
    ...ENGINE_ONLY_STATUS_ENTRIES.map((e) => ({
      ...e,
      engineTypes: e.engineTypes ? [...e.engineTypes] : undefined,
    })),
    { ...CONTROL_IMMUNITY_ENTRY },
  ];
}

/**
 * Validates raw status effect registry rows, dropping malformed entries with `console.warn`
 * (unknown `iconId`, `maxStacks < 1`, non-finite / `NaN` numbers, missing ids/names) without crashing.
 */
export function validateStatusEntries(rows: unknown): StatusEffectEntry[] {
  if (!Array.isArray(rows)) {
    console.warn('[statusEffects] Expected array of status entries; received non-array.');
    return [];
  }

  const seenIds = new Set<string>();
  const valid: StatusEffectEntry[] = [];

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    if (!raw || typeof raw !== 'object') {
      console.warn(`[statusEffects] Dropping row[${i}]: not an object.`);
      continue;
    }
    const obj = raw as Record<string, unknown>;
    const id = typeof obj.id === 'string' ? obj.id.trim() : '';
    if (!id) {
      console.warn(`[statusEffects] Dropping row[${i}]: missing valid id.`);
      continue;
    }
    if (seenIds.has(id)) {
      console.warn(`[statusEffects] Dropping duplicate status entry "${id}".`);
      continue;
    }
    const nameVi = typeof obj.nameVi === 'string' ? obj.nameVi.trim() : '';
    const nameEn = typeof obj.nameEn === 'string' ? obj.nameEn.trim() : '';
    if (!nameVi || !nameEn) {
      console.warn(`[statusEffects] Dropping "${id}": missing nameVi/nameEn.`);
      continue;
    }
    const group = obj.group as StatusRegistryGroup;
    if (!VALID_GROUPS.has(group)) {
      console.warn(`[statusEffects] Dropping "${id}": invalid group "${String(obj.group)}".`);
      continue;
    }
    const iconId = typeof obj.iconId === 'string' ? obj.iconId.trim() : '';
    if (!isValidStatusIconId(iconId)) {
      console.warn(`[statusEffects] Dropping "${id}": unknown iconId "${String(obj.iconId)}".`);
      continue;
    }
    const polarity = obj.polarity as StatusPolarity;
    if (!VALID_POLARITIES.has(polarity)) {
      console.warn(`[statusEffects] Dropping "${id}": invalid polarity "${String(obj.polarity)}".`);
      continue;
    }
    const mode = obj.mode as StatusValueMode;
    if (!VALID_MODES.has(mode)) {
      console.warn(`[statusEffects] Dropping "${id}": invalid mode "${String(obj.mode)}".`);
      continue;
    }
    const stackRule = obj.stackRule as StatusStackRule;
    if (!VALID_STACK_RULES.has(stackRule)) {
      console.warn(`[statusEffects] Dropping "${id}": invalid stackRule "${String(obj.stackRule)}".`);
      continue;
    }
    if (typeof obj.defaultValue !== 'number' || !Number.isFinite(obj.defaultValue)) {
      console.warn(`[statusEffects] Dropping "${id}": invalid defaultValue "${String(obj.defaultValue)}".`);
      continue;
    }
    if (
      typeof obj.durationTurns !== 'number' ||
      !Number.isFinite(obj.durationTurns) ||
      obj.durationTurns < 0
    ) {
      console.warn(`[statusEffects] Dropping "${id}": invalid durationTurns "${String(obj.durationTurns)}".`);
      continue;
    }
    if (
      typeof obj.maxStacks !== 'number' ||
      !Number.isFinite(obj.maxStacks) ||
      obj.maxStacks < 1
    ) {
      console.warn(`[statusEffects] Dropping "${id}": invalid maxStacks "${String(obj.maxStacks)}".`);
      continue;
    }
    if (
      obj.tickTiming !== undefined &&
      obj.tickTiming !== 'turnStart' &&
      obj.tickTiming !== 'turnEnd'
    ) {
      console.warn(`[statusEffects] Dropping "${id}": invalid tickTiming "${String(obj.tickTiming)}".`);
      continue;
    }

    const clean: StatusEffectEntry = {
      id,
      ...(Array.isArray(obj.engineTypes) && obj.engineTypes.length > 0
        ? { engineTypes: [...(obj.engineTypes as StatusEffectType[])] }
        : {}),
      nameVi,
      nameEn,
      group,
      iconId,
      polarity,
      ...(typeof obj.stat === 'string' && obj.stat.trim().length > 0
        ? { stat: obj.stat.trim() }
        : {}),
      mode,
      defaultValue: obj.defaultValue,
      durationTurns: Math.floor(obj.durationTurns),
      maxStacks: Math.floor(obj.maxStacks),
      stackRule,
      ...(obj.tickTiming ? { tickTiming: obj.tickTiming } : {}),
      ...(typeof obj.ignoresShield === 'boolean'
        ? { ignoresShield: obj.ignoresShield }
        : {}),
      dispellable: typeof obj.dispellable === 'boolean' ? obj.dispellable : true,
      ...(typeof obj.controlType === 'string' && obj.controlType.trim().length > 0
        ? { controlType: obj.controlType.trim() }
        : {}),
    };
    seenIds.add(id);
    valid.push(clean);
  }

  return valid;
}

export const STATUS_EFFECTS: readonly StatusEffectEntry[] = validateStatusEntries(
  buildRawStatusEntries()
);

const ENTRY_BY_ID = new Map<string, StatusEffectEntry>();
const ENTRY_BY_ENGINE_TYPE = new Map<StatusEffectType, StatusEffectEntry>();

for (const entry of STATUS_EFFECTS) {
  ENTRY_BY_ID.set(entry.id, entry);
  if (entry.engineTypes) {
    for (const et of entry.engineTypes) {
      ENTRY_BY_ENGINE_TYPE.set(et, entry);
    }
  }
}

export function getStatusEntry(id: string): StatusEffectEntry | undefined {
  return ENTRY_BY_ID.get(id);
}

export function getEntryForEngineType(
  type: StatusEffectType
): StatusEffectEntry | undefined {
  return ENTRY_BY_ENGINE_TYPE.get(type);
}

export function isDebuffType(type: StatusEffectType): boolean {
  return ENTRY_BY_ENGINE_TYPE.get(type)?.polarity === 'debuff';
}

registerStatusRegistryResolver((id) => ENTRY_BY_ID.get(id));
