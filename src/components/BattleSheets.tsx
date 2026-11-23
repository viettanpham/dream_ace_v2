import type { ReactNode } from 'react';
import { Minimize2, ScrollText, X } from 'lucide-react';
import type { TranslationKey } from '../i18n/en';
import type { CombatLogEntry, CombatUnit } from '../types/game';
import type { CombatLogChannel, CombatLogOrder } from '../utils/combatLogFormat';
import { CombatLogList } from './CombatLogList';
import { ErrorBoundary } from './ErrorBoundary';
import { UnitDetailSheet } from './UnitDetailSheet';

type TranslateFn = (
  key: TranslationKey,
  params?: Record<string, string | number>
) => string;

export interface PhoneUnitDetailSheetProps {
  unit: CombatUnit | null;
  selectedTargetId: string | null;
  selectedAllyTargetId: string | null;
  hasSingleAllySkill: boolean;
  canPlayerManualAct: boolean;
  validBasicTargetIds: ReadonlySet<string>;
  onClose: () => void;
  onLockEnemy: (unitId: string) => void;
  onLockAlly: (unitId: string) => void;
}

export function PhoneUnitDetailSheet({
  unit,
  selectedTargetId,
  selectedAllyTargetId,
  hasSingleAllySkill,
  canPlayerManualAct,
  validBasicTargetIds,
  onClose,
  onLockEnemy,
  onLockAlly,
}: PhoneUnitDetailSheetProps) {
  return (
    <UnitDetailSheet
      unit={unit}
      onClose={onClose}
      isTargeted={Boolean(
        unit &&
          ((unit.side === 'enemy' && selectedTargetId === unit.id) ||
            (unit.side === 'ally' &&
              hasSingleAllySkill &&
              selectedAllyTargetId === unit.id))
      )}
      canLockEnemy={canPlayerManualAct}
      canLockAlly={canPlayerManualAct && hasSingleAllySkill}
      frontRowBlocked={Boolean(
        unit && unit.side === 'enemy' && !validBasicTargetIds.has(unit.id)
      )}
      onLockEnemy={onLockEnemy}
      onLockAlly={onLockAlly}
    />
  );
}

export interface CombatLogPopupSheetProps {
  open: boolean;
  entries: CombatLogEntry[];
  units: CombatUnit[];
  channel: CombatLogChannel;
  order?: CombatLogOrder;
  expandAll: boolean;
  expandNonce: number;
  expandButtons: ReactNode;
  t: TranslateFn;
  onClose: () => void;
  onChannelChange: (channel: CombatLogChannel) => void;
  onOrderChange?: (order: CombatLogOrder) => void;
}

