export type Language = 'vi' | 'en';

export type StatKey =
  | 'attack'
  | 'defense'
  | 'fuel'
  | 'spirit'
  | 'shield'
  | 'evasion';

export type MechClassId = 'striker' | 'interceptor' | 'siege' | 'support';

export type StatBlock = Record<StatKey, number>;

export interface StatMeta {
  key: StatKey;
  label: string;
  shortLabel: string;
  effectSummary: string;
}

export interface DerivedStats {
  maxHp: number;
  maxShield: number;
  maxSp: number;
  speed: number;
  attackPower: number;
  defenseRating: number;
  dodgeChance: number; // 0 to 45 (%)
  critChance: number; // 5 to 65 (%)
  skillPower: number;
  armorPiercePct: number; // from equipped weapon/item traits (0 to 50)
  splashPct: number; // splash damage % on basic attacks (0 to 40)
  spRegenPerTurn: number; // bonus SP regen per turn from item traits + passives
  passiveSkillDmgPct: number; // from Striker passive
}

export type StatusEffectType =
  | 'burn'
  | 'shield_break'
  | 'slow'
  | 'silence'
  | 'stealth'
  | 'vulnerable'
  | 'def_up'
  | 'def_down'
  | 'eva_up'
  | 'atk_up'
  | 'spd_up'
  | 'primary_dmg_up'
  | 'skill_dmg_up'
  | 'sure_hit'
  | 'counter'
  | 'evade_all'
  | 'invincible'
  | 'regen_hp'
  | 'siege_mode'
  | 'siege_defense'
  | 'charging';

export interface ActiveStatusEffect {
  type: StatusEffectType;
  turnsRemaining: number; // 99 for active toggle stances
  magnitude?: number; // e.g., 0.25 = +25%
  charges?: number; // e.g., sure_hit (2), counter (1)
  breakOnAttack?: boolean; // Camouflage breaks on next attack
  isDebuff?: boolean;
  sourceSkillId?: string;
  targetId?: string; // stored target for Charge Shot
  sourceName?: string;
}

export type SkillClassScope = 'general' | MechClassId;

export type SkillCategory = 'normal' | 'special' | 'elite' | 'passive';

export type SkillTargetType =
  | 'self'
  | 'single_enemy'
  | 'multi_enemy'
  | 'all_enemies'
  | 'single_ally'
  | 'all_allies';

export type SkillIconKey =
  | 'shield'
  | 'wind'
  | 'flame'
  | 'crosshair'
  | 'target'
  | 'zap'
  | 'bomb'
  | 'battery'
  | 'ghost'
  | 'orbit'
  | 'anchor'
  | 'fortress'
  | 'snowflake'
  | 'shield_off'
  | 'eye_off'
  | 'ray'
  | 'sword'
  | 'rotate'
  | 'corner_down_left'
  | 'gauge'
  | 'radio'
  | 'sparkles'
  | 'skull'
  | 'heart'
  | 'radar'
  | 'bolt'
  | 'plus_circle'
  | 'waves'
  | 'swords'
  | 'shield_plus'
  | 'feather'
  | 'sun'
  | 'cleanse'
  | 'star';

export type SkillEffectKind =
  | 'buff_def'
  | 'buff_eva'
  | 'buff_primary_dmg'
  | 'buff_skill_dmg'
  | 'buff_sure_hit'
  | 'multi_attack'
  | 'splash_attack'
  | 'charge_attack'
  | 'stealth_turns'
  | 'aoe_elite_attack'
  | 'toggle_siege_mode'
  | 'toggle_siege_defense'
  | 'attack_slow'
  | 'attack_shield_break'
  | 'stealth_until_attack'
  | 'pierce_all_elite'
  | 'attack_pierce'
  | 'counter_stance'
  | 'retreat_back_eva'
  | 'buff_speed'
  | 'silence_target'
  | 'evade_all_round'
  | 'berserker_buff'
  | 'heal_single'
  | 'scan_reveal'
  | 'energize_single'
  | 'heal_field_hot'
  | 'energize_shield_field'
  | 'team_atk_up'
  | 'team_def_up'
  | 'team_eva_up'
  | 'invincible_ally'
  | 'purify_team'
  | 'full_recovery_elite'
  | 'passive_skill_dmg'
  | 'passive_def_pct'
  | 'passive_eva_spd'
  | 'passive_sp_regen';

