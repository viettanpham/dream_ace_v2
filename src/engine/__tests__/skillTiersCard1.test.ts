import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SKILL_TIERS_CONFIG,
  sanitizeSkillCardPriceMult,
  sanitizeSkillWpCostFactor,
} from '../../data/balance';
import {
  getClassKindCatalogSkills,
  getOpeningCardById,
  getSkillById,
  getSkillCardId,
  getSkillCardPrice,
  getSkillTier,
  OPENING_CARDS_LIST,
  sanitizeSkillTiersConfig,
} from '../../data/skills';
import { EN_TRANSLATIONS } from '../../i18n/en';
import { VI_TRANSLATIONS } from '../../i18n/vi';
import type { MechClassId } from '../../types/game';
import { createDefaultAdminConfig, createFreshCampaignState } from '../migration';
import {
  buyOpeningCard,
  getSkillLearnOrUpgradeCost,
  getSkillWpLearnOrUpgradeCost,
  learnOrUpgradeSkillOnGear,
  validateLearnOrUpgradeSkill,
} from '../skills';

describe('TASK CARD-1: Skill tiers (Credit / WP / Card) & card price multiplier', () => {
  it('1) getSkillTier resolves defaults for 4 classes x 2 kinds and respects custom config', () => {
    const classes: MechClassId[] = ['striker', 'siege', 'interceptor', 'support'];
    for (const classId of classes) {
      for (const kind of ['active', 'passive'] as const) {
        const list = getClassKindCatalogSkills(classId, kind);
        const tiers = list.map((s) => getSkillTier(s, classId, DEFAULT_SKILL_TIERS_CONFIG));
        const defCfg = DEFAULT_SKILL_TIERS_CONFIG[classId][kind];
        const expectedWp = list.length - defCfg.creditCount - defCfg.cardCount;
        expect(tiers.filter((t) => t === 'credit').length).toBe(defCfg.creditCount);
        expect(tiers.filter((t) => t === 'wp').length).toBe(expectedWp);
        expect(tiers.filter((t) => t === 'card').length).toBe(defCfg.cardCount);
      }
    }

    // Siege passive is sorted by unlockLevel (plating Lv1 before hull Lv10)
    expect(getSkillTier(getSkillById('sge_passive_plating')!, 'siege')).toBe('credit');
    expect(getSkillTier(getSkillById('sge_passive_hull')!, 'siege')).toBe('wp');
    expect(getSkillTier(getSkillById('sge_passive_capbank')!, 'siege')).toBe('card');
    expect(getSkillTier(getSkillById('sup_passive_field_medic')!, 'support')).toBe('card');

    // General skills stay credit regardless of class
    expect(getSkillTier(getSkillById('gen_hull_brace')!, 'support')).toBe('credit');
    expect(getSkillTier(getSkillById('gen_thruster_feint')!, 'striker')).toBe('credit');

    // Custom config: Striker passive 2 credit / 1 card -> 1 wp in between
    const customCfg = {
      ...DEFAULT_SKILL_TIERS_CONFIG,
      striker: {
        ...DEFAULT_SKILL_TIERS_CONFIG.striker,
        passive: { creditCount: 2, cardCount: 1 },
      },
    };
    expect(getSkillTier(getSkillById('str_passive_ordnance')!, 'striker', customCfg)).toBe('credit');
    expect(getSkillTier(getSkillById('str_passive_piercer')!, 'striker', customCfg)).toBe('credit');
    expect(getSkillTier(getSkillById('str_passive_overcharge')!, 'striker', customCfg)).toBe('wp');
    expect(getSkillTier(getSkillById('str_passive_killzone')!, 'striker', customCfg)).toBe('card');
  });

  it('2) wp tier pays War Points instead of Credits and refuses with insufficient_wp', () => {
    const campaign = createFreshCampaignState('WpTester', 'striker');
    const admin = createDefaultAdminConfig();
    campaign.pilot.gears.striker.level = 40;
    campaign.pilot.credits = 50_000;
    campaign.pilot.warPoints = 0;

    // str_carpet_salvo (Lv12 active, WP tier by default)
    const skill = getSkillById('str_carpet_salvo')!;
    campaign.pilot.gears.striker.skillLevels['str_carpet_salvo'] = 4;
    const expectedWp = getSkillWpLearnOrUpgradeCost(skill, 5, admin);
    expect(expectedWp).toBeGreaterThan(1);

    const refused = validateLearnOrUpgradeSkill(
      campaign.pilot,
      'striker',
      'str_carpet_salvo',
      admin
    );
    expect(refused.ok).toBe(false);
    expect(refused.reason).toBe('insufficient_wp');
    expect(refused.tier).toBe('wp');
    expect(refused.wpCost).toBe(expectedWp);

    campaign.pilot.warPoints = expectedWp + 50;
    const creditsBefore = campaign.pilot.credits;
    const res = learnOrUpgradeSkillOnGear(
      campaign.pilot,
      'striker',
      'str_carpet_salvo',
      admin
    );
    expect(res.validation.ok).toBe(true);
    expect(res.newLevel).toBe(5);
    expect(res.pilot.warPoints).toBe(50);
    expect(res.pilot.credits).toBe(creditsBefore);
  });

  it('3) card tier refuses without the card on BOTH learn and upgrade, passes with permanent licence', () => {
    const campaign = createFreshCampaignState('CardTester', 'striker');
    const admin = createDefaultAdminConfig();
    campaign.pilot.gears.striker.level = 30;
    campaign.pilot.credits = 500_000;

    // Default card-tier passive: str_passive_overcharge -> card_str_passive_overcharge
    const skillId = 'str_passive_overcharge';
    const expectedCardId = getSkillCardId(getSkillById(skillId)!);
    expect(expectedCardId).toBe('card_str_passive_overcharge');

    // Missing card on Lv0 -> Lv1
    const failLearn = validateLearnOrUpgradeSkill(
      campaign.pilot,
      'striker',
      skillId,
      admin
    );
    expect(failLearn.ok).toBe(false);
    expect(failLearn.reason).toBe('missing_card');
    expect(failLearn.requiredCardId).toBe(expectedCardId);

    // Pre-existing Lv1 save WITHOUT card in inventory still cannot upgrade until card owned
    campaign.pilot.gears.striker.skillLevels[skillId] = 1;
    const failUpgrade = validateLearnOrUpgradeSkill(
      campaign.pilot,
      'striker',
      skillId,
      admin
    );
    expect(failUpgrade.ok).toBe(false);
    expect(failUpgrade.reason).toBe('missing_card');
    expect(failUpgrade.requiredCardId).toBe(expectedCardId);

    // Grant card -> upgrade passes and card stays in ownedOpeningCards
    campaign.pilot.ownedOpeningCards.push(expectedCardId);
    const passUpgrade = learnOrUpgradeSkillOnGear(
      campaign.pilot,
      'striker',
      skillId,
      admin
    );
    expect(passUpgrade.validation.ok).toBe(true);
    expect(passUpgrade.newLevel).toBe(2);
    expect(passUpgrade.pilot.ownedOpeningCards).toContain(expectedCardId);
  });

  it('4) skillCardPriceMult scales special card WP price and wp-tier learn cost (1 vs 2)', () => {
    const admin1 = { ...createDefaultAdminConfig(), skillCardPriceMult: 1 };
    const admin2 = { ...createDefaultAdminConfig(), skillCardPriceMult: 2 };

    const specialCard = getOpeningCardById('card_str_phase_shroud', admin1)!;
    expect(specialCard.warPointCost).toBe(800);
    expect(getSkillCardPrice(specialCard, admin1)).toBe(800);
    expect(getSkillCardPrice(specialCard, admin2)).toBe(1600);

    const wpSkill = getSkillById('str_passive_piercer')!;
    const crCost = getSkillLearnOrUpgradeCost(wpSkill, 1);
    const wp1 = getSkillWpLearnOrUpgradeCost(wpSkill, 1, admin1);
    const wp2 = getSkillWpLearnOrUpgradeCost(wpSkill, 1, admin2);
    expect(wp1).toBe(Math.max(1, Math.ceil(crCost * 0.001 * 1)));
    expect(wp2).toBe(Math.max(1, Math.ceil(crCost * 0.001 * 2)));

    // buyOpeningCard charges multiplied price
    const campaign = createFreshCampaignState('ShopMult', 'striker');
    campaign.pilot.warPoints = 2000;
    const bought = buyOpeningCard(campaign.pilot, 'card_str_phase_shroud', admin2);
    expect(bought.ok).toBe(true);
    expect(bought.pilot.warPoints).toBe(400);
  });

  it('5) sanitizers clamp out-of-range values and OPENING_CARDS_LIST covers all 18 default card skills', () => {
    const clampedTiers = sanitizeSkillTiersConfig({
      striker: {
        active: { creditCount: 99, cardCount: 5 },
        passive: { creditCount: -3, cardCount: 99 },
      },
    });
    const strActiveTotal = getClassKindCatalogSkills('striker', 'active').length;
    const strPassiveTotal = getClassKindCatalogSkills('striker', 'passive').length;
    expect(clampedTiers.striker.active.creditCount).toBe(strActiveTotal);
    expect(clampedTiers.striker.active.cardCount).toBe(0);
    expect(clampedTiers.striker.passive.creditCount).toBe(0);
    expect(clampedTiers.striker.passive.cardCount).toBe(strPassiveTotal);

    expect(sanitizeSkillWpCostFactor(-5)).toBe(0.0001);
    expect(sanitizeSkillWpCostFactor(5)).toBe(1);
    expect(sanitizeSkillCardPriceMult(0)).toBe(0.1);
    expect(sanitizeSkillCardPriceMult(100)).toBe(20);

    // 9 active special/elite + 9 passive cards = 18 default cards
    expect(OPENING_CARDS_LIST.length).toBe(18);
    expect(OPENING_CARDS_LIST.find((c) => c.skillId === 'str_phase_shroud')?.id).toBe(
      'card_str_phase_shroud'
    );
    expect(OPENING_CARDS_LIST.find((c) => c.skillId === 'str_passive_overcharge')?.id).toBe(
      'card_str_passive_overcharge'
    );
  });

  it('6) vi and en translation dictionaries stay in 1:1 key parity', () => {
    const viKeys = Object.keys(VI_TRANSLATIONS).sort();
    const enKeys = Object.keys(EN_TRANSLATIONS).sort();
    expect(viKeys).toEqual(enKeys);
    expect(VI_TRANSLATIONS['skill.tier.card']).toBeTruthy();
    expect(EN_TRANSLATIONS['skill.tier.card']).toBeTruthy();
    expect(VI_TRANSLATIONS['admin.battleSection.skillTiers.title']).toBeTruthy();
    expect(EN_TRANSLATIONS['admin.battleSection.skillTiers.title']).toBeTruthy();
  });
});
