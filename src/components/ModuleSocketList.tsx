import { useEffect, useState } from 'react';
import { AlertTriangle, Check, Lock } from 'lucide-react';
import { STAT_KEYS } from '../data/classes';
import { getCatalogRow } from '../data/iconCatalog';
import { RARITY_META } from '../data/items';
import { getModuleTemplateById } from '../data/modules';
import { getEffectiveItemStats } from '../engine/equipment';
import {
  canEquipModule,
  DEFAULT_EXTENDER_SLOT_COUNT,
  findModuleInstanceInPilot,
  getUnlockedExtenderCount,
  sanitizeExtenderLevelsPerSocket,
} from '../engine/extenders';
import {
  formatItemTraitsList,
  getItemInstanceName,
  getStatShort,
  useI18n,
} from '../i18n';
import type { TranslationKey } from '../i18n/en';
import { useGameStore } from '../store/useGameStore';
import type { ItemInstance, Language } from '../types/game';
import { CatalogIcon } from './CatalogIcon';
import { SlotIcon } from './GameIcons';

export interface ModuleDeltaBadge {
  key: string;
  label: string;
  positive: boolean;
}

export function computeModuleDeltaBadges(
  lang: Language,
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string,
  currentModule: ItemInstance | null,
  nextModule: ItemInstance | null
): ModuleDeltaBadge[] {
  const badges: ModuleDeltaBadge[] = [];
  const curStats = currentModule ? getEffectiveItemStats(currentModule) : null;
  const nextStats = nextModule ? getEffectiveItemStats(nextModule) : null;

  for (const k of STAT_KEYS) {
    const d = (nextStats?.[k] ?? 0) - (curStats?.[k] ?? 0);
    if (d !== 0) {
      badges.push({
        key: k,
        label: `${getStatShort(lang, k)} ${d > 0 ? `+${d}` : d}`,
        positive: d > 0,
      });
    }
  }

  const ct = currentModule?.specialTraits;
  const nt = nextModule?.specialTraits;

  const critDelta = (nt?.critBonusPct ?? 0) - (ct?.critBonusPct ?? 0);
  if (critDelta !== 0) {
    badges.push({
      key: 'crit',
      label: `${t('ae.traitCrit')} ${critDelta > 0 ? `+${critDelta}%` : `${critDelta}%`}`,
      positive: critDelta > 0,
    });
  }

  const pierceDelta = (nt?.armorPiercePct ?? 0) - (ct?.armorPiercePct ?? 0);
  if (pierceDelta !== 0) {
    badges.push({
      key: 'pierce',
      label: `${t('ae.traitPierce')} ${pierceDelta > 0 ? `+${pierceDelta}%` : `${pierceDelta}%`}`,
      positive: pierceDelta > 0,
    });
  }

  const splashDelta = (nt?.splashPct ?? 0) - (ct?.splashPct ?? 0);
  if (splashDelta !== 0) {
    badges.push({
      key: 'splash',
      label: `${t('ae.traitSplash')} ${splashDelta > 0 ? `+${splashDelta}%` : `${splashDelta}%`}`,
      positive: splashDelta > 0,
    });
  }

  const spRegenDelta = (nt?.spRegenPerTurn ?? 0) - (ct?.spRegenPerTurn ?? 0);
  if (spRegenDelta !== 0) {
    badges.push({
      key: 'spRegen',
      label: `${t('ae.traitSpRegen')} ${spRegenDelta > 0 ? `+${spRegenDelta}` : spRegenDelta}`,
      positive: spRegenDelta > 0,
    });
  }

  const evaModDelta = (nt?.evasionMod ?? 0) - (ct?.evasionMod ?? 0);
  if (evaModDelta !== 0) {
    badges.push({
      key: 'evaMod',
      label: `${t('ae.traitEvaMod')} ${evaModDelta > 0 ? `+${evaModDelta}` : evaModDelta}`,
      positive: evaModDelta > 0,
    });
  }

  const accDelta = (nt?.accuracyPct ?? 0) - (ct?.accuracyPct ?? 0);
  if (accDelta !== 0) {
    badges.push({
      key: 'accuracy',
      label: `${t('derived.accuracy')} ${accDelta > 0 ? `+${accDelta}%` : `${accDelta}%`}`,
      positive: accDelta > 0,
    });
  }

  return badges;
}

export function formatModuleOneLineEffect(
  lang: Language,
  item: ItemInstance
): string {
  const stats = getEffectiveItemStats(item);
  const parts: string[] = [];
  for (const k of STAT_KEYS) {
    if (stats[k] > 0) {
      parts.push(`+${stats[k]} ${getStatShort(lang, k)}`);
    }
  }
  const traits = formatItemTraitsList(lang, item);
  for (const tr of traits) {
    parts.push(tr);
  }
  if (parts.length === 0) {
    const tpl = getModuleTemplateById(item.templateId);
    if (tpl) {
      return lang === 'vi' ? tpl.descVi : tpl.descEn;
    }
  }
  return parts.join(' · ');
}