export interface SkillDefinition {
  id: string;
  classScope: SkillClassScope;
  category: SkillCategory;
  icon: SkillIconKey;
  unlockLevel: number;
  spCost: number;
  cooldown: number; // turns (0 for toggles / passives / once-per-battle)
  targetType: SkillTargetType;
  effectKind: SkillEffectKind;
  powerMultiplier?: number; // e.g., 1.3 for 130%
  secondaryRatio?: number; // e.g., 0.5 for 50% splash, 0.3 for 30% pierce
  buffMagnitude?: number; // e.g., 0.25 for +25%
  secondaryMagnitude?: number; // e.g., second stat bonus in dual buffs
  duration?: number; // turns
  maxTargets?: number; // e.g., 3 for Strafing Run
  charges?: number; // e.g., 2 for Target Lock
  spAmount?: number; // e.g., +20 SP / +10 SP
  oncePerBattle?: boolean;
  isToggle?: boolean;
  openingCardId?: string;
}

export interface OpeningCardDefinition {
  id: string;
  skillId: string;
  classId: MechClassId;
  category: 'special' | 'elite';
  warPointCost: number;
}

export interface SkillValidationResult {
  ok: boolean;
  reason:
    | 'ok'
    | 'invalid_gear'
    | 'invalid_skill'
    | 'class_mismatch'
    | 'max_level'
    | 'missing_card'
    | 'level_too_low'
    | 'insufficient_credits'
    | 'is_passive'
    | 'not_learned'
    | 'already_equipped'
    | 'bar_full';
  requiredGearLevel?: number;
  requiredCardId?: string;
  cost?: number;
}

export interface BattleSkillUsability {
  canUse: boolean;
  reason:
    | 'ok'
    | 'class_mismatch'
    | 'not_equipped'
    | 'silenced'
    | 'charging'
    | 'on_cooldown'
    | 'already_used'
    | 'blocked_by_siege'
    | 'insufficient_sp';
  cooldownRemaining: number;
  spCost: number;
  isToggleActive?: boolean;
}

export interface MechClassDefinition {
  id: MechClassId;
  name: string;
  chassisCode: string;
  role: string;
  description: string;
  accentHex: string;
  baseStats: StatBlock;
  perPointGain: StatBlock;
  baseHp: number;
  baseShield: number;
  baseSp: number;
  baseSpeed: number;
  signatureSkillId: string;
}

export type SectorDifficulty = 'Standard' | 'Hard' | 'Elite';

export type BattleSize = 4 | 6 | 8;

export type BattleViewMode = 'card' | 'radar';

export type BaseType =
  | 'outpost'
  | 'colony'
  | 'relay'
  | 'fortress'
  | 'shipyard'
  | 'capital';

export type BaseTokenShape = 'round' | 'square';

export type BaseFaction = 'allied' | 'hostile' | 'neutral';

export type BaseStatus = 'operational' | 'damaged' | 'repairing';

export type BaseNpcRole =
  | 'quartermaster'
  | 'mission_officer'
  | 'pilot_for_hire'
  | 'engineer';

export interface GarrisonShipSpec {
  classId: MechClassId;
  count: number;
  isBoss?: boolean;
  isStructure?: boolean;
}

export interface MapLaneDefinition {
  id: string;
  from: string;
  to: string;
}

export interface BaseRuntimeState {
  faction: BaseFaction;
  status: BaseStatus;
  repairMonthsRemaining: number; // 0 when operational/damaged, 1..2 when repairing
  underAttack: boolean;
  attackCountdownMonths: number; // >0 when underAttack
  attackFromSectorId: string | null;
}

export interface HiredWingmanBuff {
  callsign: string;
  classId: MechClassId;
  bonusLevel: number;
  sourceSectorId: string;
}

export interface BonusMissionState {
  id: string;
  sourceSectorId: string;
  targetSectorId: string;
  rewardCredits: number;
  rewardWarPoints: number;
  completed: boolean;
}

