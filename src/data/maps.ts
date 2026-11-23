import type {
  BaseRuntimeState,
  BaseTokenShape,
  BaseType,
  BattleSize,
  MapLaneDefinition,
  SectorDefinition,
} from '../types/game';

/**
 * Canonical battle size by base type:
 * - Outpost / Colony / Relay -> 4v4 (round token)
 * - Fortress / Shipyard -> 6v6 (square token)
 * - Capital -> 8v8 with Boss (square token)
 */
export function getBattleSizeForBaseType(baseType: BaseType): BattleSize {
  switch (baseType) {
    case 'capital':
      return 8;
    case 'fortress':
    case 'shipyard':
      return 6;
    case 'outpost':
    case 'colony':
    case 'relay':
    default:
      return 4;
  }
}

export function getTokenShapeForBaseType(baseType: BaseType): BaseTokenShape {
  if (
    baseType === 'fortress' ||
    baseType === 'shipyard' ||
    baseType === 'capital'
  ) {
    return 'square';
  }
  return 'round';
}

export const SECTORS_CATALOG: SectorDefinition[] = [
  {
    id: 'border_outpost',
    name: 'Kestrel Relay Outpost',
    regionCode: 'Sector 04',
    baseType: 'outpost',
    tokenShape: 'round',
    baseLevel: 2,
    initialFaction: 'hostile',
    mapPos: { x: 245, y: 120 },
    difficulty: 'Standard',
    levelOffset: 0,
    squadSize: 4,
    enemyCount: 4,
    hasBoss: false,
    expMultiplier: 1.0,
    creditsMultiplier: 1.0,
    monthlyCredits: 220,
    monthlyWarPoints: 12,
    repairCost: 260,
    repairMonths: 1,
    npcs: ['quartermaster', 'mission_officer', 'engineer'],
    alliedGarrison: [
      { classId: 'interceptor', count: 2 },
      { classId: 'striker', count: 1 },
      { classId: 'support', count: 1 },
    ],
    hostileGarrison: [
      { classId: 'interceptor', count: 2 },
      { classId: 'striker', count: 1 },
      { classId: 'support', count: 1 },
    ],
    description:
      '4v4 frontier outpost skirmish against a hostile patrol squadron. Ideal for field-testing builds and securing forward income.',
  },
  {
    id: 'debris_belt',
    name: 'Caldera Fortress Belt',
    regionCode: 'Sector 09',
    baseType: 'fortress',
    tokenShape: 'square',
    baseLevel: 6,
    initialFaction: 'hostile',
    mapPos: { x: 520, y: 95 },
    difficulty: 'Hard',
    levelOffset: 1,
    squadSize: 6,
    enemyCount: 6,
    hasBoss: false,
    expMultiplier: 1.35,
    creditsMultiplier: 1.4,
    monthlyCredits: 420,
    monthlyWarPoints: 24,
    repairCost: 520,
    repairMonths: 2,
    npcs: ['quartermaster', 'mission_officer', 'pilot_for_hire', 'engineer'],
    alliedGarrison: [
      { classId: 'siege', count: 2 },
      { classId: 'striker', count: 2 },
      { classId: 'interceptor', count: 1 },
      { classId: 'support', count: 1 },
    ],
    hostileGarrison: [
      { classId: 'siege', count: 2, isStructure: true },
      { classId: 'striker', count: 2 },
      { classId: 'interceptor', count: 1 },
      { classId: 'support', count: 1 },
    ],
    description:
      '6v6 Fortress assault zone guarded by orbital defense turrets, veteran raiders, snipers, and repair tenders.',
  },
  {
    id: 'iron_citadel',
    name: 'Helios Capital Spire',
    regionCode: 'Sector 14',
    baseType: 'capital',
    tokenShape: 'square',
    baseLevel: 10,
    initialFaction: 'hostile',
    mapPos: { x: 755, y: 155 },
    difficulty: 'Elite',
    levelOffset: 2,
    squadSize: 8,
    enemyCount: 8,
    hasBoss: true,
    expMultiplier: 1.75,
    creditsMultiplier: 1.9,
    monthlyCredits: 780,
    monthlyWarPoints: 45,
    repairCost: 880,
    repairMonths: 2,
    npcs: ['quartermaster', 'mission_officer', 'pilot_for_hire', 'engineer'],
    alliedGarrison: [
      { classId: 'siege', count: 2 },
      { classId: 'striker', count: 3 },
      { classId: 'interceptor', count: 2 },
      { classId: 'support', count: 1 },
    ],
    hostileGarrison: [
      { classId: 'siege', count: 1, isBoss: true },
      { classId: 'siege', count: 2, isStructure: true },
      { classId: 'striker', count: 2 },
      { classId: 'interceptor', count: 2 },
      { classId: 'support', count: 1 },
    ],
    description:
      '8v8 Capital fleet battle led by a Flagship Boss Cruiser (5x bounty) and orbital defense batteries.',
  },
  {
    id: 'aegis_relay',
    name: 'Aegis Command Relay',
    regionCode: 'Sector 01',
    baseType: 'relay',
    tokenShape: 'round',
    baseLevel: 1,
    initialFaction: 'allied',
    mapPos: { x: 85, y: 165 },
    difficulty: 'Standard',
    levelOffset: 0,
    squadSize: 4,
    enemyCount: 4,
    hasBoss: false,
    expMultiplier: 1.0,
    creditsMultiplier: 1.0,
    monthlyCredits: 180,
    monthlyWarPoints: 10,
    repairCost: 220,
    repairMonths: 1,
    npcs: ['quartermaster', 'mission_officer', 'pilot_for_hire', 'engineer'],
    alliedGarrison: [
      { classId: 'striker', count: 1 },
      { classId: 'interceptor', count: 1 },
      { classId: 'siege', count: 1 },
      { classId: 'support', count: 1 },
    ],
    hostileGarrison: [
      { classId: 'interceptor', count: 2 },
      { classId: 'striker', count: 2 },
    ],
    description:
      'Allied forward relay station coordinating squadron logistics, mercenary contracts, and emergency hull maintenance.',
  },
  {
    id: 'veridian_colony',
    name: 'Veridian Mining Colony',
    regionCode: 'Sector 06',
    baseType: 'colony',
    tokenShape: 'round',
    baseLevel: 4,
    initialFaction: 'neutral',
    mapPos: { x: 350, y: 225 },
    difficulty: 'Standard',
    levelOffset: 0,
    squadSize: 4,
    enemyCount: 4,
    hasBoss: false,
    expMultiplier: 1.15,
    creditsMultiplier: 1.25,
    monthlyCredits: 320,
    monthlyWarPoints: 14,
    repairCost: 300,
    repairMonths: 1,
    npcs: ['quartermaster', 'mission_officer', 'engineer'],
    alliedGarrison: [
      { classId: 'striker', count: 2 },
      { classId: 'support', count: 2 },
    ],
    hostileGarrison: [
      { classId: 'striker', count: 2 },
      { classId: 'interceptor', count: 1 },
      { classId: 'support', count: 1 },
    ],
    description:
      '4v4 civilian ore colony rich in credits. Liberating and repairing its docks yields strong monthly funding.',
  },
  {
    id: 'vanguard_shipyard',
    name: 'Vanguard Orbital Shipyard',
    regionCode: 'Sector 11',
    baseType: 'shipyard',
    tokenShape: 'square',
    baseLevel: 8,
    initialFaction: 'hostile',
    mapPos: { x: 585, y: 230 },
    difficulty: 'Hard',
    levelOffset: 1,
    squadSize: 6,
    enemyCount: 6,
    hasBoss: false,
    expMultiplier: 1.45,
    creditsMultiplier: 1.55,
    monthlyCredits: 520,
    monthlyWarPoints: 30,
    repairCost: 600,
    repairMonths: 2,
    npcs: ['quartermaster', 'pilot_for_hire', 'engineer'],
    alliedGarrison: [
      { classId: 'siege', count: 2 },
      { classId: 'striker', count: 2 },
      { classId: 'support', count: 2 },
    ],
    hostileGarrison: [
      { classId: 'siege', count: 2, isStructure: true },
      { classId: 'striker', count: 2 },
      { classId: 'interceptor', count: 1 },
      { classId: 'support', count: 1 },
    ],
    description:
      '6v6 heavy orbital shipyard manufacturing gunships and wingman frames. Offers elite mercenaries once operational.',
  },
];

