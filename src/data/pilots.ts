import type { EnemyArchetype, MechClassId, StatusEffectType } from '../types/game';

export interface PilotNamePool {
  firstNames: string[];
  callsigns: string[];
}

export const ALLY_PILOT_POOL: PilotNamePool = {
  firstNames: [
    'Kaelen',
    'Sora',
    'Marek',
    'Lyra',
    'Dax',
    'Talia',
    'Ronan',
    'Vesper',
    'Orin',
    'Nyx',
    'Cassian',
    'Freya',
    'Juno',
    'Bram',
    'Eira',
    'Torin',
    'Zara',
    'Kael',
  ],
  callsigns: [
    'Valkyrie-2',
    'Cobalt-4',
    'Horizon-7',
    'Specter-3',
    'Atlas-9',
    'Kestrel-5',
    'Nomad-6',
    'Orion-8',
    'Zenith-3',
    'Aegis-2',
    'Falcon-4',
    'Starwing-5',
    'Nova-6',
    'Vanguard-8',
    'Raptor-7',
    'Comet-9',
  ],
};

export const WINGMAN_CHAT_KEYS = [
  'chat.engaging',
  'chat.flankCover',
  'chat.targetLocked',
  'chat.shieldsHolding',
  'chat.pushingLine',
  'chat.goodHit',
] as const;

export interface EnemyArchetypeDefinition {
  id: EnemyArchetype;
  classId: MechClassId;
  names: string[];
  bossNames: string[];
  hpMult: number;
  shieldMult: number;
  attackMult: number;
  speedMult: number;
  inflictsStatus?: StatusEffectType;
  statusChance?: number;
}

export const ENEMY_ARCHETYPE_DEFS: Record<
  EnemyArchetype,
  EnemyArchetypeDefinition
> = {
  drone: {
    id: 'drone',
    classId: 'interceptor',
    names: ['Dart-Drone', 'Wasp-Drone', 'Pulse-Drone'],
    bossNames: ['Apex Swarm-Drone'],
    hpMult: 0.78,
    shieldMult: 0.85,
    attackMult: 0.95,
    speedMult: 1.28,
    inflictsStatus: 'slow',
    statusChance: 0.45,
  },
  gunship: {
    id: 'gunship',
    classId: 'siege',
    names: ['Iron Gunship', 'Bastion Corvette', 'Heavy Gunship'],
    bossNames: ['Dreadnought Boss'],
    hpMult: 1.38,
    shieldMult: 1.3,
    attackMult: 1.05,
    speedMult: 0.82,
    inflictsStatus: 'shield_cracked',
    statusChance: 0.45,
  },
  sniper: {
    id: 'sniper',
    classId: 'striker',
    names: ['Void Sniper', 'Rail-Hunter', 'Crimson Marksman'],
    bossNames: ['Eclipse Rail-Ace'],
    hpMult: 0.88,
    shieldMult: 0.9,
    attackMult: 1.24,
    speedMult: 1.08,
    inflictsStatus: 'burn',
    statusChance: 0.5,
  },
  repair_ship: {
    id: 'repair_ship',
    classId: 'support',
    names: ['Repair Tender', 'Aegis Frigate', 'Nano-Repair Ship'],
    bossNames: ['Command Carrier'],
    hpMult: 1.05,
    shieldMult: 1.25,
    attackMult: 0.8,
    speedMult: 0.98,
  },
};

export const ENEMY_PREFIXES = [
  'Void',
  'Crimson',
  'Obsidian',
  'Dread',
  'Nebula',
  'Phantom',
  'Solar',
  'Xeno',
];
