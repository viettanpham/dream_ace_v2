import rawVoiceLines from './voiceLines.json';
import type { VoiceSpeakerSide, VoiceTrigger } from '../types/game';

export type VoiceLinesCatalog = Record<
  string,
  Partial<Record<VoiceSpeakerSide, readonly string[]>>
>;

export const VOICE_LINES: VoiceLinesCatalog = rawVoiceLines as VoiceLinesCatalog;

export function pickVoiceLine(
  trigger: VoiceTrigger | string,
  side: VoiceSpeakerSide | string,
  rand01: number
): string | null {
  const bySide = VOICE_LINES[trigger];
  if (!bySide || typeof bySide !== 'object') return null;
  const list = bySide[side as VoiceSpeakerSide];
  if (!Array.isArray(list) || list.length === 0) return null;
  const clamped = Number.isFinite(rand01)
    ? Math.max(0, Math.min(0.999999999, rand01))
    : 0;
  const idx = Math.floor(clamped * list.length);
  const picked = list[idx];
  return typeof picked === 'string' && picked.length > 0 ? picked : null;
}
