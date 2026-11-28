import type {
  ActiveBuffEntry,
  AdminConfig,
  BuffCardKind,
  BuffCardsConfig,
  BuffCardsShopConfig,
} from '../types/game';

export const BUFF_CARD_KINDS: readonly BuffCardKind[] = [
  'exp',
  'max_hp',
  'max_shield',
  'max_sp',
  'attack',
  'defense',
  'dodge',
] as const;

export const BUFF_CARD_ICON_IDS: Record<BuffCardKind, string> = {
  exp: 'RW02',
  max_hp: 'SS01',
  max_shield: 'BS05',
  max_sp: 'SS02',
  attack: 'BF02',
  defense: 'BF03',
  dodge: 'BF04',
};

export const BUFF_CARD_MAX_STOCK = 99999;

export const DEFAULT_BUFF_CARDS_TIERS: Record<BuffCardKind, number[]> = {
  exp: [50, 100, 150, 200, 250, 300],
  max_hp: [5, 10, 15, 20, 25],
  max_shield: [30, 35, 40, 45, 50],
  max_sp: [5, 10, 15, 20, 25],
  attack: [30, 40, 60, 80, 100],
  defense: [10, 20, 30, 40, 50],
  dodge: [3, 6, 9, 12, 15],
};

export const DEFAULT_BUFF_CARDS_WP_PRICE: Record<BuffCardKind, number[]> = {
  exp: [50, 100, 200, 300, 400, 500],
  max_hp: [100, 200, 300, 400, 500],
  max_shield: [100, 200, 300, 400, 500],
  max_sp: [100, 200, 300, 400, 500],
  attack: [100, 200, 300, 400, 500],
  defense: [100, 200, 300, 400, 500],
  dodge: [100, 200, 300, 400, 500],
};

export const DEFAULT_BUFF_CARDS_CONFIG: BuffCardsConfig = {
  battlesPerCard: 3,
  maxStackBattles: 30,
  tiers: {
    exp: [...DEFAULT_BUFF_CARDS_TIERS.exp],
    max_hp: [...DEFAULT_BUFF_CARDS_TIERS.max_hp],
    max_shield: [...DEFAULT_BUFF_CARDS_TIERS.max_shield],
    max_sp: [...DEFAULT_BUFF_CARDS_TIERS.max_sp],
    attack: [...DEFAULT_BUFF_CARDS_TIERS.attack],
    defense: [...DEFAULT_BUFF_CARDS_TIERS.defense],
    dodge: [...DEFAULT_BUFF_CARDS_TIERS.dodge],
  },
  wpPrice: {
    exp: [...DEFAULT_BUFF_CARDS_WP_PRICE.exp],
    max_hp: [...DEFAULT_BUFF_CARDS_WP_PRICE.max_hp],
    max_shield: [...DEFAULT_BUFF_CARDS_WP_PRICE.max_shield],
    max_sp: [...DEFAULT_BUFF_CARDS_WP_PRICE.max_sp],
    attack: [...DEFAULT_BUFF_CARDS_WP_PRICE.attack],
    defense: [...DEFAULT_BUFF_CARDS_WP_PRICE.defense],
    dodge: [...DEFAULT_BUFF_CARDS_WP_PRICE.dodge],
  },
  priceMult: 1,
  shop: {
    baseRatePct: 3,
    decayPctPerTier: 0.5,
    minRatePct: 0.5,
  },
};

export interface BuffCardDefinition {
  id: string;
  kind: BuffCardKind;
  tier: number;
  iconId: string;
}

export function isValidBuffCardKind(kind: unknown): kind is BuffCardKind {
  return (
    typeof kind === 'string' &&
    (BUFF_CARD_KINDS as readonly string[]).includes(kind)
  );
}

export function getBuffCardTiersRange(kind: BuffCardKind): number[] {
  return kind === 'exp' ? [0, 1, 2, 3, 4, 5] : [1, 2, 3, 4, 5];
}

export function getBuffCardId(kind: BuffCardKind, tier: number): string {
  return `bcard_${kind}_t${tier}`;
}

export function parseBuffCardId(
  cardId: unknown
): { kind: BuffCardKind; tier: number } | null {
  if (typeof cardId !== 'string') return null;
  const match = /^bcard_(exp|max_hp|max_shield|max_sp|attack|defense|dodge)_t(\d+)$/.exec(
    cardId.trim()
  );
  if (!match) return null;
  const kind = match[1] as BuffCardKind;
  const tier = Number(match[2]);
  if (!Number.isInteger(tier)) return null;
  const validTiers = getBuffCardTiersRange(kind);
  if (!validTiers.includes(tier)) return null;
  return { kind, tier };
}