export interface SectorDefinition {
  id: string;
  name: string;
  regionCode: string;
  baseType: BaseType;
  tokenShape: BaseTokenShape;
  baseLevel: number;
  initialFaction: BaseFaction;
  mapPos: { x: number; y: number };
  difficulty: SectorDifficulty;
  levelOffset: number;
  squadSize: BattleSize;
  enemyCount: number;
  hasBoss: boolean;
  expMultiplier: number;
  creditsMultiplier: number;
  monthlyCredits: number;
  monthlyWarPoints: number;
  repairCost: number;
  repairMonths: 1 | 2;
  npcs: BaseNpcRole[];
  alliedGarrison: GarrisonShipSpec[];
  hostileGarrison: GarrisonShipSpec[];
  description: string;
}

export type EquipmentSlot =
  | 'main_weapon'
  | 'sub_weapon'
  | 'armor'
  | 'engine'
  | 'cpu'
  | 'accessory';

export type ItemRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface ItemSpecialTraits {
  critBonusPct?: number;
  armorPiercePct?: number;
  splashPct?: number;
  spRegenPerTurn?: number;
  evasionMod?: number;
  longRange?: boolean;
}

export type ItemRegistryTag = 'sys' | (string & {});

export interface ItemTemplate {
  id: string;
  nameEn: string;
  nameVi: string;
  descEn: string;
  descVi: string;
  slot: EquipmentSlot;
  tier: number; // 1 to 4
  requiredLevel: number;
  classRestriction: MechClassId | null;
  basePrice: number;
  primaryStat: StatKey;
  primaryRange: [number, number];
  secondaryStat?: StatKey;
  secondaryRange?: [number, number];
  affixPool: StatKey[];
  specialTraits?: ItemSpecialTraits;
  registryTag?: ItemRegistryTag;
}

export interface ItemAffix {
  stat: StatKey;
  value: number;
  suffixId: string;
}

export interface ItemInstance {
  instanceId: string;
  templateId: string;
  slot: EquipmentSlot;
  tier: number;
  requiredLevel: number;
  classRestriction: MechClassId | null;
  rarity: ItemRarity;
  rolledBaseStats: Partial<StatBlock>;
  affixes: ItemAffix[];
  suffixId: string | null;
  rollQuality: number; // 0 to 100
  price: number;
  enchantLevel: number; // 0 to 10
  specialTraits?: ItemSpecialTraits;
  registryTag?: ItemRegistryTag;
  isStarter?: boolean;
  locked?: boolean;
  favorited?: boolean;
  isNew?: boolean;
  obtainedAt?: number;
}

export interface ShopItemListing extends ItemInstance {
  soldOut?: boolean;
}

export type ConsumableKind =
  | 'equipment_crate'
  | 'enchant_stone'
  | 'respec_token'
  | 'exp_boost';

export interface ConsumableItem {
  id: string;
  kind: ConsumableKind;
  quantity: number;
  slot?: EquipmentSlot;
  minRarity?: ItemRarity;
  bonusPct?: number;
  battlesCount?: number;
}

export interface WpMarketOffer {
  id: string;
  kind: ConsumableKind;
  wpCost: number;
  soldOut: boolean;
  slot?: EquipmentSlot;
  minRarity?: ItemRarity;
  bonusPct?: number;
  battlesCount?: number;
}

export type InventorySlotFilter = EquipmentSlot | 'all' | 'consumables';

export type InventoryUsabilityFilter = 'all' | 'selected_gear' | 'any_gear';

export type InventorySortKey =
  | 'newest'
  | 'level'
  | 'rarity'
  | 'tier'
  | 'rollQuality'
  | 'sellValue'
  | 'powerScore'
  | 'name';

export type InventorySortDirection = 'asc' | 'desc';

export interface InventoryFilterState {
  search: string;
  slot: InventorySlotFilter;
  rarities: ItemRarity[];
  tiers: number[];
  minLevel: number | null;
  maxLevel: number | null;
  usability: InventoryUsabilityFilter;
  minQuality: number;
  maxQuality: number;
  onlyUpgrades: boolean;
  lockedOnly: boolean;
  newOnly: boolean;
  sortBy: InventorySortKey;
  sortDir: InventorySortDirection;
  pinEquippedFirst: boolean;
}

export type QuickSellPresetId =
  | 'sell_common'
  | 'sell_below_level'
  | 'sell_worse_than_equipped';

