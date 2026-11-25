import { BALANCE_CONFIG } from '../data/balance';
import { MECH_CLASS_LIST } from '../data/classes';
import { getSectorById } from '../data/maps';
import { getModuleTemplateById, MODULE_TEMPLATES } from '../data/modules';
import type {
  AdminConfig,
  CombatUnit,
  ExtenderEquipFailureReason,
  GearUnit,
  MechClassId,
  PilotAccount,
  PilotModuleStack,
} from '../types/game';
import { getModuleSellPrice } from './itemPrice';

export const DEFAULT_EXTENDER_SLOT_COUNT = 5;
export const DEFAULT_EXTENDER_UNLOCK_LEVELS = [5, 15, 25, 35, 45] as const;
export const DEFAULT_MAX_SKILL_MODULES_PER_GEAR = 1;
export const MODULE_STACK_CAP = 99;

export interface CanEquipModuleResult {
  ok: boolean;
  reason: ExtenderEquipFailureReason | null;
  reasonKey: `extender.reason.${ExtenderEquipFailureReason}` | null;
}

export interface SetModuleResult {
  ok: boolean;
  pilot: PilotAccount;
  reason: ExtenderEquipFailureReason | null;
  reasonKey: `extender.reason.${ExtenderEquipFailureReason}` | null;
}

export interface GearModuleSkillGrant {
  skillId: string;
  tier: 1 | 2 | 3 | 4;
}

export function sanitizePilotModules(rawModules: unknown): PilotModuleStack[] {
  if (!Array.isArray(rawModules)) return [];
  const merged = new Map<string, number>();
  for (const entry of rawModules) {
    if (!entry || typeof entry !== 'object') continue;
    const raw = entry as Partial<PilotModuleStack>;
    const templateId =
      typeof raw.templateId === 'string' ? raw.templateId.trim() : '';
    if (!templateId || !getModuleTemplateById(templateId)) continue;
    if (typeof raw.count !== 'number' || !Number.isFinite(raw.count)) continue;
    const clamped = Math.max(
      1,
      Math.min(MODULE_STACK_CAP, Math.round(raw.count))
    );
    const prev = merged.get(templateId) ?? 0;
    merged.set(templateId, Math.min(MODULE_STACK_CAP, prev + clamped));
  }
  return Array.from(merged.entries()).map(([templateId, count]) => ({
    templateId,
    count,
  }));
}

export function sanitizeGearExtenders(rawExtenders: unknown): (string | null)[] {
  const result: (string | null)[] = Array(DEFAULT_EXTENDER_SLOT_COUNT).fill(
    null
  );
  if (!Array.isArray(rawExtenders)) return result;
  const limit = Math.min(DEFAULT_EXTENDER_SLOT_COUNT, rawExtenders.length);
  for (let i = 0; i < limit; i++) {
    const val = rawExtenders[i];
    if (typeof val === 'string') {
      const id = val.trim();
      if (id && getModuleTemplateById(id)) {
        result[i] = id;
      }
    }
  }
  return result;
}

export function sanitizeExtenderUnlockLevels(rawLevels: unknown): number[] {
  if (
    !Array.isArray(rawLevels) ||
    rawLevels.length !== DEFAULT_EXTENDER_SLOT_COUNT
  ) {
    return [...DEFAULT_EXTENDER_UNLOCK_LEVELS];
  }
  const parsed: number[] = [];
  for (let i = 0; i < DEFAULT_EXTENDER_SLOT_COUNT; i++) {
    const n = rawLevels[i];
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > 50) {
      return [...DEFAULT_EXTENDER_UNLOCK_LEVELS];
    }
    if (i > 0 && n < parsed[i - 1]) {
      return [...DEFAULT_EXTENDER_UNLOCK_LEVELS];
    }
    parsed.push(n);
  }
  return parsed;
}

export function sanitizeMaxSkillModulesPerGear(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return DEFAULT_MAX_SKILL_MODULES_PER_GEAR;
  }
  return Math.max(0, Math.min(2, Math.round(raw)));
}

/**
 * Enforces owned-count and per-gear same-effect uniqueness across all gears
 * in MECH_CLASS_LIST order (earlier gears & lower socket indices keep theirs first).
 */
