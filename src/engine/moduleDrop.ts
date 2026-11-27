import { getModuleTemplateById } from '../data/modules';
import type {
  ItemTemplate,
  ModuleDropConfig,
  ModuleDropEffectKey,
  ModuleTraitKey,
  StatKey,
} from '../types/game';

export const MODULE_DROP_STAT_KEYS: readonly StatKey[] = [
  'attack',
  'defense',
  'fuel',
  'spirit',
  'shield',
  'evasion',
];

export const MODULE_DROP_TRAIT_KEYS: readonly ModuleTraitKey[] = [
  'critBonusPct',
  'armorPiercePct',
  'spRegenPerTurn',
  'accuracyPct',
];

export const MODULE_DROP_EFFECT_KEYS: readonly ModuleDropEffectKey[] = [
  ...MODULE_DROP_STAT_KEYS,
  ...MODULE_DROP_TRAIT_KEYS,
];

const VALID_MODULE_EFFECT_KEY_SET = new Set<string>(MODULE_DROP_EFFECT_KEYS);

export const MIN_MODULE_DROP_FACTOR = 0;
export const MAX_MODULE_DROP_FACTOR = 1;
export const DEFAULT_MODULE_DROP_FACTOR = 0.1;

export const MIN_MODULE_DROP_SHOP_COUNT = 0;
export const MAX_MODULE_DROP_SHOP_COUNT = 3;
export const DEFAULT_MODULE_DROP_SHOP_COUNT = 1;

export const MIN_MODULE_DROP_WEIGHT = 0;
export const MAX_MODULE_DROP_WEIGHT = 100;

export const DEFAULT_MODULE_DROP_WEIGHTS: Record<ModuleDropEffectKey, number> = {
  attack: 13,
  defense: 13,
  fuel: 13,
  spirit: 13,
  shield: 13,
  evasion: 13,
  critBonusPct: 5,
  armorPiercePct: 5,
  spRegenPerTurn: 5,
  accuracyPct: 5,
};

export const DEFAULT_MODULE_DROP_CONFIG: ModuleDropConfig = {
  factor: DEFAULT_MODULE_DROP_FACTOR,
  shopCount: DEFAULT_MODULE_DROP_SHOP_COUNT,
  effectWeights: { ...DEFAULT_MODULE_DROP_WEIGHTS },
};

export function cloneModuleDropConfig(cfg: ModuleDropConfig): ModuleDropConfig {
  return {
    factor: cfg.factor,
    shopCount: cfg.shopCount,
    effectWeights: { ...cfg.effectWeights },
  };
}

export function sanitizeModuleDropFactor(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return DEFAULT_MODULE_DROP_FACTOR;
  }
  const clamped = Math.max(
    MIN_MODULE_DROP_FACTOR,
    Math.min(MAX_MODULE_DROP_FACTOR, raw)
  );
  return Math.round(clamped * 10000) / 10000;
}

export function sanitizeModuleDropShopCount(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return DEFAULT_MODULE_DROP_SHOP_COUNT;
  }
  return Math.max(
    MIN_MODULE_DROP_SHOP_COUNT,
    Math.min(MAX_MODULE_DROP_SHOP_COUNT, Math.round(raw))
  );
}

export function sanitizeModuleDropWeights(
  raw: unknown
): Record<ModuleDropEffectKey, number> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_MODULE_DROP_WEIGHTS };
  }
  const src = raw as Record<string, unknown>;
  const out = { ...DEFAULT_MODULE_DROP_WEIGHTS };
  let sum = 0;
  for (const key of MODULE_DROP_EFFECT_KEYS) {
    const val = src[key];
    const clean =
      typeof val === 'number' && Number.isFinite(val)
        ? Math.max(MIN_MODULE_DROP_WEIGHT, Math.min(MAX_MODULE_DROP_WEIGHT, val))
        : DEFAULT_MODULE_DROP_WEIGHTS[key];
    out[key] = clean;
    sum += clean;
  }
  if (sum <= 0) {
    return { ...DEFAULT_MODULE_DROP_WEIGHTS };
  }
  return out;
}

export function sanitizeModuleDropConfig(raw?: unknown): ModuleDropConfig {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return cloneModuleDropConfig(DEFAULT_MODULE_DROP_CONFIG);
  }
  const src = raw as Record<string, unknown>;
  return {
    factor: sanitizeModuleDropFactor(src.factor),
    shopCount: sanitizeModuleDropShopCount(src.shopCount),
    effectWeights: sanitizeModuleDropWeights(src.effectWeights),
  };
}

export function getModuleTemplateEffectKey(
  tpl: Pick<ItemTemplate, 'id' | 'slot'>
): ModuleDropEffectKey | null {
  if (tpl.slot !== 'module') return null;
  const mod = getModuleTemplateById(tpl.id);
  if (!mod || !VALID_MODULE_EFFECT_KEY_SET.has(mod.effectKey)) {
    return null;
  }
  return mod.effectKey as ModuleDropEffectKey;
}

export function pickWeightedModuleEffectKey(
  eligibleEffects: readonly ModuleDropEffectKey[],
  weights: Record<ModuleDropEffectKey, number>,
  rng: () => number
): ModuleDropEffectKey | null {
  if (eligibleEffects.length === 0) return null;
  let total = 0;
  const entries: Array<{ key: ModuleDropEffectKey; weight: number }> = [];
  for (const key of eligibleEffects) {
    const w = Math.max(0, Number.isFinite(weights[key]) ? weights[key] : 0);
    if (w > 0) {
      entries.push({ key, weight: w });
      total += w;
    }
  }
  if (total <= 0 || entries.length === 0) {
    return null;
  }
  let roll = rng() * total;
  for (const entry of entries) {
    roll -= entry.weight;
    if (roll <= 0) return entry.key;
  }
  return entries[entries.length - 1].key;
}

export function pickEligibleModuleTemplate(
  eligibleTemplates: readonly ItemTemplate[],
  weights: Record<ModuleDropEffectKey, number>,
  rng: () => number
): ItemTemplate | null {
  if (eligibleTemplates.length === 0) return null;
  const byEffect = new Map<ModuleDropEffectKey, ItemTemplate[]>();
  for (const tpl of eligibleTemplates) {
    const key = getModuleTemplateEffectKey(tpl);
    if (!key) continue;
    const list = byEffect.get(key);
    if (list) list.push(tpl);
    else byEffect.set(key, [tpl]);
  }
  const eligibleEffects = MODULE_DROP_EFFECT_KEYS.filter((k) => byEffect.has(k));
  const pickedEffect = pickWeightedModuleEffectKey(eligibleEffects, weights, rng);
  if (!pickedEffect) return null;
  const candidates = byEffect.get(pickedEffect);
  if (!candidates || candidates.length === 0) return null;
  return candidates[Math.floor(rng() * candidates.length)] ?? null;
}
