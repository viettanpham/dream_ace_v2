// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { generateItemInstance } from '../../engine/equipment';
import { createFreshCampaignState } from '../../engine/migration';
import { formatItemTraitsList } from '../../i18n';
import { useGameStore } from '../../store/useGameStore';
import { GarageView } from '../GarageView';
import { GearView } from '../GearView';

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
  localStorage.clear();
  useGameStore.setState({
    ...createFreshCampaignState('RadarPilot', 'striker', makeRng(1)),
    language: 'vi',
  });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  if (root) {
    act(() => {
      root?.unmount();
    });
    root = null;
  }
  if (container) {
    container.remove();
    container = null;
  }
});

describe('TASK RAD1b — GEAR live Radar tile + Accuracy / Stealth UI text', () => {
  it('1) radar tile renders empty / filled and tap selects the radar slot while Extender tiles stay locked', () => {
    act(() => {
      root!.render(createElement(GearView));
    });

    const emptyDesktopRadar = container!.querySelector(
      '[data-testid="gear-slot-tile-desktop-radar"]'
    ) as HTMLButtonElement;
    expect(emptyDesktopRadar).not.toBeNull();
    expect(emptyDesktopRadar.disabled).toBe(false);
    expect(emptyDesktopRadar.getAttribute('data-locked')).toBe('false');
    expect(emptyDesktopRadar.textContent).toContain('RADAR');
    expect(emptyDesktopRadar.textContent).toContain('—');

    const ext1Desktop = container!.querySelector(
      '[data-testid="gear-slot-tile-desktop-ext1"]'
    ) as HTMLButtonElement;
    expect(ext1Desktop.disabled).toBe(true);
    expect(ext1Desktop.getAttribute('data-locked')).toBe('true');

    // Equip a radar item and verify filled tile + tap selection opens detail panel
    const hunter = generateItemInstance(
      { templateId: 'tpl_rd_hunter', rarity: 'epic', requiredLevel: 1, rollQuality: 72 },
      makeRng(2)
    );
    const pilot = useGameStore.getState().pilot;
    useGameStore.setState({
      pilot: {
        ...pilot,
        inventory: [...pilot.inventory, hunter],
        gears: {
          ...pilot.gears,
          striker: {
            ...pilot.gears.striker,
            equipped: { ...pilot.gears.striker.equipped, radar: hunter.instanceId },
          },
        },
      },
    });

    act(() => {
      root!.render(createElement(GearView));
    });

    const filledDesktopRadar = container!.querySelector(
      '[data-testid="gear-slot-tile-desktop-radar"]'
    ) as HTMLButtonElement;
    expect(filledDesktopRadar.textContent).toContain('72%');

    act(() => {
      filledDesktopRadar.click();
    });
    expect(filledDesktopRadar.className).toContain('border-sky-400');
    expect(container!.querySelector('[data-testid="detail-unequip-shortcut"]')).not.toBeNull();
  });

  it('2) formatItemTraitsList returns accuracy and stealth lines in vi and en', () => {
    const hunter = generateItemInstance(
      { templateId: 'tpl_rd_hunter', rarity: 'epic', rollQuality: 50 },
      makeRng(3)
    );
    const viLines = formatItemTraitsList('vi', hunter);
    const enLines = formatItemTraitsList('en', hunter);

    expect(viLines).toContain('Chính xác +8%');
    expect(viLines).toContain('Dò tàng hình');
    expect(enLines).toContain('Accuracy +8%');
    expect(enLines).toContain('Stealth detect');
  });

  it('3) accuracy row and stealth chip are hidden at 0 and shown with a radar equipped in GearView and GarageView', () => {
    act(() => {
      root!.render(createElement(GearView));
    });
    expect(container!.querySelector('[data-testid="gear-derived-accuracy"]')).toBeNull();
    expect(container!.querySelector('[data-testid="gear-stealth-detect-chip"]')).toBeNull();

    act(() => {
      root!.render(createElement(GarageView));
    });
    expect(container!.querySelector('[data-testid="garage-derived-accuracy"]')).toBeNull();
    expect(container!.querySelector('[data-testid="garage-stealth-detect-chip"]')).toBeNull();

    const hunter = generateItemInstance(
      { templateId: 'tpl_rd_hunter', rarity: 'epic', requiredLevel: 1, rollQuality: 50 },
      makeRng(4)
    );
    const pilot = useGameStore.getState().pilot;
    useGameStore.setState({
      pilot: {
        ...pilot,
        inventory: [...pilot.inventory, hunter],
        gears: {
          ...pilot.gears,
          striker: {
            ...pilot.gears.striker,
            equipped: { ...pilot.gears.striker.equipped, radar: hunter.instanceId },
          },
        },
      },
    });

    act(() => {
      root!.render(createElement(GearView));
    });
    const gearAcc = container!.querySelector('[data-testid="gear-derived-accuracy"]');
    const gearChip = container!.querySelector('[data-testid="gear-stealth-detect-chip"]');
    expect(gearAcc?.textContent).toContain('Chính xác');
    expect(gearAcc?.textContent).toContain('8%');
    expect(gearAcc?.getAttribute('title')).toBe('Giảm né tránh của mục tiêu 8 điểm');
    expect(gearChip?.textContent).toContain('Dò tàng hình');
    expect(gearChip?.getAttribute('title')).toBe('Tấn công được mục tiêu đang tàng hình');

    act(() => {
      root!.render(createElement(GarageView));
    });
    const garageAcc = container!.querySelector('[data-testid="garage-derived-accuracy"]');
    const garageChip = container!.querySelector('[data-testid="garage-stealth-detect-chip"]');
    expect(garageAcc?.textContent).toContain('Chính xác');
    expect(garageAcc?.textContent).toContain('8%');
    expect(garageChip?.textContent).toContain('Dò tàng hình');
  });

  it('4) equip preview shows delta for accuracy when selecting an unequipped radar item', () => {
    const hunter = generateItemInstance(
      { templateId: 'tpl_rd_hunter', rarity: 'epic', requiredLevel: 1, rollQuality: 50 },
      makeRng(5)
    );
    const pilot = useGameStore.getState().pilot;
    useGameStore.setState({
      pilot: {
        ...pilot,
        inventory: [...pilot.inventory, hunter],
      },
    });

    act(() => {
      root!.render(createElement(GearView));
    });
    expect(container!.querySelector('[data-testid="gear-derived-accuracy"]')).toBeNull();

    const card = container!.querySelector(
      `[data-testid="inv-card-${hunter.instanceId}"]`
    ) as HTMLButtonElement;
    expect(card).not.toBeNull();
    act(() => {
      card.click();
    });

    const previewAcc = container!.querySelector('[data-testid="gear-derived-accuracy"]');
    expect(previewAcc).not.toBeNull();
    expect(previewAcc?.textContent).toContain('8%');
    expect(previewAcc?.textContent).toContain('+8');
    expect(
      container!.querySelector('[data-testid="gear-stealth-detect-chip"]')?.textContent
    ).toContain('Dò tàng hình');
  });

  it('5) cargo tab RADAR is present from EQUIPMENT_SLOTS', () => {
    act(() => {
      root!.render(createElement(GearView));
    });

    const buttons = Array.from(container!.querySelectorAll('button'));
    const radarTab = buttons.find((b) => b.textContent?.includes('RADAR') && b.textContent?.includes('(0)'));
    expect(radarTab).toBeDefined();
  });
});
