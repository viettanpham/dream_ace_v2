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
  accuracyPct?: number; // from equipped radar/item traits (0 to 30)
  splashPct: number; // splash damage % on basic attacks (0 to 40)
  spRegenPerTurn: number; // bonus SP regen per turn from item traits + passives
  passiveSkillDmgPct: number; // from Striker passive
  critDamagePct?: number; // S1c-1: bonus critical damage percentage points (e.g. 25 => +25%)
  healPowerPct?: number; // S1c-1: bonus outgoing HP heal percentage points
  shieldPowerPct?: number; // S1c-1: bonus outgoing shield restore percentage points
  shieldRegenPctAdd?: number; // S1c-1: additive per-turn shield regen % + cap
  hpRegenPctAdd?: number; // S1c-1: additive own-turn-start self HP regen %
  executeDmgPct?: number; // S1c-1: bonus damage % vs targets below 30% HP
  lastStandDefPct?: number; // S1c-1: bonus own DEF % while own HP below 30%
}

export type StatusEffectType =
  | 'burn'
  | 'shield_break'
  | 'shield_cracked'
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
  | 'charging'
  | 'registry_effect';

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
  registryId?: string; // S1a: status registry id for registry-only effects
  stacks?: number; // S1a: current stack count (>= 1)
  sourceId?: string; // S1a: caster unit id
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
  | 'star'
  | 'remove_moderator'
  | 'explosion'
  | 'flare'
  | 'health_cross'
  | 'security'
  | 'shield_with_heart'
  | 'center_focus_strong'
  | 'air'
  | 'health_and_safety'
  | 'add_moderator'
  | 'shield_moon';

export type PassiveStatKey =
  | 'attackPct'
  | 'defPct'
  | 'evaPct'
  | 'speedFlat'
  | 'spRegenFlat'
  | 'maxHpPct'
  | 'maxShieldPct'
  | 'critFlat'
  | 'critDamagePct'
  | 'dodgeFlat'
  | 'armorPierceFlat'
  | 'healPowerPct'
  | 'shieldPowerPct'
  | 'shieldRegenPctAdd'
  | 'hpRegenPctAdd'
  | 'executeDmgPct'
  | 'lastStandDefPct';

export type SkillEffectSpecKind =
  | 'damage'
  | 'heal_hp_pct'
  | 'restore_shield_pct'
  | 'restore_sp'
  | 'apply_status';

export interface SkillEffectSpec {
  kind: SkillEffectSpecKind;
  target?: 'skill' | 'self';
  powerMultiplier?: number;
  pct?: number;
  amount?: number;
  value?: number;
  statusId?: string;
  duration?: number;
}

export interface PassiveStatEntry {
  key: PassiveStatKey;
  perLevel: number;
}

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
  | 'sp_transfer'
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
  | 'passive_sp_regen'
  | 'passive_stat'
  | 'spec';

export type SkillRegistryTag = 'sys' | 'mod';

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
  shieldDamageMult?: number; // e.g., 1.5 for Aegis Sunder shield damage multiplier
  secondaryRatio?: number; // e.g., 0.5 for 50% splash, 0.3 for 30% pierce
  buffMagnitude?: number; // e.g., 0.25 for +25%
  secondaryMagnitude?: number; // e.g., second stat bonus in dual buffs
  duration?: number; // turns
  maxTargets?: number; // e.g., 3 for Strafing Run
  charges?: number; // e.g., 2 for Target Lock
  spAmount?: number; // e.g., +20 SP / +10 SP
  passiveStats?: PassiveStatEntry[]; // S1c-1: generic per-level passive stat table (1-2 entries)
  effects?: SkillEffectSpec[]; // S1c-2: generic composable skill effect specs (1-3 entries)
  oncePerBattle?: boolean;
  isToggle?: boolean;
  phaseOverride?: 'step2' | 'step3';
  openingCardId?: string;
  registryTag?: SkillRegistryTag;
}