export interface QuickSellFilterConfig {
  maxRarity: ItemRarity | null;
  maxTier: number | null;
  maxRequiredLevel: number | null;
  belowEquippedLevel: boolean;
  maxSellValue: number | null;
  maxRollQuality: number | null;
  worseThanEquipped: boolean;
  worseThanEquippedScope: 'selected' | 'any_owned';
}

export interface QuickSellUndoState {
  soldItems: ItemInstance[];
  totalCredits: number;
  soldAt: number;
}

export type EquippedSlotIds = Record<EquipmentSlot, string | null>;

export interface EquipValidationResult {
  canEquip: boolean;
  missingLevel: number | null;
  requiredClass: MechClassId | null;
  equippedOnOtherGear: MechClassId | null;
}

export type EnchantResultCode =
  | 'max_level'
  | 'insufficient_credits'
  | 'success'
  | 'failed';

export interface EnchantAttemptResult {
  attempted: boolean;
  success: boolean;
  code: EnchantResultCode;
  instanceId: string;
  templateId: string;
  previousLevel: number;
  newLevel: number;
  creditsSpent: number;
  successRate: number;
}

export type TacticsConditionKind =
  | 'always'
  | 'my_hp_below'
  | 'my_shield_zero'
  | 'my_sp_gte'
  | 'my_sp_pct_gte'
  | 'my_sp_lt'
  | 'any_ally_hp_below'
  | 'any_ally_has_debuff'
  | 'enemy_count_gte'
  | 'target_has_shield'
  | 'target_hp_below'
  | 'any_enemy_stealthed'
  | 'round_eq'
  | 'first_round'
  | 'boss_present'
  | 'my_buff_not_active'
  | 'skill_off_cooldown';

export type TacticsTargetSelector =
  | 'lowest_hp_enemy'
  | 'highest_hp_enemy'
  | 'highest_atk_enemy'
  | 'fastest_enemy'
  | 'enemy_support_first'
  | 'enemy_sniper_first'
  | 'front_row_first'
  | 'back_row_first'
  | 'random_enemy'
  | 'same_as_last_turn'
  | 'self'
  | 'lowest_hp_ally'
  | 'all_allies';

export interface TacticsCondition {
  kind: TacticsConditionKind;
  value?: number; // percentage (0..100), SP amount, enemy count, or round number
  buffType?: StatusEffectType; // used by my_buff_not_active
  skillId?: string; // used by skill_off_cooldown
}

export interface TacticsActionSpec {
  type: ActionType;
  skillId?: string;
}

export interface TacticsRule {
  id: string;
  enabled: boolean;
  condition: TacticsCondition;
  action: TacticsActionSpec;
  targetSelector: TacticsTargetSelector;
}

export interface AutoSafetyConfig {
  stopOnLowHpEnabled: boolean;
  stopOnLowHpPct: number; // default 25
  stopOnEliteReady: boolean;
  stopOnBossPresent: boolean;
  autoRetreatLowHpEnabled: boolean; // OFF by default
  autoRetreatLowHpPct: number; // default 15
}

export type TacticsPresetId =
  | 'class_default'
  | 'balanced'
  | 'focus_weak'
  | 'defensive';

export type SimpleTacticsPresetId =
  | 'balanced'
  | 'aggressive'
  | 'defensive'
  | 'support_team'
  | 'save_sp';

export type SimpleTargetPref =
  | 'weakest'
  | 'strongest'
  | 'support_first'
  | 'sniper_first'
  | 'front_row';

export type SimpleSkillUsage = 'always' | 'save_sp_50' | 'needed_only';

export type SimpleLowHpAction = 'defend' | 'heal' | 'retreat' | 'nothing';

export type SimpleElitePolicy = 'immediate' | 'boss_only' | 'off';

export interface SimpleTacticsConfig {
  presetId: SimpleTacticsPresetId;
  preferredTarget: SimpleTargetPref;
  skillUsage: SimpleSkillUsage;
  lowHpThresholdPct: number; // default 35 (10..80)
  lowHpAction: SimpleLowHpAction;
  elitePolicy: SimpleElitePolicy;
  prioritySkillIds: string[]; // up to 3 skill IDs from equipped bar (A > B > C)
}

export type TacticsMode = 'simple' | 'custom';

export interface GearTacticsProfile {
  mode?: TacticsMode;
  simple?: SimpleTacticsConfig;
  rules: TacticsRule[];
  safety: AutoSafetyConfig;
}

