import { useEffect, useMemo, useRef, useState } from 'react';
import { getCatalogRowForStatus } from '../data/statusIconMap';
import {
  buildAllySupplyBagSummary,
  buildPrestageSummary,
  countAppliedPrestageBuffs,
  formatPrestageBuffChip,
  shouldUseGroupedPrestage,
  type PrestageSideSummary,
} from '../engine/prestage';
import type { BattleSupplyRow } from '../engine/supplies';
import { getClassName, getStatusLabel } from '../i18n';
import type { TranslationKey } from '../i18n/en';
import type {
  AdminConfig,
  BattleState,
  CombatSide,
  CombatUnit,
  Language,
} from '../types/game';
import { useBattleLayoutMode } from '../utils/battleDisplay';
import { BottomSheet } from './BottomSheet';
import { CatalogIcon } from './CatalogIcon';
import { LevelBadge } from './LevelBadge';

type TranslateFn = (
  key: TranslationKey,
  params?: Record<string, string | number>
) => string;

export interface PrestageDialogProps {
  battle: BattleState;
  supplyRows: readonly BattleSupplyRow[];
  adminConfig: AdminConfig;
  autoLoopActive: boolean;
  lang: Language;
  t: TranslateFn;
  onConfirm: () => void;
}

function formatMixText(
  summary: PrestageSideSummary,
  lang: Language,
  t: TranslateFn
): string {
  if (summary.byClass.length === 0) return '—';
  const parts = summary.byClass.map(
    (c) => `${c.count} ${getClassName(lang, c.classId)}`
  );
  return t('prestage.mixPrefix', { mix: parts.join(', ') });
}

