import type {
  AdminConfig,
  VoucherConfig,
  VoucherDef,
  VoucherKind,
  VoucherOverride,
  VoucherShopListing,
  VoucherWeightMode,
} from '../types/game';
import rawVouchersData from './vouchers.json';

function isValidSystemVoucher(raw: unknown): raw is VoucherDef {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  const obj = raw as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    obj.id.trim().length > 0 &&
    (obj.kind === 'credit' || obj.kind === 'exp') &&
    typeof obj.value === 'number' &&
    Number.isFinite(obj.value) &&
    obj.value > 0 &&
    obj.system === true
  );
}

export const SYSTEM_VOUCHERS: readonly VoucherDef[] = Array.isArray(
  rawVouchersData
)
  ? (rawVouchersData as unknown[])
      .filter(isValidSystemVoucher)
      .map(
        (v): VoucherDef => ({
          id: v.id.trim(),
          kind: v.kind,
          value: Math.round(v.value),
          system: true,
        })
      )
  : [];

export const SYSTEM_VOUCHERS_BY_ID: Record<string, VoucherDef> =
  SYSTEM_VOUCHERS.reduce((acc, v) => {
    acc[v.id] = v;
    return acc;
  }, {} as Record<string, VoucherDef>);

export const DEFAULT_VOUCHER_CONFIG: VoucherConfig = {
  creditPerWp: 100,
  expPerWp: 100,
  mode: 'tierDecay',
  baseWeight: 100,
  tierDecayPct: 30,
  typesPerRoll: 8,
  overrides: {},
  custom: [],
};

export function cloneVoucherConfig(cfg: VoucherConfig): VoucherConfig {
  const overrides: Record<string, VoucherOverride> = {};
  for (const [k, v] of Object.entries(cfg.overrides)) {
    overrides[k] = { ...v };
  }
  return {
    creditPerWp: cfg.creditPerWp,
    expPerWp: cfg.expPerWp,
    mode: cfg.mode,
    baseWeight: cfg.baseWeight,
    tierDecayPct: cfg.tierDecayPct,
    typesPerRoll: cfg.typesPerRoll,
    overrides,
    custom: cfg.custom.map((c) => ({ ...c })),
  };
}

function sanitizeCustomVoucher(
  raw: unknown,
  seenIds: Set<string>
): VoucherDef | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const id = typeof obj.id === 'string' ? obj.id.trim() : '';
  if (!id || SYSTEM_VOUCHERS_BY_ID[id] || seenIds.has(id)) return null;
  const kind: VoucherKind | null =
    obj.kind === 'credit' || obj.kind === 'exp' ? obj.kind : null;
  if (!kind) return null;
  const rawVal = Number(obj.value);
  if (!Number.isFinite(rawVal) || rawVal < 1) return null;
  const value = Math.max(1, Math.round(rawVal));
  const rawWeight = Number(obj.weight);
  const weight =
    Number.isFinite(rawWeight) && rawWeight >= 0 ? rawWeight : 100;
  const rawMaxStock = Number(obj.maxStock);
  const maxStock =
    Number.isFinite(rawMaxStock) && rawMaxStock >= 1
      ? Math.max(1, Math.round(rawMaxStock))
      : 1;
  seenIds.add(id);
  return {
    id,
    kind,
    value,
    system: false,
    weight,
    maxStock,
  };
}

