// @vitest-environment jsdom
import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BALANCE_CONFIG } from '../../data/balance';
import { createFreshCampaignState } from '../../engine/migration';
import {
  createDefaultAutoSafety,
  createDefaultSimpleTactics,
  createSimplePresetConfig,
  generateTacticsFromSimple,
  MAX_PRIORITY_SKILLS,
  sanitizeGearTactics,
  sanitizeSimpleTacticsConfig,
} from '../../engine/tactics';
import { getSkillName } from '../../i18n';
import { EN_TRANSLATIONS } from '../../i18n/en';
import { VI_TRANSLATIONS } from '../../i18n/vi';
import { useGameStore } from '../../store/useGameStore';
import type { SimpleTacticsConfig, TacticsRule } from '../../types/game';
import { AutoTacticsModal } from '../AutoTacticsModal';

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: Root | null = null;

const STRIKER_6_BAR = [
  'str_hotload_shells',
  'str_ordnance_amp',
  'str_deadeye_link',
  'str_viper_sweep',
  'str_carpet_salvo',
  'gen_hull_brace',
];

const SUPPORT_HEAVY_BAR = [
  'sup_nanite_mend',
  'sup_system_purge',
  'sup_war_hymn',
  'sup_aegis_field',
  'sup_iron_canopy',
  'sup_genesis_wave',
];

beforeEach(() => {
  window.localStorage.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  const fresh = createFreshCampaignState('PilotA6', 'striker');
  useGameStore.setState({
    ...fresh,
    language: 'vi',
    screen: 'HANGAR',
    activeTab: 'skill',
    tacticsModalOpen: false,
  });
});

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
  vi.restoreAllMocks();
});