export interface SkillModDefinition extends SkillDefinition {
  category: 'normal' | 'passive';
  nameVi: string;
  nameEn: string;
  descVi: string;
  descEn: string;
  iconId: string;
  disabled?: boolean;
  registryTag: 'mod';
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
    | 'bar_full'
    | 'passive_slots_full';
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
    | 'insufficient_sp'
    | 'flux_min_sp'
    | 'used_this_turn'
    | 'revealed_this_round';
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
  | 'accessory'
  | 'radar'
  | 'module';

export type PaperDollSlot = Exclude<EquipmentSlot, 'module'>;

export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface ItemSpecialTraits {
  critBonusPct?: number;
  armorPiercePct?: number;
  splashPct?: number;
  spRegenPerTurn?: number;
  evasionMod?: number;
  longRange?: boolean;
  accuracyPct?: number;
  detectStealth?: boolean;
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

export interface SupplyShopListing {
  templateId: string;
  remaining: number;
}

export interface SupplyShopWpListing {
  slotId: string;
  templateId: string;
  remaining: number;
}

export interface SupplyShopRefreshState {
  used: number;
}

export type VoucherKind = 'credit' | 'exp';

export type VoucherWeightMode = 'perType' | 'tierDecay';

export interface VoucherDef {
  id: string;
  kind: VoucherKind;
  value: number;
  system?: boolean;
  weight?: number;
  maxStock?: number;
}

export interface VoucherOverride {
  weight?: number;
  maxStock?: number;
}

export interface VoucherConfig {
  creditPerWp: number;
  expPerWp: number;
  mode: VoucherWeightMode;
  baseWeight: number;
  tierDecayPct: number;
  typesPerRoll: number;
  overrides: Record<string, VoucherOverride>;
  custom: VoucherDef[];
}

export interface VoucherShopListing {
  voucherId: string;
  remaining: number;
}

export type ConsumableKind =
  | 'equipment_crate'
  | 'enchant_stone'
  | 'respec_token'
  | 'exp_boost'
  | 'battle_supply';

export type SupplyFamily = 'hp_kit' | 'shield_kit' | 'sp_kit' | 'buff' | 'utility';

export type SupplyEffectKind =
  | 'heal_hp_pct'
  | 'restore_shield_pct'
  | 'restore_sp_pct'
  | 'heal_hp'
  | 'restore_shield'
  | 'restore_sp'
  | 'reveal_stealth_front';

export interface SupplyEffect {
  kind: SupplyEffectKind;
  value: number;
}

export interface SupplyTemplate {
  id: string;
  family: SupplyFamily;
  tier: 1 | 2 | 3 | 4 | 5;
  unlockLevel: number;
  iconId: string;
  effects: SupplyEffect[];
  cooldownTurns: number;
  perBattleLimit: number;
  priceOverride?: number;
  registryTag: 'sys' | 'mods';
}

export interface BattleSupplyUnitState {
  usedThisTurn: number;
  usedCountsByTemplate: Record<string, number>;
  cooldownsByTemplate: Record<string, number>;
  stockByTemplate?: Record<string, number>;
}

export interface ConsumableItem {
  id: string;
  kind: ConsumableKind;
  quantity: number;
  templateId?: string;
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
  soldFromWarehouseIds?: string[];
}

export type ModuleFamily = 'stat' | 'trait' | 'skill';

export type ModuleTraitKey =
  | 'critBonusPct'
  | 'armorPiercePct'
  | 'spRegenPerTurn'
  | 'accuracyPct';

export interface ModuleTemplate {
  id: string;
  nameVi: string;
  nameEn: string;
  descVi: string;
  descEn: string;
  iconId: string;
  family: ModuleFamily;
  tier: 1 | 2 | 3 | 4;
  requiredLevel: number;
  effectKey: StatKey | ModuleTraitKey | string;
  value: number;
  skillId?: string;
  registryTag: 'sys' | 'mods';
}

export type ExtenderEquipFailureReason =
  | 'socket_locked'
  | 'level_too_low'
  | 'not_module'
  | 'same_effect'
  | 'skill_limit'
  | 'in_other_gear';

export type EquippedSlotIds = Record<PaperDollSlot, string | null>;

export interface EquipValidationResult {
  canEquip: boolean;
  missingLevel: number | null;
  requiredClass: MechClassId | null;
  equippedOnOtherGear: MechClassId | null;
}

export type EnchantResultCode =
  | 'max_level'
  | 'not_enchantable'
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

export type LidarAutoMode = 'smart' | 'fixed';

export interface LidarAutoConfig {
  enabled: boolean;
  mode: LidarAutoMode;
  minSpPct: number; // default 50 (0..100)
}

export type FluxAutoMode = 'smart' | 'fixed';

export interface FluxAutoConfig {
  enabled: boolean;
  mode: FluxAutoMode;
  allySpBelowPct: number; // default 25 (0..100)
  keepSelfPct: number; // default 50 (0..100)
}

export interface AutoSuppliesConfig {
  enabled: boolean;
  hpBelowPct: number; // default 35 (5..90)
  shieldBelowPct: number; // default 25 (5..90)
  spBelowPct: number; // default 20 (5..90)
  buffAtStart: boolean; // default true (stored for CS5)
}

export interface SimpleTacticsConfig {
  presetId: SimpleTacticsPresetId;
  preferredTarget: SimpleTargetPref;
  skillUsage: SimpleSkillUsage;
  lowHpThresholdPct: number; // default 35 (10..80)
  lowHpAction: SimpleLowHpAction;
  elitePolicy: SimpleElitePolicy;
  prioritySkillIds: string[]; // up to MAX_PRIORITY_SKILLS skill IDs from equipped bar (A > B > C ...)
  lidarAuto?: LidarAutoConfig;
  fluxAuto?: FluxAutoConfig;
  autoSupplies?: AutoSuppliesConfig;
}

export type TacticsMode = 'simple' | 'custom';

export interface GearTacticsProfile {
  mode?: TacticsMode;
  simple?: SimpleTacticsConfig;
  rules: TacticsRule[];
  safety: AutoSafetyConfig;
}

export type AutoRepeatLimit = 1 | 5 | 10 | 20 | 'infinite';

export type BattleKind =
  | 'assault'
  | 'defend'
  | 'patrol'
  | 'mission'
  | 'event';

export interface LaunchBattleOptions {
  kind?: BattleKind;
  sourceId?: string | null;
}

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
  | 'node_not_contested'
  | 'source_inactive'
  | 'manual_stop';

export type AutoRepeatDefeatRule =
  | 'stop_immediately'
  | 'stop_after_n'
  | 'never_stop';

export interface AutoRepeatSession {
  active: boolean;
  limit: AutoRepeatLimit;
  sectorId: string;
  kind?: BattleKind;
  sourceId?: string | null;
  completedRuns: number;
  wins: number;
  consecutiveDefeats?: number;
  defeatStreakLimit?: number;
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
  level: number;
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
  skillLevels: Record<string, number>; // learned skillId -> 1..20
  equippedSkillBar: string[]; // up to 6 active skills (class + general only)
  equippedPassives?: string[]; // equipped passive skillIds (up to unlocked slots)
  supplyLoadout: string[]; // battle supply templateIds equipped for battle
  extenders?: (string | null)[]; // 5 extender module slot ids (null = empty)
  tactics: GearTacticsProfile;
  battlesWon: number;
  battlesFought: number;
}

export type WorldClockSpeedMode = 'fast' | 'normal' | 'slow' | 'custom';

export interface WorldClockState {
  worldDay: number;
  lastTickAt: number | null;
  speedMode: WorldClockSpeedMode;
  secondsPerDay: number;
  paused: boolean;
}

export interface PilotAccount {
  name: string;
  credits: number;
  warPoints: number;
  ownedOpeningCards: string[];
  inventory: ItemInstance[];
  warehouse: ItemInstance[];
  worldClock: WorldClockState;
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
  pirateIncidents?: PirateIncident[];
  sectorSupply?: Record<string, number>;
  vouchers?: Record<string, number>;
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
  accuracyPct?: number;
  detectsStealth?: boolean;
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
  hitsSinceOwnTurn?: number;
  revealedThisRound?: boolean;
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
  | 'log.sectorSupply'
  | 'log.enragePhaseActivated'
  | 'log.defend'
  | 'log.healSquad'
  | 'log.healSingle'
  | 'log.shieldSingle'
  | 'log.energize'
  | 'log.spTransfer'
  | 'log.evade'
  | 'log.damage'
  | 'log.destroyed'
  | 'log.statusApplied'
  | 'log.shieldCrackNoShield'
  | 'log.shieldBreakBlocked'
  | 'log.burnTick'
  | 'log.regenTick'
  | 'log.registryDotTick'
  | 'log.registryHotTick'
  | 'log.controlResisted'
  | 'log.shieldRegen'
  | 'log.hpRegen'
  | 'log.statusCleansed'
  | 'log.splashDamage'
  | 'log.retreat'
  | 'log.buffApplied'
  | 'log.stanceToggle'
  | 'log.charging'
  | 'log.counterAttack'
  | 'log.scanReveal'
  | 'log.scanRevealNone'
  | 'log.invincibleBlock'
  | 'log.silencedBlocked'
  | 'log.wingmanChat'
  | 'log.unitMovesRow'
  | 'log.invalidTarget'
  | 'log.autoRepeatStopped'
  | 'log.useSupply'
  | 'log.supplyScanReveal'
  | 'log.supplyScanNone'
  | 'log.emergencyResupplyAlly'
  | 'log.emergencyResupplyEnemy'
  | 'log.prestageConfirm'
  | 'log.repairFreeDefeat'
  | 'log.repairFreeRetreat'
  | 'log.repairFee';

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
export type CombatFxTone = 'heal' | 'shield' | 'sp' | 'buff';

export interface CombatFxEvent {
  id: string;
  kind: CombatFxKind;
  tone?: CombatFxTone;
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
  kind?: BattleKind;
  sourceId?: string | null;
  deployedGearId: MechClassId;
  sectorId: string;
  rounds: number;
  expGained: number;
  creditsGained: number;
  warPointsGained: number;
  baseCaptureBonusWp: number;
  supportExpPct?: number;
  supportCreditPct?: number;
  repairFee?: number;
  repairFree?: boolean;
  retreatPenaltyExp?: number;
  retreatPenaltyCredit?: number;
  retreatPenaltyWp?: number;
  expBeforePenalty?: number;
  voucherCreditUsed?: Record<string, number>;
  voucherExpUsed?: Record<string, number>;
  voucherCreditRefund?: number;
  voucherExpRefund?: number;
  voucherRedeemed?: boolean;
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
  kind?: BattleKind;
  sourceId?: string | null;
  rewardMult?: number;
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
  supplyByUnit?: Record<string, BattleSupplyUnitState>;
  npcSupply?: BattleNpcSupplyState;
  turnStep2Used?: number;
  turnLockedSkillIds?: string[];
  prestage?: PrestageState;
  isResolving: boolean;
  summary: BattleSummary | null;
}

export interface BattleNpcSupplyState {
  stockByUnit: Record<string, Record<string, number>>;
  sectorSupply: number;
  emergencyUsed: {
    ally: boolean;
    enemy: boolean;
  };
}

export type BattleSpeed = 1 | 2 | 3 | 5 | 10 | 12 | 15 | 20 | 30;

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
  accuracyPct: number;
  longRangeBonus: number;
  detectStealthBonus: number;
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
  accuracyPct: number;
  longRangeDelta: -1 | 0 | 1;
  detectStealthDelta: -1 | 0 | 1;
}

export interface AutoEquipSlotPlan {
  slot: PaperDollSlot;
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
  slots: Omit<Record<PaperDollSlot, StarterSlotConfig>, 'radar'> & {
    radar?: StarterSlotConfig;
  };
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

export interface ShieldRegenConfig {
  enabled: boolean;
  basePct: number;
  perPointPct: number;
  capPct: number;
  notHitMult: number;
  hitPenaltyPct: number;
  minHitMultPct: number;
  restartTurns: number;
}

export type ItemLevelKind = 'equipment' | 'radar' | 'module';

export interface ItemKindLevelRule {
  init: number;
  step: number;
  enabled: boolean;
}

export interface ItemLevelsConfig {
  kinds: Record<ItemLevelKind, ItemKindLevelRule>;
  shopAboveLevel: number;
  shopTierAhead: number;
  dropWindow: number;
  dropDifficultyBonus: Record<SectorDifficulty, number>;
}

export interface SpEconomyConfig {
  regenPerSpirit: number;
  classFactor: Record<MechClassId, number>;
  costLevelPct: number;
}

export interface SupplyLimitMultConfig {
  assaultAttacker: number;
  assaultDefender: number;
  defendDefender: number;
  defendAttacker: number;
  bossEscort: number;
  bossPlayers: number;
}

export interface SupplyEconomyConfig {
  maxUsesPerBattle: number;
  spPriceMult: number;
  limitMult?: SupplyLimitMultConfig;
}

export type EnemyLevelRangeKind =
  | 'patrol'
  | 'pirate'
  | 'assault'
  | 'defend'
  | 'boss';

export interface EnemyLevelRange {
  min: number;
  max: number;
  peak: number;
}

export interface EnemyLevelConfig {
  ranges: Record<EnemyLevelRangeKind, EnemyLevelRange>;
  peakChancePct: number;
  enemyLevelCapOverMax: number;
}

export type ModuleDropEffectKey = StatKey | ModuleTraitKey;

export interface ModuleDropConfig {
  factor: number;
  shopCount: number;
  effectWeights: Record<ModuleDropEffectKey, number>;
}

export type EnragePhaseKey = 'rage' | 'frenzy' | 'berserker';

export interface EnragePhaseConfig {
  startRound: number;
  everyRounds: number;
  maxStacks: number;
  value: number;
}

export interface EnrageBerserkerConfig {
  startRound: number;
  everyRounds: number;
  maxStacks: number;
  critRatePct: number;
  critDamagePct: number;
  critOverflowRatio?: number;
}

export interface EnrageConfig {
  rage: EnragePhaseConfig;
  frenzy: EnragePhaseConfig;
  berserker: EnrageBerserkerConfig;
}

export interface AdminConfig {
  godMode: boolean;
  oneHitKills: boolean;
  alwaysWin: boolean;
  rewardMultiplier: number;
  battleRewards?: BattleRewardsConfig;
  battlePenalty?: BattlePenaltyConfig;
  battleSizeOverride: BattleSize | null;
  softEnrageEnabled: boolean;
  enrage?: EnrageConfig;
  forceBoss: boolean;
  battleLevelOffsetOverride: number | null;
  maxLevel?: number;
  shopMinStock: number;
  shopMaxStock: number;
  shopRarityWeights: Record<ItemRarity, number>;
  shopPriceMultiplier: number;
  formation: FormationConfig;
  autoEquip?: AutoEquipConfig;
  starterSet?: StarterSetConfig;
  iconCatalogMods?: IconCatalogModRow[];
  statusDisplayDefaults?: StatusDisplayDefaults;
  cardPopupStaggerMs?: number;
  cardPopupFlightMs?: number;
  cardPopupMaxConcurrent?: number;
  cardPopupZoneWidthPct?: number;
  cardPopupZoneHeightPct?: number;
  cardPopupStartScalePct?: number;
  cardPopupEndScalePct?: number;
  radarPopupStartScalePct?: number;
  radarPopupSmallScalePct?: number;
  radarPopupLargeScalePct?: number;
  radarPopupBigMaxUnits?: number;
  shieldRegen?: ShieldRegenConfig;
  spEconomy?: SpEconomyConfig;
  fluxTransfer?: FluxTransferConfig;
  supplyEconomy?: SupplyEconomyConfig;
  enemyLevel?: EnemyLevelConfig;
  shieldCrackedMult?: number;
  shieldCrackedTurns?: number;
  shieldDamageOverrides?: Record<string, number>;
  boxCapacity?: number;
  warehouseCapacity: number;
  ignoreFrontline?: boolean;
  noticeDurationSec?: number;
  supplyLoadoutSlots?: number;
  supplyUsesPerTurn?: number;
  supplyScanCount?: number;
  supplyShopMinTypes?: number;
  supplyShopMaxTypes?: number;
  supplyShopMinQty?: number;
  supplyShopMaxQty?: number;
  supplyShopMaxRefreshes?: number;
  supplyShopRefreshBaseCost?: number;
  supplyWpPriceDivisor?: number;
  supplyWpMinTier?: number;
  supplyWpDupWeight?: number;
  supplyWpMaxCopies?: number;
  extenderLevelsPerSocket?: number;
  maxSkillModulesPerGear?: number;
  itemLevels?: ItemLevelsConfig;
  moduleDrop?: ModuleDropConfig;
  pirates?: PiratesConfig;
  turnPhase?: TurnPhaseConfig;
  prestage?: PrestageConfig;
  stealth?: StealthConfig;
  npcSupply?: Partial<NpcSupplyConfig>;
  supplyMaxPerTypePerBattle?: number;
  skillMaxLevel?: number;
  passiveScaleAfter5?: number;
  restorePctCap?: number;
  passiveSlots?: PassiveSlotsConfig;
  skillMods?: SkillModDefinition[];
  vouchers?: VoucherConfig;
  showRawI18nKeys: boolean;
}

export interface BattleRewardsConfig {
  supportMaxLevel: number;
  supportExpPerLevelPct: number;
  supportCreditWpPerLevelPct: number;
  defeatExpPct: number;
  defeatCreditPct: number;
  defeatWpPct: number;
  defeatMaxPctOfVictory: number;
  retreatRewardPct: number;
}

export interface RepairFeeTierConfig {
  freeLevel: number;
  freeCredits: number;
  hpCoef: number;
  shieldCoef: number;
  cap: number;
}

export interface BattlePenaltyConfig {
  retreatFreeLevel: number;
  retreatExpPenaltyPct: number;
  retreatShortfallExtraCreditPct: number;
  retreatWpPenaltyPct: number;
  repairDefeat: RepairFeeTierConfig;
  repairRetreat: RepairFeeTierConfig;
}

export interface PassiveSlotsConfig {
  initial: number;
  everyLevels: number;
  max: number;
}

export type NpcSupplyKitFamily = 'hp_kit' | 'shield_kit' | 'sp_kit';

export interface NpcSupplyConfig {
  enabled: boolean;
  typesMin: number;
  typesMax: number;
  qtyMin: number;
  qtyMax: number;
  noSupplyChance: {
    mob: number;
    boss: number;
  };
  thresholds: {
    hp: number;
    shield: number;
    sp: number;
  };
  losingGap: number;
  losingBonus: number;
  winningCut: number;
  emergency: {
    enabled: boolean;
    minRound: number;
    gap: number;
    minSectorSupply: number;
  };
  sector: {
    drainPerBattle: number;
    regenPerMonth: number;
    minQtyFactor: number;
    maxExtraEmptyChance: number;
    enemyScarcityWeight: number;
  };
  baseStatusMult: Record<BaseStatus, number>;
  tierOffset: {
    Standard: number;
    Hard: number;
    Elite: number;
    boss: number;
    event: number;
  };
  kindMult: Record<CombatSide, Record<BattleKind, number>>;
  diffMult: Record<SectorDifficulty, number>;
  bossQtyMult: number;
  underdogRatio: number;
  familyWeights: {
    drone: Partial<Record<NpcSupplyKitFamily, number>>;
    gunship: Partial<Record<NpcSupplyKitFamily, number>>;
    sniper: Partial<Record<NpcSupplyKitFamily, number>>;
    repair_ship: Partial<Record<NpcSupplyKitFamily, number>>;
    ally: Partial<Record<NpcSupplyKitFamily, number>>;
  };
}

export interface StealthConfig {
  lidarDetectMin: number;
  lidarDetectMax: number;
}

export interface TurnPhaseConfig {
  maxStep2PerTurn: number;
}

export interface PrestageConfig {
  enabled: boolean;
  countdownSec: number;
  groupFromSize?: number;
}

export interface PrestageState {
  active: boolean;
  appliedByUnit: Record<string, string[]>;
}

export interface FluxTransferLevelRule {
  targets: number;
  pct: number;
  fee: number;
}

export interface FluxTransferConfig {
  levels: FluxTransferLevelRule[];
  minPerLevel?: number;
  allySpBelowPct?: number;
  keepSelfPct?: number;
}

export interface PirateSizeWeights {
  4: number;
  6: number;
  8: number;
}

export interface PiratesConfig {
  enabled: boolean;
  maxActive: number;
  spawnChancePerMonth: number;
  ensureOneWhenIdle: boolean;
  sizeWeights: PirateSizeWeights;
  expiryMonths: number;
  rewardMult: number;
}

export interface PirateIncident {
  id: string;
  nodeId: string;
  size: BattleSize;
  createdMonth: number;
  expiresMonth: number;
}

export type BaseTab = 'gear' | 'warehouse' | 'garage' | 'skill' | 'shop' | 'map';

export type ScreenState = 'TITLE' | 'HANGAR' | 'SHOP' | 'BATTLE';
