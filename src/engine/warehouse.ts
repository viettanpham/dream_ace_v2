import { BALANCE_CONFIG } from '../data/balance';
import type { ItemInstance, PilotAccount } from '../types/game';
import { getItemEquippedByGear } from './equipment';
import { sanitizeWarehouseCapacity } from './migration';

export interface WarehouseTransferResult {
  moved: number;
  skippedEquipped: number;
  skippedProtected: number;
  skippedFull: number;
  reason?: 'locked';
}

export interface WarehouseTransferEngineResult extends WarehouseTransferResult {
  pilot: PilotAccount;
}

function dedupeOrderedIds(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const id of ids) {
    if (typeof id !== 'string' || id.length === 0 || seen.has(id)) continue;
    seen.add(id);
    ordered.push(id);
  }
  return ordered;
}

function enforceDisjointBoxes(
  inventory: readonly ItemInstance[],
  warehouse: readonly ItemInstance[]
): { inventory: ItemInstance[]; warehouse: ItemInstance[] } {
  const invSeen = new Set<string>();
  const cleanInventory: ItemInstance[] = [];
  for (const item of inventory) {
    if (invSeen.has(item.instanceId)) continue;
    invSeen.add(item.instanceId);
    cleanInventory.push(item);
  }

  const whSeen = new Set<string>();
  const cleanWarehouse: ItemInstance[] = [];
  for (const item of warehouse) {
    if (invSeen.has(item.instanceId) || whSeen.has(item.instanceId)) continue;
    whSeen.add(item.instanceId);
    cleanWarehouse.push(item);
  }

  return { inventory: cleanInventory, warehouse: cleanWarehouse };
}

/**
 * Moves selected items from the shared box (`pilot.inventory`) into `pilot.warehouse`
 * in the caller-supplied `ids` order until `warehouseCapacity` is reached.
 * - Equipped items (on ANY Gear) are never moved (`skippedEquipped`).
 * - Locked or favorited items ARE allowed to move when picked explicitly.
 * - `pilot.consumables` is untouched; credits are never spent.
 */
export function moveToWarehouse(
  pilot: PilotAccount,
  ids: readonly string[],
  warehouseCapacity: number
): WarehouseTransferEngineResult {
  const orderedIds = dedupeOrderedIds(ids);
  const currentInventory = pilot.inventory;
  const currentWarehouse = Array.isArray(pilot.warehouse) ? pilot.warehouse : [];
  const cap = sanitizeWarehouseCapacity(warehouseCapacity);

  const invById = new Map<string, ItemInstance>();
  for (const item of currentInventory) {
    if (!invById.has(item.instanceId)) {
      invById.set(item.instanceId, item);
    }
  }

  const targetIds = new Set(currentWarehouse.map((it) => it.instanceId));
  const nextWarehouse: ItemInstance[] = [...currentWarehouse];
  const movedIds = new Set<string>();

  let moved = 0;
  let skippedEquipped = 0;
  let skippedFull = 0;

  for (const id of orderedIds) {
    const item = invById.get(id);
    if (!item) continue;

    if (getItemEquippedByGear(pilot.gears, item.instanceId) !== null) {
      skippedEquipped++;
      continue;
    }

    if (nextWarehouse.length >= cap) {
      skippedFull++;
      continue;
    }

    movedIds.add(item.instanceId);
    if (!targetIds.has(item.instanceId)) {
      nextWarehouse.push(item);
      targetIds.add(item.instanceId);
    }
    moved++;
  }

  if (moved === 0) {
    const disjoint = enforceDisjointBoxes(currentInventory, currentWarehouse);
    const unchanged =
      disjoint.inventory.length === currentInventory.length &&
      disjoint.warehouse.length === currentWarehouse.length;
    return {
      pilot: unchanged
        ? pilot
        : {
            ...pilot,
            inventory: disjoint.inventory,
            warehouse: disjoint.warehouse,
          },
      moved: 0,
      skippedEquipped,
      skippedProtected: 0,
      skippedFull,
    };
  }

  const remainingInventory = currentInventory.filter(
    (it) => !movedIds.has(it.instanceId)
  );
  const disjoint = enforceDisjointBoxes(remainingInventory, nextWarehouse);

  return {
    pilot: {
      ...pilot,
      inventory: disjoint.inventory,
      warehouse: disjoint.warehouse,
    },
    moved,
    skippedEquipped,
    skippedProtected: 0,
    skippedFull,
  };
}

/**
 * Bulk-moves all unequipped, unprotected (`!locked && !favorited`) items
 * from the shared box (`pilot.inventory`) into `pilot.warehouse` until `warehouseCapacity` is full.
 */