describe('TASK AUTO-6 — Priority list 3->6 skills & Rule limit 8->12', () => {
  it('derives MAX_PRIORITY_SKILLS from BALANCE_CONFIG.maxEquippedActiveSkills (6) and sets maxTacticsRules = 12', () => {
    expect(MAX_PRIORITY_SKILLS).toBe(BALANCE_CONFIG.maxEquippedActiveSkills);
    expect(MAX_PRIORITY_SKILLS).toBe(6);
    expect(BALANCE_CONFIG.maxTacticsRules).toBe(12);
  });

  it('UI toggle fills up to 6 priority skills with A..F badges and replaces the last entry when full', () => {
    const sevenSkills = [...STRIKER_6_BAR, 'gen_thruster_feint'];
    const baseState = useGameStore.getState();

    useGameStore.setState({
      language: 'vi',
      tacticsModalOpen: true,
      pilot: {
        ...baseState.pilot,
        gears: {
          ...baseState.pilot.gears,
          striker: {
            ...baseState.pilot.gears.striker,
            equippedSkillBar: sevenSkills,
            tactics: {
              ...baseState.pilot.gears.striker.tactics,
              mode: 'simple',
              simple: {
                ...createDefaultSimpleTactics('striker', sevenSkills),
                prioritySkillIds: [],
              },
            },
          },
        },
      },
    });

    act(() => {
      root!.render(createElement(AutoTacticsModal));
    });

    // Label displays dynamic MAX (6) in vi and en
    expect(container!.textContent).toContain(
      '5. Kỹ năng ưu tiên (Tối đa 6, A > B > C ...)'
    );

    const clickSkillBtn = (skillId: string) => {
      const name = getSkillName('vi', skillId);
      const btn = Array.from(container!.querySelectorAll('button')).find((b) =>
        b.textContent?.includes(name)
      );
      expect(btn, `Missing skill button for ${skillId}`).toBeDefined();
      act(() => {
        btn!.click();
      });
    };

    // Click first 6 skills -> pushes cleanly up to 6
    for (const sid of STRIKER_6_BAR) {
      clickSkillBtn(sid);
    }
    let priorityIds =
      useGameStore.getState().pilot.gears.striker.tactics.simple!.prioritySkillIds;
    expect(priorityIds).toEqual(STRIKER_6_BAR);
    expect(container!.textContent).toContain('F');

    // Click 7th skill -> replaces LAST (6th) entry
    clickSkillBtn('gen_thruster_feint');
    priorityIds =
      useGameStore.getState().pilot.gears.striker.tactics.simple!.prioritySkillIds;
    expect(priorityIds).toHaveLength(6);
    expect(priorityIds[0]).toBe('str_hotload_shells');
    expect(priorityIds[4]).toBe('str_carpet_salvo');
    expect(priorityIds[5]).toBe('gen_thruster_feint');

    // Verify EN label also shows 6
    act(() => {
      useGameStore.setState({ language: 'en' });
    });
    expect(container!.textContent).toContain(
      '5. Priority Skills (Max 6, A > B > C ...)'
    );
  });

  it('sanitizer keeps up to 6 valid bar skills, drops duplicates/non-bar/passive/cross-class, and preserves old 3-skill saved list without auto-fill', () => {
    const bar = [...STRIKER_6_BAR];
    const sanitized = sanitizeSimpleTacticsConfig(
      'striker',
      {
        presetId: 'balanced',
        preferredTarget: 'weakest',
        skillUsage: 'always',
        lowHpThresholdPct: 35,
        lowHpAction: 'defend',
        elitePolicy: 'boss_only',
        prioritySkillIds: [
          'str_hotload_shells',
          'str_hotload_shells', // duplicate
          'str_passive_ordnance', // passive
          'sup_nanite_mend', // cross-class
          'str_solar_capacitor', // not on equipped bar
          'str_ordnance_amp',
          'str_deadeye_link',
          'str_viper_sweep',
          'str_carpet_salvo',
          'gen_hull_brace',
          'gen_thruster_feint', // not on bar -> exceeds/excluded
        ],
      },
      bar
    );

    expect(sanitized.prioritySkillIds).toEqual(STRIKER_6_BAR);
    expect(sanitized.prioritySkillIds).toHaveLength(6);

    // Also confirm 7 valid bar skills get sliced at MAX_PRIORITY_SKILLS (6)
    const sevenBar = [...STRIKER_6_BAR, 'gen_thruster_feint'];
    const sliced = sanitizeSimpleTacticsConfig(
      'striker',
      { prioritySkillIds: sevenBar },
      sevenBar
    );
    expect(sliced.prioritySkillIds).toHaveLength(6);
    expect(sliced.prioritySkillIds).toEqual(STRIKER_6_BAR);

    // Old saved 3-skill list loads with its 3 skills untouched (no auto-fill)
    const savedThree = sanitizeSimpleTacticsConfig(
      'striker',
      {
        presetId: 'balanced',
        preferredTarget: 'weakest',
        skillUsage: 'always',
        lowHpThresholdPct: 35,
        lowHpAction: 'defend',
        elitePolicy: 'boss_only',
        prioritySkillIds: ['str_hotload_shells', 'str_ordnance_amp', 'str_viper_sweep'],
      },
      bar
    );
    expect(savedThree.prioritySkillIds).toEqual([
      'str_hotload_shells',
      'str_ordnance_amp',
      'str_viper_sweep',
    ]);
  });

  it('presets fill up to 6 non-elite bar skills for aggressive/balanced/support_team, while defensive keeps first 2', () => {
    const strikerBarWithElite = [
      'str_skyfall_protocol', // elite (excluded from nonEliteBar)
      'str_hotload_shells',
      'str_ordnance_amp',
      'str_deadeye_link',
      'str_viper_sweep',
      'str_carpet_salvo',
      'gen_hull_brace',
    ];

    const balanced = createSimplePresetConfig(
      'balanced',
      'striker',
      strikerBarWithElite
    );
    expect(balanced.prioritySkillIds).toEqual(STRIKER_6_BAR);
    expect(balanced.prioritySkillIds).toHaveLength(6);

    const aggressive = createSimplePresetConfig(
      'aggressive',
      'striker',
      strikerBarWithElite
    );
    expect(aggressive.prioritySkillIds).toEqual(STRIKER_6_BAR);

    const supportDefault = createDefaultSimpleTactics('support', [
      'sup_nanite_mend',
      'sup_regen_grid',
      'sup_war_hymn',
      'sup_aegis_field',
      'sup_iron_canopy',
      'gen_hull_brace',
    ]);
    expect(supportDefault.prioritySkillIds).toHaveLength(6);

    const defensive = createSimplePresetConfig(
      'defensive',
      'striker',
      strikerBarWithElite
    );
    expect(defensive.prioritySkillIds).toEqual([
      'str_hotload_shells',
      'str_ordnance_amp',
    ]);
    expect(defensive.prioritySkillIds).toHaveLength(2);

    const siegeDefault = createDefaultSimpleTactics('siege', [
      'sge_starbreaker_lance',
      'gen_hull_brace',
      'gen_thruster_feint',
    ]);
    expect(siegeDefault.presetId).toBe('defensive');
    expect(siegeDefault.prioritySkillIds).toHaveLength(2);
  });

  it('generator with 6 priority + elite + heal + purge stays <= 12, keeps fixed rules first and basic attack last', () => {
    const bar = [
      ...SUPPORT_HEAVY_BAR,
      'sup_regen_grid',
      'sup_lidar_sweep',
      'gen_hull_brace',
      'gen_thruster_feint',
    ];
    const simple: SimpleTacticsConfig = {
      presetId: 'support_team',
      preferredTarget: 'support_first',
      skillUsage: 'always',
      lowHpThresholdPct: 40,
      lowHpAction: 'heal',
      elitePolicy: 'immediate',
      prioritySkillIds: [
        'sup_war_hymn',
        'sup_aegis_field',
        'sup_iron_canopy',
        'sup_regen_grid',
        'sup_lidar_sweep',
        'gen_hull_brace',
      ],
    };

    const compiled = generateTacticsFromSimple('support', simple, bar);
    expect(compiled.rules.length).toBeLessThanOrEqual(12);
    expect(compiled.rules.length).toBe(12);

    // Fixed survival + support heal/purify + elite/special come before priority skills
    const actions = compiled.rules.map((r) =>
      r.action.type === 'skill' ? r.action.skillId : r.action.type
    );
    expect(actions[0]).toBe('sup_nanite_mend'); // lowHpAction heal
    expect(actions[1]).toBe('defend'); // sim_lowdef
    expect(actions[2]).toBe('sup_nanite_mend'); // support_team ally heal
    expect(actions[3]).toBe('sup_system_purge'); // purify
    expect(actions[4]).toBe('sup_system_purge'); // elite/special (sup_system_purge)
    expect(actions[5]).toBe('sup_genesis_wave'); // elite (sup_genesis_wave)
    // Followed by priority skills in A > B > ... order (capped at maxTacticsRules - 1)
    expect(actions.slice(6, 11)).toEqual([
      'sup_war_hymn',
      'sup_aegis_field',
      'sup_iron_canopy',
      'sup_regen_grid',
      'sup_lidar_sweep',
    ]);
    // Basic attack is ALWAYS last
    expect(actions[actions.length - 1]).toBe('attack');

    // When fixed rules leave room (e.g. balanced + defend + 1 elite), all 6 priority skills fit + attack last
    const balanced6 = generateTacticsFromSimple(
      'support',
      {
        ...simple,
        presetId: 'balanced',
        lowHpAction: 'defend',
        elitePolicy: 'boss_only',
      },
      bar
    );
    const balancedActions = balanced6.rules.map((r) =>
      r.action.type === 'skill' ? r.action.skillId : r.action.type
    );
    expect(balanced6.rules.length).toBeLessThanOrEqual(12);
    expect(balancedActions.slice(3, 9)).toEqual([
      'sup_war_hymn',
      'sup_aegis_field',
      'sup_iron_canopy',
      'sup_regen_grid',
      'sup_lidar_sweep',
      'gen_hull_brace',
    ]);
    expect(balancedActions[balancedActions.length - 1]).toBe('attack');
  });

  it('matches exact snapshot for a stored 3-skill simple config (<= 8 rules identical to pre-change behavior)', () => {
    const oldSimple: SimpleTacticsConfig = {
      presetId: 'balanced',
      preferredTarget: 'weakest',
      skillUsage: 'save_sp_50',
      lowHpThresholdPct: 35,
      lowHpAction: 'defend',
      elitePolicy: 'boss_only',
      prioritySkillIds: [
        'str_hotload_shells',
        'str_ordnance_amp',
        'str_viper_sweep',
      ],
    };
    const bar = [
      'str_hotload_shells',
      'str_ordnance_amp',
      'str_viper_sweep',
      'str_skyfall_protocol',
    ];
    const generated = generateTacticsFromSimple('striker', oldSimple, bar);
    const semanticSnapshot = generated.rules.map((r) => ({
      enabled: r.enabled,
      condition: r.condition,
      action: r.action,
      targetSelector: r.targetSelector,
    }));

    expect(semanticSnapshot).toEqual([
      {
        enabled: true,
        condition: { kind: 'my_hp_below', value: 35 },
        action: { type: 'defend' },
        targetSelector: 'self',
      },
      {
        enabled: true,
        condition: { kind: 'boss_present' },
        action: { type: 'skill', skillId: 'str_skyfall_protocol' },
        targetSelector: 'lowest_hp_enemy',
      },
      {
        enabled: true,
        condition: { kind: 'my_sp_pct_gte', value: 50 },
        action: { type: 'skill', skillId: 'str_hotload_shells' },
        targetSelector: 'self',
      },
      {
        enabled: true,
        condition: { kind: 'my_sp_pct_gte', value: 50 },
        action: { type: 'skill', skillId: 'str_ordnance_amp' },
        targetSelector: 'self',
      },
      {
        enabled: true,
        condition: { kind: 'my_sp_pct_gte', value: 50 },
        action: { type: 'skill', skillId: 'str_viper_sweep' },
        targetSelector: 'lowest_hp_enemy',
      },
      {
        enabled: true,
        condition: { kind: 'always' },
        action: { type: 'attack' },
        targetSelector: 'lowest_hp_enemy',
      },
    ]);
  });

  it('Custom mode shows x / 12 counter, disables Add Rule at 12, clamps >12 in sanitizer, preserves old 8-rule lists, and maintains vi/en parity', () => {
    const enKeys = Object.keys(EN_TRANSLATIONS).sort();
    const viKeys = Object.keys(VI_TRANSLATIONS).sort();
    expect(viKeys).toEqual(enKeys);

    const makeRules = (count: number): TacticsRule[] =>
      Array.from({ length: count }, (_, idx) => ({
        id: `custom_r_${idx}`,
        enabled: true,
        condition: { kind: 'always' },
        action: { type: 'attack' },
        targetSelector: 'lowest_hp_enemy',
      }));

    // Old 8-rule list loads unchanged
    const loaded8 = sanitizeGearTactics('striker', {
      mode: 'custom',
      rules: makeRules(8),
      safety: createDefaultAutoSafety(),
    });
    expect(loaded8.rules).toHaveLength(8);

    // Over-limit list slices at 12
    const sliced12 = sanitizeGearTactics('striker', {
      mode: 'custom',
      rules: makeRules(15),
      safety: createDefaultAutoSafety(),
    });
    expect(sliced12.rules).toHaveLength(12);

    const baseState = useGameStore.getState();
    useGameStore.setState({
      language: 'vi',
      tacticsModalOpen: true,
      pilot: {
        ...baseState.pilot,
        gears: {
          ...baseState.pilot.gears,
          striker: {
            ...baseState.pilot.gears.striker,
            tactics: {
              ...baseState.pilot.gears.striker.tactics,
              mode: 'custom',
              rules: makeRules(12),
            },
          },
        },
      },
    });

    act(() => {
      root!.render(createElement(AutoTacticsModal));
    });

    expect(container!.textContent).toContain('12 / 12 Luật');
    const tabs = container!.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    expect(tabs.length).toBeGreaterThanOrEqual(2);
    act(() => {
      tabs[1].click();
    });

    const addBtn = Array.from(container!.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Thêm luật')
    ) as HTMLButtonElement | undefined;
    expect(addBtn).toBeDefined();
    expect(addBtn!.disabled).toBe(true);
  });
});
