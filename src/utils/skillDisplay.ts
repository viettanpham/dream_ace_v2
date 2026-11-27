import {
  computeLidarDetectCount,
  getEffectiveSkillMaxLevel,
  getFluxMinPerAlly,
  getFluxTransferRule,
} from '../data/balance';
import { getScaledSkillStats } from '../data/skills';
import { getSkillTargetLabel } from '../i18n';
import {
  sanitizeShieldCrackedMult,
  sanitizeShieldCrackedTurns,
} from '../engine/shieldRegen';
import type { AdminConfig, Language, SkillDefinition } from '../types/game';

export interface SkillRealSummary {
  effectiveLevel: number;
  maxLevel: number;
  nextLevel: number | null;
  iconIds: string[];
  primaryText: string;
  nextValueText: string | null;
  nextLine: string | null;
  spCost: number;
  cooldownText: string;
  durationTurns: number | null;
  targetText: string;
  tooltipText: string;
}

function fmtPct(fraction: number): string {
  const pct = Math.round(fraction * 1000) / 10;
  return Number.isInteger(pct) ? `${pct}%` : `${pct}%`;
}

function fmtMult(val: number): string {
  return `x${Number(val.toFixed(2))}`;
}

function fmtCooldown(skill: SkillDefinition, lang: Language): string {
  if (skill.category === 'passive') {
    return lang === 'vi' ? 'Bị động' : 'Passive';
  }
  if (skill.oncePerBattle) {
    return lang === 'vi' ? '1 lần/Trận' : '1x/Battle';
  }
  if (skill.isToggle) {
    return lang === 'vi' ? 'Bật/Tắt' : 'Toggle';
  }
  if (skill.cooldown > 0) {
    return lang === 'vi' ? `Hồi ${skill.cooldown} lượt` : `CD ${skill.cooldown}t`;
  }
  return lang === 'vi' ? 'Không hồi' : 'No CD';
}

