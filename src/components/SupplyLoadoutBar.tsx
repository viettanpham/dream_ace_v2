import { Plus, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  SUPPLY_TEMPLATE_FAMILIES,
  SUPPLY_TEMPLATES,
  getSupplyTemplateById,
} from '../data/consumables';
import { getCatalogRow } from '../data/iconCatalog';
import {
  sanitizeSupplyLoadout,
  sanitizeSupplyLoadoutSlots,
} from '../engine/supplies';
import { useI18n } from '../i18n';
import { isBattleActive, useGameStore } from '../store/useGameStore';
import type { GearUnit, SupplyEffect, SupplyTemplate } from '../types/game';
import { BottomSheet } from './BottomSheet';
import { CatalogIcon } from './CatalogIcon';

export interface SupplyLoadoutBarProps {
  variant: 'desktop' | 'phone';
  gear: GearUnit;
}

const FAMILY_ORDER = new Map<string, number>(
  SUPPLY_TEMPLATE_FAMILIES.map((f, idx) => [f, idx])
);

export function formatSupplyShortName(fullName: string): string {
  const trimmed = fullName.trim();
  const strippedVi = trimmed.replace(/^Bộ\s+/i, '');
  if (strippedVi !== trimmed && strippedVi.length > 0) {
    return strippedVi.charAt(0).toUpperCase() + strippedVi.slice(1);
  }
  const strippedEn = trimmed
    .replace(/\s+Kit\s+/i, ' ')
    .replace(/\s+Charger\s+/i, ' ');
  return strippedEn;
}

type TranslateFn = ReturnType<typeof useI18n>['t'];
type SupplyTranslationKey = Parameters<TranslateFn>[0];

export function formatSupplyEffects(
  effects: readonly SupplyEffect[],
  t: TranslateFn
): string {
  return effects
    .map((eff) => {
      if (eff.kind === 'heal_hp_pct') {
        return t('supply.effect.healHp', { pct: eff.value });
      }
      if (eff.kind === 'heal_hp') {
        return t('supply.effect.healHpFlat', { val: eff.value });
      }
      if (eff.kind === 'restore_shield_pct') {
        return t('supply.effect.restoreShield', { pct: eff.value });
      }
      if (eff.kind === 'restore_shield') {
        return t('supply.effect.restoreShieldFlat', { val: eff.value });
      }
      if (eff.kind === 'restore_sp_pct') {
        return t('supply.effect.restoreSp', { pct: eff.value });
      }
      if (eff.kind === 'reveal_stealth_front') {
        return t('supply.effect.revealStealthFront', { count: eff.value });
      }
      return t('supply.effect.restoreSpFlat', { val: eff.value });
    })
    .join(', ');
}

export function formatSupplyEffectSummary(
  tpl: SupplyTemplate,
  t: TranslateFn
): string {
  return formatSupplyEffects(tpl.effects, t);
}

export function getSupplyName(tplId: string, t: TranslateFn): string {
  const key = `supply.${tplId}.name` as SupplyTranslationKey;
  const label = t(key);
  return label === key ? tplId : label;
}

