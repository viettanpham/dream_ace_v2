/**
 * Returns the Tailwind text color class representing enemy level contrast
 * relative to the player's active Gear level (`diff = enemyLevel - playerLevel`).
 */
export function levelConClass(diff: number): string {
  if (diff >= 5) return 'text-red-400';
  if (diff >= 3) return 'text-orange-400';
  if (diff >= -2) return 'text-slate-100';
  if (diff >= -4) return 'text-slate-400';
  return 'text-sky-400';
}
