import { BALANCE_CONFIG } from './balance';
import { EQUIPMENT_SLOTS, getItemTemplate, ITEM_TEMPLATES } from './items';
import type {
  EquipmentSlot,
  ItemTemplate,
  MechClassId,
  StarterBoostScope,
  StarterSetConfig,
  StarterSlotConfig,
} from '../types/game';

export const DEFAULT_STARTER_SLOT_CONFIGS: Omit<
  Record<EquipmentSlot, StarterSlotConfig>,
  'radar'
> & { radar?: StarterSlotConfig } = {
  main_weapon: {
    templateId: 'tpl_mw_pulse_cannon',
    level: 1,
    quality: 20,
  },
  sub_weapon: {
    templateId: 'tpl_sw_missile_pod',
    level: 1,
    quality: 20,
  },
  armor: {
    templateId: 'tpl_ar_striker_vanguard',
    level: 1,
    quality: 20,
  },
  engine: {
    templateId: 'tpl_en_striker_ion',
    level: 1,
    quality: 20,
  },
  cpu: {
    templateId: 'tpl_cpu_tactical',
    level: 1,
    quality: 20,
  },
  accessory: {
    templateId: 'tpl_ac_capacitor',
    level: 1,
    quality: 20,
  },
};

export const DEFAULT_STARTER_SET_CONFIG: StarterSetConfig = {
  enabled: true,
  slots: DEFAULT_STARTER_SLOT_CONFIGS,
  rookieBoostPct: 0,
  boostScope: 'new_gears_only',
};

export function cloneStarterSetConfig(
  cfg: StarterSetConfig = DEFAULT_STARTER_SET_CONFIG
): StarterSetConfig {
  const slots: Record<string, StarterSlotConfig> = {};
  for (const slot of EQUIPMENT_SLOTS) {
    const src = cfg.slots?.[slot] ?? DEFAULT_STARTER_SLOT_CONFIGS[slot];
    if (src) {
      slots[slot] = { ...src };
    }
  }
  return {
    enabled: Boolean(cfg.enabled),
    slots: slots as StarterSetConfig['slots'],
    rookieBoostPct: cfg.rookieBoostPct ?? 0,
    boostScope:
      cfg.boostScope === 'fill_empty_slots'
        ? 'fill_empty_slots'
        : 'new_gears_only',
  };
}

function findFallbackTemplateForSlot(slot: EquipmentSlot): ItemTemplate {
  return (
    ITEM_TEMPLATES.find((t) => t.slot === slot && t.tier === 1) ??
    ITEM_TEMPLATES.find((t) => t.slot === slot) ??
    ITEM_TEMPLATES[0]
  );
}

/**
 * Resolves a class-compatible template for a target Gear.
 * If the configured template is class-locked to another Gear class (e.g. Armor/Engine),
 * picks the closest matching tier template compatible with `classId`.
 */
export function resolveStarterTemplateForGear(
  slot: EquipmentSlot,
  configuredTemplateId: string,
  classId: MechClassId
): ItemTemplate {
  const configured = getItemTemplate(configuredTemplateId);
  if (
    configured &&
    configured.slot === slot &&
    (configured.classRestriction === null ||
      configured.classRestriction === classId)
  ) {
    return configured;
  }

  const desiredTier = configured?.tier ?? 1;
  const compatible = ITEM_TEMPLATES.filter(
    (t) =>
      t.slot === slot &&
      (t.classRestriction === null || t.classRestriction === classId)
  );
  if (compatible.length > 0) {
    const exactTier = compatible.find((t) => t.tier === desiredTier);
    if (exactTier) return exactTier;
    return [...compatible].sort((a, b) => a.tier - b.tier)[0];
  }

  return findFallbackTemplateForSlot(slot);
}

export function sanitizeStarterSetConfig(raw: unknown): StarterSetConfig {
  const def = cloneStarterSetConfig(DEFAULT_STARTER_SET_CONFIG);
  if (!raw || typeof raw !== 'object') return def;

  const obj = raw as Record<string, unknown>;
  const rawSlots =
    obj.slots && typeof obj.slots === 'object'
      ? (obj.slots as Record<string, unknown>)
      : {};

  const slots: Record<string, StarterSlotConfig> = {};
  for (const slot of EQUIPMENT_SLOTS) {
    const defSlot = DEFAULT_STARTER_SLOT_CONFIGS[slot];
    const entry = rawSlots[slot];
    if (entry && typeof entry === 'object') {
      const s = entry as Record<string, unknown>;
      const fallbackTemplateId =
        defSlot?.templateId ?? findFallbackTemplateForSlot(slot).id;
      const rawTplId =
        typeof s.templateId === 'string' ? s.templateId : fallbackTemplateId;
      const tpl = getItemTemplate(rawTplId);
      const validTplId =
        tpl && tpl.slot === slot ? tpl.id : fallbackTemplateId;
      const level = Math.max(
        1,
        Math.min(
          BALANCE_CONFIG.maxLevel,
          Math.floor(Number(s.level) || defSlot?.level || 1)
        )
      );
      const quality = Math.max(
        1,
        Math.min(100, Math.round(Number(s.quality) || defSlot?.quality || 20))
      );
      slots[slot] = {
        templateId: validTplId,
        level,
        quality,
      };
    } else if (defSlot) {
      slots[slot] = { ...defSlot };
    }
  }

  const rawBoost = Number(obj.rookieBoostPct);
  const rookieBoostPct =
    Number.isFinite(rawBoost) && rawBoost >= 0
      ? Math.min(300, Math.round(rawBoost))
      : 0;

  const boostScope: StarterBoostScope =
    obj.boostScope === 'fill_empty_slots'
      ? 'fill_empty_slots'
      : 'new_gears_only';

  return {
    enabled: typeof obj.enabled === 'boolean' ? obj.enabled : def.enabled,
    slots: slots as StarterSetConfig['slots'],
    rookieBoostPct,
    boostScope,
  };
}
