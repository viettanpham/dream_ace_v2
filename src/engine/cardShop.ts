import { getOpeningCardsList, getSkillById } from '../data/skills';
import type {
  AdminConfig,
  CardShopConfig,
  CardShopKindConfig,
  SkillDefinition,
} from '../types/game';

export const DEFAULT_CARD_SHOP_KIND_CONFIG: CardShopKindConfig = {
  baseRatePct: 10,
  stepPct: 1.5,
  stepLevels: 10,
  minRatePct: 1,
};

export const DEFAULT_CARD_SHOP_CONFIG: CardShopConfig = {
  enabled: true,
  active: { ...DEFAULT_CARD_SHOP_KIND_CONFIG },
  passive: { ...DEFAULT_CARD_SHOP_KIND_CONFIG },
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function sanitizeCardShopKindConfig(
  raw: unknown,
  def: CardShopKindConfig = DEFAULT_CARD_SHOP_KIND_CONFIG
): CardShopKindConfig {
  const obj =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  const rawBase =
    typeof obj.baseRatePct === 'number'
      ? obj.baseRatePct
      : Number(obj.baseRatePct);
  const baseRatePct = Number.isFinite(rawBase)
    ? round2(Math.max(0, Math.min(100, rawBase)))
    : def.baseRatePct;

  const rawStep =
    typeof obj.stepPct === 'number' ? obj.stepPct : Number(obj.stepPct);
  const stepPct = Number.isFinite(rawStep)
    ? round2(Math.max(0, rawStep))
    : def.stepPct;

  const rawStepLevels =
    typeof obj.stepLevels === 'number'
      ? obj.stepLevels
      : Number(obj.stepLevels);
  const stepLevels = Number.isFinite(rawStepLevels)
    ? Math.max(1, Math.round(rawStepLevels))
    : def.stepLevels;

  const rawMin =
    typeof obj.minRatePct === 'number'
      ? obj.minRatePct
      : Number(obj.minRatePct);
  const minRatePct = Number.isFinite(rawMin)
    ? round2(Math.max(0, Math.min(baseRatePct, rawMin)))
    : Math.min(baseRatePct, def.minRatePct);

  return {
    baseRatePct,
    stepPct,
    stepLevels,
    minRatePct,
  };
}

export function cloneCardShopConfig(
  cfg: CardShopConfig = DEFAULT_CARD_SHOP_CONFIG
): CardShopConfig {
  return {
    enabled: Boolean(cfg.enabled),
    active: { ...cfg.active },
    passive: { ...cfg.passive },
  };
}

export function sanitizeCardShopConfig(raw: unknown): CardShopConfig {
  const def = DEFAULT_CARD_SHOP_CONFIG;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return cloneCardShopConfig(def);
  }
  const obj = raw as Record<string, unknown>;
  return {
    enabled: typeof obj.enabled === 'boolean' ? obj.enabled : def.enabled,
    active: sanitizeCardShopKindConfig(obj.active, def.active),
    passive: sanitizeCardShopKindConfig(obj.passive, def.passive),
  };
}

export function resolveCardShopConfig(
  cfgOrAdmin?: CardShopConfig | Pick<AdminConfig, 'cardShop'> | null
): CardShopConfig {
  if (!cfgOrAdmin) return cloneCardShopConfig(DEFAULT_CARD_SHOP_CONFIG);
  if ('cardShop' in cfgOrAdmin) {
    return sanitizeCardShopConfig(cfgOrAdmin.cardShop);
  }
  if ('active' in cfgOrAdmin || 'passive' in cfgOrAdmin || 'enabled' in cfgOrAdmin) {
    return sanitizeCardShopConfig(cfgOrAdmin);
  }
  return cloneCardShopConfig(DEFAULT_CARD_SHOP_CONFIG);
}

/**
 * Chance (%) for an unowned opening card to appear in the WP shop per roll:
 * clamp(baseRatePct - stepPct * floor(skill.unlockLevel / stepLevels), minRatePct, baseRatePct)
 */
