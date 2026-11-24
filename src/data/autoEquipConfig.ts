import type {
  AutoEquipClassWeights,
  AutoEquipConfig,
  MechClassId,
} from '../types/game';

/**
 * Centralized Auto-Equip scoring weights & replace-margin config.
 * Editable by Admin CP via `adminConfig.autoEquip`.
 */
export const DEFAULT_AUTO_EQUIP_CONFIG: AutoEquipConfig = {
  replaceMarginPct: 0.03,
  classWeights: {
    striker: {
      attack: 2.0,
      defense: 1.3,
      fuel: 1.2,
      spirit: 1.3,
      shield: 1.2,
      evasion: 1.1,
      critBonusPct: 1.5,
      armorPiercePct: 1.2,
      splashPct: 1.4,
      spRegenPerTurn: 2.2,
      evasionMod: 0.9,
      accuracyPct: 1.2,
      longRangeBonus: 12,
      detectStealthBonus: 5,
      tierBonus: 4,
      qualityWeight: 0.15,
    },
    interceptor: {
      attack: 1.6,
      defense: 0.7,
      fuel: 1.9,
      spirit: 0.9,
      shield: 0.6,
      evasion: 2.2,
      critBonusPct: 2.2,
      armorPiercePct: 1.5,
      splashPct: 0.7,
      spRegenPerTurn: 1.8,
      evasionMod: 1.6,
      accuracyPct: 1.0,
      longRangeBonus: 6,
      detectStealthBonus: 5,
      tierBonus: 4,
      qualityWeight: 0.15,
    },
    siege: {
      attack: 2.3,
      defense: 1.6,
      fuel: 0.6,
      spirit: 1.1,
      shield: 1.5,
      evasion: 0.4,
      critBonusPct: 1.2,
      armorPiercePct: 1.4,
      splashPct: 1.5,
      spRegenPerTurn: 2.2,
      evasionMod: 0.3,
      accuracyPct: 1.0,
      longRangeBonus: 22,
      detectStealthBonus: 5,
      tierBonus: 4,
      qualityWeight: 0.15,
    },
    support: {
      attack: 0.8,
      defense: 1.7,
      fuel: 1.4,
      spirit: 2.3,
      shield: 1.9,
      evasion: 1.0,
      critBonusPct: 0.7,
      armorPiercePct: 0.5,
      splashPct: 0.5,
      spRegenPerTurn: 3.5,
      evasionMod: 0.8,
      accuracyPct: 0.6,
      longRangeBonus: 8,
      detectStealthBonus: 5,
      tierBonus: 4,
      qualityWeight: 0.15,
    },
  },
};

const WEIGHT_KEYS: (keyof AutoEquipClassWeights)[] = [
  'attack',
  'defense',
  'fuel',
  'spirit',
  'shield',
  'evasion',
  'critBonusPct',
  'armorPiercePct',
  'splashPct',
  'spRegenPerTurn',
  'evasionMod',
  'accuracyPct',
  'longRangeBonus',
  'detectStealthBonus',
  'tierBonus',
  'qualityWeight',
];

const CLASS_IDS: MechClassId[] = ['striker', 'interceptor', 'siege', 'support'];

export function cloneAutoEquipConfig(
  cfg: AutoEquipConfig = DEFAULT_AUTO_EQUIP_CONFIG
): AutoEquipConfig {
  return {
    replaceMarginPct: cfg.replaceMarginPct,
    classWeights: {
      striker: { ...cfg.classWeights.striker },
      interceptor: { ...cfg.classWeights.interceptor },
      siege: { ...cfg.classWeights.siege },
      support: { ...cfg.classWeights.support },
    },
  };
}

export function sanitizeAutoEquipConfig(raw: unknown): AutoEquipConfig {
  const def = cloneAutoEquipConfig(DEFAULT_AUTO_EQUIP_CONFIG);
  if (!raw || typeof raw !== 'object') return def;
  const obj = raw as Partial<AutoEquipConfig>;

  const replaceMarginPct =
    typeof obj.replaceMarginPct === 'number' &&
    Number.isFinite(obj.replaceMarginPct) &&
    obj.replaceMarginPct >= 0 &&
    obj.replaceMarginPct <= 1
      ? obj.replaceMarginPct
      : def.replaceMarginPct;

  const classWeights = { ...def.classWeights };
  const rawClasses = obj.classWeights as
    | Partial<Record<MechClassId, Partial<AutoEquipClassWeights>>>
    | undefined;

  if (rawClasses && typeof rawClasses === 'object') {
    for (const cid of CLASS_IDS) {
      const rawW = rawClasses[cid];
      if (!rawW || typeof rawW !== 'object') continue;
      const cleanW = { ...def.classWeights[cid] };
      for (const wk of WEIGHT_KEYS) {
        const val = rawW[wk];
        if (typeof val === 'number' && Number.isFinite(val) && val >= 0) {
          cleanW[wk] = val;
        }
      }
      classWeights[cid] = cleanW;
    }
  }

  return {
    replaceMarginPct,
    classWeights,
  };
}
