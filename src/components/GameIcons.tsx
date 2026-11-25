import {
  BatteryCharging,
  Cpu,
  Crosshair,
  Flame,
  Gift,
  HeartHandshake,
  Layers,
  Package,
  Radar,
  RotateCcw,
  Shield,
  Sparkles,
  Swords,
  Target,
  Wind,
  Zap,
} from 'lucide-react';
import { MECH_CLASSES } from '../data/classes';
import type {
  ConsumableKind,
  EquipmentSlot,
  InventorySlotFilter,
  MechClassId,
} from '../types/game';

interface SlotIconProps {
  slot: InventorySlotFilter;
  className?: string;
}

export function SlotIcon({ slot, className = 'w-4 h-4' }: SlotIconProps) {
  switch (slot) {
    case 'all':
      return <Layers className={className} aria-hidden="true" />;
    case 'consumables':
      return <Package className={className} aria-hidden="true" />;
    case 'main_weapon':
      return <Crosshair className={className} aria-hidden="true" />;
    case 'sub_weapon':
      return <Target className={className} aria-hidden="true" />;
    case 'armor':
      return <Shield className={className} aria-hidden="true" />;
    case 'engine':
      return <Flame className={className} aria-hidden="true" />;
    case 'cpu':
      return <Zap className={className} aria-hidden="true" />;
    case 'accessory':
      return <BatteryCharging className={className} aria-hidden="true" />;
    case 'radar':
      return <Radar className={className} aria-hidden="true" />;
    case 'module':
      return <Cpu className={className} aria-hidden="true" />;
    default:
      return <Layers className={className} aria-hidden="true" />;
  }
}

interface ClassIconProps {
  classId: MechClassId | 'all' | 'general';
  className?: string;
  colored?: boolean;
}

export function ClassIcon({
  classId,
  className = 'w-4 h-4',
  colored = true,
}: ClassIconProps) {
  const colorStyle =
    colored && classId !== 'all' && classId !== 'general'
      ? { color: MECH_CLASSES[classId]?.accentHex }
      : undefined;

  switch (classId) {
    case 'striker':
      return <Swords className={className} style={colorStyle} aria-hidden="true" />;
    case 'interceptor':
      return <Wind className={className} style={colorStyle} aria-hidden="true" />;
    case 'siege':
      return <Shield className={className} style={colorStyle} aria-hidden="true" />;
    case 'support':
      return (
        <HeartHandshake
          className={className}
          style={colorStyle}
          aria-hidden="true"
        />
      );
    case 'general':
      return <Sparkles className={className} aria-hidden="true" />;
    default:
      return <Layers className={className} aria-hidden="true" />;
  }
}

interface ConsumableIconProps {
  kind: ConsumableKind;
  className?: string;
}

export function ConsumableIcon({
  kind,
  className = 'w-4 h-4',
}: ConsumableIconProps) {
  switch (kind) {
    case 'equipment_crate':
      return <Gift className={className} aria-hidden="true" />;
    case 'enchant_stone':
      return <Sparkles className={className} aria-hidden="true" />;
    case 'respec_token':
      return <RotateCcw className={className} aria-hidden="true" />;
    case 'exp_boost':
      return <Zap className={className} aria-hidden="true" />;
    case 'battle_supply':
      return <Sparkles className={className} aria-hidden="true" />;
  }
}

export function getSlotAccentClass(slot: EquipmentSlot): string {
  switch (slot) {
    case 'main_weapon':
      return 'text-rose-400';
    case 'sub_weapon':
      return 'text-amber-400';
    case 'armor':
      return 'text-sky-400';
    case 'engine':
      return 'text-emerald-400';
    case 'cpu':
      return 'text-purple-400';
    case 'accessory':
      return 'text-cyan-400';
    case 'radar':
      return 'text-teal-400';
    case 'module':
      return 'text-indigo-400';
  }
}