function describeEffectAtLevel(
  skill: SkillDefinition,
  level: number,
  lang: Language,
  adminConfig?: Partial<AdminConfig> | null
): {
  iconIds: string[];
  primaryText: string;
  compactValue: string | null;
  durationTurns: number | null;
} {
  const scaled = getScaledSkillStats(skill, level, adminConfig);
  const maxLv = getEffectiveSkillMaxLevel(adminConfig);
  const dur = skill.duration && skill.duration < 90 ? skill.duration : null;
  const durPhrase = dur
    ? lang === 'vi'
      ? `trong ${dur} lượt`
      : `for ${dur}t`
    : '';

  switch (skill.effectKind) {
    case 'buff_def':
      return {
        iconIds: ['BF03'],
        primaryText:
          lang === 'vi'
            ? `DEF +${fmtPct(scaled.buffMagnitude)} ${durPhrase}`.trim()
            : `DEF +${fmtPct(scaled.buffMagnitude)} ${durPhrase}`.trim(),
        compactValue: `DEF +${fmtPct(scaled.buffMagnitude)}`,
        durationTurns: dur,
      };
    case 'buff_eva':
      return {
        iconIds: ['BF04'],
        primaryText: `EVA +${fmtPct(scaled.buffMagnitude)} ${durPhrase}`.trim(),
        compactValue: `EVA +${fmtPct(scaled.buffMagnitude)}`,
        durationTurns: dur,
      };
    case 'buff_primary_dmg':
      return {
        iconIds: ['BF02'],
        primaryText:
          lang === 'vi'
            ? `DMG Vũ khí chính +${fmtPct(scaled.buffMagnitude)} ${durPhrase}`.trim()
            : `Primary DMG +${fmtPct(scaled.buffMagnitude)} ${durPhrase}`.trim(),
        compactValue: `DMG +${fmtPct(scaled.buffMagnitude)}`,
        durationTurns: dur,
      };
    case 'buff_skill_dmg':
      return {
        iconIds: ['BF02'],
        primaryText:
          lang === 'vi'
            ? `DMG Kỹ năng +${fmtPct(scaled.buffMagnitude)} ${durPhrase}`.trim()
            : `Skill DMG +${fmtPct(scaled.buffMagnitude)} ${durPhrase}`.trim(),
        compactValue: `Skill DMG +${fmtPct(scaled.buffMagnitude)}`,
        durationTurns: dur,
      };
    case 'buff_sure_hit':
      return {
        iconIds: ['BF16'],
        primaryText:
          lang === 'vi'
            ? `Chắc chắn trúng ${skill.charges ?? 2} đòn ${durPhrase}`.trim()
            : `Sure Hit ${skill.charges ?? 2} hits ${durPhrase}`.trim(),
        compactValue: null,
        durationTurns: dur,
      };
    case 'multi_attack': {
      const targets = skill.maxTargets ?? 3;
      return {
        iconIds: ['BS01'],
        primaryText:
          lang === 'vi'
            ? `DMG ${fmtMult(scaled.powerMultiplier)} ATK · tối đa ${targets} mục tiêu`
            : `DMG ${fmtMult(scaled.powerMultiplier)} ATK · up to ${targets} targets`,
        compactValue: fmtMult(scaled.powerMultiplier),
        durationTurns: null,
      };
    }
    case 'splash_attack': {
      const splashPct = fmtPct(skill.secondaryRatio ?? 0.5);
      return {
        iconIds: ['BS01'],
        primaryText:
          lang === 'vi'
            ? `DMG ${fmtMult(scaled.powerMultiplier)} ATK (lan ${splashPct} kế bên)`
            : `DMG ${fmtMult(scaled.powerMultiplier)} ATK (${splashPct} adjacent splash)`,
        compactValue: fmtMult(scaled.powerMultiplier),
        durationTurns: null,
      };
    }
    case 'charge_attack':
      return {
        iconIds: ['BS01'],
        primaryText:
          lang === 'vi'
            ? `Tụ 1 lượt → DMG ${fmtMult(scaled.powerMultiplier)} ATK`
            : `Charge 1t → DMG ${fmtMult(scaled.powerMultiplier)} ATK`,
        compactValue: fmtMult(scaled.powerMultiplier),
        durationTurns: 1,
      };
    case 'stealth_turns':
      return {
        iconIds: ['BF18'],
        primaryText:
          lang === 'vi'
            ? `Tàng hình ${dur ?? 2} lượt`
            : `Stealth ${dur ?? 2}t`,
        compactValue: null,
        durationTurns: dur ?? 2,
      };
    case 'aoe_elite_attack':
      return {
        iconIds: ['BS01'],
        primaryText:
          lang === 'vi'
            ? `DMG ${fmtMult(scaled.powerMultiplier)} ATK · toàn bộ địch`
            : `DMG ${fmtMult(scaled.powerMultiplier)} ATK · all enemies`,
        compactValue: fmtMult(scaled.powerMultiplier),
        durationTurns: null,
      };
    case 'passive_skill_dmg':
      return {
        iconIds: ['BF02'],
        primaryText:
          lang === 'vi'
            ? `DMG Kỹ năng +${fmtPct(scaled.buffMagnitude)}`
            : `Skill DMG +${fmtPct(scaled.buffMagnitude)}`,
        compactValue: `+${fmtPct(scaled.buffMagnitude)}`,
        durationTurns: null,
      };
    case 'toggle_siege_mode':
      return {
        iconIds: ['BF02', 'BS06'],
        primaryText:
          lang === 'vi'
            ? `DMG +${fmtPct(scaled.buffMagnitude)}, EVA = 0`
            : `DMG +${fmtPct(scaled.buffMagnitude)}, EVA = 0`,
        compactValue: `DMG +${fmtPct(scaled.buffMagnitude)}`,
        durationTurns: null,
      };
    case 'toggle_siege_defense': {
      const dmgPenalty = fmtPct(skill.secondaryRatio ?? 0.3);
      return {
        iconIds: ['BF03', 'BS05'],
        primaryText:
          lang === 'vi'
            ? `DEF +${fmtPct(scaled.buffMagnitude)}, Khiên +${fmtPct(scaled.secondaryMagnitude)}, DMG -${dmgPenalty}`
            : `DEF +${fmtPct(scaled.buffMagnitude)}, SHD +${fmtPct(scaled.secondaryMagnitude)}, DMG -${dmgPenalty}`,
        compactValue: `DEF +${fmtPct(scaled.buffMagnitude)}, SHD +${fmtPct(scaled.secondaryMagnitude)}`,
        durationTurns: null,
      };
    }
    case 'attack_slow':
      return {
        iconIds: ['BS01', 'DB05'],
        primaryText:
          lang === 'vi'
            ? `DMG ${fmtMult(scaled.powerMultiplier)} ATK · Làm chậm -30% SPD (${dur ?? 2} lượt)`
            : `DMG ${fmtMult(scaled.powerMultiplier)} ATK · Slow -30% SPD (${dur ?? 2}t)`,
        compactValue: fmtMult(scaled.powerMultiplier),
        durationTurns: dur ?? 2,
      };
    case 'attack_shield_break': {
      const crackTurns = sanitizeShieldCrackedTurns(
        adminConfig?.shieldCrackedTurns
      );
      const crackMult = sanitizeShieldCrackedMult(
        adminConfig?.shieldCrackedMult
      );
      return {
        iconIds: ['BS01', 'DB12'],
        primaryText:
          lang === 'vi'
            ? `DMG ${fmtMult(scaled.powerMultiplier)} ATK · Khiên nứt x${crackMult} (${crackTurns} lượt)`
            : `DMG ${fmtMult(scaled.powerMultiplier)} ATK · Cracked SHD x${crackMult} (${crackTurns}t)`,
        compactValue: fmtMult(scaled.powerMultiplier),
        durationTurns: crackTurns,
      };
    }
    case 'stealth_until_attack':
      return {
        iconIds: ['BF18'],
        primaryText:
          lang === 'vi'
            ? 'Tàng hình đến khi khai hỏa'
            : 'Stealth until firing',
        compactValue: null,
        durationTurns: null,
      };
    case 'pierce_all_elite':
      return {
        iconIds: ['BS01', 'SS12'],
        primaryText:
          lang === 'vi'
            ? `DMG ${fmtMult(scaled.powerMultiplier)} ATK · xuyên 100% DEF & Khiên`
            : `DMG ${fmtMult(scaled.powerMultiplier)} ATK · ignores 100% DEF & SHD`,
        compactValue: fmtMult(scaled.powerMultiplier),
        durationTurns: null,
      };
    case 'passive_def_pct':
      return {
        iconIds: ['BF03'],
        primaryText: `DEF +${fmtPct(scaled.buffMagnitude)}`,
        compactValue: `+${fmtPct(scaled.buffMagnitude)}`,
        durationTurns: null,
      };
    case 'attack_pierce': {
      const piercePct = fmtPct(skill.secondaryRatio ?? 0.3);
      return {
        iconIds: ['BS01', 'SS12'],
        primaryText:
          lang === 'vi'
            ? `DMG ${fmtMult(scaled.powerMultiplier)} ATK · xuyên ${piercePct} DEF`
            : `DMG ${fmtMult(scaled.powerMultiplier)} ATK · ${piercePct} DEF pierce`,
        compactValue: fmtMult(scaled.powerMultiplier),
        durationTurns: null,
      };
    }
    case 'counter_stance':
      return {
        iconIds: ['BF15'],
        primaryText:
          lang === 'vi'
            ? `Phản đòn ${fmtMult(scaled.powerMultiplier)} ATK (${skill.charges ?? 1} lần · ${dur ?? 2} lượt)`
            : `Counter ${fmtMult(scaled.powerMultiplier)} ATK (${skill.charges ?? 1} hit · ${dur ?? 2}t)`,
        compactValue: fmtMult(scaled.powerMultiplier),
        durationTurns: dur ?? 2,
      };
    case 'retreat_back_eva':
      return {
        iconIds: ['BF04'],
        primaryText:
          lang === 'vi'
            ? `Lùi Hậu tuyến · EVA +${fmtPct(scaled.buffMagnitude)} (${dur ?? 2} lượt)`
            : `Retreat Back · EVA +${fmtPct(scaled.buffMagnitude)} (${dur ?? 2}t)`,
        compactValue: `EVA +${fmtPct(scaled.buffMagnitude)}`,
        durationTurns: dur ?? 2,
      };
    case 'buff_speed':
      return {
        iconIds: ['BF07'],
        primaryText: `SPD +${fmtPct(scaled.buffMagnitude)} ${durPhrase}`.trim(),
        compactValue: `SPD +${fmtPct(scaled.buffMagnitude)}`,
        durationTurns: dur,
      };
    case 'silence_target':
      return {
        iconIds: ['CC04'],
        primaryText:
          lang === 'vi'
            ? `Câm lặng ${dur ?? 2} lượt`
            : `Silence ${dur ?? 2}t`,
        compactValue: null,
        durationTurns: dur ?? 2,
      };
    case 'evade_all_round':
      return {
        iconIds: ['BF04'],
        primaryText:
          lang === 'vi'
            ? `Né 100% đòn trong ${dur ?? 1} vòng`
            : `Evade all hits for ${dur ?? 1} round`,
        compactValue: null,
        durationTurns: dur ?? 1,
      };
    case 'berserker_buff': {
      const defDrop = fmtPct(skill.secondaryRatio ?? 0.3);
      return {
        iconIds: ['BF02', 'BF07'],
        primaryText:
          lang === 'vi'
            ? `ATK +${fmtPct(scaled.buffMagnitude)}, SPD +${fmtPct(scaled.secondaryMagnitude)}, DEF -${defDrop} (${dur ?? 3} lượt)`
            : `ATK +${fmtPct(scaled.buffMagnitude)}, SPD +${fmtPct(scaled.secondaryMagnitude)}, DEF -${defDrop} (${dur ?? 3}t)`,
        compactValue: `ATK +${fmtPct(scaled.buffMagnitude)}, SPD +${fmtPct(scaled.secondaryMagnitude)}`,
        durationTurns: dur ?? 3,
      };
    }
    case 'passive_eva_spd':
      return {
        iconIds: ['BF04', 'BF07'],
        primaryText: `EVA +${fmtPct(scaled.buffMagnitude)}, SPD +${fmtPct(scaled.secondaryMagnitude)}`,
        compactValue: `EVA +${fmtPct(scaled.buffMagnitude)}, SPD +${fmtPct(scaled.secondaryMagnitude)}`,
        durationTurns: null,
      };
    case 'heal_single':
      return {
        iconIds: ['SS01'],
        primaryText:
          lang === 'vi'
            ? `Hồi ${fmtPct(scaled.buffMagnitude)} Max HP`
            : `Heal ${fmtPct(scaled.buffMagnitude)} Max HP`,
        compactValue: `${fmtPct(scaled.buffMagnitude)} HP`,
        durationTurns: null,
      };
    case 'heal_field_hot':
      return {
        iconIds: ['BF09'],
        primaryText:
          lang === 'vi'
            ? `Hồi ${fmtPct(scaled.buffMagnitude)} Max HP/lượt · ${dur ?? 3} lượt`
            : `Regen ${fmtPct(scaled.buffMagnitude)} Max HP/t · ${dur ?? 3}t`,
        compactValue: `${fmtPct(scaled.buffMagnitude)}/t`,
        durationTurns: dur ?? 3,
      };
    case 'scan_reveal': {
      const detectCount = computeLidarDetectCount(
        level,
        adminConfig?.stealth,
        maxLv
      );
      return {
        iconIds: ['CC10', 'DB09'],
        primaryText:
          lang === 'vi'
            ? `Quét tối đa ${detectCount} tàng hình · +${fmtPct(scaled.buffMagnitude)} sát thương nhận (${dur ?? 2} lượt)`
            : `Reveal up to ${detectCount} stealth · +${fmtPct(scaled.buffMagnitude)} DMG taken (${dur ?? 2}t)`,
        compactValue:
          lang === 'vi'
            ? `Quét ${detectCount} · +${fmtPct(scaled.buffMagnitude)}`
            : `Scan ${detectCount} · +${fmtPct(scaled.buffMagnitude)}`,
        durationTurns: dur ?? 2,
      };
    }
    case 'sp_transfer': {
      const rule = getFluxTransferRule(level, adminConfig?.fluxTransfer, maxLv);
      const minPerAlly = getFluxMinPerAlly(level, adminConfig?.fluxTransfer, maxLv);
      return {
        iconIds: ['SS02'],
        primaryText:
          lang === 'vi'
            ? `Chuyển ≥${minPerAlly} SP (${rule.pct}% SP) cho tối đa ${rule.targets} đồng đội (phí ${rule.fee}%)`
            : `Transfer ≥${minPerAlly} SP (${rule.pct}% SP) to up to ${rule.targets} allies (${rule.fee}% fee)`,
        compactValue:
          lang === 'vi'
            ? `≥${minPerAlly} SP (${rule.pct}%) · ${rule.targets} mục tiêu`
            : `≥${minPerAlly} SP (${rule.pct}%) · ${rule.targets} allies`,
        durationTurns: null,
      };
    }
    case 'energize_single':
      return {
        iconIds: ['SS02'],
        primaryText:
          lang === 'vi'
            ? `Hồi +${scaled.spAmount} SP`
            : `+${scaled.spAmount} SP`,
        compactValue: `+${scaled.spAmount} SP`,
        durationTurns: null,
      };
    case 'team_atk_up':
      return {
        iconIds: ['BF02'],
        primaryText:
          lang === 'vi'
            ? `ATK +${fmtPct(scaled.buffMagnitude)} toàn đội ${durPhrase}`.trim()
            : `Team ATK +${fmtPct(scaled.buffMagnitude)} ${durPhrase}`.trim(),
        compactValue: `ATK +${fmtPct(scaled.buffMagnitude)}`,
        durationTurns: dur,
      };
    case 'energize_shield_field':
      return {
        iconIds: ['BS05', 'SS02'],
        primaryText:
          lang === 'vi'
            ? `Khiên +${fmtPct(scaled.buffMagnitude)}, +${scaled.spAmount} SP toàn đội`
            : `Team SHD +${fmtPct(scaled.buffMagnitude)}, +${scaled.spAmount} SP`,
        compactValue: `SHD +${fmtPct(scaled.buffMagnitude)}, +${scaled.spAmount} SP`,
        durationTurns: null,
      };
    case 'team_def_up':
      return {
        iconIds: ['BF03'],
        primaryText:
          lang === 'vi'
            ? `DEF +${fmtPct(scaled.buffMagnitude)} toàn đội ${durPhrase}`.trim()
            : `Team DEF +${fmtPct(scaled.buffMagnitude)} ${durPhrase}`.trim(),
        compactValue: `DEF +${fmtPct(scaled.buffMagnitude)}`,
        durationTurns: dur,
      };
    case 'team_eva_up':
      return {
        iconIds: ['BF04'],
        primaryText:
          lang === 'vi'
            ? `EVA +${fmtPct(scaled.buffMagnitude)} toàn đội ${durPhrase}`.trim()
            : `Team EVA +${fmtPct(scaled.buffMagnitude)} ${durPhrase}`.trim(),
        compactValue: `EVA +${fmtPct(scaled.buffMagnitude)}`,
        durationTurns: dur,
      };
    case 'invincible_ally':
      return {
        iconIds: ['CC12'],
        primaryText:
          lang === 'vi'
            ? `Bất tử ${dur ?? 1} vòng`
            : `Invincible ${dur ?? 1} round`,
        compactValue: null,
        durationTurns: dur ?? 1,
      };
    case 'purify_team':
      return {
        iconIds: ['CC09'],
        primaryText:
          lang === 'vi'
            ? 'Thanh tẩy toàn bộ hiệu ứng xấu toàn đội'
            : 'Cleanse all debuffs on all allies',
        compactValue: null,
        durationTurns: null,
      };
    case 'full_recovery_elite':
      return {
        iconIds: ['SS01', 'BS05'],
        primaryText:
          lang === 'vi'
            ? 'Hồi 100% HP & 100% Khiên toàn đội'
            : 'Restore 100% HP & 100% SHD (team)',
        compactValue: null,
        durationTurns: null,
      };
    case 'passive_sp_regen':
      return {
        iconIds: ['BF11'],
        primaryText:
          lang === 'vi'
            ? `Hồi +${scaled.spAmount} SP/lượt`
            : `+${scaled.spAmount} SP/turn`,
        compactValue: `+${scaled.spAmount} SP/t`,
        durationTurns: null,
      };
  }
}

