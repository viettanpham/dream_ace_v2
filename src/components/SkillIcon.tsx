import {
  Anchor,
  BatteryCharging,
  Bomb,
  Castle,
  CornerDownLeft,
  Crosshair,
  Eraser,
  EyeOff,
  Feather,
  Flame,
  Gauge,
  Ghost,
  Heart,
  Orbit,
  PlusCircle,
  Radar,
  Radio,
  RotateCcw,
  Shield,
  ShieldOff,
  ShieldPlus,
  Skull,
  Snowflake,
  Sparkle,
  Sparkles,
  Star,
  Sun,
  Sword,
  Swords,
  Target,
  Waves,
  Wind,
  Zap,
} from 'lucide-react';
import type { SkillIconKey } from '../types/game';

interface SkillIconProps {
  icon: SkillIconKey;
  className?: string;
}

export function SkillIcon({ icon, className = 'w-4 h-4' }: SkillIconProps) {
  switch (icon) {
    case 'shield':
    case 'security':
    case 'shield_moon':
      return <Shield className={className} />;
    case 'wind':
    case 'air':
      return <Wind className={className} />;
    case 'flame':
      return <Flame className={className} />;
    case 'crosshair':
    case 'center_focus_strong':
      return <Crosshair className={className} />;
    case 'target':
      return <Target className={className} />;
    case 'zap':
    case 'bolt':
      return <Zap className={className} />;
    case 'bomb':
    case 'explosion':
      return <Bomb className={className} />;
    case 'battery':
      return <BatteryCharging className={className} />;
    case 'ghost':
      return <Ghost className={className} />;
    case 'orbit':
      return <Orbit className={className} />;
    case 'anchor':
      return <Anchor className={className} />;
    case 'fortress':
      return <Castle className={className} />;
    case 'snowflake':
      return <Snowflake className={className} />;
    case 'shield_off':
    case 'remove_moderator':
      return <ShieldOff className={className} />;
    case 'eye_off':
      return <EyeOff className={className} />;
    case 'ray':
    case 'flare':
      return <Sparkle className={className} />;
    case 'sword':
      return <Sword className={className} />;
    case 'rotate':
      return <RotateCcw className={className} />;
    case 'corner_down_left':
      return <CornerDownLeft className={className} />;
    case 'gauge':
      return <Gauge className={className} />;
    case 'radio':
      return <Radio className={className} />;
    case 'sparkles':
      return <Sparkles className={className} />;
    case 'skull':
      return <Skull className={className} />;
    case 'heart':
      return <Heart className={className} />;
    case 'radar':
      return <Radar className={className} />;
    case 'plus_circle':
    case 'health_cross':
      return <PlusCircle className={className} />;
    case 'waves':
      return <Waves className={className} />;
    case 'swords':
      return <Swords className={className} />;
    case 'shield_plus':
    case 'shield_with_heart':
    case 'health_and_safety':
    case 'add_moderator':
      return <ShieldPlus className={className} />;
    case 'feather':
      return <Feather className={className} />;
    case 'sun':
      return <Sun className={className} />;
    case 'cleanse':
      return <Eraser className={className} />;
    case 'star':
    default:
      return <Star className={className} />;
  }
}
