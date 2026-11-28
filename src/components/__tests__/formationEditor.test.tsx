// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_FORMATION_CONFIG } from '../../data/formationConfig';
import { useGameStore } from '../../store/useGameStore';
import { FormationEditor } from '../FormationEditor';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

describe('FormationEditor UI (3-Row Squad Editor)', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    useGameStore.getState().resetCampaign();
    useGameStore.getState().startCampaign('Commander', 'striker');
    useGameStore.getState().setLanguage('en');

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('renders 3 horizontal rows (front, middle, back) with capacity counts, effect lines, and Auto arrange button', () => {
    act(() => {
      root.render(createElement(FormationEditor));
    });

    const frontRow = container.querySelector('[data-formation-row="front"]');
    const middleRow = container.querySelector('[data-formation-row="middle"]');
    const backRow = container.querySelector('[data-formation-row="back"]');
    expect(frontRow).not.toBeNull();
    expect(middleRow).not.toBeNull();
    expect(backRow).not.toBeNull();

    // Capacity displays default 8/8/8 with Siege (2) front, Striker/Interceptor (4) middle, Support (2) back
    expect(
      container.querySelector('[data-testid="row-capacity-front"]')?.textContent
    ).toBe('2/8');
    expect(
      container.querySelector('[data-testid="row-capacity-middle"]')?.textContent
    ).toBe('4/8');
    expect(
      container.querySelector('[data-testid="row-capacity-back"]')?.textContent
    ).toBe('2/8');

    // One-line effect descriptions reflect default row modifiers
    expect(frontRow?.textContent).toContain('+10% DEF');
    expect(middleRow?.textContent).toContain('Neutral');
    expect(backRow?.textContent).toContain('-10% DEF');
    expect(backRow?.textContent).toContain('+10% Ranged DMG');

    // Auto arrange button exists
    const buttons = Array.from(container.querySelectorAll('button'));
    const autoBtn = buttons.find((b) =>
      b.textContent?.includes('Auto arrange')
    );
    expect(autoBtn).toBeDefined();
    expect(autoBtn?.className).toContain('min-h-[44px]');
  });

  it('swaps cleanly when moving into a full row (unit tap & row button) and allows tap-to-move into an open row', () => {
    // Explicit tight setup: front (2/2 full with ally_player in front) and back (2/2 full), middle open (4/5)
    useGameStore.getState().adminUpdateConfig({
      formation: {
        ...DEFAULT_FORMATION_CONFIG,
        rowCapacities: { front: 2, middle: 5, back: 2 },
      },
    });
    const curSquad = useGameStore.getState().pilot.squadFormation ?? [];
    const movedSquad = curSquad.map((u) => {
      if (u.id === 'ally_player') return { ...u, row: 'front' as const };
      if (u.id === 'ally_npc_1') return { ...u, row: 'middle' as const };
      return u;
    });
    const frontSwap = movedSquad.filter((u) => u.row === 'front');
    if (frontSwap.length > 2) {
      let extra = frontSwap.length - 2;
      for (let i = 0; i < movedSquad.length && extra > 0; i++) {
        if (movedSquad[i].row === 'front' && movedSquad[i].id !== 'ally_player') {
          movedSquad[i] = { ...movedSquad[i], row: 'middle' };
          extra--;
        }
      }
    }
    useGameStore.setState((s) => ({
      pilot: { ...s.pilot, squadFormation: movedSquad },
    }));

    act(() => {
      root.render(createElement(FormationEditor));
    });

    // Player lead placed in front row (2/2)
    const leadBtn = container.querySelector<HTMLButtonElement>(
      '[data-testid="formation-unit-ally_player"]'
    );
    expect(leadBtn).not.toBeNull();

    // Tap lead unit to select it
    act(() => {
      leadBtn!.click();
    });
    expect(leadBtn!.getAttribute('aria-pressed')).toBe('true');

    // Back row is full (2/2) -> button offers "Tap to swap here", never shows a dead-end alert
    const backUnitsBefore = (useGameStore.getState().pilot.squadFormation ?? []).filter(
      (u) => u.row === 'back'
    );
    expect(backUnitsBefore).toHaveLength(2);
    const targetBackUnit = backUnitsBefore[0];
    const lastBackUnit = [...backUnitsBefore].sort(
      (a, b) => a.formationCol - b.formationCol
    )[1];

    const moveToBackBtn = container.querySelector<HTMLButtonElement>(
      '[data-testid="move-to-back"]'
    );
    expect(moveToBackBtn).not.toBeNull();
    expect(moveToBackBtn!.textContent).toContain('Tap to swap here');

    // Tap a specific unit in the full Back row -> swaps lead unit with that tapped unit
    const tappedBackUnitBtn = container.querySelector<HTMLButtonElement>(
      `[data-testid="formation-unit-${targetBackUnit.id}"]`
    );
    expect(tappedBackUnitBtn).not.toBeNull();
    act(() => {
      tappedBackUnitBtn!.click();
    });

    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(
      useGameStore
        .getState()
        .pilot.squadFormation?.find((u) => u.id === 'ally_player')?.row
    ).toBe('back');
    expect(
      useGameStore
        .getState()
        .pilot.squadFormation?.find((u) => u.id === targetBackUnit.id)?.row
    ).toBe('front');
    expect(
      container.querySelector('[data-testid="row-capacity-back"]')?.textContent
    ).toBe('2/2');
    expect(
      container.querySelector('[data-testid="row-capacity-front"]')?.textContent
    ).toBe('2/2');

    // Now select the swapped unit (now in front) and tap move-to-back row button -> swaps with last unit in back row
    const swappedBackInFrontBtn = container.querySelector<HTMLButtonElement>(
      `[data-testid="formation-unit-${targetBackUnit.id}"]`
    );
    act(() => {
      swappedBackInFrontBtn!.click();
    });
    const moveToBackBtn2 = container.querySelector<HTMLButtonElement>(
      '[data-testid="move-to-back"]'
    );
    act(() => {
      moveToBackBtn2!.click();
    });

    expect(
      useGameStore
        .getState()
        .pilot.squadFormation?.find((u) => u.id === targetBackUnit.id)?.row
    ).toBe('back');
    expect(
      useGameStore
        .getState()
        .pilot.squadFormation?.find((u) => u.id === lastBackUnit.id)?.row
    ).toBe('front');

    // Tap lead unit (still in back) and tap open Middle row (4/5) -> moves cleanly into open slot
    const leadNow = container.querySelector<HTMLButtonElement>(
      '[data-testid="formation-unit-ally_player"]'
    );
    act(() => {
      leadNow!.click();
    });
    const moveToMidBtn = container.querySelector<HTMLButtonElement>(
      '[data-testid="move-to-middle"]'
    );
    expect(moveToMidBtn).not.toBeNull();
    act(() => {
      moveToMidBtn!.click();
    });

    expect(
      useGameStore
        .getState()
        .pilot.squadFormation?.find((u) => u.id === 'ally_player')?.row
    ).toBe('middle');
    expect(
      container.querySelector('[data-testid="row-capacity-back"]')?.textContent
    ).toBe('1/2');
    expect(
      container.querySelector('[data-testid="row-capacity-middle"]')?.textContent
    ).toBe('5/5');

    // Clicking "Auto arrange" returns the Striker lead to Middle row
    const autoBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Auto arrange')
    );
    act(() => {
      autoBtn!.click();
    });

    expect(
      useGameStore
        .getState()
        .pilot.squadFormation?.find((u) => u.id === 'ally_player')?.row
    ).toBe('middle');
    expect(useGameStore.getState().pilot.formationCustomized).toBe(false);
  });

  it('keeps all interactive tap targets >= 44px and uses no sub-13px text classes', () => {
    act(() => {
      root.render(createElement(FormationEditor));
    });

    const buttons = Array.from(container.querySelectorAll('button'));
    expect(buttons.length).toBeGreaterThan(0);
    for (const btn of buttons) {
      expect(btn.className).toContain('min-h-[44px]');
    }

    const html = container.innerHTML;
    expect(html).not.toMatch(/\btext-(xs|\[1[012]px\]|\[[0-9]px\])\b/);
  });
});
