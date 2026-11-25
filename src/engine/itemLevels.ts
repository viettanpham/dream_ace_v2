import rawItemLevels from '../data/itemLevels.json';
import type {
  EquipmentSlot,
  ItemKindLevelRule,
  ItemLevelKind,
  ItemLevelsConfig,
  ItemTemplate,
  PaperDollSlot,
  SectorDifficulty,
} from '../types/game';

const FALLBACK_ITEM_LEVELS_CONFIG: ItemLevelsConfig = {
  kinds: {
    equipment: { init: 1, step: 5, enabled: false },
    radar: { init: 5, step: 10, enabled: true },
    module: { init: 10, step: 10, enabled: true },
  },
  shopAboveLevel: 20,
  shopTierAhead: 1,
  dropWindow: 5,
  dropDifficultyBonus: {
    Standard: 0,
    Hard: 3,
    Elite: 5,
  },
};

function clampInt(
  value: unknown,
  min: number,
  max: number,
  fallback: number
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function sanitizeKindRule(
  raw: unknown,
  fallback: ItemKindLevelRule
): ItemKindLevelRule {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...fallback };
  }
  const src = raw as Record<string, unknown>;
  return {
    init: clampInt(src.init, 1, 100, fallback.init),
    step: clampInt(src.step, 1, 50, fallback.step),
    enabled:
      typeof src.enabled === 'boolean' ? src.enabled : fallback.enabled,
  };
}

export function cloneItemLevelsConfig(cfg: ItemLevelsConfig): ItemLevelsConfig {
  return {
    kinds: {
      equipment: { ...cfg.kinds.equipment },
      radar: { ...cfg.kinds.radar },
      module: { ...cfg.kinds.module },
    },
    shopAboveLevel: cfg.shopAboveLevel,
    shopTierAhead: cfg.shopTierAhead,
    dropWindow: cfg.dropWindow,
    dropDifficultyBonus: { ...cfg.dropDifficultyBonus },
  };
}

export function sanitizeItemLevelsConfig(
  raw?: Partial<ItemLevelsConfig> | Record<string, unknown> | null,
  base: ItemLevelsConfig = FALLBACK_ITEM_LEVELS_CONFIG
): ItemLevelsConfig {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return cloneItemLevelsConfig(base);
  }
  const src = raw as Record<string, unknown>;
  const rawKinds =
    src.kinds && typeof src.kinds === 'object' && !Array.isArray(src.kinds)
      ? (src.kinds as Record<string, unknown>)
      : {};
  const rawBonus =
    src.dropDifficultyBonus &&
    typeof src.dropDifficultyBonus === 'object' &&
    !Array.isArray(src.dropDifficultyBonus)
      ? (src.dropDifficultyBonus as Record<string, unknown>)
      : {};

  return {
    kinds: {
      equipment: sanitizeKindRule(rawKinds.equipment, base.kinds.equipment),
      radar: sanitizeKindRule(rawKinds.radar, base.kinds.radar),
      module: sanitizeKindRule(rawKinds.module, base.kinds.module),
    },
    shopAboveLevel: clampInt(src.shopAboveLevel, 0, 100, base.shopAboveLevel),
    shopTierAhead: clampInt(src.shopTierAhead, 0, 3, base.shopTierAhead),
    dropWindow: clampInt(src.dropWindow, 0, 100, base.dropWindow),
    dropDifficultyBonus: {
      Standard: clampInt(
        rawBonus.Standard,
        0,
        100,
        base.dropDifficultyBonus.Standard
      ),
      Hard: clampInt(rawBonus.Hard, 0, 100, base.dropDifficultyBonus.Hard),
      Elite: clampInt(rawBonus.Elite, 0, 100, base.dropDifficultyBonus.Elite),
    },
  };
}

export const DEFAULT_ITEM_LEVELS_CONFIG: ItemLevelsConfig =
  sanitizeItemLevelsConfig(rawItemLevels as Record<string, unknown>);

export function getItemLevelKind(slot: EquipmentSlot): ItemLevelKind {
  if (slot === 'radar') return 'radar';
  if (slot === 'module') return 'module';
  return 'equipment';
}