export function CombatLogPopupSheet({
  open,
  entries,
  units,
  channel,
  order,
  expandAll,
  expandNonce,
  expandButtons,
  t,
  onClose,
  onChannelChange,
  onOrderChange,
}: CombatLogPopupSheetProps) {
  if (!open) return null;

  return (
    <div
      data-testid="combat-log-popup"
      className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-slate-950/70 p-0 md:p-4"
      role="dialog"
      aria-modal="false"
      aria-label={t('battle.combatLog')}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full md:max-w-2xl h-[82dvh] max-h-[88dvh] flex flex-col rounded-t-2xl md:rounded-xl border-t md:border border-slate-700/90 bg-[#0B111C] text-slate-100 shadow-2xl overflow-hidden pb-safe">
        <div className="md:hidden pt-2.5 pb-1 flex justify-center shrink-0">
          <span className="w-10 h-1 rounded-full bg-slate-700" />
        </div>

        <div className="px-4 py-2.5 border-b border-slate-800/90 flex items-center justify-between gap-2 shrink-0">
          <div className="min-w-0 flex items-center gap-2">
            <ScrollText className="w-4 h-4 text-sky-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-[15px] font-bold text-slate-100 truncate">
                {t('battle.combatLog')}
              </div>
              <div className="text-[11px] font-mono-nums text-slate-400">
                {t('battle.eventsCount', { count: entries.length })}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
            {expandButtons}
            <button
              type="button"
              data-testid="combat-log-popup-dock-btn"
              onClick={onClose}
              className="min-h-[36px] px-2.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 text-[12px] font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Minimize2 className="w-3.5 h-3.5 text-sky-400" />
              <span>{t('log.modeDocked')}</span>
            </button>
            <button
              type="button"
              data-testid="combat-log-popup-close"
              onClick={onClose}
              aria-label={t('common.close')}
              className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <CombatLogList
            entries={entries}
            units={units}
            active={open}
            density="comfortable"
            mode="popup"
            channel={channel}
            onChannelChange={onChannelChange}
            order={order}
            onOrderChange={onOrderChange}
            expandAll={expandAll}
            expandNonce={expandNonce}
          />
        </div>
      </div>
    </div>
  );
}

export interface BattleSheetsProps {
  phoneSheetUnit: CombatUnit | null;
  phoneUnitSheetId: string | null;
  selectedTargetId: string | null;
  selectedAllyTargetId: string | null;
  hasSingleAllySkill: boolean;
  canPlayerManualAct: boolean;
  validBasicTargetIds: ReadonlySet<string>;
  onClosePhoneSheet: () => void;
  onLockEnemy: (unitId: string) => void;
  onLockAlly: (unitId: string) => void;
  logSheetOpen: boolean;
  entries: CombatLogEntry[];
  units: CombatUnit[];
  logChannel: CombatLogChannel;
  logOrder?: CombatLogOrder;
  logExpandAll: boolean;
  logExpandNonce: number;
  expandButtons: ReactNode;
  t: TranslateFn;
  onCloseLogSheet: () => void;
  onLogChannelChange: (channel: CombatLogChannel) => void;
  onLogOrderChange?: (order: CombatLogOrder) => void;
  onReloadBattle: () => void;
}

export function BattleSheets({
  phoneSheetUnit,
  phoneUnitSheetId,
  selectedTargetId,
  selectedAllyTargetId,
  hasSingleAllySkill,
  canPlayerManualAct,
  validBasicTargetIds,
  onClosePhoneSheet,
  onLockEnemy,
  onLockAlly,
  logSheetOpen,
  entries,
  units,
  logChannel,
  logOrder,
  logExpandAll,
  logExpandNonce,
  expandButtons,
  t,
  onCloseLogSheet,
  onLogChannelChange,
  onLogOrderChange,
  onReloadBattle,
}: BattleSheetsProps) {
  return (
    <>
      <ErrorBoundary
        variant="panel"
        title={phoneSheetUnit?.name ?? 'Unit Telemetry'}
        resetKey={phoneUnitSheetId ?? 'none'}
        onClose={onClosePhoneSheet}
        onReloadBattle={onReloadBattle}
      >
        <UnitDetailSheet
          unit={phoneSheetUnit}
          onClose={onClosePhoneSheet}
          isTargeted={Boolean(
            phoneSheetUnit &&
              ((phoneSheetUnit.side === 'enemy' &&
                selectedTargetId === phoneSheetUnit.id) ||
                (phoneSheetUnit.side === 'ally' &&
                  hasSingleAllySkill &&
                  selectedAllyTargetId === phoneSheetUnit.id))
          )}
          canLockEnemy={canPlayerManualAct}
          canLockAlly={canPlayerManualAct && hasSingleAllySkill}
          frontRowBlocked={Boolean(
            phoneSheetUnit &&
              phoneSheetUnit.side === 'enemy' &&
              !validBasicTargetIds.has(phoneSheetUnit.id)
          )}
          onLockEnemy={onLockEnemy}
          onLockAlly={onLockAlly}
        />
      </ErrorBoundary>

      <ErrorBoundary
        variant="panel"
        title={t('battle.combatLog')}
        resetKey={logSheetOpen}
        onClose={onCloseLogSheet}
        onReloadBattle={onReloadBattle}
      >
        {logSheetOpen && (
          <CombatLogPopupSheet
            open={logSheetOpen}
            entries={entries}
            units={units}
            channel={logChannel}
            order={logOrder}
            expandAll={logExpandAll}
            expandNonce={logExpandNonce}
            expandButtons={expandButtons}
            t={t}
            onClose={onCloseLogSheet}
            onChannelChange={onLogChannelChange}
            onOrderChange={onLogOrderChange}
          />
        )}
      </ErrorBoundary>
    </>
  );
}