export type AutoRepeatLimit = 1 | 5 | 10 | 20 | 'infinite';

export type AutoStopReason =
  | 'completed'
  | 'defeat'
  | 'defeat_streak'
  | 'retreat'
  | 'low_hp'
  | 'elite_ready'
  | 'boss_present'
  | 'auto_retreat'
  | 'inventory_full'
  | 'manual_stop';

export interface AutoRepeatSession {
  active: boolean;
  limit: AutoRepeatLimit;
  sectorId: string;
  completedRuns: number;
  wins: number;
  consecutiveDefeats?: number;
  totalExp: number;
  totalCredits: number;
  totalWarPoints: number;
  totalDrops: ItemInstance[];
  stopReason: AutoStopReason | null;
}

export interface AutoRepeatRunToast {
  id: string;
  runNumber: number;
  outcome: 'victory' | 'defeat';
  expGained: number;
  creditsGained: number;
  warPointsGained: number;
  lootCount: number;
}

export type TeamColorRole = 'me' | 'ally' | 'enemy' | 'boss';

export interface TurnQueueEntry {
  unitId: string;
  name: string;
  classId: MechClassId;
  side: CombatSide;
  isPlayer: boolean;
  isBoss: boolean;
  teamRole: TeamColorRole;
  effectiveSpeed: number;
  baseSpeed: number;
  isSlowed: boolean;
  isSpeedBoosted: boolean;
  phase: 'current' | 'upcoming' | 'next_round';
}

export interface TurnQueueView {
  round: number;
  current: TurnQueueEntry[];
  next: TurnQueueEntry[];
}

export interface GearUnit {
  classId: MechClassId;
  owned: boolean;
  level: number;
  exp: number;
  unspentPoints: number;
  allocatedPoints: StatBlock;
  equipped: EquippedSlotIds;
  skillLevels: Record<string, number>; // learned skillId -> 1..5
  equippedSkillBar: string[]; // up to 6 active skills (class + general only)
  tactics: GearTacticsProfile;
  battlesWon: number;
  battlesFought: number;
}

export interface PilotAccount {
  name: string;
  credits: number;
  warPoints: number;
  ownedOpeningCards: string[];
  inventory: ItemInstance[];
  gears: Record<MechClassId, GearUnit>;
  activeGearId: MechClassId;
  unlockedSectorIds: string[];
  capturedSectorIds: string[];
  campaignMonth: number;
  baseStates: Record<string, BaseRuntimeState>;
  hiredWingman: HiredWingmanBuff | null;
  engineerShieldBoost: boolean;
  activeBonusMission: BonusMissionState | null;
  consumables?: ConsumableItem[];
  activeExpBoostBattles?: number;
  activeEnchantBonusPct?: number;
  squadFormation?: SquadFormationUnit[];
  formationCustomized?: boolean;
}

export type EnemyArchetype = 'drone' | 'gunship' | 'sniper' | 'repair_ship';

export type CombatSide = 'ally' | 'enemy';

export type CombatRow = 'front' | 'middle' | 'back';

export interface FormationRowModifier {
  /** Defense % modifier (e.g. 0.10 = +10% DEF, -0.10 = -10% DEF) */
  defensePct: number;
  /** General damage % modifier (e.g. 0 = 0%, -0.10 = -10% DMG) */
  damagePct: number;
  /** Additional damage % modifier for ranged weapons/units (e.g. 0.10 = +10% ranged DMG) */
  rangedDamagePct: number;
}

export interface FormationConfig {
  rowCapacities: Record<CombatRow, number>;
  maxUnitsPerSide: number;
  rowModifiers: Record<CombatRow, FormationRowModifier>;
}

export interface SquadFormationUnit {
  id: string;
  name: string;
  callsign: string;
  classId: MechClassId;
  isPlayer: boolean;
  row: CombatRow;
  formationCol: number;
}

export type UnitAnimState =
  | 'idle'
  | 'attacking'
  | 'hit'
  | 'shielded'
  | 'evaded'
  | 'casting'
  | 'destroyed';

