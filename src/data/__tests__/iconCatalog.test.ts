import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import rawIconCatalog from '../iconCatalog.json';
import {
  FORBIDDEN_ICON_SYMBOLS,
  getCatalog,
  getCatalogRow,
  ICON_CATALOG_GROUPS,
  validateIconCatalog,
} from '../iconCatalog';
import {
  createDefaultAdminConfig,
  CURRENT_SAVE_VERSION,
  createFreshCampaignState,
  migrateSaveData,
} from '../../engine/migration';
import type { AdminConfig } from '../../types/game';

describe('iconCatalog data & loader (G4a-1 part 1)', () => {
  it('JSON has exactly 98 sys rows, unique ids, expected group counts, kind counts, and composite SS12 layers', () => {
    expect(Array.isArray(rawIconCatalog)).toBe(true);
    expect(rawIconCatalog).toHaveLength(98);

    const ids = new Set<string>();
    const groupCounts: Record<string, number> = {};
    const kindCounts: Record<string, number> = {};

    for (const row of rawIconCatalog) {
      expect(row.tag).toBe('sys');
      expect(ids.has(row.id)).toBe(false);
      ids.add(row.id);

      groupCounts[row.group] = (groupCounts[row.group] ?? 0) + 1;
      kindCounts[row.kind] = (kindCounts[row.kind] ?? 0) + 1;
    }

    expect(groupCounts).toEqual({
      BS: 6,
      SS: 16,
      BF: 20,
      DB: 11,
      DT: 6,
      CC: 13,
      EV: 16,
      RW: 10,
    });

    expect(kindCounts).toEqual({
      normal: 54,
      buff: 20,
      debuff: 24,
    });

    const ss12 = rawIconCatalog.find((row) => row.id === 'SS12');
    expect(ss12).toBeDefined();
    expect('symbol' in (ss12 ?? {})).toBe(false);
    expect(ss12?.layers).toEqual([
      { symbol: 'remove_moderator', color: '#378ADD', opacity: 0.5 },
      { symbol: 'east', color: '#EF9F27', opacity: 1 },
    ]);
  });

  it('every symbol and layer symbol exists in @material-symbols/font-400/index.d.ts and no forbidden symbol appears', () => {
    const fontDtsPath = path.resolve(
      process.cwd(),
      'node_modules/@material-symbols/font-400/index.d.ts'
    );
    const fontDts = fs.readFileSync(fontDtsPath, 'utf8');
    const forbidden = new Set<string>(FORBIDDEN_ICON_SYMBOLS);

    const catalog = getCatalog();
    expect(catalog).toHaveLength(98);

    for (const row of catalog) {
      const symbols = row.layers
        ? row.layers.map((layer) => layer.symbol)
        : row.symbol
        ? [row.symbol]
        : [];
      expect(symbols.length).toBeGreaterThan(0);

      for (const sym of symbols) {
        expect(forbidden.has(sym)).toBe(false);
        expect(fontDts).toContain(`"${sym}"`);
      }
    }
  });

  it('rejects duplicate id, bad kind, bad hex, forbidden symbol, and group mismatch with clear errors', () => {
    const sample = {
      id: 'BS01',
      nameVi: 'Test',
      group: 'BS',
      symbol: 'swords',
      color: '#EF9F27',
      kind: 'normal',
      tag: 'sys',
    };

    expect(() => validateIconCatalog([sample, { ...sample }])).toThrow(
      /duplicate id/i
    );
    expect(() =>
      validateIconCatalog([{ ...sample, kind: 'curse' }])
    ).toThrow(/invalid kind/i);
    expect(() =>
      validateIconCatalog([{ ...sample, color: 'EF9F27' }])
    ).toThrow(/invalid hex color/i);
    expect(() =>
      validateIconCatalog([{ ...sample, symbol: 'radioactive' }])
    ).toThrow(/forbidden symbol/i);
    expect(() =>
      validateIconCatalog([{ ...sample, symbol: 'gpp_good' }])
    ).toThrow(/forbidden symbol/i);
    expect(() =>
      validateIconCatalog([{ ...sample, id: 'BF01', group: 'BS' }])
    ).toThrow(/does not match id prefix/i);
  });

  it('returns 98 sys rows when no mods provided and merges append/override mods rows cleanly', () => {
    const base = getCatalog();
    expect(base).toHaveLength(98);
    expect(base.every((r) => r.tag === 'sys')).toBe(true);
    expect(ICON_CATALOG_GROUPS).toHaveLength(8);
    expect(getCatalogRow('SS12')?.layers).toHaveLength(2);

    const merged = getCatalog([
      {
        id: 'BS01',
        nameVi: 'Công kích tùy chỉnh',
        symbol: 'bolt',
        color: '#1D9E75',
      },
      {
        id: 'BF99',
        nameVi: 'Siêu tập trung',
        group: 'BF',
        symbol: 'center_focus_strong',
        color: '#1D9E75',
        kind: 'buff',
      },
    ]);

    expect(merged).toHaveLength(99);

    const overridden = merged.find((r) => r.id === 'BS01');
    expect(overridden).toMatchObject({
      id: 'BS01',
      nameVi: 'Công kích tùy chỉnh',
      symbol: 'bolt',
      color: '#1D9E75',
      kind: 'normal',
      tag: 'mods',
    });

    const appended = merged.find((r) => r.id === 'BF99');
    expect(appended).toMatchObject({
      id: 'BF99',
      nameVi: 'Siêu tập trung',
      group: 'BF',
      symbol: 'center_focus_strong',
      color: '#1D9E75',
      kind: 'buff',
      tag: 'mods',
    });
  });

  it('keeps CURRENT_SAVE_VERSION = 9 and loads old AdminConfig without iconCatalogMods', () => {
    expect(CURRENT_SAVE_VERSION).toBe(10);

    const oldAdmin = { ...createDefaultAdminConfig() } as Partial<AdminConfig>;
    delete oldAdmin.iconCatalogMods;

    expect(getCatalog(oldAdmin.iconCatalogMods)).toHaveLength(98);

    const fresh = createFreshCampaignState('Vance', 'striker');
    const migrated = migrateSaveData(
      {
        ...fresh,
        adminConfig: oldAdmin as AdminConfig,
      },
      CURRENT_SAVE_VERSION
    );
    expect(migrated.adminConfig.iconCatalogMods).toEqual([]);
    expect(getCatalog(migrated.adminConfig.iconCatalogMods)).toHaveLength(98);
  });
});
