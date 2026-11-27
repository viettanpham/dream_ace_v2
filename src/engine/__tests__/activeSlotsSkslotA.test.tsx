// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { AutoTacticsModal } from '../../components/AutoTacticsModal';
import { SkillView } from '../../components/SkillView';
import {
  ACTIVE_SLOTS_HARD_MAX,
  DEFAULT_ACTIVE_SLOTS_CONFIG,
  getUnlockedActiveSlots,
  sanitizeActiveSlotsConfig,
} from '../../data/balance';
import { getDefaultSelectedNodeId } from '../../data/maps';
import { useGameStore } from '../../store/useGameStore';
import { createInitialBattleState } from '../combat';
import {
  createFreshCampaignState,
  CURRENT_SAVE_VERSION,
  migrateSaveData,
} from '../migration';
import { equipSkillToGearBar } from '../skills';
import { createSimplePresetConfig } from '../tactics';

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe('TASK SKSLOT-A — Active skill slots by gear level', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  afterEach(() => {
    if (root) {
      act(() => {
        root!.unmount();
      });
      root = null;
    }
    if (container) {
      container.remove();
      container = null;
    }
  });

  it('1) getUnlockedActiveSlots scales by level (Lv1=3..Lv30=9) and clamps to max', () => {
    expect(ACTIVE_SLOTS_HARD_MAX).toBe(9);
    expect(getUnlockedActiveSlots(1)).toBe(3);
    expect(getUnlockedActiveSlots(5)).toBe(4);
    expect(getUnlockedActiveSlots(10)).toBe(5);
    expect(getUnlockedActiveSlots(15)).toBe(6);
    expect(getUnlockedActiveSlots(25)).toBe(8);
    expect(getUnlockedActiveSlots(30)).toBe(9);
    expect(getUnlockedActiveSlots(50)).toBe(9);
    expect(
      getUnlockedActiveSlots(40, { initial: 2, everyLevels: 4, max: 6 })
    ).toBe(6);
  });

  it('2) sanitizeActiveSlotsConfig applies defaults and clamps ranges safely', () => {
    expect(sanitizeActiveSlotsConfig(undefined)).toEqual(
      DEFAULT_ACTIVE_SLOTS_CONFIG
    );
    expect(
      sanitizeActiveSlotsConfig({ initial: 0, everyLevels: 99, max: 20 })
    ).toEqual({
      initial: 1,
      everyLevels: 50,
      max: 9,
    });
    expect(
      sanitizeActiveSlotsConfig({ initial: 7, everyLevels: 3, max: 4 })
    ).toEqual({
      initial: 7,
      everyLevels: 3,
      max: 7,
    });
  });

  it('3) equip is refused at unlocked limit, while over-long existing bar (6 at Lv1) is preserved by migration and combat', () => {
    const fresh = createFreshCampaignState('Tester', 'striker');
    const sixActive = [
      'str_hotload_shells',
      'str_ordnance_amp',
      'str_deadeye_link',
      'str_viper_sweep',
      'str_carpet_salvo',
      'gen_hull_brace',
    ];
    for (const id of sixActive) {
      fresh.pilot.gears.striker.skillLevels[id] = 1;
    }
    fresh.pilot.gears.striker.skillLevels.gen_thruster_feint = 1;

    // Lv1 unlocked limit is 3 -> equipping a 4th skill is refused
    fresh.pilot.gears.striker.equippedSkillBar = sixActive.slice(0, 3);
    const refused = equipSkillToGearBar(
      fresh.pilot,
      'striker',
      'str_viper_sweep',
      fresh.adminConfig
    );
    expect(refused.validation.ok).toBe(false);
    expect(refused.validation.reason).toBe('bar_full');

    // Grandfathering: existing 6-skill bar at Lv1 survives migration & enters combat intact
    fresh.pilot.gears.striker.equippedSkillBar = [...sixActive];
    const migrated = migrateSaveData(fresh, CURRENT_SAVE_VERSION);
    expect(migrated.pilot.gears.striker.equippedSkillBar).toEqual(sixActive);

    const battle = createInitialBattleState(
      migrated.pilot,
      getDefaultSelectedNodeId(),
      () => 0.5,
      null,
      migrated.adminConfig
    );
    const playerUnit = battle.units.find((u) => u.isPlayer)!;
    expect(playerUnit.equippedSkillIds).toEqual(sixActive);
  });

  it('4) SkillView shows unlocked slots + next locked tile and keeps all 6 grandfathered slots visible', () => {
    useGameStore.getState().resetCampaign();
    useGameStore.getState().startCampaign('SlotTester', 'striker');
    useGameStore.getState().setLanguage('vi');

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root!.render(createElement(SkillView));
    });

    const row = container.querySelector('[data-testid="active-slots-row"]')!;
    const lockedTile = container.querySelector(
      '[data-testid="active-slot-next-locked"]'
    )!;
    expect(row.children.length).toBe(4); // 3 unlocked + 1 next locked
    expect(lockedTile.textContent).toContain('Mở ở Lv5');

    // Grandfathered Lv1 save with 6 equipped skills shows all 6 + next locked tile
    const pilot = useGameStore.getState().pilot;
    const sixBar = [
      'str_hotload_shells',
      'str_ordnance_amp',
      'str_deadeye_link',
      'str_viper_sweep',
      'str_carpet_salvo',
      'gen_hull_brace',
    ];
    const nextLevels = { ...pilot.gears.striker.skillLevels };
    for (const id of sixBar) nextLevels[id] = 1;
    act(() => {
      useGameStore.setState({
        pilot: {
          ...pilot,
          gears: {
            ...pilot.gears,
            striker: {
              ...pilot.gears.striker,
              level: 1,
              skillLevels: nextLevels,
              equippedSkillBar: sixBar,
            },
          },
        },
      });
    });
    expect(
      container.querySelector('[data-testid="active-slots-row"]')!.children
        .length
    ).toBe(7); // 6 grandfathered + 1 next locked
  });

  it('5) tactics priority list length follows unlocked active slots of selected gear', () => {
    const sixBar = [
      'str_hotload_shells',
      'str_ordnance_amp',
      'str_deadeye_link',
      'str_viper_sweep',
      'str_carpet_salvo',
      'gen_hull_brace',
    ];
    const lv1Preset = createSimplePresetConfig(
      'balanced',
      'striker',
      sixBar,
      getUnlockedActiveSlots(1)
    );
    expect(lv1Preset.prioritySkillIds).toHaveLength(3);

    useGameStore.getState().resetCampaign();
    useGameStore.getState().startCampaign('TacticsTester', 'striker');
    useGameStore.getState().setLanguage('vi');
    const st = useGameStore.getState();
    useGameStore.setState({
      tacticsModalOpen: true,
      pilot: {
        ...st.pilot,
        gears: {
          ...st.pilot.gears,
          striker: {
            ...st.pilot.gears.striker,
            level: 10, // unlocked = 5
            equippedSkillBar: sixBar,
          },
        },
      },
    });

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root!.render(createElement(AutoTacticsModal));
    });
    expect(container.textContent).toContain(
      '5. Kỹ năng ưu tiên (Tối đa 5, A > B > C ...)'
    );
  });
});