export const BUFF_CARD_LIST: BuffCardDefinition[] = BUFF_CARD_KINDS.flatMap((kind) =>
  getBuffCardTiersRange(kind).map((tier) => ({
    id: getBuffCardId(kind, tier),
    kind,
    tier,
    iconId: BUFF_CARD_ICON_IDS[kind],
  }))
);

export const BUFF_CARD_BY_ID: Record<string, BuffCardDefinition> = Object.fromEntries(
  BUFF_CARD_LIST.map((def) => [def.id, def])
);

export function getBuffCardDef(cardId: unknown): BuffCardDefinition | null {
  if (typeof cardId !== 'string') return null;
  return BUFF_CARD_BY_ID[cardId.trim()] ?? null;
}

function clampNum(value: unknown, min: number, max: number, fallback: number): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, num));
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, Math.min(max, Math.round(num)));
}

export function cloneBuffCardsConfig(
  src: BuffCardsConfig = DEFAULT_BUFF_CARDS_CONFIG
): BuffCardsConfig {
  const tiers = {} as Record<BuffCardKind, number[]>;
  const wpPrice = {} as Record<BuffCardKind, number[]>;
  for (const kind of BUFF_CARD_KINDS) {
    tiers[kind] = [...(src.tiers[kind] ?? DEFAULT_BUFF_CARDS_TIERS[kind])];
    wpPrice[kind] = [...(src.wpPrice[kind] ?? DEFAULT_BUFF_CARDS_WP_PRICE[kind])];
  }
  return {
    battlesPerCard: src.battlesPerCard,
    maxStackBattles: src.maxStackBattles,
    tiers,
    wpPrice,
    priceMult: src.priceMult,
    shop: { ...src.shop },
  };
}

export function sanitizeBuffCardsConfig(raw: unknown): BuffCardsConfig {
  const src =
    raw && typeof raw === 'object' ? (raw as Partial<BuffCardsConfig>) : {};
  const defaults = DEFAULT_BUFF_CARDS_CONFIG;

  const battlesPerCard = clampInt(src.battlesPerCard, 1, 20, defaults.battlesPerCard);
  const maxStackBattles = clampInt(
    src.maxStackBattles,
    1,
    200,
    defaults.maxStackBattles
  );
  const priceMult =
    Math.round(clampNum(src.priceMult, 0.1, 20, defaults.priceMult) * 100) / 100;

  const rawShop =
    src.shop && typeof src.shop === 'object'
      ? (src.shop as Partial<BuffCardsShopConfig>)
      : {};
  const baseRatePct = clampNum(rawShop.baseRatePct, 0, 100, defaults.shop.baseRatePct);
  const decayPctPerTier = clampNum(
    rawShop.decayPctPerTier,
    0,
    100,
    defaults.shop.decayPctPerTier
  );
  const minRatePct = clampNum(
    rawShop.minRatePct,
    0,
    baseRatePct,
    Math.min(baseRatePct, defaults.shop.minRatePct)
  );

  const rawTiers =
    src.tiers && typeof src.tiers === 'object'
      ? (src.tiers as Partial<Record<BuffCardKind, unknown>>)
      : {};
  const rawWpPrice =
    src.wpPrice && typeof src.wpPrice === 'object'
      ? (src.wpPrice as Partial<Record<BuffCardKind, unknown>>)
      : {};

  const tiers = {} as Record<BuffCardKind, number[]>;
  const wpPrice = {} as Record<BuffCardKind, number[]>;

  for (const kind of BUFF_CARD_KINDS) {
    const defTiers = defaults.tiers[kind];
    const defWp = defaults.wpPrice[kind];
    const arrTiers = Array.isArray(rawTiers[kind]) ? (rawTiers[kind] as unknown[]) : [];
    const arrWp = Array.isArray(rawWpPrice[kind])
      ? (rawWpPrice[kind] as unknown[])
      : [];
    const maxPct = kind === 'dodge' ? 45 : 500;
    tiers[kind] = defTiers.map((defVal, idx) =>
      clampNum(arrTiers[idx], 0, maxPct, defVal)
    );
    wpPrice[kind] = defWp.map((defVal, idx) =>
      clampInt(arrWp[idx], 1, 999999, defVal)
    );
  }

  return {
    battlesPerCard,
    maxStackBattles,
    tiers,
    wpPrice,
    priceMult,
    shop: {
      baseRatePct,
      decayPctPerTier,
      minRatePct,
    },
  };
}

