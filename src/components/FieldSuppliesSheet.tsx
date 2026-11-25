import { Settings, Zap } from 'lucide-react';
import { getCatalogRow } from '../data/iconCatalog';
import type { BattleSupplyRow } from '../engine/supplies';
import type { TranslationKey } from '../i18n/en';
import type { IconCatalogModRow } from '../types/game';
import { BottomSheet } from './BottomSheet';
import { CatalogIcon } from './CatalogIcon';
import { ErrorBoundary } from './ErrorBoundary';
import { formatSupplyEffects, getSupplyName } from './SupplyLoadoutBar';

type TranslateFn = (
  key: TranslationKey,
  params?: Record<string, string | number>
) => string;

export interface FieldSuppliesSheetProps {
  open: boolean;
  t: TranslateFn;
  onClose: () => void;
  onOpenTactics: () => void;
  onReloadBattle: () => void;
  rows?: BattleSupplyRow[];
  usedThisTurn?: number;
  usesPerTurn?: number;
  hasLoadout?: boolean;
  iconCatalogMods?: IconCatalogModRow[];
  onUseSupply?: (templateId: string) => void;
}

export function FieldSuppliesSheet({
  open,
  t,
  onClose,
  onOpenTactics,
  onReloadBattle,
  rows,
  usedThisTurn = 0,
  usesPerTurn = 1,
  hasLoadout,
  iconCatalogMods,
  onUseSupply,
}: FieldSuppliesSheetProps) {
  const hasSupplyModel = rows !== undefined;
  const effectiveHasLoadout =
    hasLoadout ?? Boolean(rows?.some((row) => row.templateId !== null));

  return (
    <ErrorBoundary
      variant="panel"
      title={t('battle.suppliesTitle')}
      resetKey={open}
      onClose={onClose}
      onReloadBattle={onReloadBattle}
    >
      <BottomSheet
        open={open}
        onClose={onClose}
        title={t('battle.suppliesTitle')}
        footer={
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenTactics();
            }}
            className="w-full min-h-[44px] px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-[13px] inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <Settings className="w-4 h-4" />
            <span>{t('battle.openTactics')}</span>
          </button>
        }
      >
        {!hasSupplyModel ? (
          <div className="rounded-lg border border-slate-800 bg-[#080D16] p-4 text-[13px] text-slate-300 leading-relaxed flex items-start gap-2">
            <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>{t('battle.noConsumables')}</span>
          </div>
        ) : (
          <div className="space-y-2.5 min-w-0">
            <div
              data-testid="supply-sheet-turn-header"
              className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-300 px-0.5"
            >
              <span>
                {t('supply.sheetUsedTurn', {
                  n: usedThisTurn,
                  max: usesPerTurn,
                })}
              </span>
            </div>

            {!effectiveHasLoadout ? (
              <div
                data-testid="supply-sheet-empty-loadout"
                className="rounded-lg border border-slate-800 bg-[#080D16] p-3.5 text-xs text-slate-300 space-y-1"
              >
                <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{t('supply.emptyLoadout')}</span>
                </div>
                <div className="text-slate-400 pl-5">
                  {t('supply.emptySlotHint')}
                </div>
              </div>
            ) : (
              <div className="space-y-1.5 min-w-0">
                {rows.map((row) => {
                  if (!row.templateId) {
                    return (
                      <div
                        key={`empty-${row.slotIndex}`}
                        data-testid={`supply-sheet-empty-${row.slotIndex}`}
                        className="rounded-lg border border-slate-800/70 bg-[#080D16]/70 px-3 py-2 text-xs text-slate-400"
                      >
                        {t('supply.emptySlotHint')}
                      </div>
                    );
                  }

                  const tplId = row.templateId;
                  const iconRow = row.iconId
                    ? getCatalogRow(row.iconId, iconCatalogMods) ?? null
                    : null;
                  const name = getSupplyName(tplId, t);
                  const effectText =
                    row.effects.length > 0
                      ? formatSupplyEffects(row.effects, t)
                      : row.effectSummary;

                  return (
                    <div
                      key={`${row.slotIndex}-${tplId}`}
                      data-testid={`supply-sheet-row-${tplId}`}
                      className="rounded-lg border border-slate-800 bg-[#080D16] px-2.5 py-2 flex items-center justify-between gap-2 min-w-0"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <CatalogIcon
                          row={iconRow}
                          size="sm"
                          showBadges={false}
                          showArrowBadge={false}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-slate-100 truncate">
                            {name}
                          </div>
                          <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <span className="text-emerald-300 font-medium">
                              {effectText}
                            </span>
                            <span className="font-mono-nums text-amber-300 font-semibold">
                              x{row.stock}
                            </span>
                            <span className="font-mono-nums text-slate-400">
                              {t('supply.usesCount', {
                                n: row.usedCount,
                                max: Number.isFinite(row.limit) ? row.limit : '∞',
                              })}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center">
                        {row.ok ? (
                          <button
                            type="button"
                            data-testid={`supply-use-btn-${tplId}`}
                            onClick={() => onUseSupply?.(tplId)}
                            className="min-h-[36px] min-w-[54px] px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer transition-colors"
                          >
                            {t('supply.useBtn')}
                          </button>
                        ) : (
                          <span
                            data-testid={`supply-reason-${tplId}`}
                            className="text-[11px] font-medium text-rose-300/90 text-right max-w-[116px] leading-tight"
                          >
                            {row.reasonKey
                              ? t(row.reasonKey as TranslationKey, row.params)
                              : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </BottomSheet>
    </ErrorBoundary>
  );
}
