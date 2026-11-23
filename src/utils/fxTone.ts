import type { CombatFxEvent, CombatSide } from '../types/game';

export type ResolvedFxTone = 'heal' | 'shield' | 'sp' | 'buff' | 'damage';

/** Existing team accent colors for damage FX (matching BattleVfxOverlay getTeamPalette). */
export const DAMAGE_TEAM_ACCENTS: Record<CombatSide, string> = {
  ally: '#38bdf8',
  enemy: '#f97316',
};

export const FX_TONE_COLORS: Record<ResolvedFxTone, string> = {
  heal: '#22c55e',
  shield: '#38bdf8',
  sp: '#f59e0b',
  buff: '#facc15',
  damage: DAMAGE_TEAM_ACCENTS.ally,
};

export function resolveFxTone(
  fx: Pick<CombatFxEvent, 'kind' | 'tone'>
): ResolvedFxTone {
  if (fx.kind === 'heal') {
    return fx.tone ?? 'heal';
  }
  return 'damage';
}

export function resolveFxToneColor(
  fx: Pick<CombatFxEvent, 'kind' | 'tone' | 'fromSide' | 'accentHex'>
): string {
  const tone = resolveFxTone(fx);
  if (tone === 'damage') {
    return DAMAGE_TEAM_ACCENTS[fx.fromSide] ?? fx.accentHex ?? FX_TONE_COLORS.damage;
  }
  return FX_TONE_COLORS[tone];
}