export function getTierRequiredLevel(
  kind: ItemLevelKind,
  tier: number,
  cfg: ItemLevelsConfig = DEFAULT_ITEM_LEVELS_CONFIG
): number {
  const rule = cfg.kinds[kind] ?? DEFAULT_ITEM_LEVELS_CONFIG.kinds[kind];
  const safeTier = Number.isFinite(tier) ? Math.max(1, Math.floor(tier)) : 1;
  return rule.init + rule.step * (safeTier - 1);
}

export function getEffectiveTemplateRequiredLevel(
  template: Pick<ItemTemplate, 'slot' | 'tier' | 'requiredLevel'>,
  cfg: ItemLevelsConfig = DEFAULT_ITEM_LEVELS_CONFIG
): number {
  const kind = getItemLevelKind(template.slot);
  if (cfg.kinds[kind].enabled) {
    return getTierRequiredLevel(kind, template.tier, cfg);
  }
  return template.requiredLevel;
}

export function getShopEligibleTemplatesForSlot(
  templates: readonly ItemTemplate[],
  slot: PaperDollSlot,
  referenceLevel: number,
  cfg: ItemLevelsConfig = DEFAULT_ITEM_LEVELS_CONFIG
): ItemTemplate[] {
  const kind = getItemLevelKind(slot);
  const safeRef = Math.max(
    1,
    Math.floor(Number.isFinite(referenceLevel) ? referenceLevel : 1)
  );
  const tierAhead = clampInt(cfg.shopTierAhead, 0, 3, 1);

  let highestUnlockedTier = 0;
  for (const tpl of templates) {
    if (getItemLevelKind(tpl.slot) !== kind) continue;
    const req = getEffectiveTemplateRequiredLevel(tpl, cfg);
    if (req <= safeRef && tpl.tier > highestUnlockedTier) {
      highestUnlockedTier = tpl.tier;
    }
  }

  const tierCap = highestUnlockedTier + tierAhead;
  const levelCap = safeRef + Math.max(0, cfg.shopAboveLevel);

  return templates.filter(
    (tpl) =>
      tpl.slot === slot &&
      tpl.tier <= tierCap &&
      getEffectiveTemplateRequiredLevel(tpl, cfg) <= levelCap
  );
}

export interface DropSlotPool {
  slot: PaperDollSlot;
  templates: ItemTemplate[];
}

export function getDropSlotPools(
  templates: readonly ItemTemplate[],
  slots: readonly PaperDollSlot[],
  gearLevel: number,
  difficulty: SectorDifficulty,
  cfg: ItemLevelsConfig = DEFAULT_ITEM_LEVELS_CONFIG
): DropSlotPool[] {
  const safeGearLevel = Math.max(
    1,
    Math.floor(Number.isFinite(gearLevel) ? gearLevel : 1)
  );
  const bonus = cfg.dropDifficultyBonus[difficulty] ?? 0;
  const window = Math.max(0, cfg.dropWindow);
  const upperBound = safeGearLevel + window + bonus;
  const lowerBound = safeGearLevel - window;

  const pools: DropSlotPool[] = [];
  for (const slot of slots) {
    const underUpper = templates.filter(
      (tpl) =>
        tpl.slot === slot &&
        getEffectiveTemplateRequiredLevel(tpl, cfg) <= upperBound
    );
    if (underUpper.length === 0) continue;

    const inBand = underUpper.filter(
      (tpl) => getEffectiveTemplateRequiredLevel(tpl, cfg) >= lowerBound
    );
    if (inBand.length > 0) {
      pools.push({ slot, templates: inBand });
      continue;
    }

    let maxReqUnderUpper = 0;
    for (const tpl of underUpper) {
      const req = getEffectiveTemplateRequiredLevel(tpl, cfg);
      if (req > maxReqUnderUpper) maxReqUnderUpper = req;
    }
    const highestUnderUpper = underUpper.filter(
      (tpl) => getEffectiveTemplateRequiredLevel(tpl, cfg) === maxReqUnderUpper
    );
    pools.push({ slot, templates: highestUnderUpper });
  }

  return pools;
}