export interface CombatUnit {
  id: string;
  name: string;
  callsign: string;
  side: CombatSide;
  row: CombatRow;
  formationCol?: number; // 0..(cols-1) within its row for adjacent splash & grid/radar layout
  hasLongRangeWeapon?: boolean;
  isPlayer: boolean;
  classId: MechClassId;
  archetype?: EnemyArchetype;
  isBoss?: boolean;
  isStructure?: boolean; // Turrets / structures / orbital stations (square tokens in Radar View)
  level: number;
  skillLevel: number; // fallback for NPCs
  skillLevels: Record<string, number>;
  equippedSkillIds: string[]; // up to 6 active skills
  skillCooldowns: Record<string, number>; // skillId -> turns remaining
  usedOnceSkills: string[]; // Elite skills already consumed this battle
  stats: StatBlock;
  derived: DerivedStats;
  hp: number;
  shield: number;
  sp: number;
  isDefending: boolean;
  alive: boolean;
  statuses: ActiveStatusEffect[];
  animState: UnitAnimState;
}

export type ActionType = 'attack' | 'skill' | 'defend';

export type PopupTone =
  | 'damage'
  | 'crit'
  | 'shield'
  | 'heal'
  | 'evade'
  | 'buff'
  | 'status';

export interface FloatingPopup {
  id: string;
  unitId: string;
  text: string;
  tone: PopupTone;
}

export type CombatLogTag =
  | 'ATTACK'
  | 'SKILL'
  | 'DEFEND'
  | 'CRIT'
  | 'EVADE'
  | 'SHIELD'
  | 'HEAL'
  | 'STATUS'
  | 'KO'
  | 'SYSTEM';

export type CombatLogTemplateKey =
  | 'log.battleStart'
  | 'log.defend'
  | 'log.healSquad'
  | 'log.healSingle'
  | 'log.energize'
  | 'log.evade'
  | 'log.damage'
  | 'log.destroyed'
  | 'log.statusApplied'
  | 'log.burnTick'
  | 'log.regenTick'
  | 'log.statusCleansed'
  | 'log.splashDamage'
  | 'log.retreat'
  | 'log.buffApplied'
  | 'log.stanceToggle'
  | 'log.charging'
  | 'log.counterAttack'
  | 'log.scanReveal'
  | 'log.invincibleBlock'
  | 'log.silencedBlocked'
  | 'log.wingmanChat'
  | 'log.unitMovesRow'
  | 'log.invalidTarget';

export interface CombatLogEntry {
  id: string;
  round: number;
  actorName: string;
  actorSide?: CombatSide;
  actorIsPlayer?: boolean;
  actorIsBoss?: boolean;
  autoRuleNumber?: number; // >0 => [AUTO #N], 0 => [AUTO] fallback
  tag: CombatLogTag;
  templateKey: CombatLogTemplateKey;
  params: Record<string, string | number>;
}

export type CombatFxKind = 'laser' | 'missile' | 'railgun' | 'heal';

export interface CombatFxEvent {
  id: string;
  kind: CombatFxKind;
  fromSide: CombatSide;
  fromSlotIndex: number; // 0..7
  fromUnitId?: string;
  toSide: CombatSide;
  toSlotIndices: number[];
  toUnitIds?: string[];
  accentHex: string;
}

export interface BattleSummary {
  outcome: 'victory' | 'defeat';
  retreated?: boolean;
  deployedGearId: MechClassId;
  sectorId: string;
  rounds: number;
  expGained: number;
  creditsGained: number;
  warPointsGained: number;
  baseCaptureBonusWp: number;
  leveledUp: boolean;
  previousLevel: number;
  newLevel: number;
  statPointsGained: number;
  battlesToNextLevel: number;
  unlockedSectorId: string | null;
  enemiesDestroyed: number;
  totalEnemies: number;
  alliesSurviving: number;
  droppedItems: ItemInstance[];
}

export interface WingmanChatter {
  id: string;
  unitId: string;
  unitName: string;
  textKey: string;
}

export type BattleEventType =
  | 'turn_start'
  | 'attack'
  | 'skill_cast'
  | 'damage'
  | 'dodge'
  | 'heal'
  | 'shield_grant'
  | 'defend'
  | 'status_applied'
  | 'cleanse'
  | 'kill';

export interface BattleEventFlags {
  crit?: boolean;
  dodge?: boolean;
  shieldAbsorbed?: boolean;
  kill?: boolean;
  splash?: boolean;
  counter?: boolean;
  isDebuff?: boolean;
  isBurn?: boolean;
  isRegen?: boolean;
  invincible?: boolean;
}

