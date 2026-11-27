// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGameStore } from '../../store/useGameStore';
import { AdminPanel } from '../AdminPanel';
import {
  AdminSection,
  AdminSectionsProvider,
  AdminSectionsToolbar,
  getAdminSectionStorageKey,
} from '../admin/AdminSection';

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function setReactInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value'
  )!.set!;
  setter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('TASK ADM-UI1 — Admin CP Battle tab collapsible sections', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    useGameStore.getState().resetCampaign();
    useGameStore.getState().startCampaign('AdminTester', 'striker');
    useGameStore.getState().setLanguage('vi');
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    root = null;
    container?.remove();
    container = null;
  });

  it('1) AdminSection toggles on click and keyboard (Enter / Space) and updates aria-expanded & hidden body', () => {
    act(() => {
      root!.render(
        createElement(
          AdminSection,
          {
            id: 'unit-test',
            title: 'Mục thử nghiệm',
            description: 'Mô tả một dòng',
          },
          createElement('div', { 'data-testid': 'inner-body' }, 'Nội dung')
        )
      );
    });

    const toggle = container!.querySelector<HTMLButtonElement>(
      '[data-testid="admin-section-toggle-unit-test"]'
    )!;
    const body = container!.querySelector<HTMLElement>(
      '[data-testid="admin-section-body-unit-test"]'
    )!;

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(body.classList.contains('hidden')).toBe(true);
    expect(body.hasAttribute('hidden')).toBe(true);

    // Click opens
    act(() => {
      toggle.click();
    });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(body.classList.contains('hidden')).toBe(false);
    expect(body.hasAttribute('hidden')).toBe(false);

    // Enter closes
    act(() => {
      toggle.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
      );
    });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(body.classList.contains('hidden')).toBe(true);

    // Space opens
    act(() => {
      toggle.dispatchEvent(
        new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true })
      );
    });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(body.classList.contains('hidden')).toBe(false);
  });

  it('2) collapse-all closes and expand-all opens every section via AdminSectionsProvider toolbar', () => {
    act(() => {
      root!.render(
        createElement(
          AdminSectionsProvider,
          null,
          createElement(AdminSectionsToolbar, {
            collapseLabel: 'Thu gọn tất cả',
            expandLabel: 'Mở rộng tất cả',
          }),
          createElement(
            AdminSection,
            { id: 'sec-a', title: 'Mục A', defaultOpen: true },
            createElement('span', null, 'A')
          ),
          createElement(
            AdminSection,
            { id: 'sec-b', title: 'Mục B', defaultOpen: false },
            createElement('span', null, 'B')
          )
        )
      );
    });

    const toggleA = () =>
      container!.querySelector<HTMLButtonElement>('[data-testid="admin-section-toggle-sec-a"]')!;
    const toggleB = () =>
      container!.querySelector<HTMLButtonElement>('[data-testid="admin-section-toggle-sec-b"]')!;
    const collapseAllBtn = container!.querySelector<HTMLButtonElement>(
      '[data-testid="admin-collapse-all"]'
    )!;
    const expandAllBtn = container!.querySelector<HTMLButtonElement>(
      '[data-testid="admin-expand-all"]'
    )!;

    expect(toggleA().getAttribute('aria-expanded')).toBe('true');
    expect(toggleB().getAttribute('aria-expanded')).toBe('false');

    act(() => {
      expandAllBtn.click();
    });
    expect(toggleA().getAttribute('aria-expanded')).toBe('true');
    expect(toggleB().getAttribute('aria-expanded')).toBe('true');

    act(() => {
      collapseAllBtn.click();
    });
    expect(toggleA().getAttribute('aria-expanded')).toBe('false');
    expect(toggleB().getAttribute('aria-expanded')).toBe('false');
  });

  it('3) open state survives unmount & remount via sessionStorage under admin.section.<id>', () => {
    const renderTwo = () =>
      createElement(
        AdminSectionsProvider,
        null,
        createElement(
          AdminSection,
          { id: 'first', title: 'First', defaultOpen: true },
          createElement('span', null, '1')
        ),
        createElement(
          AdminSection,
          { id: 'second', title: 'Second', defaultOpen: false },
          createElement('span', null, '2')
        )
      );

    act(() => {
      root!.render(renderTwo());
    });

    // Collapse first, expand second
    act(() => {
      container!
        .querySelector<HTMLButtonElement>('[data-testid="admin-section-toggle-first"]')!
        .click();
      container!
        .querySelector<HTMLButtonElement>('[data-testid="admin-section-toggle-second"]')!
        .click();
    });

    expect(window.sessionStorage.getItem(getAdminSectionStorageKey('first'))).toBe('0');
    expect(window.sessionStorage.getItem(getAdminSectionStorageKey('second'))).toBe('1');

    // Unmount and remount into fresh root
    act(() => {
      root!.unmount();
    });
    root = createRoot(container!);
    act(() => {
      root!.render(renderTwo());
    });

    expect(
      container!
        .querySelector('[data-testid="admin-section-toggle-first"]')!
        .getAttribute('aria-expanded')
    ).toBe('false');
    expect(
      container!
        .querySelector('[data-testid="admin-section-toggle-second"]')!
        .getAttribute('aria-expanded')
    ).toBe('true');
  });

  it('4) battle tab renders all titled sections with first (Quy mô trận) open and known fields still update adminConfig', () => {
    act(() => {
      useGameStore.setState({ adminPanelOpen: true });
      root!.render(createElement(AdminPanel));
    });

    const battleTab = container!.querySelector<HTMLButtonElement>(
      '[data-testid="admin-tab-battle"]'
    )!;
    act(() => {
      battleTab.click();
    });

    const expectedSectionTitles: Array<[string, string, boolean]> = [
      ['battle-size', 'Quy mô trận', true],
      ['cheats', 'Chế độ thử nghiệm', false],
      ['enrage', 'Cuồng nộ (chống trận kéo dài)', false],
      ['passive-slots', 'Ô kỹ năng nội tại', false],
      ['enemy-level', 'Cấp độ kẻ địch', false],
      ['shield-regen', 'Hồi khiên & Phá khiên', false],
      ['npc-supply', 'Vật tư NPC & Quân nhu khu vực', false],
      ['sp-economy', 'Kinh tế SP, Flux & Lidar', false],
      ['turn-phase', 'Lượt 3 bước & Chuẩn bị trận', false],
      ['supply-shop', 'Cửa hàng vật tư', false],
      ['supply-economy', 'Giới hạn vật tư mỗi trận', false],
      ['reward-mult', 'Hệ số phần thưởng', false],
      ['status-defaults', 'Mặc định hiển thị trạng thái', false],
      ['card-popup', 'Popup nổi (Card & Radar)', false],
      ['live-battle', 'Điều khiển trận đang diễn ra', false],
    ];

    for (const [id, title, defaultExpanded] of expectedSectionTitles) {
      const sec = container!.querySelector(`[data-testid="admin-section-${id}"]`);
      const toggle = container!.querySelector(
        `[data-testid="admin-section-toggle-${id}"]`
      );
      expect(sec).not.toBeNull();
      expect(toggle?.textContent).toContain(title);
      expect(toggle?.getAttribute('aria-expanded')).toBe(
        defaultExpanded ? 'true' : 'false'
      );
    }

    // Toolbar controls expand-all / collapse-all inside AdminPanel battle tab
    const expandAll = container!.querySelector<HTMLButtonElement>(
      '[data-testid="admin-expand-all"]'
    )!;
    const collapseAll = container!.querySelector<HTMLButtonElement>(
      '[data-testid="admin-collapse-all"]'
    )!;
    expect(expandAll).not.toBeNull();
    expect(collapseAll).not.toBeNull();

    // Known field inside first open section updates adminConfig
    const skillMaxInput = container!.querySelector<HTMLInputElement>(
      '[data-testid="admin-skill-max-level"]'
    )!;
    expect(skillMaxInput).not.toBeNull();
    act(() => {
      setReactInputValue(skillMaxInput, '12');
    });
    expect(useGameStore.getState().adminConfig.skillMaxLevel).toBe(12);

    // Expanding cheats section & toggling godMode also updates adminConfig
    act(() => {
      expandAll.click();
    });
    expect(
      container!
        .querySelector('[data-testid="admin-section-toggle-cheats"]')!
        .getAttribute('aria-expanded')
    ).toBe('true');
  });
});
