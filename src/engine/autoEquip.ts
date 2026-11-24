import { DEFAULT_AUTO_EQUIP_CONFIG } from '../data/autoEquipConfig';
import { EMPTY_STAT_BLOCK, MECH_CLASS_LIST, STAT_KEYS } from '../data/classes';
import { EMPTY_EQUIPPED_SLOT_IDS, EQUIPMENT_SLOTS } from '../data/items';
import type {
  AutoEquipConfig,
  AutoEquipGearPlan,
  AutoEquipPlan,
  AutoEquipSlotPlan,
  AutoEquipTraitDeltas,
  AutoEquipUndoSnapshot,
  EquipmentSlot,
  EquippedSlotIds,
  GearUnit,
  ItemInstance,
  MechClassId,
  PilotAccount,
  StatBlock,
} from '../types/game';
import { getEffectiveItemStats, getItemEquippedByGear } from './equipment';
import { isItemUsableByGear } from './inventory';

/**
 * Computes a deterministic class-weighted utility score for an ItemInstance.
 * Incorporates effective (enchant-scaled) stats, special traits (crit, pierce, splash,
 * SP regen, evasion mod, longRange), item tier, and roll quality.
 */
export function scoreItemForClass(
  item: ItemInstance,
  classId: MechClassId,
  config: AutoEquipConfig = DEFAULT_AUTO_EQUIP_CONFIG
): number {
  const weights = config.classWeights[classId];
  const stats = getEffectiveItemStats(item);

  let raw = 0;
  for (const key of STAT_KEYS) {
    raw += (stats[key] ?? 0) * weights[key];
  }

  const tr = item.specialTraits;
  if (tr) {
    raw += (tr.critBonusPct ?? 0) * weights.critBonusPct;
    raw += (tr.armorPiercePct ?? 0) * weights.armorPiercePct;
    raw += (tr.splashPct ?? 0) * weights.splashPct;
    raw += (tr.spRegenPerTurn ?? 0) * weights.spRegenPerTurn;
    raw += (tr.evasionMod ?? 0) * weights.evasionMod;
    raw += (tr.accuracyPct ?? 0) * weights.accuracyPct;
    if (tr.longRange) {
      raw += weights.longRangeBonus;
    }
    if (tr.detectStealth) {
      raw += weights.detectStealthBonus;
    }
  }

  raw += item.tier * weights.tierBonus + item.rollQuality * weights.qualityWeight;

  return Math.max(0.1, Math.round(raw * 10) / 10);
}

function computeSlotStatDeltas(
  currentItem: ItemInstance | null,
  nextItem: ItemInstance | null
): StatBlock {
  const curStats = currentItem
    ? getEffectiveItemStats(currentItem)
    : EMPTY_STAT_BLOCK;
  const nextStats = nextItem
    ? getEffectiveItemStats(nextItem)
    : EMPTY_STAT_BLOCK;
  const deltas: StatBlock = { ...EMPTY_STAT_BLOCK };
  for (const key of STAT_KEYS) {
    deltas[key] = (nextStats[key] ?? 0) - (curStats[key] ?? 0);
  }
  return deltas;
}

function computeSlotTraitDeltas(
  currentItem: ItemInstance | null,
  nextItem: ItemInstance | null
): AutoEquipTraitDeltas {
  const ct = currentItem?.specialTraits;
  const nt = nextItem?.specialTraits;
  const curRange = ct?.longRange ? 1 : 0;
  const nextRange = nt?.longRange ? 1 : 0;
  const curDetect = ct?.detectStealth ? 1 : 0;
  const nextDetect = nt?.detectStealth ? 1 : 0;
  return {
    critBonusPct: (nt?.critBonusPct ?? 0) - (ct?.critBonusPct ?? 0),
    armorPiercePct: (nt?.armorPiercePct ?? 0) - (ct?.armorPiercePct ?? 0),
    splashPct: (nt?.splashPct ?? 0) - (ct?.splashPct ?? 0),
    spRegenPerTurn: (nt?.spRegenPerTurn ?? 0) - (ct?.spRegenPerTurn ?? 0),
    evasionMod: (nt?.evasionMod ?? 0) - (ct?.evasionMod ?? 0),
    accuracyPct: (nt?.accuracyPct ?? 0) - (ct?.accuracyPct ?? 0),
    longRangeDelta: (nextRange - curRange) as -1 | 0 | 1,
    detectStealthDelta: (nextDetect - curDetect) as -1 | 0 | 1,
  };
}

