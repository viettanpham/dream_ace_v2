import { MECH_CLASS_LIST } from '../data/classes';
import { getModuleTemplateById } from '../data/modules';
import type {
  AdminConfig,
  ExtenderEquipFailureReason,
  GearUnit,
  ItemInstance,
  MechClassId,
  ModuleTemplate,
  PilotAccount,
} from '../types/game';

export const DEFAULT_EXTENDER_SLOT_COUNT = 5;
export const DEFAULT_EXTENDER_LEVELS_PER_SOCKET = 10;
export const MIN_EXTENDER_LEVELS_PER_SOCKET = 1;
export const MAX_EXTENDER_LEVELS_PER_SOCKET = 50;
export const DEFAULT_MAX_SKILL_MODULES_PER_GEAR = 1;

export interface CanEquipModuleResult {
  ok: boolean;
  reason: ExtenderEquipFailureReason | null;
  reasonKey: `extender.reason.${ExtenderEquipFailureReason}` | null;
  conflictSocket?: number;
  reasonParams?: { socket: number };
}

export interface SetModuleResult {
  ok: boolean;
  pilot: PilotAccount;
  reason: ExtenderEquipFailureReason | null;
  reasonKey: `extender.reason.${ExtenderEquipFailureReason}` | null;
  conflictSocket?: number;
  reasonParams?: { socket: number };
}

export interface GearModuleSkillGrant {
  skillId: string;
  tier: 1 | 2 | 3 | 4;
}

export function sanitizeExtenderLevelsPerSocket(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return DEFAULT_EXTENDER_LEVELS_PER_SOCKET;
  }
  return Math.max(
    MIN_EXTENDER_LEVELS_PER_SOCKET,
    Math.min(MAX_EXTENDER_LEVELS_PER_SOCKET, Math.round(raw))
  );
}

export function sanitizeMaxSkillModulesPerGear(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return DEFAULT_MAX_SKILL_MODULES_PER_GEAR;
  }
  return Math.max(0, Math.min(2, Math.round(raw)));
}

export function sanitizeGearExtenders(
  rawExtenders: unknown,
  validIds?: ReadonlySet<string>
): (string | null)[] {
  const result: (string | null)[] = Array(DEFAULT_EXTENDER_SLOT_COUNT).fill(
    null
  );
  if (!Array.isArray(rawExtenders)) return result;
  const limit = Math.min(DEFAULT_EXTENDER_SLOT_COUNT, rawExtenders.length);
  for (let i = 0; i < limit; i++) {
    const val = rawExtenders[i];
    if (typeof val === 'string') {
      const id = val.trim();
      if (id && (!validIds || validIds.has(id))) {
        result[i] = id;
      }
    }
  }
  return result;
}

export function findModuleInstanceInPilot(
  pilot: Pick<PilotAccount, 'inventory' | 'warehouse'>,
  instanceId: string
): ItemInstance | undefined {
  const invMatch = pilot.inventory.find((it) => it.instanceId === instanceId);
  if (invMatch) return invMatch;
  if (Array.isArray(pilot.warehouse)) {
    return pilot.warehouse.find((it) => it.instanceId === instanceId);
  }
  return undefined;
}

export function getModuleSocketOwner(
  gears: Record<MechClassId, GearUnit>,
  instanceId: string,
  excludeSlot?: { gearId: MechClassId; socketIndex: number }
): { gearId: MechClassId; socketIndex: number } | null {
  for (const cls of MECH_CLASS_LIST) {
    const gear = gears[cls.id];
    if (!gear?.extenders) continue;
    const limit = Math.min(DEFAULT_EXTENDER_SLOT_COUNT, gear.extenders.length);
    for (let i = 0; i < limit; i++) {
      if (
        excludeSlot &&
        excludeSlot.gearId === cls.id &&
        excludeSlot.socketIndex === i
      ) {
        continue;
      }
      if (gear.extenders[i] === instanceId) {
        return { gearId: cls.id, socketIndex: i };
      }
    }
  }
  return null;
}

/**
 * Enforces valid module instances (`slot === 'module'`), single-owner instance uniqueness
 * across all gears, and per-gear same-effect uniqueness in MECH_CLASS_LIST order.
 * Locked sockets keep their valid instance ids (giving 0 stats/traits until unlocked).
 */
