import { useMemo } from 'react';
import { EMPTY_STAT_BLOCK, STAT_KEYS } from '../data/classes';
import { RARITY_META } from '../data/items';
import {
  getGearEquippedInstances,
  simulateGearEquipChange,
  sumGearEquipmentStats,
  sumGearSpecialTraits,
  validateEquipOnGear,
} from '../engine/equipment';
import { calculateItemPowerScore, RARITY_RANK } from '../engine/inventory';
import { getGearPassiveBonuses } from '../engine/skills';
import { calculateEffectiveStats } from '../engine/stats';
import {
  formatEquipValidationReason,
  formatItemTraitsList,
  getItemInstanceName,
  getSlotLabel,
  getStatShort,
  useI18n,
} from '../i18n';
import { useGameStore } from '../store/useGameStore';
import type { ItemInstance, PaperDollSlot, StatKey } from '../types/game';
import { BottomSheet } from './BottomSheet';
import { SlotIcon } from './GameIcons';

export interface GearSwapPickerProps {
  open: boolean;
  slot: PaperDollSlot | null;
  onClose: () => void;
  onEquipped?: (slot: PaperDollSlot) => void;
}

interface SwapCandidate {
  item: ItemInstance;
  powerScore: number;
  traits: string[];
  topDeltas: Array<{ key: StatKey; delta: number }>;
  validation: ReturnType<typeof validateEquipOnGear>;
  reason: string | null;
}

