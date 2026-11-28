import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { EMPTY_STAT_BLOCK, STAT_KEYS } from '../data/classes';
import { getCatalogRow } from '../data/iconCatalog';
import { RARITY_META } from '../data/items';
import { getModuleTemplateById } from '../data/modules';
import {
  getGearEquippedInstances,
  simulateGearEquipChange,
  sumGearEquipmentStats,
  sumGearSpecialTraits,
  validateEquipOnGear,
} from '../engine/equipment';
import {
  canEquipModule,
  findModuleInstanceInPilot,
  getModuleSocketOwner,
} from '../engine/extenders';
import { calculateItemPowerScore, RARITY_RANK } from '../engine/inventory';
import {
  applyPilotBuffsToPassives,
  getGearPassiveBonuses,
} from '../engine/skills';
import { calculateEffectiveStats } from '../engine/stats';
import {
  formatEquipValidationReason,
  formatItemTraitsList,
  getItemInstanceName,
  getSlotLabel,
  getStatShort,
  useI18n,
} from '../i18n';
import type { TranslationKey } from '../i18n/en';
import { useGameStore } from '../store/useGameStore';
import type {
  EquipmentSlot,
  ItemInstance,
  PaperDollSlot,
  StatKey,
} from '../types/game';
import { BottomSheet } from './BottomSheet';
import { CatalogIcon } from './CatalogIcon';
import { SlotIcon } from './GameIcons';
import {
  computeModuleDeltaBadges,
  formatModuleOneLineEffect,
  type ModuleDeltaBadge,
} from './ModuleSocketList';