export function getCardAppearRate(
  skill: Pick<SkillDefinition, 'unlockLevel'>,
  kindCfg: CardShopKindConfig
): number {
  const safeKind = sanitizeCardShopKindConfig(kindCfg);
  const unlockLv = Number.isFinite(skill.unlockLevel)
    ? Math.max(0, skill.unlockLevel)
    : 0;
  const steps = Math.floor(unlockLv / safeKind.stepLevels);
  const raw = safeKind.baseRatePct - safeKind.stepPct * steps;
  const clamped = Math.max(
    safeKind.minRatePct,
    Math.min(safeKind.baseRatePct, raw)
  );
  return Number(clamped.toFixed(4));
}

export function rollCardShopStock(
  ownedCardIds: readonly string[],
  adminConfig?: Pick<AdminConfig, 'skillTiers' | 'skillMods' | 'cardShop'> | null,
  rng: () => number = Math.random
): string[] {
  const cfg = resolveCardShopConfig(adminConfig);
  const ownedSet = new Set(ownedCardIds);
  const cards = getOpeningCardsList(adminConfig);
  const picked: string[] = [];

  for (const card of cards) {
    if (ownedSet.has(card.id)) continue;
    const skill = getSkillById(card.skillId, adminConfig);
    if (!skill) continue;
    const kindCfg = skill.category === 'passive' ? cfg.passive : cfg.active;
    const ratePct = getCardAppearRate(skill, kindCfg);
    if (ratePct <= 0) continue;
    if (ratePct >= 100 || rng() * 100 < ratePct) {
      picked.push(card.id);
    }
  }

  return picked;
}

export function sanitizeCardShopStock(
  raw: unknown,
  ownedCardIds: readonly string[],
  adminConfig?: Pick<AdminConfig, 'skillTiers' | 'skillMods' | 'cardShop'> | null
): string[] {
  if (!Array.isArray(raw)) return [];
  const validIds = new Set(getOpeningCardsList(adminConfig).map((c) => c.id));
  const ownedSet = new Set(ownedCardIds);
  const seen = new Set<string>();
  const clean: string[] = [];

  for (const entry of raw) {
    if (typeof entry !== 'string') continue;
    if (!validIds.has(entry)) continue;
    if (ownedSet.has(entry) || seen.has(entry)) continue;
    seen.add(entry);
    clean.push(entry);
  }

  return clean;
}

export function isCardInWpShopStock(
  cardId: string | undefined | null,
  cardShopStockWp: readonly string[] | undefined | null,
  adminConfig?: Pick<AdminConfig, 'cardShop'> | null
): boolean {
  if (!cardId) return false;
  const cfg = resolveCardShopConfig(adminConfig);
  if (!cfg.enabled) return true;
  if (!Array.isArray(cardShopStockWp)) return false;
  return cardShopStockWp.includes(cardId);
}

export function getExpectedCardShopStats(
  adminConfig?: Pick<AdminConfig, 'skillTiers' | 'skillMods' | 'cardShop'> | null,
  ownedCardIds: readonly string[] = []
): {
  totalCards: number;
  eligibleCards: number;
  expectedCards: number;
  expectedActive: number;
  expectedPassive: number;
} {
  const cfg = resolveCardShopConfig(adminConfig);
  const cards = getOpeningCardsList(adminConfig);
  const ownedSet = new Set(ownedCardIds);
  let eligibleCards = 0;
  let expectedActive = 0;
  let expectedPassive = 0;

  for (const card of cards) {
    if (ownedSet.has(card.id)) continue;
    const skill = getSkillById(card.skillId, adminConfig);
    if (!skill) continue;
    eligibleCards += 1;
    const isPassive = skill.category === 'passive';
    if (!cfg.enabled) {
      if (isPassive) expectedPassive += 1;
      else expectedActive += 1;
      continue;
    }
    const ratePct = getCardAppearRate(
      skill,
      isPassive ? cfg.passive : cfg.active
    );
    if (isPassive) expectedPassive += ratePct / 100;
    else expectedActive += ratePct / 100;
  }

  const expectedCards = expectedActive + expectedPassive;
  return {
    totalCards: cards.length,
    eligibleCards,
    expectedCards: Number(expectedCards.toFixed(2)),
    expectedActive: Number(expectedActive.toFixed(2)),
    expectedPassive: Number(expectedPassive.toFixed(2)),
  };
}