export function GearSwapPicker({
  open,
  slot,
  onClose,
  onEquipped,
}: GearSwapPickerProps) {
  const { lang, t } = useI18n();
  const pilot = useGameStore((s) => s.pilot);
  const equipItem = useGameStore((s) => s.equipItem);

  const activeGear = pilot.gears[pilot.activeGearId];

  const currentEquipped = useMemo(() => {
    if (!slot) return null;
    return getGearEquippedInstances(activeGear, pilot.inventory)[slot] ?? null;
  }, [slot, activeGear, pilot.inventory]);

  const candidates = useMemo<SwapCandidate[]>(() => {
    if (!open || !slot) return [];

    const currentEquipBonuses = sumGearEquipmentStats(activeGear, pilot.inventory);
    const currentEquipTraits = sumGearSpecialTraits(activeGear, pilot.inventory);
    const passiveBonuses = getGearPassiveBonuses(activeGear);
    const currentStats = calculateEffectiveStats(
      activeGear.classId,
      activeGear.level,
      activeGear.allocatedPoints,
      EMPTY_STAT_BLOCK,
      currentEquipBonuses,
      currentEquipTraits,
      passiveBonuses
    );

    const matching = pilot.inventory.filter(
      (item) =>
        item.slot === slot && item.instanceId !== currentEquipped?.instanceId
    );

    const enriched = matching.map((item) => {
      const powerScore = calculateItemPowerScore(item);
      const candGear = simulateGearEquipChange(activeGear, {
        type: 'equip',
        instance: item,
      });
      const candBonuses = sumGearEquipmentStats(candGear, pilot.inventory);
      const candTraits = sumGearSpecialTraits(candGear, pilot.inventory);
      const candStats = calculateEffectiveStats(
        activeGear.classId,
        activeGear.level,
        activeGear.allocatedPoints,
        EMPTY_STAT_BLOCK,
        candBonuses,
        candTraits,
        passiveBonuses
      );

      const topDeltas = STAT_KEYS.map((key) => ({
        key,
        delta: candStats[key] - currentStats[key],
      }))
        .filter((d) => d.delta !== 0)
        .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
        .slice(0, 4);

      const validation = validateEquipOnGear(item, activeGear, pilot.gears);
      const reason = formatEquipValidationReason(lang, validation);

      return {
        item,
        powerScore,
        traits: formatItemTraitsList(lang, item),
        topDeltas,
        validation,
        reason,
      };
    });

    enriched.sort((a, b) => {
      const rarityDiff =
        RARITY_RANK[b.item.rarity] - RARITY_RANK[a.item.rarity];
      if (rarityDiff !== 0) return rarityDiff;
      const lvlDiff = b.item.requiredLevel - a.item.requiredLevel;
      if (lvlDiff !== 0) return lvlDiff;
      const powerDiff = b.powerScore - a.powerScore;
      if (powerDiff !== 0) return powerDiff;
      return a.item.instanceId.localeCompare(b.item.instanceId);
    });

    return enriched;
  }, [open, slot, activeGear, pilot.inventory, pilot.gears, currentEquipped, lang]);

  if (!slot) return null;

  const isSwap = currentEquipped !== null;
  const headingPrefix = isSwap ? t('gear.swapTitle') : t('gear.pickTitle');

  const handleEquipRow = (item: ItemInstance) => {
    const res = equipItem(item.instanceId);
    if (res.canEquip && item.slot !== 'module') {
      onEquipped?.(item.slot);
      onClose();
    }
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      testId="gear-swap-picker"
      zIndexClass="z-[60]"
      maxHeightClass="max-h-[86dvh]"
      bodyScrollable
      title={`${headingPrefix} — ${getSlotLabel(lang, slot)}`}
      footer={
        <div className="flex justify-end">
          <button
            type="button"
            data-testid="gear-swap-close-btn"
            onClick={onClose}
            className="min-h-[40px] px-4 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
          >
            {t('common.close')}
          </button>
        </div>
      }
    >
      {candidates.length === 0 ? (
        <p
          data-testid="gear-swap-empty"
          className="py-8 text-center text-sm text-slate-400"
        >
          {t('gear.swapEmptyList')}
        </p>
      ) : (
        <div className="space-y-2">
          {candidates.map(
            ({ item, traits, topDeltas, validation, reason }) => {
              const rarity = RARITY_META[item.rarity];
              const disabled = !validation.canEquip;
              return (
                <div
                  key={item.instanceId}
                  data-testid={`gear-swap-row-${item.instanceId}`}
                  className={`flex items-center justify-between gap-2.5 rounded-lg border border-slate-800 bg-[#080D16] p-2.5 ${
                    disabled ? 'opacity-55' : ''
                  }`}
                >
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <div
                      className={`w-9 h-9 rounded-lg border ${rarity.borderClass} bg-[#0C1422] flex items-center justify-center shrink-0 mt-0.5`}
                    >
                      <SlotIcon
                        slot={item.slot}
                        className={`w-4 h-4 ${rarity.textClass}`}
                      />
                    </div>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className={`text-sm font-bold truncate ${rarity.textClass}`}
                        >
                          {getItemInstanceName(lang, item, true)}
                        </span>
                        <span className="text-[11px] font-mono-nums text-slate-400 shrink-0">
                          {t('common.levelShort')}
                          {item.requiredLevel}
                        </span>
                      </div>

                      {traits.length > 0 && (
                        <div className="text-[11px] text-purple-300/90 truncate">
                          {traits.join(' · ')}
                        </div>
                      )}

                      {topDeltas.length > 0 && (
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-mono-nums">
                          {topDeltas.map(({ key, delta }) => (
                            <span
                              key={key}
                              className={
                                delta > 0
                                  ? 'text-emerald-400 font-semibold'
                                  : 'text-red-400 font-semibold'
                              }
                            >
                              {getStatShort(lang, key)}{' '}
                              {delta > 0 ? `+${delta}` : delta}
                            </span>
                          ))}
                        </div>
                      )}

                      {disabled && reason && (
                        <div
                          data-testid={`gear-swap-reason-${item.instanceId}`}
                          className="text-[11px] text-red-400 truncate"
                        >
                          {reason}
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    data-testid={`gear-swap-equip-${item.instanceId}`}
                    disabled={disabled}
                    onClick={() => handleEquipRow(item)}
                    className={`min-h-[38px] px-3 rounded-lg border text-xs font-bold shrink-0 transition-colors ${
                      disabled
                        ? 'border-slate-800 bg-slate-900/70 text-slate-500 cursor-not-allowed'
                        : 'border-emerald-500/60 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 cursor-pointer'
                    }`}
                  >
                    {t('gear.equipActionBtn')}
                  </button>
                </div>
              );
            }
          )}
        </div>
      )}
    </BottomSheet>
  );
}