export interface GearSwapPickerProps {
  open: boolean;
  slot: EquipmentSlot | null;
  socketIndex?: number;
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

interface ModuleSwapCandidate {
  item: ItemInstance;
  inWarehouse: boolean;
  effectLine: string;
  deltas: ModuleDeltaBadge[];
  canEquip: boolean;
  reason: string | null;
}

export function GearSwapPicker({
  open,
  slot,
  socketIndex,
  onClose,
  onEquipped,
}: GearSwapPickerProps) {
  const { lang, t } = useI18n();
  const pilot = useGameStore((s) => s.pilot);
  const adminConfig = useGameStore((s) => s.adminConfig);
  const equipItem = useGameStore((s) => s.equipItem);
  const setExtenderModule = useGameStore((s) => s.setExtenderModule);

  const [actionError, setActionError] = useState<string | null>(null);

  const activeGear = pilot.gears[pilot.activeGearId];
  const isModuleSocketMode =
    slot === 'module' && typeof socketIndex === 'number';

  useEffect(() => {
    setActionError(null);
  }, [open, slot, socketIndex, activeGear.classId]);

  const currentEquipped = useMemo(() => {
    if (!slot || slot === 'module') return null;
    return getGearEquippedInstances(activeGear, pilot.inventory)[slot] ?? null;
  }, [slot, activeGear, pilot.inventory]);

  const currentSocketModule = useMemo(() => {
    if (!isModuleSocketMode || typeof socketIndex !== 'number') return null;
    const id = activeGear.extenders?.[socketIndex] ?? null;
    return id ? findModuleInstanceInPilot(pilot, id) ?? null : null;
  }, [isModuleSocketMode, socketIndex, activeGear.extenders, pilot]);

  const candidates = useMemo<SwapCandidate[]>(() => {
    if (!open || !slot || isModuleSocketMode || slot === 'module') return [];

    const currentEquipBonuses = sumGearEquipmentStats(
      activeGear,
      pilot.inventory,
      adminConfig,
      pilot.warehouse
    );
    const currentEquipTraits = sumGearSpecialTraits(
      activeGear,
      pilot.inventory,
      adminConfig,
      pilot.warehouse
    );
    const passiveBonuses = applyPilotBuffsToPassives(
      getGearPassiveBonuses(activeGear, adminConfig),
      pilot.activeBuffs,
      adminConfig
    );
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
      const candBonuses = sumGearEquipmentStats(
        candGear,
        pilot.inventory,
        adminConfig,
        pilot.warehouse
      );
      const candTraits = sumGearSpecialTraits(
        candGear,
        pilot.inventory,
        adminConfig,
        pilot.warehouse
      );
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
  }, [
    open,
    slot,
    isModuleSocketMode,
    activeGear,
    pilot.inventory,
    pilot.warehouse,
    pilot.gears,
    adminConfig,
    currentEquipped,
    lang,
  ]);

  const moduleCandidates = useMemo<ModuleSwapCandidate[]>(() => {
    if (!open || !isModuleSocketMode || typeof socketIndex !== 'number') {
      return [];
    }

    const seenIds = new Set<string>();
    const combined: Array<{ item: ItemInstance; inWarehouse: boolean }> = [];
    for (const item of pilot.inventory) {
      if (item.slot !== 'module' || seenIds.has(item.instanceId)) continue;
      seenIds.add(item.instanceId);
      combined.push({ item, inWarehouse: false });
    }
    for (const item of pilot.warehouse ?? []) {
      if (item.slot !== 'module' || seenIds.has(item.instanceId)) continue;
      seenIds.add(item.instanceId);
      combined.push({ item, inWarehouse: true });
    }

    const unmounted = combined.filter(({ item }) => {
      if (item.instanceId === currentSocketModule?.instanceId) return false;
      const owner = getModuleSocketOwner(pilot.gears, item.instanceId, {
        gearId: activeGear.classId,
        socketIndex,
      });
      return owner === null;
    });

    const enriched = unmounted.map(({ item, inWarehouse }) => {
      const check = canEquipModule(
        pilot,
        activeGear.classId,
        socketIndex,
        item.instanceId,
        adminConfig
      );
      return {
        item,
        inWarehouse,
        effectLine: formatModuleOneLineEffect(lang, item),
        deltas: computeModuleDeltaBadges(lang, t, currentSocketModule, item),
        canEquip: check.ok,
        reason:
          !check.ok && check.reasonKey
            ? t(check.reasonKey as TranslationKey, check.reasonParams)
            : null,
      };
    });

    enriched.sort((a, b) => {
      const tierDiff = b.item.tier - a.item.tier;
      if (tierDiff !== 0) return tierDiff;
      const rarityDiff =
        RARITY_RANK[b.item.rarity] - RARITY_RANK[a.item.rarity];
      if (rarityDiff !== 0) return rarityDiff;
      const lvlDiff = b.item.requiredLevel - a.item.requiredLevel;
      if (lvlDiff !== 0) return lvlDiff;
      const powerDiff =
        calculateItemPowerScore(b.item) - calculateItemPowerScore(a.item);
      if (powerDiff !== 0) return powerDiff;
      return a.item.instanceId.localeCompare(b.item.instanceId);
    });

    return enriched;
  }, [
    open,
    isModuleSocketMode,
    socketIndex,
    pilot,
    activeGear.classId,
    currentSocketModule,
    adminConfig,
    lang,
    t,
  ]);

  if (!slot) return null;

  const isSwap = currentEquipped !== null;
  const headingPrefix = isSwap ? t('gear.swapTitle') : t('gear.pickTitle');
  const modalTitle =
    isModuleSocketMode && typeof socketIndex === 'number'
      ? t('module.pickerTitle', { n: socketIndex + 1 })
      : `${headingPrefix} — ${getSlotLabel(lang, slot)}`;

  const handleEquipRow = (item: ItemInstance) => {
    const res = equipItem(item.instanceId);
    if (res.canEquip && item.slot !== 'module') {
      onEquipped?.(item.slot);
      onClose();
    }
  };

  const handleEquipModuleRow = (item: ItemInstance) => {
    if (typeof socketIndex !== 'number') return;
    const res = setExtenderModule(
      activeGear.classId,
      socketIndex,
      item.instanceId
    );
    if (!res.ok) {
      setActionError(
        res.reasonKey
          ? t(res.reasonKey as TranslationKey, res.reasonParams)
          : null
      );
      return;
    }
    setActionError(null);
    onClose();
  };

  const handleUnequipModuleSocket = () => {
    if (typeof socketIndex !== 'number') return;
    const res = setExtenderModule(activeGear.classId, socketIndex, null);
    if (!res.ok) {
      setActionError(
        res.reasonKey
          ? t(res.reasonKey as TranslationKey, res.reasonParams)
          : null
      );
      return;
    }
    setActionError(null);
    onClose();
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      testId="gear-swap-picker"
      zIndexClass="z-[60]"
      maxHeightClass="max-h-[86dvh]"
      bodyScrollable
      title={modalTitle}
      footer={
        <div className="flex items-center justify-end gap-2">
          {isModuleSocketMode && currentSocketModule !== null && (
            <button
              type="button"
              data-testid="gear-swap-unequip-btn"
              onClick={handleUnequipModuleSocket}
              className="min-h-[40px] px-4 rounded-lg border border-rose-500/50 bg-rose-500/15 hover:bg-rose-500/25 text-xs font-bold text-rose-200 transition-colors cursor-pointer"
            >
              {t('module.unequipBtn')}
            </button>
          )}
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
      {actionError && (
        <div
          data-testid="gear-swap-error"
          role="alert"
          className="mb-2 flex items-center gap-1.5 rounded border border-red-500/40 bg-red-500/10 px-2.5 py-1.5 text-xs text-red-300"
        >
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span className="min-w-0 break-words">{actionError}</span>
        </div>
      )}

      {isModuleSocketMode ? (
        moduleCandidates.length === 0 ? (
          <p
            data-testid="gear-swap-empty"
            className="py-8 text-center text-sm text-slate-400"
          >
            {t('module.pickerEmpty')}
          </p>
        ) : (
          <div className="space-y-2">
            {moduleCandidates.map(
              ({ item, inWarehouse, effectLine, deltas, canEquip, reason }) => {
                const rarity = RARITY_META[item.rarity];
                const disabled = !canEquip;
                const tpl = getModuleTemplateById(item.templateId);
                const iconRow = tpl
                  ? getCatalogRow(tpl.iconId, adminConfig?.iconCatalogMods) ??
                    null
                  : null;

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
                        {iconRow ? (
                          <CatalogIcon
                            row={iconRow}
                            size="sm"
                            showBadges={false}
                            showArrowBadge={false}
                          />
                        ) : (
                          <SlotIcon
                            slot="module"
                            className={`w-4 h-4 ${rarity.textClass}`}
                          />
                        )}
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
                          {inWarehouse && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-800/90 text-[10px] font-medium text-slate-300 shrink-0">
                              {t('module.inWarehouseTag')}
                            </span>
                          )}
                        </div>

                        {effectLine && (
                          <div className="text-[11px] text-sky-300/90 truncate">
                            {effectLine}
                          </div>
                        )}

                        {deltas.length > 0 && (
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-mono-nums">
                            {deltas.map((d) => (
                              <span
                                key={d.key}
                                className={
                                  d.positive
                                    ? 'text-emerald-400 font-semibold'
                                    : 'text-red-400 font-semibold'
                                }
                              >
                                {d.label}
                              </span>
                            ))}
                          </div>
                        )}

                        {disabled && reason && (
                          <div
                            data-testid={`gear-swap-reason-${item.instanceId}`}
                            className="text-[11px] text-red-400 break-words"
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
                      onClick={() => handleEquipModuleRow(item)}
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
        )
      ) : candidates.length === 0 ? (
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
