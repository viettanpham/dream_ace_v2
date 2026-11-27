import { Lock, Tag } from 'lucide-react';
import { RARITY_META } from '../data/items';
import type { ItemInstance, PaperDollSlot } from '../types/game';
import { SlotIcon } from './GameIcons';

export type GearPaperDollSlotKey =
  | PaperDollSlot
  | 'ext1'
  | 'ext2'
  | 'ext3'
  | 'ext4'
  | 'ext5';

export const PAPER_DOLL_LEFT_SLOTS: readonly GearPaperDollSlotKey[] = [
  'main_weapon',
  'radar',
  'cpu',
  'armor',
  'ext2',
  'ext4',
] as const;

export const PAPER_DOLL_RIGHT_SLOTS: readonly GearPaperDollSlotKey[] = [
  'sub_weapon',
  'accessory',
  'engine',
  'ext1',
  'ext3',
  'ext5',
] as const;

export function isEquipmentSlotKey(
  key: GearPaperDollSlotKey
): key is PaperDollSlot {
  return !key.startsWith('ext');
}

export interface GearSlotTileProps {
  slotKey: GearPaperDollSlotKey;
  label: string;
  instance?: ItemInstance | null;
  itemName?: string;
  selected?: boolean;
  previewTarget?: boolean;
  confirmingUnequip?: boolean;
  locked?: boolean;
  lockedLabel?: string;
  classLocked?: boolean;
  classOnlyTitle?: string;
  starterBadgeLabel?: string;
  title?: string;
  variant?: 'desktop' | 'phone';
  onSelect?: () => void;
}