function compareCandidates(
  a: { item: ItemInstance; score: number },
  b: { item: ItemInstance; score: number }
): number {
  if (b.score !== a.score) return b.score - a.score;
  if (b.item.tier !== a.item.tier) return b.item.tier - a.item.tier;
  if (b.item.rollQuality !== a.item.rollQuality) {
    return b.item.rollQuality - a.item.rollQuality;
  }
  if (b.item.enchantLevel !== a.item.enchantLevel) {
    return b.item.enchantLevel - a.item.enchantLevel;
  }
  return a.item.instanceId.localeCompare(b.item.instanceId);
}

export interface BuildAutoEquipPlanOptions {
  mode: 'single' | 'all';
  targetGearId?: MechClassId;
  gearOrder?: MechClassId[];
  config?: AutoEquipConfig;
}

/**
 * Pure planner that computes an Auto-Equip preview plan for either a single Gear
 * or every owned Gear in sequence (without mutating `pilot`).
 */
export function buildAutoEquipPlan(
  pilot: PilotAccount,
  options: BuildAutoEquipPlanOptions
): AutoEquipPlan {
  const mode = options.mode;
  const targetGearId = options.targetGearId ?? pilot.activeGearId;
  const config = options.config ?? DEFAULT_AUTO_EQUIP_CONFIG;
  const margin = Math.max(0, config.replaceMarginPct);

  const itemById = new Map<string, ItemInstance>(
    pilot.inventory.map((it) => [it.instanceId, it])
  );

  // Map every currently equipped instanceId to its current Gear owner
  const originalOwnerById = new Map<string, MechClassId>();
  for (const cls of MECH_CLASS_LIST) {
    const g = pilot.gears[cls.id];
    if (!g) continue;
    for (const slot of EQUIPMENT_SLOTS) {
      const eqId = g.equipped[slot];
      if (eqId) {
        originalOwnerById.set(eqId, cls.id);
      }
    }
  }

  let orderedGearIds: MechClassId[] = [];
  if (mode === 'single') {
    if (pilot.gears[targetGearId]?.owned) {
      orderedGearIds = [targetGearId];
    }
  } else {
    const defaultOrder: MechClassId[] = [
      targetGearId,
      ...MECH_CLASS_LIST.map((c) => c.id).filter((id) => id !== targetGearId),
    ];
    const requestedOrder = options.gearOrder
      ? [
          ...options.gearOrder,
          ...defaultOrder.filter((id) => !options.gearOrder!.includes(id)),
        ]
      : defaultOrder;
    const seen = new Set<MechClassId>();
    for (const id of requestedOrder) {
      if (seen.has(id)) continue;
      if (pilot.gears[id]?.owned) {
        seen.add(id);
        orderedGearIds.push(id);
      }
    }
  }

  const participatingSet = new Set<MechClassId>(orderedGearIds);
  const assignedItemIds = new Set<string>();
  const gearPlans: AutoEquipGearPlan[] = [];
  let totalChangedSlots = 0;

  for (const gearId of orderedGearIds) {
    const gear = pilot.gears[gearId];
    if (!gear || !gear.owned) continue;

    const slotPlans: AutoEquipSlotPlan[] = [];
    let changedCount = 0;
    let totalCurrentScore = 0;
    let totalNextScore = 0;
    const totalStatDeltas: StatBlock = { ...EMPTY_STAT_BLOCK };

    for (const slot of EQUIPMENT_SLOTS) {
      const currentId = gear.equipped[slot];
      const currentItem = currentId ? itemById.get(currentId) ?? null : null;
      const currentScore = currentItem
        ? scoreItemForClass(currentItem, gear.classId, config)
        : 0;

      const currentStillAvailable =
        currentItem !== null &&
        !assignedItemIds.has(currentItem.instanceId) &&
        isItemUsableByGear(currentItem, gear);

      // Gather eligible candidates in this slot
      const candidates: Array<{ item: ItemInstance; score: number }> = [];
      for (const item of pilot.inventory) {
        if (item.slot !== slot) continue;
        if (!isItemUsableByGear(item, gear)) continue;
        if (assignedItemIds.has(item.instanceId)) continue;

        const origOwner = originalOwnerById.get(item.instanceId);
        if (mode === 'single') {
          // Single-Gear mode NEVER touches items equipped on another Gear
          if (origOwner !== undefined && origOwner !== gear.classId) {
            continue;
          }
        } else {
          // All-Gears mode can reassign among participating owned Gears, never unowned Gears
          if (origOwner !== undefined && !participatingSet.has(origOwner)) {
            continue;
          }
        }

        if (currentStillAvailable && item.instanceId === currentItem!.instanceId) {
          continue;
        }

        candidates.push({
          item,
          score: scoreItemForClass(item, gear.classId, config),
        });
      }

      candidates.sort(compareCandidates);
      const bestCandidate = candidates[0] ?? null;

      let chosenItem: ItemInstance | null = null;
      if (currentStillAvailable && currentItem) {
        const threshold = currentScore * (1 + margin) - 1e-6;
        if (
          bestCandidate &&
          bestCandidate.score > currentScore &&
          bestCandidate.score >= threshold
        ) {
          chosenItem = bestCandidate.item;
        } else {
          chosenItem = currentItem;
        }
      } else {
        // Either slot was empty or its original item was reassigned to an earlier Gear in 'all' mode
        chosenItem = bestCandidate ? bestCandidate.item : null;
      }

      if (chosenItem) {
        assignedItemIds.add(chosenItem.instanceId);
      }

      const nextScore = chosenItem
        ? scoreItemForClass(chosenItem, gear.classId, config)
        : 0;
      const scoreDelta = Math.round((nextScore - currentScore) * 10) / 10;
      const changed =
        (currentItem?.instanceId ?? null) !== (chosenItem?.instanceId ?? null);

      const statDeltas = computeSlotStatDeltas(currentItem, chosenItem);
      const traitDeltas = computeSlotTraitDeltas(currentItem, chosenItem);

      const chosenOrigOwner = chosenItem
        ? originalOwnerById.get(chosenItem.instanceId) ?? null
        : null;
      const reassignedFromGear =
        mode === 'all' &&
        changed &&
        chosenOrigOwner !== null &&
        chosenOrigOwner !== gear.classId
          ? chosenOrigOwner
          : null;

      if (changed) {
        changedCount += 1;
        totalChangedSlots += 1;
      }
      totalCurrentScore =
        Math.round((totalCurrentScore + currentScore) * 10) / 10;
      totalNextScore = Math.round((totalNextScore + nextScore) * 10) / 10;
      for (const k of STAT_KEYS) {
        totalStatDeltas[k] += statDeltas[k];
      }

      slotPlans.push({
        slot,
        currentItem,
        nextItem: chosenItem,
        currentScore,
        nextScore,
        scoreDelta,
        changed,
        statDeltas,
        traitDeltas,
        reassignedFromGear,
      });
    }

    gearPlans.push({
      gearId: gear.classId,
      slots: slotPlans,
      changedCount,
      totalCurrentScore,
      totalNextScore,
      totalStatDeltas,
    });
  }

  return {
    mode,
    targetGearId,
    gearPlans,
    totalChangedSlots,
  };
}