/**
 * Formats concrete real-number skill stats for cards, passive rows, and tooltips.
 * Uses effective level = min(storedLevel, adminConfig.skillMaxLevel), with next-level delta when applicable.
 */
export function formatSkillRealSummary(
  skill: SkillDefinition,
  storedOrPreviewLevel: number,
  lang: Language,
  adminConfig?: Partial<AdminConfig> | null,
  effectiveSpCost?: number
): SkillRealSummary {
  const maxLevel = getEffectiveSkillMaxLevel(adminConfig);
  const rawLv = Math.floor(storedOrPreviewLevel || 0);
  const effectiveLevel = Math.max(1, Math.min(maxLevel, rawLv > 0 ? rawLv : 1));
  const current = describeEffectAtLevel(skill, effectiveLevel, lang, adminConfig);

  const canAdvance = rawLv >= 1 && effectiveLevel < maxLevel;
  const nextLevel = canAdvance ? effectiveLevel + 1 : null;

  let nextValueText: string | null = null;
  if (nextLevel !== null) {
    const nextDesc = describeEffectAtLevel(skill, nextLevel, lang, adminConfig);
    if (
      nextDesc.compactValue &&
      nextDesc.compactValue !== current.compactValue
    ) {
      nextValueText = nextDesc.compactValue;
    }
  }

  const nextLine =
    nextLevel !== null && nextValueText
      ? `→ Lv.${nextLevel}: ${nextValueText}`
      : null;

  const spCost =
    typeof effectiveSpCost === 'number' ? effectiveSpCost : skill.spCost;
  const cooldownText = fmtCooldown(skill, lang);
  const targetText = getSkillTargetLabel(lang, skill.targetType);

  const tooltipParts = [
    current.primaryText,
    nextLine,
    skill.category !== 'passive' ? `${spCost} SP` : null,
    cooldownText,
    targetText,
  ].filter(Boolean);

  return {
    effectiveLevel,
    maxLevel,
    nextLevel,
    iconIds: current.iconIds,
    primaryText: current.primaryText,
    nextValueText,
    nextLine,
    spCost,
    cooldownText,
    durationTurns: current.durationTurns,
    targetText,
    tooltipText: tooltipParts.join(' · '),
  };
}