export function sanitizeGearExtendersAcrossPilot(
  gears: Record<MechClassId, GearUnit>,
  modules: readonly PilotModuleStack[]
): Record<MechClassId, GearUnit> {
  const remaining = new Map<string, number>();
  for (const stack of modules) {
    if (!stack || !getModuleTemplateById(stack.templateId)) continue;
    const count = Math.max(
      0,
      Math.min(MODULE_STACK_CAP, Math.round(stack.count || 0))
    );
    if (count > 0) {
      remaining.set(
        stack.templateId,
        Math.min(MODULE_STACK_CAP, (remaining.get(stack.templateId) ?? 0) + count)
      );
    }
  }

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
      const tpl = getModuleTemplateById(id);
      if (!tpl) {
        clean[i] = null;
        continue;
      }
      const effKey = `${tpl.family}:${tpl.effectKey}`;
      if (
        seenEffectOnGear.has(effKey) ||
        (tpl.skillId && seenSkillOnGear.has(tpl.skillId))
      ) {
        clean[i] = null;
        continue;
      }
      const rem = remaining.get(id) ?? 0;
      if (rem <= 0) {
        clean[i] = null;
        continue;
      }
      seenEffectOnGear.add(effKey);
      if (tpl.skillId) {
        seenSkillOnGear.add(tpl.skillId);
      }
      remaining.set(id, rem - 1);
    }

    nextGears[cls.id] = {
      ...gear,
      extenders: clean,
    };
  }

  return nextGears;
}

/**
 * Counts how many extender sockets are unlocked for `gear` given `admin.extenderUnlockLevels`.
 */
export function getUnlockedExtenderCount(
  gear: Pick<GearUnit, 'level'>,
  admin?: Pick<AdminConfig, 'extenderUnlockLevels'> | null
): number {
  const levels = sanitizeExtenderUnlockLevels(admin?.extenderUnlockLevels);
  let count = 0;
  for (const reqLv of levels) {
    if (reqLv <= gear.level) {
      count += 1;
    }
  }
  return count;
}

function failEquip(reason: ExtenderEquipFailureReason): CanEquipModuleResult {
  return {
    ok: false,
    reason,
    reasonKey: `extender.reason.${reason}`,
  };
}

export function getOwnedModuleCount(
  pilot: Pick<PilotAccount, 'modules'>,
  templateId: string
): number {
  let total = 0;
  for (const stack of pilot.modules ?? []) {
    if (stack.templateId === templateId && Number.isFinite(stack.count)) {
      total += Math.max(0, Math.floor(stack.count));
    }
  }
  return total;
}

export function countSlottedModuleCopies(
  pilot: Pick<PilotAccount, 'gears'>,
  templateId: string,
  excludeSlot?: { gearId: MechClassId; socketIndex: number }
): number {
  let count = 0;
  for (const cls of MECH_CLASS_LIST) {
    const gear = pilot.gears[cls.id];
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
      if (gear.extenders[i] === templateId) {
        count += 1;
      }
    }
  }
  return count;
}