export function sanitizeGearExtendersAcrossPilot(
  gears: Record<MechClassId, GearUnit>,
  inventory: readonly ItemInstance[],
  warehouse: readonly ItemInstance[] = []
): Record<MechClassId, GearUnit> {
  const moduleById = new Map<
    string,
    { item: ItemInstance; tpl: ModuleTemplate }
  >();
  for (const it of [...inventory, ...warehouse]) {
    if (!it || it.slot !== 'module') continue;
    const tpl = getModuleTemplateById(it.templateId);
    if (!tpl) continue;
    if (!moduleById.has(it.instanceId)) {
      moduleById.set(it.instanceId, { item: it, tpl });
    }
  }

  const claimedInstanceIds = new Set<string>();
  const nextGears: Record<MechClassId, GearUnit> = { ...gears };

  for (const cls of MECH_CLASS_LIST) {
    const gear = nextGears[cls.id];
    if (!gear) continue;

    const clean = sanitizeGearExtenders(gear.extenders);
    const seenEffectOnGear = new Set<string>();
    const seenSkillOnGear = new Set<string>();

    for (let i = 0; i < clean.length; i++) {
      const id = clean[i];
      if (!id) continue;
      const entry = moduleById.get(id);
      if (!entry) {
        clean[i] = null;
        continue;
      }
      if (claimedInstanceIds.has(id)) {
        clean[i] = null;
        continue;
      }
      const effKey = `${entry.tpl.family}:${entry.tpl.effectKey}`;
      if (
        seenEffectOnGear.has(effKey) ||
        (entry.tpl.skillId && seenSkillOnGear.has(entry.tpl.skillId))
      ) {
        clean[i] = null;
        continue;
      }
      claimedInstanceIds.add(id);
      seenEffectOnGear.add(effKey);
      if (entry.tpl.skillId) {
        seenSkillOnGear.add(entry.tpl.skillId);
      }
    }

    nextGears[cls.id] = {
      ...gear,
      extenders: clean,
    };
  }

  return nextGears;
}

/**
 * Counts how many extender sockets are unlocked for `gear` given `admin.extenderLevelsPerSocket`.
 */
export function getUnlockedExtenderCount(
  gear: Pick<GearUnit, 'level'>,
  admin?: Pick<AdminConfig, 'extenderLevelsPerSocket'> | null
): number {
  const levelsPerSocket = sanitizeExtenderLevelsPerSocket(
    admin?.extenderLevelsPerSocket
  );
  const level = Math.max(0, Math.floor(gear.level || 0));
  return Math.min(
    DEFAULT_EXTENDER_SLOT_COUNT,
    Math.floor(level / levelsPerSocket)
  );
}

function failEquip(
  reason: ExtenderEquipFailureReason,
  conflictSocket?: number
): CanEquipModuleResult {
  return {
    ok: false,
    reason,
    reasonKey: `extender.reason.${reason}`,
    ...(conflictSocket !== undefined
      ? { conflictSocket, reasonParams: { socket: conflictSocket } }
      : {}),
  };
}

export function canEquipModule(
  pilot: Pick<PilotAccount, 'gears' | 'inventory' | 'warehouse'>,
  gearId: MechClassId,
  socketIndex: number,
  instanceId: string,
  admin?: Pick<
    AdminConfig,
    'extenderLevelsPerSocket' | 'maxSkillModulesPerGear'
  > | null
): CanEquipModuleResult {
  if (
    !Number.isInteger(socketIndex) ||
    socketIndex < 0 ||
    socketIndex >= DEFAULT_EXTENDER_SLOT_COUNT
  ) {
    return failEquip('socket_locked');
  }

  const gear = pilot.gears[gearId];
  if (!gear) {
    return failEquip('socket_locked');
  }

  const unlockedCount = getUnlockedExtenderCount(gear, admin);
  if (socketIndex >= unlockedCount) {
    return failEquip('socket_locked');
  }

  const inst = findModuleInstanceInPilot(pilot, instanceId);
  if (!inst || inst.slot !== 'module') {
    return failEquip('not_module');
  }

  const tpl = getModuleTemplateById(inst.templateId);
  if (!tpl) {
    return failEquip('not_module');
  }

  const owner = getModuleSocketOwner(pilot.gears, inst.instanceId, {
    gearId,
    socketIndex,
  });
  if (owner) {
    return failEquip('in_other_gear');
  }

  if (gear.level < tpl.requiredLevel) {
    return failEquip('level_too_low');
  }

  const extenders = gear.extenders ?? [];
  let skillCountExcludingTarget = 0;
  const limit = Math.min(DEFAULT_EXTENDER_SLOT_COUNT, extenders.length);
  for (let i = 0; i < limit; i++) {
    if (i === socketIndex) continue;
    const otherId = extenders[i];
    if (!otherId) continue;
    const otherInst = findModuleInstanceInPilot(pilot, otherId);
    if (!otherInst || otherInst.slot !== 'module') continue;
    const other = getModuleTemplateById(otherInst.templateId);
    if (!other) continue;
    if (
      (other.family === tpl.family && other.effectKey === tpl.effectKey) ||
      (tpl.skillId && other.skillId === tpl.skillId)
    ) {
      return failEquip('same_effect', i + 1);
    }
    if (other.family === 'skill') {
      skillCountExcludingTarget += 1;
    }
  }

  if (tpl.family === 'skill') {
    const maxSkills = sanitizeMaxSkillModulesPerGear(
      admin?.maxSkillModulesPerGear
    );
    if (skillCountExcludingTarget + 1 > maxSkills) {
      return failEquip('skill_limit');
    }
  }

  return { ok: true, reason: null, reasonKey: null };
}