export function sanitizeVoucherConfig(raw: unknown): VoucherConfig {
  const obj =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  const rawCreditPerWp = Number(obj.creditPerWp);
  const creditPerWp =
    typeof obj.creditPerWp === 'number' &&
    Number.isFinite(rawCreditPerWp) &&
    rawCreditPerWp >= 1
      ? Math.max(1, Math.round(rawCreditPerWp))
      : DEFAULT_VOUCHER_CONFIG.creditPerWp;

  const rawExpPerWp = Number(obj.expPerWp);
  const expPerWp =
    typeof obj.expPerWp === 'number' &&
    Number.isFinite(rawExpPerWp) &&
    rawExpPerWp >= 1
      ? Math.max(1, Math.round(rawExpPerWp))
      : DEFAULT_VOUCHER_CONFIG.expPerWp;

  const mode: VoucherWeightMode =
    obj.mode === 'perType' || obj.mode === 'tierDecay'
      ? obj.mode
      : DEFAULT_VOUCHER_CONFIG.mode;

  const rawBaseWeight = Number(obj.baseWeight);
  const baseWeight =
    typeof obj.baseWeight === 'number' && Number.isFinite(rawBaseWeight)
      ? Math.max(0, rawBaseWeight)
      : DEFAULT_VOUCHER_CONFIG.baseWeight;

  const rawDecay = Number(obj.tierDecayPct);
  const tierDecayPct =
    typeof obj.tierDecayPct === 'number' && Number.isFinite(rawDecay)
      ? Math.max(0, Math.min(100, rawDecay))
      : DEFAULT_VOUCHER_CONFIG.tierDecayPct;

  const rawTypes = Number(obj.typesPerRoll);
  const typesPerRoll =
    typeof obj.typesPerRoll === 'number' && Number.isFinite(rawTypes)
      ? Math.max(0, Math.round(rawTypes))
      : DEFAULT_VOUCHER_CONFIG.typesPerRoll;

  const seenCustomIds = new Set<string>();
  const custom: VoucherDef[] = [];
  if (Array.isArray(obj.custom)) {
    for (const entry of obj.custom) {
      const cleaned = sanitizeCustomVoucher(entry, seenCustomIds);
      if (cleaned) custom.push(cleaned);
    }
  }

  const validIds = new Set<string>([
    ...SYSTEM_VOUCHERS.map((v) => v.id),
    ...custom.map((v) => v.id),
  ]);

  const overrides: Record<string, VoucherOverride> = {};
  if (
    obj.overrides &&
    typeof obj.overrides === 'object' &&
    !Array.isArray(obj.overrides)
  ) {
    for (const [id, rawOv] of Object.entries(
      obj.overrides as Record<string, unknown>
    )) {
      if (!validIds.has(id)) continue;
      if (!rawOv || typeof rawOv !== 'object' || Array.isArray(rawOv)) continue;
      const ovObj = rawOv as Record<string, unknown>;
      const cleanedOv: VoucherOverride = {};
      if (
        typeof ovObj.weight === 'number' &&
        Number.isFinite(ovObj.weight)
      ) {
        cleanedOv.weight = Math.max(0, ovObj.weight);
      }
      if (
        typeof ovObj.maxStock === 'number' &&
        Number.isFinite(ovObj.maxStock)
      ) {
        cleanedOv.maxStock = Math.max(1, Math.round(ovObj.maxStock));
      }
      if (
        cleanedOv.weight !== undefined ||
        cleanedOv.maxStock !== undefined
      ) {
        overrides[id] = cleanedOv;
      }
    }
  }

  return {
    creditPerWp,
    expPerWp,
    mode,
    baseWeight,
    tierDecayPct,
    typesPerRoll,
    overrides,
    custom,
  };
}

export function resolveVoucherConfig(
  cfgOrAdmin?: VoucherConfig | AdminConfig | null
): VoucherConfig {
  if (
    cfgOrAdmin &&
    typeof cfgOrAdmin === 'object' &&
    ('vouchers' in cfgOrAdmin || 'rewardMultiplier' in cfgOrAdmin)
  ) {
    return sanitizeVoucherConfig((cfgOrAdmin as AdminConfig).vouchers);
  }
  return sanitizeVoucherConfig(cfgOrAdmin);
}

export function getAllVouchers(
  cfgOrAdmin?: VoucherConfig | AdminConfig | null
): VoucherDef[] {
  const cfg = resolveVoucherConfig(cfgOrAdmin);
  return [...SYSTEM_VOUCHERS, ...cfg.custom];
}

export function getVoucherById(
  id: string,
  cfgOrAdmin?: VoucherConfig | AdminConfig | null
): VoucherDef | undefined {
  if (SYSTEM_VOUCHERS_BY_ID[id]) return SYSTEM_VOUCHERS_BY_ID[id];
  const cfg = resolveVoucherConfig(cfgOrAdmin);
  return cfg.custom.find((c) => c.id === id);
}

export function getNextCustomVoucherId(
  custom: readonly VoucherDef[]
): string {
  let maxN = 0;
  for (const c of custom) {
    const m = /^v_custom_(\d+)$/.exec(c.id);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n > maxN) maxN = n;
    }
  }
  return `v_custom_${maxN + 1}`;
}

export function getVoucherPriceWp(
  def: Pick<VoucherDef, 'kind' | 'value'>,
  cfgOrAdmin?: VoucherConfig | AdminConfig | null
): number {
  const cfg = resolveVoucherConfig(cfgOrAdmin);
  const ratio = def.kind === 'credit' ? cfg.creditPerWp : cfg.expPerWp;
  const safeRatio = Math.max(1, ratio);
  return Math.max(1, Math.round(def.value / safeRatio));
}