/**
 * Purely applies an AutoEquipPlan to a PilotAccount and returns an Undo snapshot
 * capturing the previous equipment state of every affected Gear.
 */
export function applyAutoEquipPlan(
  pilot: PilotAccount,
  plan: AutoEquipPlan
): { pilot: PilotAccount; undoSnapshot: AutoEquipUndoSnapshot } {
  const previousEquippedByGear: Partial<Record<MechClassId, EquippedSlotIds>> =
    {};
  const nextGears: Record<MechClassId, GearUnit> = { ...pilot.gears };
  const newlyAssignedIds = new Set<string>();

  for (const gp of plan.gearPlans) {
    const existingGear = nextGears[gp.gearId];
    if (!existingGear || !existingGear.owned) continue;

    previousEquippedByGear[gp.gearId] = {
      ...EMPTY_EQUIPPED_SLOT_IDS,
      ...existingGear.equipped,
    };

    const nextEquipped: EquippedSlotIds = {
      ...EMPTY_EQUIPPED_SLOT_IDS,
      ...existingGear.equipped,
    };
    for (const sp of gp.slots) {
      const nextId = sp.nextItem?.instanceId ?? null;
      nextEquipped[sp.slot] = nextId;
      if (nextId) newlyAssignedIds.add(nextId);
    }

    nextGears[gp.gearId] = {
      ...existingGear,
      equipped: nextEquipped,
    };
  }

  // Defensive uniqueness check: ensure no assigned instance remains on a non-plan Gear
  const plannedGearIds = new Set(plan.gearPlans.map((g) => g.gearId));
  for (const cls of MECH_CLASS_LIST) {
    if (plannedGearIds.has(cls.id)) continue;
    const other = nextGears[cls.id];
    if (!other) continue;
    let dirty = false;
    const cleanedEquipped = { ...other.equipped };
    for (const slot of EQUIPMENT_SLOTS) {
      const eqId = cleanedEquipped[slot];
      if (eqId && newlyAssignedIds.has(eqId)) {
        cleanedEquipped[slot] = null;
        dirty = true;
      }
    }
    if (dirty) {
      nextGears[cls.id] = { ...other, equipped: cleanedEquipped };
    }
  }

  return {
    pilot: {
      ...pilot,
      gears: nextGears,
    },
    undoSnapshot: {
      mode: plan.mode,
      targetGearId: plan.targetGearId,
      previousEquippedByGear,
      changedSlotsCount: plan.totalChangedSlots,
      appliedAt: Date.now(),
    },
  };
}

