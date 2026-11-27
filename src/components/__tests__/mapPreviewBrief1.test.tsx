// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_ENEMY_LEVEL_CONFIG,
  getEnemyLevelBand,
} from '../../engine/enemyLevel';
import { useGameStore } from '../../store/useGameStore';
import { levelConClass } from '../../utils/levelCon';
import { MapView } from '../MapView';

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe('TASK BRIEF-1 — Battle preview card in the map briefing', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    localStorage.clear();
    useGameStore.getState().resetCampaign();
    useGameStore.getState().startCampaign('Vance', 'striker');
    useGameStore.getState().setLanguage('vi');
    useGameStore.getState().selectSector('border_outpost');

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

  it('1) levelConClass returns the exact Tailwind classes at every threshold', () => {
    expect(levelConClass(5)).toBe('text-red-400');
    expect(levelConClass(8)).toBe('text-red-400');
    expect(levelConClass(4)).toBe('text-orange-400');
    expect(levelConClass(3)).toBe('text-orange-400');
    expect(levelConClass(2)).toBe('text-slate-100');
    expect(levelConClass(0)).toBe('text-slate-100');
    expect(levelConClass(-2)).toBe('text-slate-100');
    expect(levelConClass(-3)).toBe('text-slate-400');
    expect(levelConClass(-4)).toBe('text-slate-400');
    expect(levelConClass(-5)).toBe('text-sky-400');
    expect(levelConClass(-9)).toBe('text-sky-400');
  });

  it('2) getEnemyLevelBand resolves boss, pirate, and mission/event -> assault ranges', () => {
    const bossBand = getEnemyLevelBand('assault', DEFAULT_ENEMY_LEVEL_CONFIG, {
      hasBoss: true,
    });
    expect(bossBand).toEqual({ min: 5, max: 10, mid: 8 });

    const pirateBand = getEnemyLevelBand('event', DEFAULT_ENEMY_LEVEL_CONFIG, {
      sourceId: 'pir_1',
    });
    expect(pirateBand).toEqual({ min: -3, max: 6, mid: 2 });

    const eventBand = getEnemyLevelBand('event', DEFAULT_ENEMY_LEVEL_CONFIG);
    const missionBand = getEnemyLevelBand('mission', DEFAULT_ENEMY_LEVEL_CONFIG);
    expect(eventBand).toEqual({ min: 1, max: 10, mid: 6 });
    expect(missionBand).toEqual({ min: 1, max: 10, mid: 6 });
  });

  it('3) clicking a battle option row opens its inline preview card and a second click closes it', () => {
    useGameStore.getState().selectSector('aegis_relay');
    act(() => {
      root.render(createElement(MapView));
    });

    const patrolRow = container.querySelector<HTMLElement>(
      '[data-testid="map-option-row-patrol"]'
    )!;
    const defendRow = container.querySelector<HTMLElement>(
      '[data-testid="map-option-row-defend"]'
    )!;
    expect(patrolRow.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('[data-testid="map-option-preview-patrol"]')).toBeNull();

    act(() => {
      patrolRow.click();
    });
    expect(patrolRow.getAttribute('aria-expanded')).toBe('true');
    const patrolPreview = container.querySelector(
      '[data-testid="map-option-preview-patrol"]'
    );
    expect(patrolPreview).not.toBeNull();
    expect(patrolPreview?.textContent).toContain('PHE TA:');
    expect(patrolPreview?.textContent).toContain('ĐỊCH:');

    // Clicking another row opens only one at a time
    act(() => {
      defendRow.click();
    });
    expect(patrolRow.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('[data-testid="map-option-preview-patrol"]')).toBeNull();
    expect(defendRow.getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelector('[data-testid="map-option-preview-defend"]')).not.toBeNull();

    // Second click closes it
    act(() => {
      defendRow.click();
    });
    expect(defendRow.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('[data-testid="map-option-preview-defend"]')).toBeNull();
  });

  it('4) clicking the deploy button inside a row launches battle without toggling the preview card', () => {
    act(() => {
      root.render(createElement(MapView));
    });

    const assaultRow = container.querySelector<HTMLElement>(
      '[data-testid="map-option-row-assault"]'
    )!;
    const deployBtn = container.querySelector<HTMLButtonElement>(
      '[data-testid="map-option-deploy-assault"]'
    )!;
    expect(assaultRow.getAttribute('aria-expanded')).toBe('false');

    act(() => {
      deployBtn.click();
    });

    expect(useGameStore.getState().battle?.kind).toBe('assault');
    expect(assaultRow.getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('[data-testid="map-option-preview-assault"]')).toBeNull();
  });
});