export function getVoucherDefaultMaxStock(def: Pick<VoucherDef, 'id' | 'kind' | 'value' | 'system' | 'maxStock'>): number {
  if (def.system === false && typeof def.maxStock === 'number') {
    return Math.max(1, Math.round(def.maxStock));
  }
  const sameKind = SYSTEM_VOUCHERS.filter((v) => v.kind === def.kind).sort(
    (a, b) => a.value - b.value || a.id.localeCompare(b.id)
  );
  const rank = sameKind.findIndex((v) => v.id === def.id);
  if (rank < 0) {
    return typeof def.maxStock === 'number'
      ? Math.max(1, Math.round(def.maxStock))
      : 1;
  }
  if (rank < 3) return 5;
  if (rank < Math.max(3, sameKind.length - 3)) return 3;
  return 1;
}

export function getVoucherMaxStock(
  def: VoucherDef,
  cfgOrAdmin?: VoucherConfig | AdminConfig | null
): number {
  const cfg = resolveVoucherConfig(cfgOrAdmin);
  const ov = cfg.overrides[def.id];
  if (ov && typeof ov.maxStock === 'number') {
    return Math.max(1, Math.round(ov.maxStock));
  }
  if (def.system === false && typeof def.maxStock === 'number') {
    return Math.max(1, Math.round(def.maxStock));
  }
  return getVoucherDefaultMaxStock(def);
}

export function getVoucherWeights(
  cfgOrAdmin?: VoucherConfig | AdminConfig | null
): Record<string, number> {
  const cfg = resolveVoucherConfig(cfgOrAdmin);
  const all = getAllVouchers(cfg);
  const weights: Record<string, number> = {};

  if (cfg.mode === 'perType') {
    for (const v of all) {
      const ov = cfg.overrides[v.id];
      const w =
        ov && typeof ov.weight === 'number'
          ? ov.weight
          : typeof v.weight === 'number'
            ? v.weight
            : 100;
      weights[v.id] = Math.max(0, w);
    }
    return weights;
  }

  // mode === 'tierDecay': within each kind rank vouchers by value ascending;
  // lowest = baseWeight, each higher rank *= (1 - tierDecayPct / 100).
  // Override weight wins in both modes.
  const decayMult = Math.max(0, 1 - cfg.tierDecayPct / 100);
  for (const kind of ['credit', 'exp'] as const) {
    const ranked = all
      .filter((v) => v.kind === kind)
      .sort(
        (a, b) =>
          a.value - b.value ||
          (Boolean(a.system) === Boolean(b.system)
            ? 0
            : a.system
              ? -1
              : 1) ||
          a.id.localeCompare(b.id)
      );
    for (let rank = 0; rank < ranked.length; rank++) {
      const v = ranked[rank];
      const ov = cfg.overrides[v.id];
      if (ov && typeof ov.weight === 'number') {
        weights[v.id] = Math.max(0, ov.weight);
      } else {
        weights[v.id] = Math.max(
          0,
          cfg.baseWeight * Math.pow(decayMult, rank)
        );
      }
    }
  }

  return weights;
}

export function sanitizeOwnedVouchers(
  raw: unknown,
  cfgOrAdmin?: VoucherConfig | AdminConfig | null
): Record<string, number> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }
  const validIds = new Set(getAllVouchers(cfgOrAdmin).map((v) => v.id));
  const clean: Record<string, number> = {};
  for (const [id, qty] of Object.entries(raw as Record<string, unknown>)) {
    if (!validIds.has(id)) continue;
    const n = typeof qty === 'number' ? qty : Number(qty);
    if (!Number.isFinite(n)) continue;
    clean[id] = Math.max(0, Math.floor(n));
  }
  return clean;
}

export function sanitizeVoucherShopStockWp(
  rawStock: unknown,
  cfgOrAdmin?: VoucherConfig | AdminConfig | null
): VoucherShopListing[] {
  if (!Array.isArray(rawStock)) return [];
  const validIds = new Set(getAllVouchers(cfgOrAdmin).map((v) => v.id));
  const seen = new Set<string>();
  const clean: VoucherShopListing[] = [];

  for (const entry of rawStock) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const rawId = (entry as { voucherId?: unknown }).voucherId;
    const voucherId = typeof rawId === 'string' ? rawId.trim() : '';
    if (!voucherId || !validIds.has(voucherId) || seen.has(voucherId)) {
      continue;
    }
    seen.add(voucherId);
    const rawRem = Number((entry as { remaining?: unknown }).remaining);
    const remaining = Number.isFinite(rawRem)
      ? Math.max(0, Math.floor(rawRem))
      : 0;
    clean.push({ voucherId, remaining });
  }

  return clean;
}