/**
 * Purely restores previous equipment from an AutoEquipUndoSnapshot.
 */
export function undoAutoEquipSnapshot(
  pilot: PilotAccount,
  snapshot: AutoEquipUndoSnapshot
): PilotAccount {
  const validIds = new Set(pilot.inventory.map((it) => it.instanceId));
  const nextGears: Record<MechClassId, GearUnit> = { ...pilot.gears };
  const restoredIds = new Set<string>();
  const restoredGearIds = new Set<MechClassId>();

  for (const cls of MECH_CLASS_LIST) {
    const prevSlots = snapshot.previousEquippedByGear[cls.id];
    if (!prevSlots) continue;
    const existingGear = nextGears[cls.id];
    if (!existingGear) continue;

    restoredGearIds.add(cls.id);
    const cleanedSlots: EquippedSlotIds = { ...EMPTY_EQUIPPED_SLOT_IDS };
    for (const slot of EQUIPMENT_SLOTS) {
      const id = prevSlots[slot];
      if (id && validIds.has(id) && !restoredIds.has(id)) {
        cleanedSlots[slot] = id;
        restoredIds.add(id);
      } else {
        cleanedSlots[slot] = null;
      }
    }

    nextGears[cls.id] = {
      ...existingGear,
      equipped: cleanedSlots,
    };
  }

  // Ensure any restored item isn't left duplicated on another Gear
  for (const cls of MECH_CLASS_LIST) {
    if (restoredGearIds.has(cls.id)) continue;
    const other = nextGears[cls.id];
    if (!other) continue;
    let dirty = false;
    const cleaned = { ...other.equipped };
    for (const slot of EQUIPMENT_SLOTS) {
      const id = cleaned[slot];
      if (id && restoredIds.has(id)) {
        cleaned[slot] = null;
        dirty = true;
      }
    }
    if (dirty) {
      nextGears[cls.id] = { ...other, equipped: cleaned };
    }
  }

  // Reconcile if any inventory check left unequipped items
  void getItemEquippedByGear;

  return {
    ...pilot,
    gears: nextGears,
  };
}

export function getAutoEquipSlotOrder(): EquipmentSlot[] {
  return [...EQUIPMENT_SLOTS];
}