export function PrestageDialog({
  battle,
  supplyRows,
  adminConfig,
  autoLoopActive,
  lang,
  t,
  onConfirm,
}: PrestageDialogProps) {
  const layoutMode = useBattleLayoutMode();
  const isPhonePortrait = layoutMode === 'phone-portrait';
  const [phoneTab, setPhoneTab] = useState<CombatSide>('ally');

  const loopKey = `${autoLoopActive ? 1 : 0}:${battle.sectorId}:${battle.turnCounter}`;
  const confirmedForKeyRef = useRef<string | null>(null);
  const onConfirmRef = useRef(onConfirm);
  onConfirmRef.current = onConfirm;

  useEffect(() => {
    if (!autoLoopActive) {
      confirmedForKeyRef.current = null;
      return;
    }
    if (confirmedForKeyRef.current === loopKey) return;
    confirmedForKeyRef.current = loopKey;
    onConfirmRef.current();
  }, [autoLoopActive, loopKey]);

  const isGrouped = useMemo(
    () => shouldUseGroupedPrestage(battle.units, adminConfig),
    [battle.units, adminConfig]
  );

  const allySummary = useMemo(
    () => buildPrestageSummary(battle.units, 'ally', true),
    [battle.units]
  );

  const enemySummary = useMemo(
    () => buildPrestageSummary(battle.units, 'enemy', false),
    [battle.units]
  );

  const allyUnits = useMemo(
    () => battle.units.filter((u) => u.side === 'ally' && u.alive),
    [battle.units]
  );

  const enemyUnits = useMemo(
    () => battle.units.filter((u) => u.side === 'enemy' && u.alive),
    [battle.units]
  );

  const totalAllyBuffs = useMemo(
    () => countAppliedPrestageBuffs(battle.units, 'ally'),
    [battle.units]
  );

  const allySupplyEntries = useMemo(
    () =>
      buildAllySupplyBagSummary(battle.units, battle.supplyByUnit, supplyRows),
    [battle.units, battle.supplyByUnit, supplyRows]
  );

  const allySupplyText = useMemo(
    () =>
      allySupplyEntries
        .map(
          (entry) =>
            `${t(`prestage.supplyFamily.${entry.family}` as TranslationKey)} T${entry.tier} x${entry.count}`
        )
        .join(' · '),
    [allySupplyEntries, t]
  );

  const refLevel =
    allySummary.commander?.level ??
    allyUnits[0]?.level ??
    1;

  const iconMods = adminConfig.iconCatalogMods;

  // Multi-battle loop skips PrestageDialog completely (acts like countdown 0)
  if (autoLoopActive) {
    return null;
  }

  const confirmButton = (
    <button
      type="button"
      data-testid="prestage-confirm-btn"
      onClick={onConfirm}
      className={`${
        isPhonePortrait ? 'w-full h-[44px] min-h-[44px]' : 'min-h-[40px] px-6'
      } rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-colors cursor-pointer whitespace-nowrap`}
    >
      {t('prestage.confirm')}
    </button>
  );

  const renderSupplyOrIntelStrip = (side: CombatSide) => {
    if (side === 'enemy') {
      return (
        <div
          data-testid="prestage-enemy-intel-strip"
          className="shrink-0 mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2 text-xs text-slate-400 min-w-0"
        >
          <span className="font-semibold text-slate-300 shrink-0">
            {t('prestage.supplyBagTitle')}:
          </span>
          <span className="truncate text-slate-400">
            {t('prestage.enemyIntelNone')}
          </span>
        </div>
      );
    }

    return (
      <div
        data-testid="prestage-ally-supply-strip"
        className="shrink-0 mt-2 pt-2 border-t border-slate-800/80 text-xs leading-relaxed text-slate-300 min-w-0 break-words"
      >
        <span className="font-semibold text-slate-200">
          {t('prestage.supplyBagTeamTitle')}:{' '}
        </span>
        {allySupplyEntries.length === 0 ? (
          <span className="text-slate-400">{t('prestage.supplyBagEmpty')}</span>
        ) : (
          <span className="font-mono-nums text-amber-200">
            {allySupplyText}
          </span>
        )}
      </div>
    );
  };

  const renderSmallList = (side: CombatSide, sideUnits: CombatUnit[]) => {
    const isEnemy = side === 'enemy';
    return (
      <div
        data-testid={`prestage-${side}-list`}
        className="flex-1 min-h-0 overflow-y-auto tactical-scroll space-y-1.5 pr-0.5"
      >
        {sideUnits.map((unit) => {
          const hpPct =
            unit.derived.maxHp > 0
              ? Math.max(0, Math.min(100, Math.round((unit.hp / unit.derived.maxHp) * 100)))
              : 0;
          const spPct =
            unit.derived.maxSp > 0
              ? Math.max(0, Math.min(100, Math.round((unit.sp / unit.derived.maxSp) * 100)))
              : 0;
          const activeStatuses = isEnemy
            ? []
            : unit.statuses.filter((st) => st.turnsRemaining > 0);

          return (
            <div
              key={unit.id}
              data-testid={`prestage-row-${unit.id}`}
              className="px-2.5 py-2 rounded-lg border border-slate-800/80 bg-slate-900/65 min-w-0"
            >
              <div className="flex items-center gap-2 min-w-0">
                <LevelBadge
                  level={unit.level}
                  refLevel={refLevel}
                  side={unit.side}
                  isLeader={unit.isPlayer}
                  textSizeClass="text-xs"
                />
                <span className="text-sm font-semibold text-slate-100 truncate min-w-0 flex-1">
                  {unit.name}
                </span>
                <span className="text-xs text-slate-400 shrink-0 whitespace-nowrap">
                  {getClassName(lang, unit.classId)}
                </span>
                <div
                  className="w-10 shrink-0 flex flex-col gap-0.5"
                  aria-hidden="true"
                >
                  <div className="h-[3px] w-full rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-emerald-400"
                      style={{ width: `${hpPct}%` }}
                    />
                  </div>
                  <div className="h-[2px] w-full rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-amber-400"
                      style={{ width: `${spPct}%` }}
                    />
                  </div>
                </div>
              </div>
              {!isEnemy && activeStatuses.length > 0 && (
                <div
                  data-testid={`prestage-unit-buffs-${unit.id}`}
                  className="mt-1.5 flex items-center flex-wrap gap-1.5 min-w-0"
                >
                  {activeStatuses.map((st) => (
                    <span
                      key={st.type}
                      title={getStatusLabel(lang, st.type)}
                      className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/40 text-xs font-mono-nums font-medium text-emerald-200 whitespace-nowrap"
                    >
                      {formatPrestageBuffChip(st, lang)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {isEnemy && (
          <div className="pt-1 text-xs text-slate-500">
            {t('prestage.enemyStatusHidden')}
          </div>
        )}
      </div>
    );
  };

  const renderGroupedSide = (side: CombatSide, summary: PrestageSideSummary) => {
    const isEnemy = side === 'enemy';
    return (
      <div
        data-testid={`prestage-${side}-grouped`}
        className="flex-1 min-h-0 overflow-y-auto tactical-scroll space-y-2 pr-0.5"
      >
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-800/80 bg-slate-900/80 min-w-0">
          {summary.commander ? (
            <>
              <LevelBadge
                level={summary.commander.level}
                refLevel={refLevel}
                side={side}
                isLeader={summary.commander.isPlayer}
                textSizeClass="text-xs"
              />
              <span className="text-sm font-semibold text-slate-100 truncate min-w-0 flex-1">
                {summary.commander.name}
              </span>
              <span className="text-xs text-slate-400 shrink-0 whitespace-nowrap">
                {getClassName(lang, summary.commander.classId)}
              </span>
            </>
          ) : (
            <span className="text-slate-500 text-xs">
              {t('prestage.commanderEmpty')}
            </span>
          )}
        </div>

        {summary.byClass.map((cls) => (
          <div
            key={cls.classId}
            data-testid={`prestage-group-${side}-${cls.classId}`}
            className="rounded-lg border border-slate-800/75 bg-slate-900/50 px-2.5 py-2 space-y-1.5 min-w-0"
          >
            <div className="flex items-center justify-between gap-2 text-xs font-medium text-slate-100 font-mono-nums min-w-0">
              <span className="truncate">
                {t('prestage.classGroupLine', {
                  className: getClassName(lang, cls.classId),
                  count: cls.count,
                  min: cls.levelMin,
                  max: cls.levelMax,
                  avg: cls.levelAvg,
                })}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 items-center">
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-emerald-400"
                    style={{ width: `${cls.avgHpPct}%` }}
                  />
                </div>
                <span className="font-mono-nums text-xs text-emerald-300 shrink-0">
                  {cls.avgHpPct}%
                </span>
              </div>
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-sky-400"
                    style={{ width: `${cls.avgShieldPct}%` }}
                  />
                </div>
                <span className="font-mono-nums text-xs text-sky-300 shrink-0">
                  {cls.avgShieldPct}%
                </span>
              </div>
            </div>

            <div className="flex items-center flex-wrap gap-1.5 text-xs min-w-0">
              {isEnemy ? (
                <span className="text-slate-500">
                  {t('prestage.enemyStatusHidden')}
                </span>
              ) : cls.statuses.length === 0 ? (
                <span className="text-slate-500">—</span>
              ) : (
                cls.statuses.map((st) => (
                  <span
                    key={st.type}
                    className="inline-flex items-center gap-1 text-emerald-200 font-mono-nums"
                  >
                    <CatalogIcon
                      row={getCatalogRowForStatus(st.type, iconMods)}
                      fallbackStatusType={st.type}
                      size="xs"
                      showBadges={false}
                      showArrowBadge={false}
                    />
                    <span>{getStatusLabel(lang, st.type)}</span>
                    <span>×{st.count}</span>
                  </span>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderSidePanel = (side: CombatSide) => {
    const summary = side === 'ally' ? allySummary : enemySummary;
    const sideUnits = side === 'ally' ? allyUnits : enemyUnits;
    return (
      <div
        data-testid={`prestage-side-${side}`}
        className="flex flex-col flex-1 min-h-0 min-w-0"
      >
        {!isPhonePortrait && (
          <div className="shrink-0 flex items-center justify-between gap-2 pb-1.5 mb-2 border-b border-slate-800/80 min-w-0">
            <span
              className={`text-xs font-bold uppercase tracking-wider ${
                side === 'ally' ? 'text-emerald-300' : 'text-rose-300'
              }`}
            >
              {side === 'ally' ? t('prestage.sideAlly') : t('prestage.sideEnemy')}
            </span>
            <span className="font-mono-nums text-xs text-slate-400 shrink-0">
              {summary.total}
            </span>
          </div>
        )}
        {isGrouped
          ? renderGroupedSide(side, summary)
          : renderSmallList(side, sideUnits)}
        {renderSupplyOrIntelStrip(side)}
      </div>
    );
  };

  const buffsHeaderText = t('prestage.buffsAppliedHeader', {
    count: totalAllyBuffs,
  });

  if (isPhonePortrait) {
    return (
      <BottomSheet
        open={true}
        onClose={() => {}}
        title={t('prestage.title')}
        size="large"
        maxHeightClass="max-h-[86dvh]"
        bodyScrollable={false}
        testId="prestage-dialog"
        footer={confirmButton}
      >
        {/* Fixed overview + buff count ABOVE tabs */}
        <div className="shrink-0 px-4 pt-2 pb-1.5 space-y-1 min-w-0">
          <div
            data-testid="prestage-phone-overview"
            className="text-xs font-semibold text-slate-200 font-mono-nums truncate"
          >
            {t('prestage.overviewPhone', {
              ally: allySummary.total,
              enemy: enemySummary.total,
            })}
          </div>
          <div
            data-testid="prestage-buff-count"
            className="text-xs font-medium text-emerald-300 truncate"
          >
            {buffsHeaderText}
          </div>
        </div>

        {/* Fixed tabs [Ta | Địch] */}
        <div className="shrink-0 px-4 pb-2 border-b border-slate-800/80 grid grid-cols-2 gap-1.5">
          <button
            type="button"
            data-testid="prestage-tab-ally"
            onClick={() => setPhoneTab('ally')}
            className={`min-h-[40px] rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              phoneTab === 'ally'
                ? 'bg-emerald-500/20 border border-emerald-500/60 text-emerald-200'
                : 'bg-slate-900/70 border border-slate-800 text-slate-400'
            }`}
          >
            {t('prestage.tabAlly')} ({allySummary.total})
          </button>
          <button
            type="button"
            data-testid="prestage-tab-enemy"
            onClick={() => setPhoneTab('enemy')}
            className={`min-h-[40px] rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              phoneTab === 'enemy'
                ? 'bg-rose-500/20 border border-rose-500/60 text-rose-200'
                : 'bg-slate-900/70 border border-slate-800 text-slate-400'
            }`}
          >
            {t('prestage.tabEnemy')} ({enemySummary.total})
          </button>
        </div>

        {/* Scrollable body + side strip */}
        <div className="flex-1 min-h-0 flex flex-col px-4 py-2.5 overflow-hidden">
          {renderSidePanel(phoneTab)}
        </div>
      </BottomSheet>
    );
  }

  return (
    <div
      className="fixed inset-0 z-40 bg-black/75 flex items-center justify-center p-2 sm:p-4 overflow-x-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="prestage-dialog-title"
    >
      <div
        data-testid="prestage-dialog"
        data-mode={isGrouped ? 'grouped' : 'list'}
        className="w-[min(820px,calc(100vw-16px))] max-w-[820px] max-h-[84vh] flex flex-col rounded-xl border border-slate-700 bg-[#0E1521] text-slate-100 shadow-2xl overflow-hidden"
      >
        {/* Fixed Header */}
        <div className="shrink-0 px-5 py-3.5 border-b border-slate-800/90 space-y-1 min-w-0">
          <div className="flex items-center justify-between gap-3 min-w-0">
            <h2
              id="prestage-dialog-title"
              className="text-base font-bold text-slate-100 truncate"
            >
              {t('prestage.title')}
            </h2>
            <span
              data-testid="prestage-desktop-overview"
              className="font-mono-nums text-xs font-semibold text-emerald-300 truncate"
            >
              {t('prestage.overviewDesktop', {
                ally: allySummary.total,
                enemy: enemySummary.total,
              })}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 min-w-0 flex-wrap">
            <div
              data-testid="prestage-desktop-mix"
              className="text-xs text-slate-400 truncate min-w-0"
            >
              {t('prestage.tabAlly')}: {formatMixText(allySummary, lang, t)} ·{' '}
              {t('prestage.tabEnemy')}: {formatMixText(enemySummary, lang, t)}
            </div>
            <div
              data-testid="prestage-buff-count"
              className="text-xs font-semibold text-emerald-300 shrink-0"
            >
              {buffsHeaderText}
            </div>
          </div>
        </div>

        {/* 2 columns Ta | Địch */}
        <div className="flex-1 min-h-0 grid grid-cols-2 gap-4 px-5 py-3.5 overflow-hidden">
          {renderSidePanel('ally')}
          {renderSidePanel('enemy')}
        </div>

        {/* Fixed Footer */}
        <div className="shrink-0 px-5 py-3 border-t border-slate-800/90 bg-[#080C14]/95 flex justify-end">
          {confirmButton}
        </div>
      </div>
    </div>
  );
}
