import type {
  AdminConfig,
  Language,
  MedalId,
  MedalsConfig,
  TierTuple5,
} from '../types/game';
import type { CardTierNumber } from './cardTiers';

export const MEDAL_IDS: readonly MedalId[] = [
  'medal_t1',
  'medal_t2',
  'medal_t3',
  'medal_t4',
  'medal_t5',
] as const;

export const MEDAL_ICON_ID = 'RW04';
export const MEDAL_MAX_QTY = 99999;

export const DEFAULT_MEDALS_CONFIG: MedalsConfig = {
  wp: [1000, 2000, 5000, 8000, 12000],
  blackMarketRatePct: 0.5,
  blackMarketWeights: [80, 20, 0, 0, 0],
  blackMarketCreditPerWp: 1500,
};

export function cloneMedalsConfig(cfg: MedalsConfig): MedalsConfig {
  return {
    wp: [...cfg.wp] as TierTuple5,
    blackMarketRatePct: cfg.blackMarketRatePct,
    blackMarketWeights: [...cfg.blackMarketWeights] as TierTuple5,
    blackMarketCreditPerWp: cfg.blackMarketCreditPerWp,
  };
}

export function sanitizeMedalsConfig(raw: unknown): MedalsConfig {
  const obj =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  const wpOut: number[] = [...DEFAULT_MEDALS_CONFIG.wp];
  if (Array.isArray(obj.wp) && obj.wp.length === 5) {
    for (let i = 0; i < 5; i++) {
      const n = typeof obj.wp[i] === 'number' ? obj.wp[i] : Number(obj.wp[i]);
      if (Number.isFinite(n) && Math.round(n) >= 1) {
        wpOut[i] = Math.min(10_000_000, Math.round(n));
      }
    }
  }

  const rawRate =
    typeof obj.blackMarketRatePct === 'number'
      ? obj.blackMarketRatePct
      : Number(obj.blackMarketRatePct);
  const blackMarketRatePct = Number.isFinite(rawRate)
    ? Math.max(0, Math.min(10, Math.round(rawRate * 100) / 100))
    : DEFAULT_MEDALS_CONFIG.blackMarketRatePct;

  const weightsOut: number[] = [...DEFAULT_MEDALS_CONFIG.blackMarketWeights];
  if (
    Array.isArray(obj.blackMarketWeights) &&
    obj.blackMarketWeights.length === 5
  ) {
    for (let i = 0; i < 5; i++) {
      const rawW = obj.blackMarketWeights[i];
      const n = typeof rawW === 'number' ? rawW : Number(rawW);
      if (Number.isFinite(n)) {
        weightsOut[i] = Math.max(0, Math.min(100000, Math.round(n)));
      }
    }
  }

  const rawCreditPerWp =
    typeof obj.blackMarketCreditPerWp === 'number'
      ? obj.blackMarketCreditPerWp
      : Number(obj.blackMarketCreditPerWp);
  const blackMarketCreditPerWp = Number.isFinite(rawCreditPerWp)
    ? Math.max(1, Math.min(1_000_000, Math.round(rawCreditPerWp)))
    : DEFAULT_MEDALS_CONFIG.blackMarketCreditPerWp;

  return {
    wp: wpOut as TierTuple5,
    blackMarketRatePct,
    blackMarketWeights: weightsOut as TierTuple5,
    blackMarketCreditPerWp,
  };
}

export function resolveMedalsConfig(
  cfg?: MedalsConfig | AdminConfig | null
): MedalsConfig {
  if (!cfg) return DEFAULT_MEDALS_CONFIG;
  if ('showRawI18nKeys' in cfg || 'medals' in cfg) {
    return sanitizeMedalsConfig((cfg as AdminConfig).medals);
  }
  return sanitizeMedalsConfig(cfg as MedalsConfig);
}

export function getMedalId(tier: CardTierNumber): MedalId {
  return `medal_t${tier}` as MedalId;
}

export function parseMedalId(
  raw: unknown
): { id: MedalId; tier: CardTierNumber } | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  const match = /^medal_t([1-5])$/.exec(trimmed);
  if (!match) return null;
  const tier = Number(match[1]) as CardTierNumber;
  return {
    id: `medal_t${tier}` as MedalId,
    tier,
  };
}

export function getMedalWpValue(
  tier: CardTierNumber,
  cfg?: MedalsConfig | AdminConfig | null
): number {
  const clean = resolveMedalsConfig(cfg);
  return clean.wp[tier - 1] ?? DEFAULT_MEDALS_CONFIG.wp[0];
}

export function getMedalName(tier: CardTierNumber, lang: Language): string {
  return lang === 'vi'
    ? `Huân chương danh dự T${tier}`
    : `Medal of Honor T${tier}`;
}

export function getMedalLore(lang: Language): string {
  return lang === 'vi'
    ? 'Liên Minh VSS phong tặng cho các anh hùng có công'
    : 'Awarded by the VSS Alliance to heroes of distinguished service';
}

export function sanitizePilotMedals(
  raw: unknown
): Partial<Record<MedalId, number>> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }
  const clean: Partial<Record<MedalId, number>> = {};
  for (const [id, qty] of Object.entries(raw as Record<string, unknown>)) {
    const parsed = parseMedalId(id);
    if (!parsed) continue;
    const n = typeof qty === 'number' ? qty : Number(qty);
    if (!Number.isFinite(n)) continue;
    const cleanQty = Math.min(MEDAL_MAX_QTY, Math.max(0, Math.floor(n)));
    if (cleanQty <= 0) continue;
    clean[parsed.id] = cleanQty;
  }
  return clean;
}

export function grantMedalsToMap(
  current: unknown,
  additions: Partial<Record<MedalId, number>>
): Partial<Record<MedalId, number>> {
  const next = sanitizePilotMedals(current);
  for (const medalId of MEDAL_IDS) {
    const add = Math.max(0, Math.floor(Number(additions[medalId]) || 0));
    if (add <= 0) continue;
    next[medalId] = Math.min(MEDAL_MAX_QTY, (next[medalId] ?? 0) + add);
  }
  return next;
}