export function resolveBuffCardsConfig(
  cfgOrAdmin?: BuffCardsConfig | Partial<AdminConfig> | null
): BuffCardsConfig {
  if (!cfgOrAdmin) return DEFAULT_BUFF_CARDS_CONFIG;
  if ('tiers' in cfgOrAdmin && 'battlesPerCard' in cfgOrAdmin) {
    return sanitizeBuffCardsConfig(cfgOrAdmin);
  }
  const admin = cfgOrAdmin as Partial<AdminConfig>;
  return admin.buffCards
    ? sanitizeBuffCardsConfig(admin.buffCards)
    : DEFAULT_BUFF_CARDS_CONFIG;
}

export function getBuffCardRatePct(
  tier: number,
  shopCfg?: Partial<BuffCardsShopConfig> | null
): number {
  const def = DEFAULT_BUFF_CARDS_CONFIG.shop;
  const base = clampNum(shopCfg?.baseRatePct, 0, 100, def.baseRatePct);
  const decay = clampNum(shopCfg?.decayPctPerTier, 0, 100, def.decayPctPerTier);
  const min = clampNum(shopCfg?.minRatePct, 0, base, Math.min(base, def.minRatePct));
  const t = Number.isFinite(tier) ? Math.max(0, tier) : 0;
  return Math.max(min, Math.min(base, base - decay * t));
}

export function getBuffCardTierIndex(kind: BuffCardKind, tier: number): number {
  return kind === 'exp' ? tier : tier - 1;
}

export function getBuffCardPercent(
  kind: BuffCardKind,
  tier: number,
  cfgOrAdmin?: BuffCardsConfig | Partial<AdminConfig> | null
): number {
  const cfg = resolveBuffCardsConfig(cfgOrAdmin);
  const arr = cfg.tiers[kind];
  const idx = getBuffCardTierIndex(kind, tier);
  if (!arr || idx < 0 || idx >= arr.length) return 0;
  return arr[idx] ?? 0;
}

export function getBuffCardWpPrice(
  kind: BuffCardKind,
  tier: number,
  cfgOrAdmin?: BuffCardsConfig | Partial<AdminConfig> | null
): number {
  const cfg = resolveBuffCardsConfig(cfgOrAdmin);
  const arr = cfg.wpPrice[kind];
  const idx = getBuffCardTierIndex(kind, tier);
  const base = arr && idx >= 0 && idx < arr.length ? arr[idx] : 100;
  return Math.max(1, Math.round(base * cfg.priceMult));
}

export function sanitizePilotBuffCards(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, number> = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    const parsed = parseBuffCardId(key);
    if (!parsed) continue;
    const qty = Math.floor(Number(val));
    if (!Number.isFinite(qty) || qty <= 0) continue;
    out[getBuffCardId(parsed.kind, parsed.tier)] = Math.min(
      BUFF_CARD_MAX_STOCK,
      qty
    );
  }
  return out;
}

export function sanitizePilotActiveBuffs(
  raw: unknown,
  legacyExpBoostBattles?: unknown
): Partial<Record<BuffCardKind, ActiveBuffEntry>> {
  const out: Partial<Record<BuffCardKind, ActiveBuffEntry>> = {};
  if (raw && typeof raw === 'object') {
    for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
      if (!isValidBuffCardKind(key)) continue;
      if (!val || typeof val !== 'object') continue;
      const entry = val as Partial<ActiveBuffEntry>;
      const validTiers = getBuffCardTiersRange(key);
      const tier = Number(entry.tier);
      const battles = Math.floor(Number(entry.battles));
      if (!validTiers.includes(tier)) continue;
      if (!Number.isFinite(battles) || battles <= 0) continue;
      out[key] = {
        tier,
        battles: Math.min(200, battles),
      };
    }
  }
  const legacy = Math.floor(Number(legacyExpBoostBattles));
  if (!out.exp && Number.isFinite(legacy) && legacy > 0) {
    out.exp = {
      tier: 0,
      battles: Math.min(200, legacy),
    };
  }
  return out;
}