export interface BattleEvent {
  id: string;
  round: number;
  turn: number;
  actorId: string;
  targetId?: string;
  type: BattleEventType;
  amount?: number;
  shieldAbsorbed?: number;
  hpDamage?: number;
  spSpent?: number;
  skillId?: string;
  statusId?: StatusEffectType;
  flags?: BattleEventFlags;
}

export interface BattleRoundSnapshot {
  round: number;
  allyHp: number;
  allyMaxHp: number;
  allyHpPct: number;
  enemyHp: number;
  enemyMaxHp: number;
  enemyHpPct: number;
}

export interface SkillBreakdownStats {
  skillId: string; // 'basic_attack' or actual skillId
  uses: number;
  damage: number;
  healing: number;
  shieldGranted: number;
  crits: number;
}

export interface UnitBattleStats {
  unitId: string;
  name: string;
  classId: MechClassId;
  side: CombatSide;
  isPlayer: boolean;
  isBoss: boolean;
  alive: boolean;
  hp: number;
  maxHp: number;
  damageDealt: number;
  damageTakenHp: number;
  damageTakenShield: number;
  damageTakenTotal: number;
  healingDone: number;
  shieldGranted: number;
  shieldAbsorbed: number;
  hits: number;
  crits: number;
  critRate: number; // 0..100
  dodges: number;
  kills: number;
  deaths: number;
  turnsTaken: number;
  spSpent: number;
  buffsApplied: number;
  debuffsApplied: number;
  buffsReceived: number;
  debuffsReceived: number;
  damagePerTurn: number;
  skills: Record<string, SkillBreakdownStats>;
}

export interface TeamBattleStats {
  side: CombatSide;
  damageDealt: number;
  damageTakenHp: number;
  damageTakenShield: number;
  damageTakenTotal: number;
  healingDone: number;
  shieldGranted: number;
  shieldAbsorbed: number;
  hits: number;
  crits: number;
  critRate: number;
  dodges: number;
  kills: number;
  deaths: number;
  turnsTaken: number;
  spSpent: number;
  buffsApplied: number;
  debuffsApplied: number;
  aliveCount: number;
  totalCount: number;
  remainingHp: number;
  totalMaxHp: number;
  remainingHpPct: number;
}

export interface RoundDamagePoint {
  round: number;
  allyCumulativeDamage: number;
  enemyCumulativeDamage: number;
}

export interface BattleMvpAward {
  unitId: string;
  value: number;
}

export interface BattleStatsSummary {
  rounds: number;
  ally: TeamBattleStats;
  enemy: TeamBattleStats;
  units: UnitBattleStats[];
  roundDamageSeries: RoundDamagePoint[];
  roundHpSeries: BattleRoundSnapshot[];
  mvps: {
    mostDamage: BattleMvpAward | null;
    mostHealing: BattleMvpAward | null;
    mostDamageTaken: BattleMvpAward | null;
    mostDodges: BattleMvpAward | null;
  };
}

export interface BattleState {
  sectorId: string;
  deployedGearId: MechClassId;
  squadSize: BattleSize;
  units: CombatUnit[];
  turnOrder: string[];
  activeTurnIndex: number;
  round: number;
  turnCounter: number;
  selectedTargetId: string | null;
  selectedAllyTargetId: string | null;
  lastPlayerTargetId: string | null;
  autoStopNotice: AutoStopReason | null;
  wingmanChat?: WingmanChatter | null;
  log: CombatLogEntry[];
  events: BattleEvent[];
  roundSnapshots: BattleRoundSnapshot[];
  popups: FloatingPopup[];
  fxEvents: CombatFxEvent[];
  explodedUnitIds: string[];
  isResolving: boolean;
  summary: BattleSummary | null;
}

export type BattleSpeed = 1 | 2 | 3 | 5 | 10;

export interface AutoEquipClassWeights {
  attack: number;
  defense: number;
  fuel: number;
  spirit: number;
  shield: number;
  evasion: number;
  critBonusPct: number;
  armorPiercePct: number;
  splashPct: number;
  spRegenPerTurn: number;
  evasionMod: number;
  longRangeBonus: number;
  tierBonus: number;
  qualityWeight: number;
}