export function formatModuleShortName(fullName: string): string {
  const trimmed = fullName.trim();
  const strippedVi = trimmed.replace(/^Mô-đun\s+/i, '');
  if (strippedVi !== trimmed && strippedVi.length > 0) {
    return strippedVi;
  }
  const strippedEn = trimmed.replace(/\s+Module(\s+|$)/i, '$1').trim();
  return strippedEn || trimmed;
}

export interface ModuleSocketListProps {
  moduleInstance: ItemInstance;
}

export function ModuleSocketList({ moduleInstance }: ModuleSocketListProps) {
  const { lang, t } = useI18n();
  const pilot = useGameStore((s) => s.pilot);
  const adminConfig = useGameStore((s) => s.adminConfig);
  const setExtenderModule = useGameStore((s) => s.setExtenderModule);

  const [actionError, setActionError] = useState<string | null>(null);

  const activeGear = pilot.gears[pilot.activeGearId];
  const levelsPerSocket = sanitizeExtenderLevelsPerSocket(
    adminConfig?.extenderLevelsPerSocket
  );
  const unlockedCount = getUnlockedExtenderCount(activeGear, adminConfig);

  useEffect(() => {
    setActionError(null);
  }, [moduleInstance.instanceId, activeGear.classId]);

  const handleEquipIntoSocket = (socketIndex: number) => {
    const res = setExtenderModule(
      activeGear.classId,
      socketIndex,
      moduleInstance.instanceId
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
  };

  return (
    <div
      data-testid="module-socket-list"
      className="rounded border border-slate-800/90 bg-[#080C14] p-3 space-y-2"
    >
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-bold uppercase tracking-wide text-amber-300">
          {t('module.socketListTitle')}
        </h4>
      </div>

      {actionError && (
        <div
          data-testid="module-socket-error"
          role="alert"
          className="flex items-center gap-1.5 rounded border border-red-500/40 bg-red-500/10 px-2.5 py-1.5 text-xs text-red-300"
        >
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span className="min-w-0 break-words">{actionError}</span>
        </div>
      )}

      <div className="space-y-1.5">
        {Array.from({ length: DEFAULT_EXTENDER_SLOT_COUNT }, (_, idx) => {
          const socketNum = idx + 1;
          const isLocked = idx >= unlockedCount;
          const currentId = activeGear.extenders?.[idx] ?? null;
          const currentModule = currentId
            ? findModuleInstanceInPilot(pilot, currentId) ?? null
            : null;
          const isSameInThisSocket = currentId === moduleInstance.instanceId;

          const check = isLocked
            ? null
            : canEquipModule(
                pilot,
                activeGear.classId,
                idx,
                moduleInstance.instanceId,
                adminConfig
              );

          const isBlocked = isLocked || (check !== null && !check.ok);
          const reasonText =
            !isLocked && check && !check.ok && check.reasonKey
              ? t(check.reasonKey, check.reasonParams)
              : null;

          const deltas =
            !isLocked && !isSameInThisSocket
              ? computeModuleDeltaBadges(
                  lang,
                  t,
                  currentModule,
                  moduleInstance
                )
              : [];

          return (
            <div
              key={idx}
              data-testid={`module-socket-row-${socketNum}`}
              data-locked={isLocked ? 'true' : 'false'}
              className={`flex items-center justify-between gap-2 rounded border border-slate-800/80 bg-[#0B111C] px-2.5 py-2 ${
                isBlocked ? 'opacity-60' : ''
              }`}
            >
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                  <span className="font-mono-nums font-bold text-slate-200 shrink-0">
                    {t('module.socketLabel', { n: socketNum })}
                  </span>
                  {isLocked ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                      <Lock className="w-3 h-3 shrink-0" />
                      <span>
                        {t('module.unlockAtLevel', {
                          level: socketNum * levelsPerSocket,
                        })}
                      </span>
                    </span>
                  ) : currentModule ? (
                    <span className="text-slate-300 truncate">
                      {getItemInstanceName(lang, currentModule, true)}
                    </span>
                  ) : (
                    <span className="text-slate-500">
                      {t('module.emptySocket')}
                    </span>
                  )}
                </div>

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

                {reasonText && (
                  <div
                    data-testid={`module-socket-reason-${socketNum}`}
                    className="text-[11px] text-red-400 break-words"
                  >
                    {reasonText}
                  </div>
                )}
              </div>

              {!isLocked && (
                <button
                  type="button"
                  data-testid={`module-socket-equip-${socketNum}`}
                  disabled={Boolean(
                    !check?.ok || isSameInThisSocket
                  )}
                  onClick={() => handleEquipIntoSocket(idx)}
                  className={`min-h-[36px] px-3 rounded border text-xs font-bold shrink-0 inline-flex items-center gap-1 transition-colors ${
                    isSameInThisSocket
                      ? 'border-sky-500/45 bg-sky-500/15 text-sky-200 cursor-default'
                      : !check?.ok
                      ? 'border-slate-800 bg-slate-900/70 text-slate-500 cursor-not-allowed'
                      : 'border-emerald-500/60 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 cursor-pointer'
                  }`}
                >
                  {isSameInThisSocket ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>{t('module.equippedHere')}</span>
                    </>
                  ) : (
                    <span>{t('module.equipBtn')}</span>
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export interface GearSocketRowProps {
  onSelectSocket: (socketIndex: number) => void;
}

export function GearSocketRow({ onSelectSocket }: GearSocketRowProps) {
  const { lang, t } = useI18n();
  const pilot = useGameStore((s) => s.pilot);
  const adminConfig = useGameStore((s) => s.adminConfig);
  const iconCatalogMods = useGameStore((s) => s.adminConfig.iconCatalogMods);

  const activeGear = pilot.gears[pilot.activeGearId];
  const levelsPerSocket = sanitizeExtenderLevelsPerSocket(
    adminConfig?.extenderLevelsPerSocket
  );
  const unlockedCount = getUnlockedExtenderCount(activeGear, adminConfig);

  return (
    <div className="lg:col-span-full w-full relative z-10 pt-2 border-t border-slate-800/80 space-y-1.5">
      <div className="flex items-center justify-between gap-2 px-0.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
          {t('module.socketsHeading')}
        </span>
      </div>

      <div
        data-testid="gear-socket-row"
        className="grid grid-cols-5 gap-1 sm:gap-1.5 w-full"
      >
        {Array.from({ length: DEFAULT_EXTENDER_SLOT_COUNT }, (_, idx) => {
          const socketNum = idx + 1;
          const isLocked = idx >= unlockedCount;
          const currentId = activeGear.extenders?.[idx] ?? null;
          const mod =
            !isLocked && currentId
              ? findModuleInstanceInPilot(pilot, currentId) ?? null
              : null;
          const tpl = mod ? getModuleTemplateById(mod.templateId) : undefined;
          const iconRow = tpl
            ? getCatalogRow(tpl.iconId, iconCatalogMods) ?? null
            : null;
          const fullName = mod ? getItemInstanceName(lang, mod, true) : '';
          const shortName = mod ? formatModuleShortName(fullName) : '';
          const rarity = mod ? RARITY_META[mod.rarity] : null;
          const unlockLv = socketNum * levelsPerSocket;

          return (
            <button
              key={idx}
              type="button"
              data-testid={`gear-socket-tile-${socketNum}`}
              data-locked={isLocked ? 'true' : 'false'}
              disabled={isLocked}
              title={
                isLocked
                  ? t('module.unlockAtLevel', { level: unlockLv })
                  : mod
                  ? fullName
                  : t('module.socketLabel', { n: socketNum })
              }
              aria-label={
                isLocked
                  ? `${t('module.socketLabel', { n: socketNum })} - ${t('module.unlockAtLevel', { level: unlockLv })}`
                  : mod
                  ? `${t('module.socketLabel', { n: socketNum })}: ${fullName}`
                  : `${t('module.socketLabel', { n: socketNum })} (${t('module.emptySocket')})`
              }
              onClick={() => {
                if (!isLocked) onSelectSocket(idx);
              }}
              className={`min-w-0 h-12 sm:h-[52px] px-1 py-1 rounded-md border flex flex-col items-center justify-center gap-0.5 overflow-hidden transition-colors ${
                isLocked
                  ? 'border-slate-800/70 bg-slate-950/60 text-slate-500 cursor-not-allowed opacity-60'
                  : mod && rarity
                  ? `${rarity.borderClass} bg-[#0A111D] hover:border-amber-400/80 text-slate-100 cursor-pointer`
                  : 'border-dashed border-slate-700/80 bg-[#080C14]/90 hover:border-amber-400/70 text-slate-400 hover:text-amber-300 cursor-pointer'
              }`}
            >
              {isLocked ? (
                <>
                  <Lock className="w-3 h-3 text-slate-500 shrink-0" />
                  <span className="text-[10px] font-mono-nums leading-none truncate max-w-full">
                    Lv {unlockLv}
                  </span>
                </>
              ) : mod ? (
                <>
                  {iconRow ? (
                    <CatalogIcon
                      row={iconRow}
                      size="xs"
                      showBadges={false}
                      showArrowBadge={false}
                    />
                  ) : (
                    <SlotIcon
                      slot="module"
                      className={`w-3.5 h-3.5 shrink-0 ${rarity?.textClass ?? 'text-sky-300'}`}
                    />
                  )}
                  <span
                    className={`text-[10px] font-medium leading-tight truncate w-full text-center ${
                      rarity?.textClass ?? 'text-slate-200'
                    }`}
                  >
                    {shortName}
                  </span>
                </>
              ) : (
                <span
                  aria-hidden="true"
                  className="text-sm font-bold leading-none text-slate-400"
                >
                  +
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