export function setModule(
  pilot: PilotAccount,
  gearId: MechClassId,
  socketIndex: number,
  instanceId: string,
  admin?: Pick<
    AdminConfig,
    'extenderLevelsPerSocket' | 'maxSkillModulesPerGear'
  > | null
): SetModuleResult {
  const check = canEquipModule(pilot, gearId, socketIndex, instanceId, admin);
  if (!check.ok) {
    return {
      ok: false,
      pilot,
      reason: check.reason,
      reasonKey: check.reasonKey,
      ...(check.conflictSocket !== undefined
        ? {
            conflictSocket: check.conflictSocket,
            reasonParams: check.reasonParams,
          }
        : {}),
    };
  }

  const gear = pilot.gears[gearId];
  const nextExtenders = sanitizeGearExtenders(gear.extenders);
  nextExtenders[socketIndex] = instanceId;

  return {
    ok: true,
    pilot: {
      ...pilot,
      gears: {
        ...pilot.gears,
        [gearId]: {
          ...gear,
          extenders: nextExtenders,
        },
      },
    },
    reason: null,
    reasonKey: null,
  };
}

export function clearModule(
  pilot: PilotAccount,
  gearId: MechClassId,
  socketIndex: number
): { ok: boolean; pilot: PilotAccount } {
  if (
    !Number.isInteger(socketIndex) ||
    socketIndex < 0 ||
    socketIndex >= DEFAULT_EXTENDER_SLOT_COUNT
  ) {
    return { ok: false, pilot };
  }
  const gear = pilot.gears[gearId];
  if (!gear) {
    return { ok: false, pilot };
  }

  const nextExtenders = sanitizeGearExtenders(gear.extenders);
  nextExtenders[socketIndex] = null;

  return {
    ok: true,
    pilot: {
      ...pilot,
      gears: {
        ...pilot.gears,
        [gearId]: {
          ...gear,
          extenders: nextExtenders,
        },
      },
    },
  };
}

/**
 * Returns active skill grants from unlocked skill-family module instances on a GearUnit.
 */
export function getGearModuleSkillGrants(
  gear: Pick<GearUnit, 'level' | 'extenders'>,
  inventory: readonly ItemInstance[],
  admin?: Pick<AdminConfig, 'extenderLevelsPerSocket'> | null,
  warehouse: readonly ItemInstance[] = []
): GearModuleSkillGrant[] {
  const unlockedCount = getUnlockedExtenderCount(gear, admin);
  const extenders = gear.extenders ?? [];
  const limit = Math.min(unlockedCount, extenders.length);
  const grants: GearModuleSkillGrant[] = [];

  for (let i = 0; i < limit; i++) {
    const id = extenders[i];
    if (!id) continue;
    const inst =
      inventory.find((it) => it.instanceId === id) ??
      warehouse.find((it) => it.instanceId === id);
    if (!inst || inst.slot !== 'module') continue;
    const tpl = getModuleTemplateById(inst.templateId);
    if (!tpl || tpl.family !== 'skill' || !tpl.skillId) continue;
    grants.push({
      skillId: tpl.skillId,
      tier: tpl.tier,
    });
  }

  return grants;
}