export const MAP_LANES: MapLaneDefinition[] = [
  { id: 'lane_aegis_border', from: 'aegis_relay', to: 'border_outpost' },
  { id: 'lane_aegis_veridian', from: 'aegis_relay', to: 'veridian_colony' },
  { id: 'lane_border_caldera', from: 'border_outpost', to: 'debris_belt' },
  { id: 'lane_border_veridian', from: 'border_outpost', to: 'veridian_colony' },
  { id: 'lane_veridian_shipyard', from: 'veridian_colony', to: 'vanguard_shipyard' },
  { id: 'lane_caldera_shipyard', from: 'debris_belt', to: 'vanguard_shipyard' },
  { id: 'lane_caldera_helios', from: 'debris_belt', to: 'iron_citadel' },
  { id: 'lane_shipyard_helios', from: 'vanguard_shipyard', to: 'iron_citadel' },
];

export function createInitialBaseStates(): Record<string, BaseRuntimeState> {
  const states: Record<string, BaseRuntimeState> = {};
  for (const sector of SECTORS_CATALOG) {
    const isAegis = sector.id === 'aegis_relay';
    states[sector.id] = {
      faction: sector.initialFaction,
      status: 'operational',
      repairMonthsRemaining: 0,
      // Aegis Relay starts with an active frontier raid countdown from Kestrel Outpost so the player immediately sees incoming lane dots + alert!
      underAttack: isAegis,
      attackCountdownMonths: isAegis ? 2 : 0,
      attackFromSectorId: isAegis ? 'border_outpost' : null,
    };
  }
  return states;
}

export function getSectorById(sectorId: string): SectorDefinition {
  return SECTORS_CATALOG.find((s) => s.id === sectorId) ?? SECTORS_CATALOG[0];
}

/**
 * @deprecated Replaced by cumulative visible-node frontline tracking in `src/engine/frontline.ts`.
 * Kept exported for backwards-compatibility only.
 */
export function getNextSectorId(currentSectorId: string): string | null {
  const campaignChain = [
    'border_outpost',
    'debris_belt',
    'iron_citadel',
    'veridian_colony',
    'vanguard_shipyard',
  ];
  const idx = campaignChain.indexOf(currentSectorId);
  if (idx === -1 || idx + 1 >= campaignChain.length) return null;
  return campaignChain[idx + 1];
}
