import { BALANCE_CONFIG, COMBAT_FORMULAS, getMaxLevel } from './balance';

export { BALANCE_CONFIG, COMBAT_FORMULAS };

/**
 * Compatibility facade forwarding progression constants from the single centralized balance.ts config.
 */
export const PROGRESSION_CONFIG = {
  startingLevel: BALANCE_CONFIG.startingLevel,
  get maxLevel(): number {
    return getMaxLevel();
  },
  initialStatPoints: BALANCE_CONFIG.initialStatPoints,
  statPointsPerLevel: BALANCE_CONFIG.statPointsPerLevel,
  startingCredits: BALANCE_CONFIG.startingCredits,
  expBase: BALANCE_CONFIG.expBase,
  expExponent: BALANCE_CONFIG.expExponent,
  rewardMultDefault: BALANCE_CONFIG.rewardMultDefault,
};