export function canEquipModule(
  pilot: Pick<PilotAccount, 'gears' | 'modules'>,
  gearId: MechClassId,
  socketIndex: number,
  templateId: string,
  admin?: Pick<
    AdminConfig,
    'extenderUnlockLevels' | 'maxSkillModulesPerGear'
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

  const tpl = getModuleTemplateById(templateId);
  if (!tpl) {
    return failEquip('not_owned');
  }

  if (gear.level < tpl.requiredLevel) {
    return failEquip('level_too_low');
  }

  const ownedCount = getOwnedModuleCount(pilot, tpl.id);
  const usedElsewhere = countSlottedModuleCopies(pilot, tpl.id, {
    gearId,
    socketIndex,
  });
  if (ownedCount <= usedElsewhere) {
    return failEquip('not_owned');
  }

  const extenders = gear.extenders ?? [];
  let skillCountExcludingTarget = 0;
  const limit = Math.min(DEFAULT_EXTENDER_SLOT_COUNT, extenders.length);
  for (let i = 0; i < limit; i++) {
    if (i === socketIndex) continue;
    const otherId = extenders[i];
    if (!otherId) continue;
    const other = getModuleTemplateById(otherId);
    if (!other) continue;
    if (
      (other.family === tpl.family && other.effectKey === tpl.effectKey) ||
      (tpl.skillId && other.skillId === tpl.skillId)
    ) {
      return failEquip('same_effect');
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
  templateId: string,
  admin?: Pick<
    AdminConfig,
    'extenderUnlockLevels' | 'maxSkillModulesPerGear'
  > | null
): SetModuleResult {
  const check = canEquipModule(pilot, gearId, socketIndex, templateId, admin);
  if (!check.ok) {
    return {
      ok: false,
      pilot,
      reason: check.reason,
      reasonKey: check.reasonKey,
    };
  }

  const gear = pilot.gears[gearId];
  const nextExtenders = sanitizeGearExtenders(gear.extenders);
  nextExtenders[socketIndex] = templateId;

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
 * Returns active skill grants from unlocked skill-family modules on a GearUnit.
 * Returns [] for the current catalog until S1c-4 adds skill-family modules and combat wires them.
 */
export function getGearModuleSkillGrants(
  gear: Pick<GearUnit, 'level' | 'extenders'>,
  admin?: Pick<AdminConfig, 'extenderUnlockLevels'> | null
): GearModuleSkillGrant[] {
  const unlockedCount = getUnlockedExtenderCount(gear, admin);
  const extenders = gear.extenders ?? [];
  const limit = Math.min(unlockedCount, extenders.length);
  const grants: GearModuleSkillGrant[] = [];

  for (let i = 0; i < limit; i++) {
    const id = extenders[i];
    if (!id) continue;
    const tpl = getModuleTemplateById(id);
    if (!tpl || tpl.family !== 'skill' || !tpl.skillId) continue;
    grants.push({
      skillId: tpl.skillId,
      tier: tpl.tier,
    });
  }

  return grants;
}

export function addModuleToPilot(
  pilot: PilotAccount,
  templateId: string,
  count: number = 1
): { pilot: PilotAccount; added: number; overflow: number; creditsGained: number } {
  const tpl = getModuleTemplateById(templateId);
  const qty = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  if (!tpl || qty <= 0) {
    return { pilot, added: 0, overflow: 0, creditsGained: 0 };
  }

  const currentStacks = sanitizePilotModules(pilot.modules);
  const existingIdx = currentStacks.findIndex((s) => s.templateId === tpl.id);
  const prevCount = existingIdx >= 0 ? currentStacks[existingIdx].count : 0;
  const nextCount = Math.min(MODULE_STACK_CAP, prevCount + qty);
  const added = nextCount - prevCount;
  const overflow = qty - added;
  const creditsGained =
    overflow > 0 ? overflow * getModuleSellPrice(tpl) : 0;

  let nextModules = currentStacks;
  if (added > 0) {
    if (existingIdx >= 0) {
      nextModules = currentStacks.map((s, idx) =>
        idx === existingIdx ? { ...s, count: nextCount } : s
      );
    } else {
      nextModules = [...currentStacks, { templateId: tpl.id, count: nextCount }];
    }
  }

  if (added === 0 && creditsGained === 0) {
    return { pilot, added: 0, overflow, creditsGained: 0 };
  }

  return {
    pilot: {
      ...pilot,
      modules: nextModules,
      credits: pilot.credits + creditsGained,
    },
    added,
    overflow,
    creditsGained,
  };
}

export function addModuleDropsToPilot(
  pilot: PilotAccount,
  drops: readonly PilotModuleStack[]
): { pilot: PilotAccount; creditsGained: number } {
  let nextPilot = pilot;
  let creditsGained = 0;
  for (const drop of drops) {
    const res = addModuleToPilot(nextPilot, drop.templateId, drop.count);
    nextPilot = res.pilot;
    creditsGained += res.creditsGained;
  }
  return { pilot: nextPilot, creditsGained };
}

export function mergeModuleStacks(
  existing: readonly PilotModuleStack[] | undefined,
  incoming: readonly PilotModuleStack[]
): PilotModuleStack[] {
  const map = new Map<string, number>();
  for (const stack of existing ?? []) {
    if (!stack?.templateId || stack.count <= 0) continue;
    map.set(stack.templateId, (map.get(stack.templateId) ?? 0) + stack.count);
  }
  for (const stack of incoming) {
    if (!stack?.templateId || stack.count <= 0) continue;
    map.set(stack.templateId, (map.get(stack.templateId) ?? 0) + stack.count);
  }
  return Array.from(map.entries()).map(([templateId, count]) => ({
    templateId,
    count,
  }));
}

/**
 * Rolls up to 1 extender module drop for a completed battle.
 * Call AFTER rollBattleItemDrops so item drops stay identical for the same seed.
 */
export function rollBattleModuleDrops(
  enemies: CombatUnit[],
  sectorId: string,
  gearLevel: number,
  won: boolean,
  rng: () => number = Math.random
): PilotModuleStack[] {
  const destroyedEnemies = enemies.filter((e) => !e.alive);
  if (destroyedEnemies.length === 0) return [];

  const sector = getSectorById(sectorId);
  const mCfg = BALANCE_CONFIG.moduleDropConfig;
  const itemCfg = BALANCE_CONFIG.dropConfig[sector.difficulty];
  const hasBossDestroyed = destroyedEnemies.some((e) => e.isBoss);

  let dropChance = mCfg[sector.difficulty] + (hasBossDestroyed ? mCfg.bossBonus : 0);
  if (!won) {
    dropChance *= mCfg.lossFactor;
  }
  if (rng() >= dropChance) {
    return [];
  }

  const maxTier = Math.min(
    4,
    Math.max(
      itemCfg.maxTier,
      gearLevel >= 9 ? 4 : gearLevel >= 6 ? 3 : gearLevel >= 3 ? 2 : 1
    )
  );

  const statPool = MODULE_TEMPLATES.filter(
    (t) => t.family === 'stat' && t.tier <= maxTier
  );
  const traitPool = MODULE_TEMPLATES.filter(
    (t) => t.family === 'trait' && t.tier >= 2 && t.tier <= maxTier
  );

  const pickTrait = rng() * 100 >= 80 && traitPool.length > 0;
  const pool = pickTrait ? traitPool : statPool;
  if (pool.length === 0) return [];

  const chosen = pool[Math.floor(rng() * pool.length)];
  return [{ templateId: chosen.id, count: 1 }];
}
