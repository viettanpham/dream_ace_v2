// @vitest-environment jsdom
import fs from 'node:fs';
import path from 'node:path';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  attachPerfDocumentListeners,
  PERF_MODE_STORAGE_KEY,
  readPerfMode,
  resolvePerfLevel,
  syncPerfAttribute,
  writePerfMode,
} from '../../utils/perfPrefs';
import { EffectsSettingsPanel } from '../EffectsSettingsPanel';
import { TitleScreen } from '../TitleScreen';

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function mockMatchMedia(reducedMotion: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('prefers-reduced-motion') ? reducedMotion : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

describe('PERF1 performance & low-effects mode', () => {
  let container: HTMLDivElement;
  let root: Root;
  const origMatchMedia = window.matchMedia;
  const origHardwareConcurrency = Object.getOwnPropertyDescriptor(
    navigator,
    'hardwareConcurrency'
  );
  const origHidden = Object.getOwnPropertyDescriptor(Document.prototype, 'hidden');

  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-perf');
    document.documentElement.removeAttribute('data-paused');
    mockMatchMedia(false);
    Object.defineProperty(navigator, 'hardwareConcurrency', {
      configurable: true,
      value: 8,
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-perf');
    document.documentElement.removeAttribute('data-paused');
    window.matchMedia = origMatchMedia;
    if (origHardwareConcurrency) {
      Object.defineProperty(
        navigator,
        'hardwareConcurrency',
        origHardwareConcurrency
      );
    }
    if (origHidden) {
      Object.defineProperty(Document.prototype, 'hidden', origHidden);
    }
  });

  it('1) perfMode persists in localStorage and sets data-perf on <html>', () => {
    act(() => {
      root.render(createElement(TitleScreen));
    });
    expect(document.documentElement.getAttribute('data-perf')).toBe('full');

    const titleBtn = container.querySelector<HTMLButtonElement>(
      '[data-testid="title-perf-mode-btn"]'
    );
    expect(titleBtn).not.toBeNull();

    // auto -> full -> low
    act(() => {
      titleBtn!.click();
    });
    expect(readPerfMode()).toBe('full');
    expect(window.localStorage.getItem(PERF_MODE_STORAGE_KEY)).toBe('full');
    expect(document.documentElement.getAttribute('data-perf')).toBe('full');

    act(() => {
      titleBtn!.click();
    });
    expect(readPerfMode()).toBe('low');
    expect(window.localStorage.getItem(PERF_MODE_STORAGE_KEY)).toBe('low');
    expect(document.documentElement.getAttribute('data-perf')).toBe('low');

    act(() => {
      root.render(createElement(EffectsSettingsPanel));
    });
    const settingsBtn = container.querySelector<HTMLButtonElement>(
      '[data-testid="settings-perf-mode-btn"]'
    );
    expect(settingsBtn).not.toBeNull();
    // low -> auto (8 cores, no reduced-motion -> full)
    act(() => {
      settingsBtn!.click();
    });
    expect(readPerfMode()).toBe('auto');
    expect(document.documentElement.getAttribute('data-perf')).toBe('full');
  });

  it("2) 'auto' resolves from hardwareConcurrency and prefers-reduced-motion", () => {
    writePerfMode('auto');

    mockMatchMedia(false);
    Object.defineProperty(navigator, 'hardwareConcurrency', {
      configurable: true,
      value: 8,
    });
    expect(resolvePerfLevel('auto')).toBe('full');
    expect(syncPerfAttribute()).toBe('full');
    expect(document.documentElement.getAttribute('data-perf')).toBe('full');

    Object.defineProperty(navigator, 'hardwareConcurrency', {
      configurable: true,
      value: 4,
    });
    expect(resolvePerfLevel('auto')).toBe('low');
    expect(syncPerfAttribute()).toBe('low');
    expect(document.documentElement.getAttribute('data-perf')).toBe('low');

    Object.defineProperty(navigator, 'hardwareConcurrency', {
      configurable: true,
      value: 16,
    });
    mockMatchMedia(true);
    expect(resolvePerfLevel('auto')).toBe('low');
    expect(syncPerfAttribute()).toBe('low');
    expect(document.documentElement.getAttribute('data-perf')).toBe('low');
  });

  it('3) hidden tab or window blur sets and clears data-paused on <html>', () => {
    let hiddenValue = false;
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => hiddenValue,
    });

    const detach = attachPerfDocumentListeners();
    try {
      expect(document.documentElement.hasAttribute('data-paused')).toBe(false);

      hiddenValue = true;
      document.dispatchEvent(new Event('visibilitychange'));
      expect(document.documentElement.getAttribute('data-paused')).toBe('true');

      hiddenValue = false;
      document.dispatchEvent(new Event('visibilitychange'));
      expect(document.documentElement.hasAttribute('data-paused')).toBe(false);

      window.dispatchEvent(new Event('blur'));
      expect(document.documentElement.getAttribute('data-paused')).toBe('true');

      window.dispatchEvent(new Event('focus'));
      expect(document.documentElement.hasAttribute('data-paused')).toBe(false);
    } finally {
      detach();
    }
  });

  it('4) TitleScreen has no blur-3xl element and no rotating/hovering SVG child', () => {
    act(() => {
      root.render(createElement(TitleScreen));
    });

    expect(container.querySelector('.blur-3xl')).toBeNull();
    expect(
      container.querySelector(
        'svg .anim-radar, svg.anim-radar, svg.anim-ship-hover-hero, svg .anim-ship-hover-hero, svg.anim-ship-hover, svg .anim-ship-hover'
      )
    ).toBeNull();
    expect(container.querySelector('div.anim-radar')).not.toBeNull();
    expect(container.querySelector('div.anim-ship-hover-hero')).not.toBeNull();
  });

  it('5) low-mode CSS block in index.css disables all infinite-animation selectors', () => {
    const css = fs.readFileSync(
      path.resolve(process.cwd(), 'src/index.css'),
      'utf8'
    );
    const lowBlockStart = css.indexOf('html[data-perf="low"]');
    expect(lowBlockStart).toBeGreaterThan(-1);
    const lowCss = css.slice(lowBlockStart);

    const infiniteSelectors = [
      '.anim-turn-active',
      '.anim-turn-arrow',
      '.anim-ship-hover',
      '.anim-ship-hover-hero',
      '.anim-thruster',
      '.anim-shield-bubble',
      '.anim-radar',
      '.anim-radar-sweep',
      '.anim-radar-star',
      '.anim-token-hover',
      '.anim-reticle-pulse',
      '.anim-raid-pulse',
      '.anim-contested-pulse',
      '.anim-lane-flow',
      '.vfx-html-sweep',
      '.vfx-low-hp-pulse',
      '.animate-pulse',
    ];

    for (const sel of infiniteSelectors) {
      expect(lowCss).toContain(`html[data-perf="low"] ${sel}`);
    }
    expect(lowCss).toContain('animation: none !important;');
    expect(css).toContain('html[data-paused="true"]');
  });
});