export function GearSlotTile({
  slotKey,
  label,
  instance = null,
  itemName,
  selected = false,
  previewTarget = false,
  confirmingUnequip = false,
  locked = false,
  lockedLabel = 'Soon',
  classLocked = false,
  classOnlyTitle,
  starterBadgeLabel = 'Starter',
  title,
  variant = 'desktop',
  onSelect,
}: GearSlotTileProps) {
  const isLiveSlot = isEquipmentSlotKey(slotKey) && !locked;
  const activeInst = isLiveSlot ? instance : null;

  const stateClass = locked
    ? 'border-slate-800/60 bg-[#080C14]/50 opacity-55 cursor-not-allowed'
    : confirmingUnequip
    ? 'border-red-400/80 bg-red-500/10 cursor-pointer'
    : selected
    ? 'border-sky-400 bg-sky-500/15 cursor-pointer'
    : previewTarget
    ? 'border-amber-400/80 bg-amber-500/10 cursor-pointer'
    : activeInst
    ? `${RARITY_META[activeInst.rarity].borderClass} bg-[#080C14] hover:border-slate-600 cursor-pointer`
    : 'border-slate-800/90 bg-[#080C14] hover:border-slate-700 cursor-pointer';

  const iconBoxClass = locked
    ? 'border-slate-800/80 bg-slate-950/70 text-slate-500'
    : activeInst
    ? `${RARITY_META[activeInst.rarity].borderClass} bg-slate-900 ${RARITY_META[activeInst.rarity].textClass}`
    : 'border-slate-800 bg-slate-950 text-slate-600';

  const handleClick = () => {
    if (locked || !onSelect) return;
    onSelect();
  };

  if (variant === 'phone') {
    return (
      <button
        type="button"
        disabled={locked}
        aria-disabled={locked || undefined}
        onClick={handleClick}
        title={title}
        data-testid={`gear-slot-tile-phone-${slotKey}`}
        data-slot-key={slotKey}
        data-locked={locked ? 'true' : 'false'}
        className={`w-full min-h-[52px] px-2 py-1.5 rounded-lg border text-left transition-colors flex items-center justify-between gap-2 min-w-0 ${stateClass}`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span
            className={`h-8 w-8 rounded border flex items-center justify-center shrink-0 ${iconBoxClass}`}
          >
            {locked || !isEquipmentSlotKey(slotKey) ? (
              <Lock className="w-3.5 h-3.5" />
            ) : (
              <SlotIcon slot={slotKey} className="w-4 h-4" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div
              className={`flex items-center gap-1 text-[11px] leading-none ${
                locked ? 'text-slate-500' : 'text-slate-400'
              }`}
            >
              <span className="truncate">{label}</span>
              {classLocked && !locked && (
                <span title={classOnlyTitle}>
                  <Tag className="w-2.5 h-2.5 text-sky-400/80 shrink-0" />
                </span>
              )}
            </div>
            <div
              className={`mt-1 truncate ${
                locked
                  ? 'text-[11px] font-medium text-slate-500'
                  : activeInst
                  ? `text-xs font-semibold ${RARITY_META[activeInst.rarity].textClass}`
                  : 'text-xs font-semibold text-slate-600'
              }`}
            >
              {locked ? lockedLabel : activeInst ? itemName ?? '—' : '—'}
            </div>
          </div>
        </div>

        {activeInst && (
          <div className="flex items-center gap-1 shrink-0 font-mono-nums text-[11px]">
            {activeInst.locked && (
              <Lock className="w-3 h-3 text-amber-300 shrink-0" />
            )}
            {activeInst.enchantLevel > 0 && (
              <span className="font-bold text-amber-400">
                +{activeInst.enchantLevel}
              </span>
            )}
          </div>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={locked}
      aria-disabled={locked || undefined}
      onClick={handleClick}
      title={title}
      data-testid={`gear-slot-tile-desktop-${slotKey}`}
      data-slot-key={slotKey}
      data-locked={locked ? 'true' : 'false'}
      className={`w-[58px] h-[62px] xl:w-[66px] xl:h-[66px] p-1 rounded-lg border text-center transition-colors flex flex-col items-center justify-between gap-0.5 relative shrink-0 ${stateClass}`}
    >
      {(classLocked && !locked) || activeInst?.locked ? (
        <span className="absolute top-1 left-1 flex items-center gap-0.5">
          {classLocked && !locked && (
            <span title={classOnlyTitle}>
              <Tag className="w-2.5 h-2.5 text-sky-400/80 shrink-0" />
            </span>
          )}
          {activeInst?.locked && (
            <Lock className="w-2.5 h-2.5 text-amber-300 shrink-0" />
          )}
        </span>
      ) : null}

      {activeInst && activeInst.enchantLevel > 0 && (
        <span className="absolute top-1 right-1 font-mono-nums text-[10px] font-bold text-amber-400 leading-none">
          +{activeInst.enchantLevel}
        </span>
      )}

      <span
        className={`h-7 w-7 mt-0.5 rounded border flex items-center justify-center shrink-0 ${iconBoxClass}`}
      >
        {locked || !isEquipmentSlotKey(slotKey) ? (
          <Lock className="w-3.5 h-3.5" />
        ) : (
          <SlotIcon slot={slotKey} className="w-4 h-4" />
        )}
      </span>

      <div className="w-full min-w-0 flex flex-col items-center">
        <span
          className={`text-[10px] font-semibold leading-tight truncate w-full ${
            locked
              ? 'text-slate-500'
              : activeInst
              ? RARITY_META[activeInst.rarity].textClass
              : 'text-slate-400'
          }`}
        >
          {label}
        </span>
        {locked ? (
          <span className="text-[9px] leading-none text-slate-500 truncate w-full">
            {lockedLabel}
          </span>
        ) : activeInst?.isStarter && isEquipmentSlotKey(slotKey) ? (
          <span
            data-testid={`slot-starter-badge-${slotKey}`}
            className="px-1 rounded border border-cyan-500/45 bg-cyan-500/12 text-[9px] leading-tight font-sans font-semibold text-cyan-300"
          >
            {starterBadgeLabel}
          </span>
        ) : activeInst ? (
          <span className="text-[9px] leading-none font-mono-nums text-slate-500">
            {activeInst.rollQuality}%
          </span>
        ) : (
          <span className="text-[9px] leading-none text-slate-600">—</span>
        )}
      </div>
    </button>
  );
}
