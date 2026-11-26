import { describe, expect, it } from 'vitest';
import { getSkillById } from '../../data/skills';
import type { MechClassId } from '../../types/game';
import { buildNpcSkillLoadout } from '../combat';
import { MAX_ACTIVE_SKILL_BAR } from '../skills';

describe('NPC-SK1 — buildNpcSkillLoadout role priority', () => {
  it('1) support level 10 prioritizes nanite_mend, lidar_sweep, flux_transfer, war_hymn in order', () => {
    const loadout = buildNpcSkillLoadout('support', 10);
    expect(loadout.equippedSkillIds.slice(0, 4)).toEqual([
      'sup_nanite_mend',
      'sup_lidar_sweep',
      'sup_flux_transfer',
      'sup_war_hymn',
    ]);
    expect(loadout.skillLevels.sup_nanite_mend).toBe(2);
    expect(loadout.skillLevels.sup_war_hymn).toBe(2);
  });

  it('2) striker level 1 picks str_hotload_shells + backfill without duplicates or crash', () => {
    const loadout = buildNpcSkillLoadout('striker', 1);
    expect(loadout.equippedSkillIds[0]).toBe('str_hotload_shells');
    expect(new Set(loadout.equippedSkillIds).size).toBe(
      loadout.equippedSkillIds.length
    );
    expect(loadout.skillLevels.str_hotload_shells).toBe(1);
  });

  it('3) high-level loadouts never exceed 6 skills and never include special/elite/passive skills', () => {
    const classes: MechClassId[] = ['striker', 'interceptor', 'siege', 'support'];
    for (const cls of classes) {
      const loadout = buildNpcSkillLoadout(cls, 50);
      expect(loadout.equippedSkillIds.length).toBeLessThanOrEqual(
        MAX_ACTIVE_SKILL_BAR
      );
      expect(new Set(loadout.equippedSkillIds).size).toBe(
        loadout.equippedSkillIds.length
      );
      for (const skillId of loadout.equippedSkillIds) {
        const def = getSkillById(skillId);
        expect(def).toBeDefined();
        expect(def?.category).toBe('normal');
        expect(loadout.skillLevels[skillId]).toBe(5);
      }
    }
  });
});