export function SupplyLoadoutBar({ variant, gear }: SupplyLoadoutBarProps) {
  const { t } = useI18n();
  const consumables = useGameStore((s) => s.pilot.consumables);
  const supplyLoadoutSlots = useGameStore(
    (s) => s.adminConfig.supplyLoadoutSlots
  );
  const iconCatalogMods = useGameStore((s) => s.adminConfig.iconCatalogMods);
  const screen = useGameStore((s) => s.screen);
  const battle = useGameStore((s) => s.battle);
  const autoRepeatActive = useGameStore((s) =>
    Boolean(s.autoRepeatSession?.active)
  );
  const setSupplyLoadout = useGameStore((s) => s.setSupplyLoadout);

  const [openSlotIndex, setOpenSlotIndex] = useState<number | null>(null);
  const [lockedFromAction, setLockedFromAction] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const isStoreLocked = isBattleActive({ screen, battle }) || autoRepeatActive;
  const isLocked = isStoreLocked || lockedFromAction;

  useEffect(() => {
    setOpenSlotIndex(null);
    setLockedFromAction(false);
  }, [gear.classId]);

  useEffect(() => {
    if (!isStoreLocked) {
      setLockedFromAction(false);
    } else {
      setOpenSlotIndex(null);
    }
  }, [isStoreLocked]);

  useEffect(() => {
    if (variant !== 'desktop' || openSlotIndex === null) return;
    const onPointerDown = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpenSlotIndex(null);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenSlotIndex(null);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [variant, openSlotIndex]);

  const slotCount = sanitizeSupplyLoadoutSlots(supplyLoadoutSlots);
  const loadoutIds = useMemo(
    () => sanitizeSupplyLoadout(gear.supplyLoadout, slotCount),
    [gear.supplyLoadout, slotCount]
  );
  const loadoutSet = useMemo(() => new Set(loadoutIds), [loadoutIds]);

  const stockByTemplateId = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of consumables ?? []) {
      if (c.kind === 'battle_supply' && c.templateId) {
        map.set(c.templateId, (map.get(c.templateId) ?? 0) + c.quantity);
      }
    }
    return map;
  }, [consumables]);

  const pickerTemplates = useMemo(() => {
    return SUPPLY_TEMPLATES.filter((tpl) => {
      if (tpl.unlockLevel > gear.level) return false;
      const stock = stockByTemplateId.get(tpl.id) ?? 0;
      return stock > 0 || loadoutSet.has(tpl.id);
    }).sort((a, b) => {
      const fa = FAMILY_ORDER.get(a.family) ?? 99;
      const fb = FAMILY_ORDER.get(b.family) ?? 99;
      if (fa !== fb) return fa - fb;
      if (a.tier !== b.tier) return a.tier - b.tier;
      return a.id.localeCompare(b.id);
    });
  }, [gear.level, stockByTemplateId, loadoutSet]);

  const handleChooseTemplate = (templateId: string | null) => {
    if (openSlotIndex === null) return;
    if (isLocked) {
      setOpenSlotIndex(null);
      return;
    }

    let nextIds: string[];
    if (templateId === null) {
      nextIds = loadoutIds.filter((_, idx) => idx !== openSlotIndex);
    } else if (openSlotIndex < loadoutIds.length) {
      nextIds = loadoutIds.map((id, idx) =>
        idx === openSlotIndex ? templateId : id
      );
    } else {
      nextIds = [...loadoutIds, templateId];
    }

    const result = setSupplyLoadout(gear.classId, nextIds);
    if (result.reason === 'locked') {
      setLockedFromAction(true);
    }
    setOpenSlotIndex(null);
  };

  const tileHeightClass = variant === 'phone' ? 'h-[48px]' : 'h-[52px]';
  const showClearRow =
    openSlotIndex !== null && openSlotIndex < loadoutIds.length;

  const pickerContent =
    openSlotIndex === null ? null : (
      <div className="space-y-1">
        {showClearRow && (
          <button
            type="button"
            data-testid={`supply-picker-clear-${variant}`}
            onClick={() => handleChooseTemplate(null)}
            className="w-full min-h-[44px] px-2.5 py-1.5 rounded border border-rose-500/35 bg-rose-500/10 hover:bg-rose-500/20 text-rose-200 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{t('supply.clearSlot')}</span>
          </button>
        )}

        {pickerTemplates.length === 0 ? (
          <div className="px-2 py-3 text-center text-xs text-slate-400">
            {t('supply.emptyOwned')}
          </div>
        ) : (
          pickerTemplates.map((tpl) => {
            const stock = stockByTemplateId.get(tpl.id) ?? 0;
            const alreadyInLoadout = loadoutSet.has(tpl.id);
            const iconRow = getCatalogRow(tpl.iconId, iconCatalogMods) ?? null;
            const effectText = formatSupplyEffectSummary(tpl, t);

            return (
              <button
                key={tpl.id}
                type="button"
                data-testid={`supply-picker-item-${variant}-${tpl.id}`}
                disabled={alreadyInLoadout}
                onClick={() => handleChooseTemplate(tpl.id)}
                className={`w-full min-h-[44px] px-2.5 py-1.5 rounded border flex items-center justify-between gap-2 text-left transition-colors ${
                  alreadyInLoadout
                    ? 'border-slate-800/80 bg-slate-900/40 text-slate-500 cursor-not-allowed opacity-60'
                    : 'border-slate-800 bg-[#080C14] hover:border-amber-400/70 text-slate-100 cursor-pointer'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <CatalogIcon
                    row={iconRow}
                    size="sm"
                    showBadges={false}
                    showArrowBadge={false}
                  />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold truncate">
                      {getSupplyName(tpl.id, t)}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">
                      {effectText}
                    </div>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-2 font-mono-nums text-xs">
                  {alreadyInLoadout && (
                    <span className="text-[11px] font-sans font-semibold text-sky-400">
                      {t('supply.alreadyEquipped')}
                    </span>
                  )}
                  <span
                    className={
                      stock === 0
                        ? 'text-slate-500'
                        : 'text-amber-300 font-semibold'
                    }
                  >
                    x{stock}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    );

  return (
    <div
      ref={containerRef}
      data-testid={`supply-loadout-bar-${variant}`}
      className="w-full relative"
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-xs font-display font-bold tracking-wide text-slate-200 truncate">
          {t('supply.bagTitle')}
        </span>
        <span
          data-testid={`supply-loadout-count-${variant}`}
          className="font-mono-nums text-[11px] font-semibold text-slate-400 shrink-0"
        >
          {loadoutIds.length}/{slotCount}
        </span>
      </div>

      <div
        className="grid gap-1.5"
        style={{
          gridTemplateColumns: `repeat(${slotCount}, minmax(0, 1fr))`,
        }}
      >
        {Array.from({ length: slotCount }, (_, index) => {
          const templateId = loadoutIds[index] ?? null;
          const tpl = templateId ? getSupplyTemplateById(templateId) : undefined;
          const stock = templateId
            ? stockByTemplateId.get(templateId) ?? 0
            : 0;
          const iconRow = tpl
            ? getCatalogRow(tpl.iconId, iconCatalogMods) ?? null
            : null;
          const isOpen = openSlotIndex === index;
          const isEmpty = !tpl;

          return (
            <button
              key={index}
              type="button"
              data-testid={`supply-slot-${variant}-${index}`}
              data-supply-template-id={templateId ?? ''}
              data-supply-dimmed={isLocked ? 'true' : 'false'}
              title={
                isLocked
                  ? t('supply.lockedHint')
                  : tpl
                  ? getSupplyName(tpl.id, t)
                  : t('supply.pickerTitle')
              }
              onClick={() => {
                if (isLocked) return;
                setOpenSlotIndex((prev) => (prev === index ? null : index));
              }}
              className={`${tileHeightClass} min-w-0 rounded px-1 py-0.5 flex flex-col items-center justify-center overflow-hidden transition-colors ${
                isEmpty
                  ? 'border border-dashed border-slate-700/85 bg-[#080C14]/55'
                  : 'border border-slate-700/90 bg-[#080C14]/95'
              } ${
                isOpen && !isLocked
                  ? 'border-amber-400 bg-amber-500/10'
                  : !isLocked
                  ? 'hover:border-amber-400/70'
                  : ''
              } ${
                isLocked
                  ? 'opacity-50 cursor-not-allowed'
                  : 'cursor-pointer'
              }`}
            >
              {isEmpty ? (
                <Plus className="w-4 h-4 text-slate-500 shrink-0" />
              ) : (
                <>
                  <div className="flex items-center justify-center gap-1 min-w-0 max-w-full">
                    <CatalogIcon
                      row={iconRow}
                      size="xs"
                      showBadges={false}
                      showArrowBadge={false}
                    />
                    <span
                      className={`font-mono-nums text-[10px] font-bold leading-none ${
                        stock === 0 ? 'text-slate-500 opacity-70' : 'text-amber-300'
                      }`}
                    >
                      x{stock}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] leading-tight font-medium truncate max-w-full mt-0.5 ${
                      stock === 0 ? 'text-slate-400 opacity-75' : 'text-slate-200'
                    }`}
                  >
                    {formatSupplyShortName(getSupplyName(tpl.id, t))}
                  </span>
                </>
              )}
            </button>
          );
        })}
      </div>

      {variant === 'desktop' && openSlotIndex !== null && !isLocked && (
        <div
          data-testid="supply-picker-desktop"
          className="absolute left-0 right-0 top-full mt-1.5 z-40 rounded-lg border border-slate-700/90 bg-[#0B111C] shadow-2xl p-2 max-h-72 overflow-y-auto"
        >
          {pickerContent}
        </div>
      )}

      {variant === 'phone' && (
        <BottomSheet
          open={openSlotIndex !== null && !isLocked}
          onClose={() => setOpenSlotIndex(null)}
          title={t('supply.pickerTitle')}
          subtitle={t('supply.bagTitle')}
        >
          <div data-testid="supply-picker-phone">{pickerContent}</div>
        </BottomSheet>
      )}
    </div>
  );
}