export interface AutoEquipConfig {
  replaceMarginPct: number;
  classWeights: Record<MechClassId, AutoEquipClassWeights>;
}

export interface AutoEquipTraitDeltas {
  critBonusPct: number;
  armorPiercePct: number;
  splashPct: number;
  spRegenPerTurn: number;
  evasionMod: number;
  longRangeDelta: -1 | 0 | 1;
}

export interface AutoEquipSlotPlan {
  slot: EquipmentSlot;
  currentItem: ItemInstance | null;
  nextItem: ItemInstance | null;
  currentScore: number;
  nextScore: number;
  scoreDelta: number;
  changed: boolean;
  statDeltas: StatBlock;
  traitDeltas: AutoEquipTraitDeltas;
  reassignedFromGear: MechClassId | null;
}

export interface AutoEquipGearPlan {
  gearId: MechClassId;
  slots: AutoEquipSlotPlan[];
  changedCount: number;
  totalCurrentScore: number;
  totalNextScore: number;
  totalStatDeltas: StatBlock;
}

export interface AutoEquipPlan {
  mode: 'single' | 'all';
  targetGearId: MechClassId;
  gearPlans: AutoEquipGearPlan[];
  totalChangedSlots: number;
}

export interface AutoEquipUndoSnapshot {
  mode: 'single' | 'all';
  targetGearId: MechClassId;
  previousEquippedByGear: Partial<Record<MechClassId, EquippedSlotIds>>;
  changedSlotsCount: number;
  appliedAt: number;
}

export type StarterBoostScope = 'new_gears_only' | 'fill_empty_slots';

export interface StarterSlotConfig {
  templateId: string;
  level: number;
  quality: number;
}

export interface StarterSetConfig {
  enabled: boolean;
  slots: Record<EquipmentSlot, StarterSlotConfig>;
  rookieBoostPct: number;
  boostScope: StarterBoostScope;
}

export type IconCatalogKind = 'normal' | 'buff' | 'debuff';

export type IconCatalogGroupId =
  | 'BS'
  | 'SS'
  | 'BF'
  | 'DB'
  | 'DT'
  | 'CC'
  | 'EV'
  | 'RW';

export type IconCatalogTag = 'sys' | 'mods';

export interface IconCatalogLayer {
  symbol: string;
  color: string;
  opacity: number;
}

export interface IconCatalogRow {
  id: string;
  nameVi: string;
  group: IconCatalogGroupId;
  symbol?: string;
  layers?: IconCatalogLayer[];
  color: string;
  kind: IconCatalogKind;
  tag: IconCatalogTag;
}

export interface IconCatalogModRow {
  id: string;
  nameVi?: string;
  group?: IconCatalogGroupId;
  symbol?: string;
  layers?: IconCatalogLayer[];
  color?: string;
  kind?: IconCatalogKind;
  tag?: 'mods';
}

export type StatusBadgeLayout = 'A' | 'B';

export interface StatusDisplaySettings {
  badgeLayout: StatusBadgeLayout;
  phoneRows: number;
  desktopRows: number;
  playerPhoneRows: number;
  playerDesktopRows: number;
}

export type StatusDisplayDefaults = Partial<StatusDisplaySettings>;

export interface AdminConfig {
  godMode: boolean;
  oneHitKills: boolean;
  alwaysWin: boolean;
  rewardMultiplier: number;
  battleSizeOverride: BattleSize | null;
  softEnrageEnabled: boolean;
  enrageStartRound: number;
  enrageStepPct: number;
  forceBoss: boolean;
  battleLevelOffsetOverride: number | null;
  shopMinStock: number;
  shopMaxStock: number;
  shopRarityWeights: Record<ItemRarity, number>;
  shopPriceMultiplier: number;
  formation: FormationConfig;
  autoEquip?: AutoEquipConfig;
  starterSet?: StarterSetConfig;
  iconCatalogMods?: IconCatalogModRow[];
  statusDisplayDefaults?: StatusDisplayDefaults;
  showRawI18nKeys: boolean;
}

export type BaseTab = 'gear' | 'garage' | 'skill' | 'shop' | 'map';

export type ScreenState = 'TITLE' | 'HANGAR' | 'SHOP' | 'BATTLE';
