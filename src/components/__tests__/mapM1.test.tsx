// @vitest-environment jsdom
import { createElement, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EN_TRANSLATIONS } from '../../i18n/en';
import { VI_TRANSLATIONS } from '../../i18n/vi';
import { getSectorById } from '../../data/maps';
import { useGameStore } from '../../store/useGameStore';
import {
  clampMapPan,
  clampMapZoom,
  computeInitialPhoneMapView,
  MAP_MIN_PHONE_LABEL_PX,
  MAP_SVG_LABEL_FONT_SIZE,
  MAP_VIEWBOX_HEIGHT,
  MAP_VIEWBOX_WIDTH,
  MapView,
} from '../MapView';

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function setViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  });
  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: height,
  });
  window.dispatchEvent(new Event('resize'));
}

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
  window.localStorage.clear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  useGameStore.setState({
    language: 'vi',
    screen: 'HANGAR',
    activeTab: 'map',
    selectedSectorId: 'border_outpost',
  });
});

afterEach(() => {
  vi.useRealTimers();
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

describe('TASK MAP-M1 — Pure initial phone zoom, centering & pan clamping', () => {
  it('computes initial phone zoom so sector labels are >= 11px on screen and clamps pan inside box bounds', () => {
    const boxW = 364;
    const boxH = 523;
    const baseScale = Math.min(boxW / MAP_VIEWBOX_WIDTH, boxH / MAP_VIEWBOX_HEIGHT);

    // Center target stays centered
    const centerView = computeInitialPhoneMapView({ x: 420, y: 155 }, boxW, boxH);
    const screenLabelPx = MAP_SVG_LABEL_FONT_SIZE * baseScale * centerView.zoom;
    expect(screenLabelPx).toBeGreaterThanOrEqual(MAP_MIN_PHONE_LABEL_PX);
    expect(centerView.zoom).toBeGreaterThan(2);
    expect(centerView.pan.x).toBe(0);
    expect(centerView.pan.y).toBe(0);

    // Edge target shifts pan toward sector without leaving box bounds
    const leftSector = getSectorById('border_outpost');
    const edgeView = computeInitialPhoneMapView(leftSector.mapPos, boxW, boxH);
    const scaledW = MAP_VIEWBOX_WIDTH * baseScale * edgeView.zoom;
    const scaledH = MAP_VIEWBOX_HEIGHT * baseScale * edgeView.zoom;
    expect(Math.abs(edgeView.pan.x)).toBeLessThanOrEqual(
      Math.abs(scaledW - boxW) / 2 + 0.05
    );
    expect(Math.abs(edgeView.pan.y)).toBeLessThanOrEqual(
      Math.abs(scaledH - boxH) / 2 + 0.05
    );
    expect(edgeView.pan.x).not.toBe(0);

    // Extreme pan clamps cleanly
    const clamped = clampMapPan(9999, -9999, edgeView.zoom, boxW, boxH);
    expect(clamped.x).toBeCloseTo(Math.abs(scaledW - boxW) / 2, 1);
    expect(clamped.y).toBeCloseTo(-Math.abs(scaledH - boxH) / 2, 1);
    expect(clampMapZoom(0.1)).toBe(0.75);
    expect(clampMapZoom(10)).toBe(3.2);
  });
});

describe('TASK MAP-M1 — Phone map layout vs Desktop unchanged', () => {
  it('on phone width (390px): compact header with (i) button & no subtitle <p>, zoomed big map with 4s fading hint & bottom-right 40px zoom controls, and sticky action bar calling advanceMonth & startBattle', () => {
    vi.useFakeTimers();
    setViewport(390, 844);

    const advanceSpy = vi.spyOn(useGameStore.getState(), 'advanceMonth');
    const startBattleSpy = vi.spyOn(useGameStore.getState(), 'startBattle');

    act(() => {
      root!.render(createElement(MapView));
    });

    // 1) Compact header (<= 72px), no subtitle <p> inside header, (i) button opens subtitle sheet
    const compactHeader = container!.querySelector(
      '[data-testid="map-compact-header"]'
    ) as HTMLElement;
    expect(compactHeader).not.toBeNull();
    expect(compactHeader.className).toContain('max-h-[72px]');
    expect(
      container!.querySelector('[data-testid="map-desktop-header"]')
    ).toBeNull();
    expect(compactHeader.querySelector('p')).toBeNull();
    expect(compactHeader.textContent).not.toContain(
      VI_TRANSLATIONS['map.pageSubtitle']
    );
    expect(compactHeader.textContent).toContain('CR');
    expect(compactHeader.textContent).toContain('WP');

    const infoBtn = container!.querySelector(
      '[data-testid="map-info-btn"]'
    ) as HTMLButtonElement;
    expect(infoBtn).not.toBeNull();
    expect(infoBtn.className).toContain('w-10');
    expect(infoBtn.className).toContain('h-10');
    expect(container!.querySelector('[data-testid="map-info-subtitle"]')).toBeNull();

    act(() => {
      infoBtn.click();
    });
    const infoSubtitle = container!.querySelector(
      '[data-testid="map-info-subtitle"]'
    );
    expect(infoSubtitle).not.toBeNull();
    expect(infoSubtitle!.textContent).toBe(VI_TRANSLATIONS['map.pageSubtitle']);

    // 2) Big map box height = clamp(360px, 62dvh, 560px), zoomed > 1, 40px bottom-right zoom buttons, bottom-left hint fades after 4s
    const mapBox = container!.querySelector(
      '[data-testid="map-viewport-box"]'
    ) as HTMLElement;
    expect(mapBox.style.height).toBe('clamp(360px, 62dvh, 560px)');
    const mapSvg = mapBox.querySelector('svg[role="img"]') as SVGSVGElement;
    expect(mapSvg.style.transform).not.toContain('scale(1)');

    const zoomControls = container!.querySelector(
      '[data-testid="map-zoom-controls"]'
    ) as HTMLElement;
    expect(zoomControls.className).toContain('bottom-2');
    expect(zoomControls.className).toContain('right-2');
    const zoomButtons = Array.from(zoomControls.querySelectorAll('button'));
    expect(zoomButtons).toHaveLength(3);
    for (const btn of zoomButtons) {
      expect(btn.className).toContain('min-w-[40px]');
      expect(btn.className).toContain('min-h-[40px]');
    }

    // Zoom in then reset returns to initial phone transform
    const initialTransform = mapSvg.style.transform;
    act(() => {
      zoomButtons[0].click();
    });
    expect(mapSvg.style.transform).not.toBe(initialTransform);
    act(() => {
      zoomButtons[2].click();
    });
    expect(mapSvg.style.transform).toBe(initialTransform);

    // Hint sits bottom-left and fades via CSS opacity after 4s (no unmount / no layout shift)
    const hint = container!.querySelector(
      '[data-testid="map-pan-hint"]'
    ) as HTMLElement;
    expect(hint.className).toContain('bottom-2');
    expect(hint.className).toContain('left-2');
    expect(hint.getAttribute('data-hint-faded')).toBe('false');
    expect(hint.className).toContain('opacity-100');

    act(() => {
      vi.advanceTimersByTime(4050);
    });
    expect(hint.getAttribute('data-hint-faded')).toBe('true');
    expect(hint.className).toContain('opacity-0');

    // 3) Sticky bottom action bar with 2 x 44px buttons calling advanceMonth & startBattle
    const actionBar = container!.querySelector(
      '[data-testid="map-phone-action-bar"]'
    ) as HTMLElement;
    expect(actionBar).not.toBeNull();
    expect(actionBar.className).toContain('sticky');
    expect(actionBar.className).toContain('bottom-0');

    const advBtn = container!.querySelector(
      '[data-testid="map-phone-advance-btn"]'
    ) as HTMLButtonElement;
    const deployBtn = container!.querySelector(
      '[data-testid="map-phone-deploy-btn"]'
    ) as HTMLButtonElement;
    expect(advBtn.className).toContain('min-h-[44px]');
    expect(deployBtn.className).toContain('min-h-[44px]');
    expect(advBtn.textContent).toBe(VI_TRANSLATIONS['map.advanceMonthShort']);
    expect(deployBtn.textContent).toContain(VI_TRANSLATIONS['map.deployShort']);
    expect(deployBtn.textContent).toContain('Lv.');
    expect(deployBtn.getAttribute('title')).toContain('Lv.');

    const selectedId = useGameStore.getState().selectedSectorId;
    act(() => {
      advBtn.click();
    });
    expect(advanceSpy).toHaveBeenCalledTimes(1);

    act(() => {
      deployBtn.click();
    });
    expect(startBattleSpy).toHaveBeenCalledTimes(1);
    expect(startBattleSpy).toHaveBeenCalledWith(selectedId);
  });

  it('on desktop width (1280px): keeps full desktop header with long labels, zoom 1, and no phone sticky bar; i18n short keys exist in vi & en', () => {
    setViewport(1280, 800);
    act(() => {
      root!.render(createElement(MapView));
    });

    const desktopHeader = container!.querySelector(
      '[data-testid="map-desktop-header"]'
    ) as HTMLElement;
    expect(desktopHeader).not.toBeNull();
    expect(
      container!.querySelector('[data-testid="map-compact-header"]')
    ).toBeNull();
    expect(
      container!.querySelector('[data-testid="map-phone-action-bar"]')
    ).toBeNull();
    expect(desktopHeader.textContent).toContain(
      VI_TRANSLATIONS['map.pageSubtitle']
    );
    expect(desktopHeader.textContent).toContain(
      VI_TRANSLATIONS['map.advanceMonth']
    );
    expect(desktopHeader.textContent).toContain(
      VI_TRANSLATIONS['hangar.deploySquad']
    );

    const mapSvg = container!.querySelector(
      '[data-testid="map-viewport-box"] svg[role="img"]'
    ) as SVGSVGElement;
    expect(mapSvg.style.transform).toContain('scale(1)');

    for (const k of [
      'map.advanceMonthShort',
      'map.deployShort',
      'map.monthlyTotalShort',
      'map.infoBtnAria',
    ] as const) {
      expect(VI_TRANSLATIONS[k]).toBeTruthy();
      expect(EN_TRANSLATIONS[k]).toBeTruthy();
    }
  });
});