export function moveAllUnusedToWarehouse(
  pilot: PilotAccount,
  warehouseCapacity: number
): WarehouseTransferEngineResult {
  const currentInventory = pilot.inventory;
  const currentWarehouse = Array.isArray(pilot.warehouse) ? pilot.warehouse : [];
  const cap = sanitizeWarehouseCapacity(warehouseCapacity);

  const targetIds = new Set(currentWarehouse.map((it) => it.instanceId));
  const nextWarehouse: ItemInstance[] = [...currentWarehouse];
  const movedIds = new Set<string>();

  let moved = 0;
  let skippedEquipped = 0;
  let skippedProtected = 0;
  let skippedFull = 0;

  for (const item of currentInventory) {
    if (getItemEquippedByGear(pilot.gears, item.instanceId) !== null) {
      skippedEquipped++;
      continue;
    }

    if (item.locked || item.favorited) {
      skippedProtected++;
      continue;
    }

    if (nextWarehouse.length >= cap) {
      skippedFull++;
      continue;
    }

    movedIds.add(item.instanceId);
    if (!targetIds.has(item.instanceId)) {
      nextWarehouse.push(item);
      targetIds.add(item.instanceId);
    }
    moved++;
  }

  if (moved === 0) {
    const disjoint = enforceDisjointBoxes(currentInventory, currentWarehouse);
    const unchanged =
      disjoint.inventory.length === currentInventory.length &&
      disjoint.warehouse.length === currentWarehouse.length;
    return {
      pilot: unchanged
        ? pilot
        : {
            ...pilot,
            inventory: disjoint.inventory,
            warehouse: disjoint.warehouse,
          },
      moved: 0,
      skippedEquipped,
      skippedProtected,
      skippedFull,
    };
  }

  const remainingInventory = currentInventory.filter(
    (it) => !movedIds.has(it.instanceId)
  );
  const disjoint = enforceDisjointBoxes(remainingInventory, nextWarehouse);

  return {
    pilot: {
      ...pilot,
      inventory: disjoint.inventory,
      warehouse: disjoint.warehouse,
    },
    moved,
    skippedEquipped,
    skippedProtected,
    skippedFull,
  };
}

/**
 * Moves selected items from `pilot.warehouse` back into the shared box (`pilot.inventory`)
 * in the caller-supplied `ids` order until `BALANCE_CONFIG.maxInventorySize` is reached.
 * - Box never grows beyond its cap (`BALANCE_CONFIG.maxInventorySize`).
 * - Locked/favorited items move freely when picked by id.
 * - `pilot.consumables` is untouched; credits are never spent.
 */
export function moveToBox(
  pilot: PilotAccount,
  ids: readonly string[],
  boxCapacity: number = BALANCE_CONFIG.maxInventorySize
): WarehouseTransferEngineResult {
  const orderedIds = dedupeOrderedIds(ids);
  const currentInventory = pilot.inventory;
  const currentWarehouse = Array.isArray(pilot.warehouse) ? pilot.warehouse : [];
  const cap =
    typeof boxCapacity === 'number' && Number.isFinite(boxCapacity) && boxCapacity >= 0
      ? Math.floor(boxCapacity)
      : BALANCE_CONFIG.maxInventorySize;

  const whById = new Map<string, ItemInstance>();
  for (const item of currentWarehouse) {
    if (!whById.has(item.instanceId)) {
      whById.set(item.instanceId, item);
    }
  }

  const targetIds = new Set(currentInventory.map((it) => it.instanceId));
  const nextInventory: ItemInstance[] = [...currentInventory];
  const movedIds = new Set<string>();

  let moved = 0;
  let skippedEquipped = 0;
  let skippedFull = 0;

  for (const id of orderedIds) {
    const item = whById.get(id);
    if (!item) continue;

    if (getItemEquippedByGear(pilot.gears, item.instanceId) !== null) {
      skippedEquipped++;
      continue;
    }

    if (nextInventory.length >= cap) {
      skippedFull++;
      continue;
    }

    movedIds.add(item.instanceId);
    if (!targetIds.has(item.instanceId)) {
      nextInventory.push(item);
      targetIds.add(item.instanceId);
    }
    moved++;
  }

  if (moved === 0) {
    const disjoint = enforceDisjointBoxes(currentInventory, currentWarehouse);
    const unchanged =
      disjoint.inventory.length === currentInventory.length &&
      disjoint.warehouse.length === currentWarehouse.length;
    return {
      pilot: unchanged
        ? pilot
        : {
            ...pilot,
            inventory: disjoint.inventory,
            warehouse: disjoint.warehouse,
          },
      moved: 0,
      skippedEquipped,
      skippedProtected: 0,
      skippedFull,
    };
  }

  const remainingWarehouse = currentWarehouse.filter(
    (it) => !movedIds.has(it.instanceId)
  );
  const disjoint = enforceDisjointBoxes(nextInventory, remainingWarehouse);

  return {
    pilot: {
      ...pilot,
      inventory: disjoint.inventory,
      warehouse: disjoint.warehouse,
    },
    moved,
    skippedEquipped,
    skippedProtected: 0,
    skippedFull,
  };
}
