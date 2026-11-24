import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  Flag,
  Layers,
  LayoutGrid,
  Package,
  RefreshCw,
  RotateCcw,
  Shield,
  ShoppingBag,
  Sliders,
  Sparkles,
  Swords,
  Trash2,
  Upload,
  User,
  Wrench,
  X,
} from 'lucide-react';
import { BALANCE_CONFIG } from '../data/balance';
import { MECH_CLASS_LIST } from '../data/classes';
import {
  cloneFormationConfig,
  DEFAULT_FORMATION_CONFIG,
  FORMATION_ROWS,
} from '../data/formationConfig';
import { EQUIPMENT_SLOTS, ITEM_TEMPLATES } from '../data/items';
import { SECTORS_CATALOG } from '../data/maps';
import {
  cloneStarterSetConfig,
  DEFAULT_STARTER_SET_CONFIG,
} from '../data/starterConfig';
import {
  getClassName,
  getRarityLabel,
  getSectorName,
  getSlotLabel,
  useI18n,
} from '../i18n';
import { ENABLE_ADMIN_CP, useGameStore } from '../store/useGameStore';
import {
  computeShieldRegenPct,
  sanitizeShieldCrackedMult,
  sanitizeShieldCrackedTurns,
  sanitizeShieldDamageOverrides,
  sanitizeShieldRegenConfig,
} from '../engine/shieldRegen';
import {
  MAX_SUPPLY_SHOP_QTY, MAX_SUPPLY_SHOP_TYPES, MIN_SUPPLY_SHOP_QTY, MIN_SUPPLY_SHOP_TYPES, sanitizeSupplyShopConfig,
} from '../engine/shop';
import {
  DEFAULT_BOX_CAPACITY,
  DEFAULT_WAREHOUSE_CAPACITY,
  getBoxCapacity,
  MAX_BOX_CAPACITY,
  MAX_WAREHOUSE_CAPACITY,
  MIN_BOX_CAPACITY,
  MIN_WAREHOUSE_CAPACITY,
  sanitizeBoxCapacity,
  sanitizeNoticeDurationSec,
  sanitizeWarehouseCapacity,
} from '../engine/migration';
import type {
  BattleSize,
  CombatRow,
  EquipmentSlot,
  ItemRarity,
  MechClassId,
} from '../types/game';
import {
  clearErrorLogs,
  getErrorLogs,
  subscribeErrorLogs,
  type AppErrorLogEntry,
} from '../utils/errorLog';
import { ClassIcon, SlotIcon } from './GameIcons';
import {
  BUILTIN_STATUS_DISPLAY_DEFAULTS,
  clampPlayerStatusRows,
  clampStatusAreaRows,
} from '../utils/statusDisplayPrefs';
import type { StatusBadgeLayout, StatusDisplayDefaults } from '../types/game';

type AdminTab =
  | 'pilot'
  | 'items'
  | 'starter'
  | 'shop'
  | 'skills'
  | 'battle'
  | 'campaign'
  | 'formation'
  | 'system';

const RARITY_LIST: ItemRarity[] = ['common', 'rare', 'epic', 'legendary'];

export function AdminPanel() {
  const { lang, t } = useI18n();
  const open = useGameStore((s) => s.adminPanelOpen);
  const pilot = useGameStore((s) => s.pilot);
  const battle = useGameStore((s) => s.battle);
  const shopStock = useGameStore((s) => s.shopStock);
  const wpMarketOffers = useGameStore((s) => s.wpMarketOffers);
  const adminConfig = useGameStore((s) => s.adminConfig);

  const setAdminPanelOpen = useGameStore((s) => s.setAdminPanelOpen);
  const adminSetGearLevel = useGameStore((s) => s.adminSetGearLevel);
  const adminAddGearExp = useGameStore((s) => s.adminAddGearExp);
  const adminSetGearUnspentPoints = useGameStore(
    (s) => s.adminSetGearUnspentPoints
  );
  const adminAddGearUnspentPoints = useGameStore(
    (s) => s.adminAddGearUnspentPoints
  );
  const adminResetGearAllocation = useGameStore(
    (s) => s.adminResetGearAllocation
  );
  const adminSetCredits = useGameStore((s) => s.adminSetCredits);
  const adminAddCredits = useGameStore((s) => s.adminAddCredits);
  const adminSetWarPoints = useGameStore((s) => s.adminSetWarPoints);
  const adminAddWarPoints = useGameStore((s) => s.adminAddWarPoints);
  const adminGenerateItems = useGameStore((s) => s.adminGenerateItems);
  const adminDeleteItems = useGameStore((s) => s.adminDeleteItems);
  const adminFillInventory = useGameStore((s) => s.adminFillInventory);
  const adminRestockShopNow = useGameStore((s) => s.adminRestockShopNow);
  const adminForceAddShopItem = useGameStore((s) => s.adminForceAddShopItem);
  const adminUnlockAllSkillsForGear = useGameStore(
    (s) => s.adminUnlockAllSkillsForGear
  );
  const adminGrantAllOpeningCards = useGameStore(
    (s) => s.adminGrantAllOpeningCards
  );
  const adminResetBattleCooldowns = useGameStore(
    (s) => s.adminResetBattleCooldowns
  );
  const adminSkipBattleToRound = useGameStore((s) => s.adminSkipBattleToRound);
  const adminSetCampaignMonth = useGameStore((s) => s.adminSetCampaignMonth);
  const adminSetBaseFaction = useGameStore((s) => s.adminSetBaseFaction);
  const adminTriggerEnemyAttack = useGameStore(
    (s) => s.adminTriggerEnemyAttack
  );
  const adminUnlockAllGears = useGameStore((s) => s.adminUnlockAllGears);
  const adminUnlockAllSectors = useGameStore((s) => s.adminUnlockAllSectors);
  const adminApplyStarterToEmptySlots = useGameStore(
    (s) => s.adminApplyStarterToEmptySlots
  );
  const adminUpdateConfig = useGameStore((s) => s.adminUpdateConfig);
  const adminExportSaveJson = useGameStore((s) => s.adminExportSaveJson);
  const adminImportSaveJson = useGameStore((s) => s.adminImportSaveJson);
  const forceWinBattle = useGameStore((s) => s.forceWinBattle);
  const resetCampaign = useGameStore((s) => s.resetCampaign);

  const [tab, setTab] = useState<AdminTab>('pilot');
  const [targetGearId, setTargetGearId] = useState<MechClassId>(
    pilot.activeGearId
  );

  // Pilot tab inputs
  const [levelInput, setLevelInput] = useState(
    String(pilot.gears[pilot.activeGearId].level)
  );
  const [expInput, setExpInput] = useState('500');
  const [pointsInput, setPointsInput] = useState('10');
  const [creditsInput, setCreditsInput] = useState('5000');
  const [wpInput, setWpInput] = useState('500');

  // Items tab inputs
  const [genSlot, setGenSlot] = useState<EquipmentSlot>('main_weapon');
  const [genTier, setGenTier] = useState<number>(2);
  const [genRarity, setGenRarity] = useState<ItemRarity>('epic');
  const [genReqLevel, setGenReqLevel] = useState<string>('');
  const [genQuality, setGenQuality] = useState<string>('');
  const [genQty, setGenQty] = useState<number>(3);
  const [delMaxRarity, setDelMaxRarity] = useState<ItemRarity>('common');
  const [delMaxTier, setDelMaxTier] = useState<number>(2);

  // Shop tab force-add inputs
  const [forceShopSlot, setForceShopSlot] = useState<EquipmentSlot>('main_weapon');
  const [forceShopTier, setForceShopTier] = useState<number>(3);
  const [forceShopRarity, setForceShopRarity] = useState<ItemRarity>('legendary');
  const [forceShopTpl, setForceShopTpl] = useState<string>('');

  // Battle tab skip-round input
  const [skipRoundInput, setSkipRoundInput] = useState('21');

  // Campaign tab month input
  const [monthInput, setMonthInput] = useState(String(pilot.campaignMonth));

  // System tab state
  const [importJson, setImportJson] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const [showInspector, setShowInspector] = useState(false);
  const [errorLogs, setErrorLogs] = useState<AppErrorLogEntry[]>(() =>
    getErrorLogs()
  );

  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    setTargetGearId(pilot.activeGearId);
    setLevelInput(String(pilot.gears[pilot.activeGearId].level));
    setMonthInput(String(pilot.campaignMonth));
  }, [pilot.activeGearId, pilot.gears, pilot.campaignMonth, open]);

  useEffect(() => {
    if (!open) return;
    setErrorLogs(getErrorLogs());
    return subscribeErrorLogs(() => {
      setErrorLogs(getErrorLogs());
    });
  }, [open]);

  if (!open || !ENABLE_ADMIN_CP) return null;

  const targetGear = pilot.gears[targetGearId] ?? pilot.gears[pilot.activeGearId];
  const flash = (msg: string) => {
    setFeedback(msg);
  };

  const tabs: Array<{ id: AdminTab; label: string; icon: typeof User }> = [
    { id: 'pilot', label: t('admin.tab.pilot'), icon: User },
    { id: 'items', label: t('admin.tab.items'), icon: Package },
    { id: 'starter', label: t('admin.tab.starter'), icon: Layers },
    { id: 'shop', label: t('admin.tab.shop'), icon: ShoppingBag },
    { id: 'skills', label: t('admin.tab.skills'), icon: Sparkles },
    { id: 'battle', label: t('admin.tab.battle'), icon: Swords },
    { id: 'campaign', label: t('admin.tab.campaign'), icon: Flag },
    { id: 'formation', label: t('admin.tab.formation'), icon: LayoutGrid },
    { id: 'system', label: t('admin.tab.system'), icon: Wrench },
  ];

  const starterCfg = adminConfig.starterSet ?? DEFAULT_STARTER_SET_CONFIG;

  const handleCopyExport = async () => {
    const json = adminExportSaveJson();
    try {
      await navigator.clipboard.writeText(json);
      flash(t('error.copiedBtn'));
    } catch {
      setImportJson(json);
      flash(t('admin.systemExportCopy'));
    }
  };

  const handleDownloadExport = () => {
    const json = adminExportSaveJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dream_ace_save_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    flash(t('admin.systemExportDownload'));
  };

  const handleImportSave = () => {
    const res = adminImportSaveJson(importJson);
    if (res.ok) {
      flash(t('admin.systemImportOk'));
      setImportJson('');
    } else {
      flash(t('admin.systemImportErr', { err: res.error ?? 'Unknown' }));
    }
  };

  const forceSlotTemplates = ITEM_TEMPLATES.filter(
    (tpl) => tpl.slot === forceShopSlot
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('admin.title')}
    >
      <div className="w-full sm:max-w-4xl h-[92dvh] sm:h-[85dvh] rounded-t-2xl sm:rounded-xl border border-amber-500/40 bg-[#0A101B] text-slate-100 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-800 bg-[#0E1624] flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Sliders className="w-4 h-4 text-amber-400 shrink-0" />
            <div className="min-w-0">
              <h2 className="font-display text-lg font-bold tracking-wide text-amber-300 truncate">
                {t('admin.title')}
              </h2>
              <p className="text-[11px] text-slate-400 truncate">
                {t('admin.subtitle')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAdminPanelOpen(false)}
            aria-label={t('admin.close')}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Wrapped Icon Tab Bar (NO horizontal scrollbar) */}
        <div className="px-3 py-2 border-b border-slate-800 bg-[#0C1320] flex flex-wrap gap-1.5 shrink-0">
          {tabs.map((tb) => {
            const Icon = tb.icon;
            const active = tab === tb.id;
            return (
              <button
                key={tb.id}
                type="button"
                data-testid={`admin-tab-${tb.id}`}
                onClick={() => setTab(tb.id)}
                className={`min-h-[36px] px-2.5 rounded-lg border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                  active
                    ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                    : 'border-slate-800 bg-slate-900/80 text-slate-400 hover:text-slate-100'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{tb.label}</span>
              </button>
            );
          })}
        </div>

        {/* Feedback Toast Bar */}
        {feedback && (
          <div className="px-4 py-2 border-b border-emerald-500/30 bg-emerald-950/30 text-xs text-emerald-200 flex items-center justify-between gap-2 shrink-0">
            <span className="inline-flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>{feedback}</span>
            </span>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Tab Body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 pb-safe">
          {/* 1. PILOT & GEAR TAB */}
          {tab === 'pilot' && (
            <div className="space-y-4">
              {/* Target Gear Selector */}
              <div className="p-3 rounded-lg border border-slate-800 bg-[#0D1422] space-y-2">
                <div className="text-xs font-semibold text-slate-300">
                  {t('admin.targetGear')}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {MECH_CLASS_LIST.map((cls) => {
                    const g = pilot.gears[cls.id];
                    const selected = targetGearId === cls.id;
                    return (
                      <button
                        key={cls.id}
                        type="button"
                        onClick={() => {
                          setTargetGearId(cls.id);
                          setLevelInput(String(g.level));
                        }}
                        className={`min-h-[38px] px-3 rounded-lg border text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
                          selected
                            ? 'border-amber-400 bg-amber-500/15 text-amber-200'
                            : 'border-slate-700 bg-slate-900 text-slate-300'
                        }`}
                      >
                        <ClassIcon classId={cls.id} className="w-3.5 h-3.5" />
                        <span>
                          {getClassName(lang, cls.id)} Lv.{g.level}
                          {!g.owned ? ' (Locked)' : ''}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Level & EXP */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg border border-slate-800 bg-[#0D1422] space-y-2">
                  <div className="text-xs font-semibold text-slate-300">
                    {t('admin.setLevel')} (1–{BALANCE_CONFIG.maxLevel})
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={1}
                      max={BALANCE_CONFIG.maxLevel}
                      value={levelInput}
                      onChange={(e) => setLevelInput(e.target.value)}
                      className="flex-1 h-9 px-2.5 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        adminSetGearLevel(Number(levelInput) || 1, targetGearId);
                        flash(
                          `${getClassName(lang, targetGearId)} → Lv.${levelInput}`
                        );
                      }}
                      className="h-9 px-3 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer"
                    >
                      {t('admin.apply')}
                    </button>
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-slate-800 bg-[#0D1422] space-y-2">
                  <div className="text-xs font-semibold text-slate-300">
                    {t('admin.addExp')}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={1}
                      value={expInput}
                      onChange={(e) => setExpInput(e.target.value)}
                      className="flex-1 h-9 px-2.5 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        adminAddGearExp(Number(expInput) || 0, targetGearId);
                        flash(`+${expInput} EXP`);
                      }}
                      className="h-9 px-3 rounded bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs cursor-pointer"
                    >
                      +{expInput}
                    </button>
                  </div>
                </div>

                {/* Stat Points */}
                <div className="p-3 rounded-lg border border-slate-800 bg-[#0D1422] space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-300">
                      {t('admin.statPoints')}
                    </span>
                    <span className="font-mono-nums text-amber-300">
                      {targetGear.unspentPoints} pts
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <input
                      type="number"
                      min={0}
                      value={pointsInput}
                      onChange={(e) => setPointsInput(e.target.value)}
                      className="w-20 h-9 px-2.5 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        adminSetGearUnspentPoints(
                          Number(pointsInput) || 0,
                          targetGearId
                        );
                        flash(`Points = ${pointsInput}`);
                      }}
                      className="h-9 px-3 rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-semibold cursor-pointer"
                    >
                      Set
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        adminAddGearUnspentPoints(
                          Number(pointsInput) || 0,
                          targetGearId
                        );
                        flash(`+${pointsInput} pts`);
                      }}
                      className="h-9 px-3 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs cursor-pointer"
                    >
                      +{pointsInput}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        adminResetGearAllocation(targetGearId);
                        flash(t('admin.resetAllocation'));
                      }}
                      className="h-9 px-2.5 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs text-slate-300 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Unlock all Gears */}
                <div className="p-3 rounded-lg border border-slate-800 bg-[#0D1422] flex flex-col justify-between gap-2">
                  <div className="text-xs font-semibold text-slate-300">
                    {t('admin.unlockAllGears')}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      adminUnlockAllGears();
                      flash(t('admin.unlockAllGears'));
                    }}
                    className="h-9 px-3 rounded bg-amber-500/20 border border-amber-500/60 hover:bg-amber-500/30 text-amber-200 font-semibold text-xs cursor-pointer"
                  >
                    {t('admin.unlockAllGears')} (4/4)
                  </button>
                </div>

                {/* Credits */}
                <div className="p-3 rounded-lg border border-slate-800 bg-[#0D1422] space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-300">
                      {t('common.credits')}
                    </span>
                    <span className="font-mono-nums text-amber-300">
                      {pilot.credits.toLocaleString()} CR
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={0}
                      value={creditsInput}
                      onChange={(e) => setCreditsInput(e.target.value)}
                      className="flex-1 h-9 px-2.5 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        adminSetCredits(Number(creditsInput) || 0);
                        flash(`Credits = ${creditsInput}`);
                      }}
                      className="h-9 px-3 rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-semibold cursor-pointer"
                    >
                      Set
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        adminAddCredits(Number(creditsInput) || 0);
                        flash(`+${creditsInput} CR`);
                      }}
                      className="h-9 px-3 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer"
                    >
                      +CR
                    </button>
                  </div>
                </div>

                {/* War Points */}
                <div className="p-3 rounded-lg border border-slate-800 bg-[#0D1422] space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-300">
                      {t('common.warPoints')}
                    </span>
                    <span className="font-mono-nums text-purple-300">
                      {pilot.warPoints.toLocaleString()} WP
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min={0}
                      value={wpInput}
                      onChange={(e) => setWpInput(e.target.value)}
                      className="flex-1 h-9 px-2.5 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        adminSetWarPoints(Number(wpInput) || 0);
                        flash(`WP = ${wpInput}`);
                      }}
                      className="h-9 px-3 rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-semibold cursor-pointer"
                    >
                      Set
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        adminAddWarPoints(Number(wpInput) || 0);
                        flash(`+${wpInput} WP`);
                      }}
                      className="h-9 px-3 rounded bg-purple-500 hover:bg-purple-400 text-white font-bold text-xs cursor-pointer"
                    >
                      +WP
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. ITEMS TAB */}
          {tab === 'items' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-lg border border-slate-800 bg-[#0D1422] space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  {t('admin.itemGenerator')}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <label className="space-y-1 block">
                    <span className="text-[11px] text-slate-400 block">Slot</span>
                    <select
                      value={genSlot}
                      onChange={(e) => setGenSlot(e.target.value as EquipmentSlot)}
                      className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs"
                    >
                      {EQUIPMENT_SLOTS.map((s) => (
                        <option key={s} value={s}>
                          {getSlotLabel(lang, s)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1 block">
                    <span className="text-[11px] text-slate-400 block">Tier</span>
                    <select
                      value={genTier}
                      onChange={(e) => setGenTier(Number(e.target.value))}
                      className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs"
                    >
                      {[1, 2, 3, 4].map((ti) => (
                        <option key={ti} value={ti}>
                          T{ti}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1 block">
                    <span className="text-[11px] text-slate-400 block">
                      {t('inv.filterRarity')}
                    </span>
                    <select
                      value={genRarity}
                      onChange={(e) => setGenRarity(e.target.value as ItemRarity)}
                      className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs"
                    >
                      {RARITY_LIST.map((r) => (
                        <option key={r} value={r}>
                          {getRarityLabel(lang, r)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1 block">
                    <span className="text-[11px] text-slate-400 block">
                      {t('admin.itemsReqLevel')}
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      placeholder="Auto"
                      value={genReqLevel}
                      onChange={(e) => setGenReqLevel(e.target.value)}
                      className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
                    />
                  </label>

                  <label className="space-y-1 block">
                    <span className="text-[11px] text-slate-400 block">
                      {t('admin.itemsRollQuality')}
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      placeholder="Random"
                      value={genQuality}
                      onChange={(e) => setGenQuality(e.target.value)}
                      className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
                    />
                  </label>

                  <label className="space-y-1 block">
                    <span className="text-[11px] text-slate-400 block">Qty</span>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={genQty}
                      onChange={(e) =>
                        setGenQty(Math.max(1, Math.min(100, Number(e.target.value) || 1)))
                      }
                      className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
                    />
                  </label>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      const added = adminGenerateItems(
                        genSlot,
                        genTier,
                        genRarity,
                        genQty,
                        {
                          requiredLevel:
                            genReqLevel !== ''
                              ? Math.max(1, Number(genReqLevel) || 1)
                              : undefined,
                          rollQuality:
                            genQuality !== ''
                              ? Math.max(1, Math.min(100, Number(genQuality) || 50))
                              : undefined,
                        }
                      );
                      flash(`+${added} items (${getSlotLabel(lang, genSlot)})`);
                    }}
                    className="min-h-[40px] px-4 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <SlotIcon slot={genSlot} className="w-3.5 h-3.5" />
                    <span>{t('admin.generateItems')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const added = adminFillInventory(50);
                      flash(t('admin.itemsFilledFeedback', { count: added }));
                    }}
                    className="min-h-[40px] px-3 rounded-lg border border-sky-500/60 bg-sky-500/15 hover:bg-sky-500/25 text-sky-200 font-semibold text-xs cursor-pointer"
                  >
                    {t('admin.itemsFill50')}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const added = adminFillInventory(100);
                      flash(t('admin.itemsFilledFeedback', { count: added }));
                    }}
                    className="min-h-[40px] px-3 rounded-lg border border-sky-500/60 bg-sky-500/15 hover:bg-sky-500/25 text-sky-200 font-semibold text-xs cursor-pointer"
                  >
                    {t('admin.itemsFill100')}
                  </button>
                </div>
              </div>

              {/* Bulk Delete Tools */}
              <div className="p-3.5 rounded-lg border border-rose-500/30 bg-[#0D1422] space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-rose-300">
                    Inventory Cleanup ({pilot.inventory.length} items)
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={delMaxRarity}
                    onChange={(e) =>
                      setDelMaxRarity(e.target.value as ItemRarity)
                    }
                    className="h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs"
                  >
                    {RARITY_LIST.map((r) => (
                      <option key={r} value={r}>
                        &lt;= {getRarityLabel(lang, r)}
                      </option>
                    ))}
                  </select>
                  <select
                    value={delMaxTier}
                    onChange={(e) => setDelMaxTier(Number(e.target.value))}
                    className="h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs"
                  >
                    {[1, 2, 3, 4].map((ti) => (
                      <option key={ti} value={ti}>
                        &lt;= T{ti}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      const n = adminDeleteItems('by_filter', {
                        maxRarity: delMaxRarity,
                        maxTier: delMaxTier,
                      });
                      flash(t('admin.itemsDeletedFeedback', { count: n }));
                    }}
                    className="min-h-[36px] px-3 rounded border border-rose-500/50 bg-rose-500/15 hover:bg-rose-500/25 text-rose-200 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{t('admin.itemsDeleteFiltered')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const n = adminDeleteItems('all_unequipped');
                      flash(t('admin.itemsDeletedFeedback', { count: n }));
                    }}
                    className="min-h-[36px] px-3 rounded bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{t('admin.itemsDeleteAll')}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 2B. STARTER SET TAB */}
          {tab === 'starter' && (
            <div className="space-y-4" data-testid="admin-starter-panel">
              {/* Header + Global Enable + Reset */}
              <div className="p-3.5 rounded-lg border border-slate-800 bg-[#0D1422] space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-bold uppercase tracking-wider text-amber-300">
                      {t('admin.starter.title')}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                      {t('admin.starter.subtitle')}
                    </p>
                  </div>
                  <button
                    type="button"
                    data-testid="admin-starter-reset"
                    onClick={() => {
                      adminUpdateConfig({
                        starterSet: cloneStarterSetConfig(
                          DEFAULT_STARTER_SET_CONFIG
                        ),
                      });
                      flash(t('admin.starter.resetBtn'));
                    }}
                    className="h-8 px-2.5 inline-flex items-center gap-1.5 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold cursor-pointer shrink-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{t('admin.starter.resetBtn')}</span>
                  </button>
                </div>

                <label className="p-2.5 rounded border border-slate-800/90 bg-[#080C14] flex items-center justify-between gap-2 cursor-pointer">
                  <span className="text-xs font-semibold text-slate-200">
                    {t('admin.starter.enabledLabel')}
                  </span>
                  <input
                    type="checkbox"
                    data-testid="admin-starter-enabled"
                    checked={starterCfg.enabled}
                    onChange={(e) => {
                      const next = cloneStarterSetConfig(starterCfg);
                      next.enabled = e.target.checked;
                      adminUpdateConfig({ starterSet: next });
                    }}
                    className="w-4 h-4 accent-amber-400"
                  />
                </label>
              </div>

              {/* Rookie Boost ("Hỗ trợ tân thủ") + Scope */}
              <div className="p-3.5 rounded-lg border border-slate-800 bg-[#0D1422] space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="space-y-1 block">
                    <span className="text-xs font-semibold text-slate-200 block">
                      {t('admin.starter.rookieBoostLabel')} (+
                      {starterCfg.rookieBoostPct}%)
                    </span>
                    <input
                      type="number"
                      data-testid="admin-starter-boost-input"
                      min={0}
                      max={300}
                      step={5}
                      value={starterCfg.rookieBoostPct}
                      onChange={(e) => {
                        const val = Math.max(
                          0,
                          Math.min(300, Math.round(Number(e.target.value) || 0))
                        );
                        const next = cloneStarterSetConfig(starterCfg);
                        next.rookieBoostPct = val;
                        adminUpdateConfig({ starterSet: next });
                      }}
                      className="w-full h-9 px-2.5 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
                    />
                    <span className="text-[11px] text-slate-400 block leading-snug">
                      {t('admin.starter.rookieBoostHint')}
                    </span>
                  </label>

                  <div className="space-y-1.5">
                    <div className="text-xs font-semibold text-slate-200">
                      {t('admin.starter.boostScopeLabel')}
                    </div>
                    <div className="space-y-1.5">
                      <label className="flex items-center gap-2 p-2 rounded border border-slate-800 bg-[#080C14] text-xs text-slate-200 cursor-pointer">
                        <input
                          type="radio"
                          name="starter-boost-scope"
                          data-testid="admin-starter-scope-new"
                          checked={starterCfg.boostScope === 'new_gears_only'}
                          onChange={() => {
                            const next = cloneStarterSetConfig(starterCfg);
                            next.boostScope = 'new_gears_only';
                            adminUpdateConfig({ starterSet: next });
                          }}
                          className="accent-amber-400"
                        />
                        <span>{t('admin.starter.scopeNewOnly')}</span>
                      </label>
                      <label className="flex items-center gap-2 p-2 rounded border border-slate-800 bg-[#080C14] text-xs text-slate-200 cursor-pointer">
                        <input
                          type="radio"
                          name="starter-boost-scope"
                          data-testid="admin-starter-scope-fill"
                          checked={starterCfg.boostScope === 'fill_empty_slots'}
                          onChange={() => {
                            const next = cloneStarterSetConfig(starterCfg);
                            next.boostScope = 'fill_empty_slots';
                            adminUpdateConfig({ starterSet: next });
                          }}
                          className="accent-amber-400"
                        />
                        <span>{t('admin.starter.scopeFillEmpty')}</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-1.5">
                    {[0, 50, 100].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        data-testid={`admin-starter-boost-preset-${pct}`}
                        onClick={() => {
                          const next = cloneStarterSetConfig(starterCfg);
                          next.rookieBoostPct = pct;
                          adminUpdateConfig({ starterSet: next });
                        }}
                        className={`h-8 px-2.5 rounded border text-xs font-mono-nums font-semibold cursor-pointer ${
                          starterCfg.rookieBoostPct === pct
                            ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                            : 'border-slate-700 bg-slate-900 text-slate-300 hover:text-slate-100'
                        }`}
                      >
                        +{pct}%
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    data-testid="admin-starter-apply-empty"
                    disabled={!starterCfg.enabled}
                    onClick={() => {
                      const count = adminApplyStarterToEmptySlots();
                      flash(
                        count > 0
                          ? t('admin.starter.appliedEmptyFeedback', { count })
                          : t('admin.starter.noneEmptyFeedback')
                      );
                    }}
                    className="h-9 px-3.5 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-slate-950 font-bold text-xs cursor-pointer disabled:cursor-not-allowed"
                  >
                    {t('admin.starter.applyEmptyBtn')}
                  </button>
                </div>
              </div>

              {/* Per-Slot 6 Fixed Slots Configuration */}
              <div className="p-3.5 rounded-lg border border-slate-800 bg-[#0D1422] space-y-2.5">
                <div className="text-xs font-bold text-amber-300">
                  {t('admin.starter.slotsTitle')}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {EQUIPMENT_SLOTS.map((slot) => {
                    const slotCfg = starterCfg.slots[slot];
                    const slotTemplates = ITEM_TEMPLATES.filter(
                      (tpl) => tpl.slot === slot
                    );
                    return (
                      <div
                        key={slot}
                        data-testid={`admin-starter-slot-${slot}`}
                        className="p-2.5 rounded border border-slate-800 bg-[#080C14] space-y-2"
                      >
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
                          <SlotIcon slot={slot} className="w-3.5 h-3.5 text-sky-400" />
                          <span>{getSlotLabel(lang, slot)}</span>
                        </div>
                        {!slotCfg ? (
                          <div className="text-xs text-slate-500 py-2">—</div>
                        ) : (
                          <>
                            <label className="space-y-1 block">
                              <span className="text-[11px] text-slate-400 block">
                                {t('admin.starter.templateLabel')}
                              </span>
                              <select
                                data-testid={`admin-starter-slot-${slot}-template`}
                                value={slotCfg.templateId}
                                onChange={(e) => {
                                  const next = cloneStarterSetConfig(starterCfg);
                                  const baseSlot = next.slots[slot] ?? slotCfg;
                                  next.slots[slot] = {
                                    ...baseSlot,
                                    templateId: e.target.value,
                                  };
                                  adminUpdateConfig({ starterSet: next });
                                }}
                                className="w-full h-8 px-2 rounded border border-slate-700 bg-slate-900 text-xs"
                              >
                                {slotTemplates.map((tpl) => (
                                  <option key={tpl.id} value={tpl.id}>
                                    {lang === 'vi' ? tpl.nameVi : tpl.nameEn} (T
                                    {tpl.tier}
                                    {tpl.classRestriction
                                      ? ` · ${getClassName(lang, tpl.classRestriction)}`
                                      : ''}
                                    )
                                  </option>
                                ))}
                              </select>
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                              <label className="space-y-1 block">
                                <span className="text-[11px] text-slate-400 block">
                                  {t('admin.starter.levelLabel')}
                                </span>
                                <input
                                  type="number"
                                  data-testid={`admin-starter-slot-${slot}-level`}
                                  min={1}
                                  max={BALANCE_CONFIG.maxLevel}
                                  value={slotCfg.level}
                                  onChange={(e) => {
                                    const lv = Math.max(
                                      1,
                                      Math.min(
                                        BALANCE_CONFIG.maxLevel,
                                        Math.floor(Number(e.target.value) || 1)
                                      )
                                    );
                                    const next = cloneStarterSetConfig(starterCfg);
                                    const baseSlot = next.slots[slot] ?? slotCfg;
                                    next.slots[slot] = {
                                      ...baseSlot,
                                      level: lv,
                                    };
                                    adminUpdateConfig({ starterSet: next });
                                  }}
                                  className="w-full h-8 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
                                />
                              </label>
                              <label className="space-y-1 block">
                                <span className="text-[11px] text-slate-400 block">
                                  {t('admin.starter.qualityLabel')}
                                </span>
                                <input
                                  type="number"
                                  data-testid={`admin-starter-slot-${slot}-quality`}
                                  min={1}
                                  max={100}
                                  value={slotCfg.quality}
                                  onChange={(e) => {
                                    const q = Math.max(
                                      1,
                                      Math.min(
                                        100,
                                        Math.round(Number(e.target.value) || 1)
                                      )
                                    );
                                    const next = cloneStarterSetConfig(starterCfg);
                                    const baseSlot = next.slots[slot] ?? slotCfg;
                                    next.slots[slot] = {
                                      ...baseSlot,
                                      quality: q,
                                    };
                                    adminUpdateConfig({ starterSet: next });
                                  }}
                                  className="w-full h-8 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
                                />
                              </label>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* 3. SHOP TAB */}
          {tab === 'shop' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-lg border border-slate-800 bg-[#0D1422] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs text-slate-300 font-mono-nums">
                    Credits Stock: {shopStock.filter((i) => !i.soldOut).length}/
                    {shopStock.length} · WP Offers:{' '}
                    {wpMarketOffers.filter((o) => !o.soldOut).length}/
                    {wpMarketOffers.length}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      adminRestockShopNow();
                      flash(t('admin.shopRestockNow'));
                    }}
                    className="min-h-[38px] px-3.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>{t('admin.shopRestockNow')}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className="space-y-1 block">
                    <span className="text-[11px] text-slate-400 block">
                      {t('admin.shopMinStock')} (1–10)
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={adminConfig.shopMinStock}
                      onChange={(e) => {
                        const val = Math.max(
                          1,
                          Math.min(10, Number(e.target.value) || 1)
                        );
                        adminUpdateConfig({
                          shopMinStock: val,
                          shopMaxStock: Math.max(val, adminConfig.shopMaxStock),
                        });
                      }}
                      className="w-full h-9 px-2.5 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
                    />
                  </label>

                  <label className="space-y-1 block">
                    <span className="text-[11px] text-slate-400 block">
                      {t('admin.shopMaxStock')} (1–10)
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={adminConfig.shopMaxStock}
                      onChange={(e) => {
                        const val = Math.max(
                          adminConfig.shopMinStock,
                          Math.min(10, Number(e.target.value) || 10)
                        );
                        adminUpdateConfig({ shopMaxStock: val });
                      }}
                      className="w-full h-9 px-2.5 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
                    />
                  </label>

                  <label className="space-y-1 block">
                    <span className="text-[11px] text-slate-400 block">
                      {t('admin.shopPriceMult')} ({adminConfig.shopPriceMultiplier}x)
                    </span>
                    <input
                      type="number"
                      step={0.1}
                      min={0.1}
                      max={5}
                      value={adminConfig.shopPriceMultiplier}
                      onChange={(e) =>
                        adminUpdateConfig({
                          shopPriceMultiplier: Math.max(
                            0.1,
                            Math.min(5, Number(e.target.value) || 1)
                          ),
                        })
                      }
                      className="w-full h-9 px-2.5 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
                    />
                  </label>
                </div>

                {/* Rarity Weights */}
                <div className="space-y-1.5">
                  <div className="text-[11px] text-slate-400">
                    {t('admin.shopRarityWeights')}
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {RARITY_LIST.map((r) => (
                      <label key={r} className="space-y-1 block">
                        <span className="text-[10px] uppercase text-slate-400 block">
                          {getRarityLabel(lang, r)}
                        </span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={adminConfig.shopRarityWeights[r]}
                          onChange={(e) =>
                            adminUpdateConfig({
                              shopRarityWeights: {
                                ...adminConfig.shopRarityWeights,
                                [r]: Math.max(0, Number(e.target.value) || 0),
                              },
                            })
                          }
                          className="w-full h-8 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Force-add specific item */}
              <div className="p-3.5 rounded-lg border border-slate-800 bg-[#0D1422] space-y-2.5">
                <div className="text-xs font-bold text-amber-300">
                  {t('admin.shopForceAdd')}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <select
                    value={forceShopSlot}
                    onChange={(e) => {
                      setForceShopSlot(e.target.value as EquipmentSlot);
                      setForceShopTpl('');
                    }}
                    className="h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs"
                  >
                    {EQUIPMENT_SLOTS.map((s) => (
                      <option key={s} value={s}>
                        {getSlotLabel(lang, s)}
                      </option>
                    ))}
                  </select>
                  <select
                    value={forceShopTpl}
                    onChange={(e) => setForceShopTpl(e.target.value)}
                    className="h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs"
                  >
                    <option value="">Any Template</option>
                    {forceSlotTemplates.map((tpl) => (
                      <option key={tpl.id} value={tpl.id}>
                        {lang === 'vi' ? tpl.nameVi : tpl.nameEn}
                      </option>
                    ))}
                  </select>
                  <select
                    value={forceShopTier}
                    onChange={(e) => setForceShopTier(Number(e.target.value))}
                    className="h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs"
                  >
                    {[1, 2, 3, 4].map((ti) => (
                      <option key={ti} value={ti}>
                        T{ti}
                      </option>
                    ))}
                  </select>
                  <select
                    value={forceShopRarity}
                    onChange={(e) =>
                      setForceShopRarity(e.target.value as ItemRarity)
                    }
                    className="h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs"
                  >
                    {RARITY_LIST.map((r) => (
                      <option key={r} value={r}>
                        {getRarityLabel(lang, r)}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    adminForceAddShopItem({
                      templateId: forceShopTpl || undefined,
                      slot: forceShopSlot,
                      tier: forceShopTier,
                      rarity: forceShopRarity,
                    });
                    flash(t('admin.shopForceAddBtn'));
                  }}
                  className="min-h-[38px] px-4 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer"
                >
                  {t('admin.shopForceAddBtn')}
                </button>
              </div>
            </div>
          )}

          {/* 4. SKILLS TAB */}
          {tab === 'skills' && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-lg border border-slate-800 bg-[#0D1422] space-y-3">
                <div className="text-xs font-semibold text-slate-300">
                  {t('admin.targetGear')}: {getClassName(lang, targetGearId)}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {MECH_CLASS_LIST.map((cls) => (
                    <button
                      key={cls.id}
                      type="button"
                      onClick={() => setTargetGearId(cls.id)}
                      className={`h-9 px-3 rounded border text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
                        targetGearId === cls.id
                          ? 'border-amber-400 bg-amber-500/15 text-amber-200'
                          : 'border-slate-700 bg-slate-900 text-slate-300'
                      }`}
                    >
                      <ClassIcon classId={cls.id} className="w-3.5 h-3.5" />
                      <span>{getClassName(lang, cls.id)}</span>
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      adminUnlockAllSkillsForGear(targetGearId, true);
                      flash(t('admin.skillsUnlockAllMax'));
                    }}
                    className="min-h-[40px] px-4 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer"
                  >
                    {t('admin.skillsUnlockAllMax')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      adminUnlockAllSkillsForGear(targetGearId, false);
                      flash(t('admin.skillsUnlockAllLv1'));
                    }}
                    className="min-h-[40px] px-4 rounded-lg border border-sky-500/50 bg-sky-500/15 hover:bg-sky-500/25 text-sky-200 font-semibold text-xs cursor-pointer"
                  >
                    {t('admin.skillsUnlockAllLv1')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      adminGrantAllOpeningCards();
                      flash(t('admin.skillsGrantCards'));
                    }}
                    className="min-h-[40px] px-4 rounded-lg border border-purple-500/50 bg-purple-500/15 hover:bg-purple-500/25 text-purple-200 font-semibold text-xs cursor-pointer"
                  >
                    {t('admin.skillsGrantCards')}
                  </button>
                  <button
                    type="button"
                    disabled={!battle || Boolean(battle.summary)}
                    onClick={() => {
                      adminResetBattleCooldowns();
                      flash(t('admin.skillsResetCd'));
                    }}
                    className="min-h-[40px] px-4 rounded-lg border border-emerald-500/50 bg-emerald-500/15 hover:bg-emerald-500/25 disabled:opacity-40 text-emerald-200 font-semibold text-xs cursor-pointer disabled:cursor-not-allowed"
                  >
                    {t('admin.skillsResetCd')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 5. BATTLE TAB */}
          {tab === 'battle' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {(
                  [
                    ['godMode', t('admin.godMode')],
                    ['oneHitKills', t('admin.oneHit')],
                    ['alwaysWin', t('admin.alwaysWin')],
                    ['softEnrageEnabled', t('admin.softEnrage')],
                    ['forceBoss', t('admin.battleForceBoss')],
                  ] as const
                ).map(([key, label]) => (
                  <label
                    key={key}
                    className="p-3 rounded-lg border border-slate-800 bg-[#0D1422] flex items-center justify-between gap-2 cursor-pointer"
                  >
                    <span className="text-xs font-semibold text-slate-200">
                      {label}
                    </span>
                    <input
                      type="checkbox"
                      checked={Boolean(adminConfig[key])}
                      onChange={(e) =>
                        adminUpdateConfig({ [key]: e.target.checked })
                      }
                      className="w-4 h-4 accent-amber-400"
                    />
                  </label>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-3.5 rounded-lg border border-slate-800 bg-[#0D1422]">
                {/* Battle Size */}
                <label className="space-y-1 block">
                  <span className="text-[11px] text-slate-400 block">
                    {t('admin.battleSizeOverride')}
                  </span>
                  <select
                    value={adminConfig.battleSizeOverride ?? ''}
                    onChange={(e) =>
                      adminUpdateConfig({
                        battleSizeOverride: e.target.value
                          ? (Number(e.target.value) as BattleSize)
                          : null,
                      })
                    }
                    className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs"
                  >
                    <option value="">Default</option>
                    <option value="4">4v4</option>
                    <option value="6">6v6</option>
                    <option value="8">8v8</option>
                  </select>
                </label>

                {/* Enemy Level Offset */}
                <label className="space-y-1 block">
                  <span className="text-[11px] text-slate-400 block">
                    {t('admin.battleLevelOffset')}
                  </span>
                  <input
                    type="number"
                    min={-10}
                    max={30}
                    placeholder={t('admin.battleLevelOffsetDefault')}
                    value={adminConfig.battleLevelOffsetOverride ?? ''}
                    onChange={(e) =>
                      adminUpdateConfig({
                        battleLevelOffsetOverride:
                          e.target.value === ''
                            ? null
                            : Math.floor(Number(e.target.value) || 0),
                      })
                    }
                    className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
                  />
                </label>

                {/* Enrage Start Round */}
                <label className="space-y-1 block">
                  <span className="text-[11px] text-slate-400 block">
                    {t('admin.battleEnrageStart')}
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={adminConfig.enrageStartRound}
                    onChange={(e) =>
                      adminUpdateConfig({
                        enrageStartRound: Math.max(
                          1,
                          Number(e.target.value) || 20
                        ),
                      })
                    }
                    className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
                  />
                </label>

                {/* Enrage Step % */}
                <label className="space-y-1 block">
                  <span className="text-[11px] text-slate-400 block">
                    {t('admin.battleEnrageStep')}
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={Math.round(adminConfig.enrageStepPct * 100)}
                    onChange={(e) =>
                      adminUpdateConfig({
                        enrageStepPct:
                          Math.max(0, Number(e.target.value) || 0) / 100,
                      })
                    }
                    className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
                  />
                </label>

                {/* Notice Banner Auto-Close Duration */}
                <label className="space-y-1 block sm:col-span-2 lg:col-span-1">
                  <span className="text-[11px] text-slate-400 block">
                    {t('admin.noticeDurationSec')}
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={120}
                    data-testid="admin-notice-duration-input"
                    value={sanitizeNoticeDurationSec(adminConfig.noticeDurationSec)}
                    onChange={(e) => {
                      const raw =
                        e.target.value === '' ? 0 : Number(e.target.value);
                      adminUpdateConfig({
                        noticeDurationSec: sanitizeNoticeDurationSec(raw),
                      });
                    }}
                    className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
                  />
                </label>

                {/* Box Capacity ("Sức chứa Hòm đồ") */}
                <label className="space-y-1 block">
                  <span className="text-[11px] text-slate-400 block">
                    {t('admin.boxCapacity')}
                  </span>
                  <input
                    type="number"
                    min={MIN_BOX_CAPACITY}
                    max={MAX_BOX_CAPACITY}
                    data-testid="admin-box-capacity-input"
                    value={getBoxCapacity(adminConfig)}
                    onChange={(e) => {
                      const raw =
                        e.target.value === ''
                          ? DEFAULT_BOX_CAPACITY
                          : Number(e.target.value);
                      adminUpdateConfig({
                        boxCapacity: sanitizeBoxCapacity(raw),
                      });
                    }}
                    className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
                  />
                  <span className="text-[10px] text-slate-500 block">
                    {t('admin.boxCapacityHint')}
                  </span>
                </label>

                {/* Warehouse Capacity ("Sức chứa Kho đồ") */}
                <label className="space-y-1 block">
                  <span className="text-[11px] text-slate-400 block">
                    {t('admin.warehouseCapacity')}
                  </span>
                  <input
                    type="number"
                    min={MIN_WAREHOUSE_CAPACITY}
                    max={MAX_WAREHOUSE_CAPACITY}
                    data-testid="admin-warehouse-capacity-input"
                    value={sanitizeWarehouseCapacity(
                      adminConfig.warehouseCapacity
                    )}
                    onChange={(e) => {
                      const raw =
                        e.target.value === ''
                          ? DEFAULT_WAREHOUSE_CAPACITY
                          : Number(e.target.value);
                      adminUpdateConfig({
                        warehouseCapacity: sanitizeWarehouseCapacity(raw),
                      });
                    }}
                    className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
                  />
                  <span className="text-[10px] text-slate-500 block">
                    {t('admin.warehouseCapacityHint')}
                  </span>
                </label>
              </div>

              {/* Shield Regen ("Hồi khiên") */}
              {(() => {
                const srCfg = sanitizeShieldRegenConfig(adminConfig.shieldRegen);
                const examplePct = Number(
                  computeShieldRegenPct(25, srCfg).toFixed(2)
                );
                const hit2Mult = Math.max(
                  srCfg.minHitMultPct,
                  srCfg.notHitMult - srCfg.hitPenaltyPct * 2
                );
                const hit2Pct = Number(((examplePct * hit2Mult) / 100).toFixed(2));
                const updateSr = (patch: Partial<typeof srCfg>) => {
                  adminUpdateConfig({
                    shieldRegen: sanitizeShieldRegenConfig({
                      ...srCfg,
                      ...patch,
                    }),
                  });
                };
                return (
                  <div
                    data-testid="admin-shield-regen-section"
                    className="p-3.5 rounded-lg border border-slate-800 bg-[#0D1422] space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-sky-300">
                        {t('admin.shieldRegenTitle')}
                      </span>
                      <span
                        data-testid="admin-shield-regen-example"
                        className="text-[11px] font-mono-nums text-sky-200/90"
                      >
                        {t('admin.shieldRegenExample', { pct: examplePct, hit2Pct })}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <label className="flex items-center gap-2 h-9 px-2.5 rounded border border-slate-700 bg-slate-900 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={srCfg.enabled}
                          onChange={(e) =>
                            updateSr({ enabled: e.target.checked })
                          }
                          className="accent-sky-400"
                        />
                        <span className="text-slate-200">
                          {t('admin.shieldRegenEnabled')}
                        </span>
                      </label>

                      <label className="space-y-1 block">
                        <span className="text-[11px] text-slate-400 block">
                          {t('admin.shieldRegenBasePct')}
                        </span>
                        <input
                          type="number"
                          min={0}
                          max={50}
                          step={0.5}
                          value={srCfg.basePct}
                          onChange={(e) =>
                            updateSr({ basePct: Number(e.target.value) })
                          }
                          className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
                        />
                      </label>

                      <label className="space-y-1 block">
                        <span className="text-[11px] text-slate-400 block">
                          {t('admin.shieldRegenPerPointPct')}
                        </span>
                        <input
                          type="number"
                          min={0}
                          max={50}
                          step={0.01}
                          value={srCfg.perPointPct}
                          onChange={(e) =>
                            updateSr({ perPointPct: Number(e.target.value) })
                          }
                          className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
                        />
                      </label>

                      <label className="space-y-1 block">
                        <span className="text-[11px] text-slate-400 block">
                          {t('admin.shieldRegenCapPct')}
                        </span>
                        <input
                          type="number"
                          min={0}
                          max={50}
                          step={0.5}
                          value={srCfg.capPct}
                          onChange={(e) =>
                            updateSr({ capPct: Number(e.target.value) })
                          }
                          className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
                        />
                      </label>

                      <label className="space-y-1 block">
                        <span className="text-[11px] text-slate-400 block">
                          {t('admin.shieldRegenNotHitMult')}
                        </span>
                        <input
                          type="number"
                          min={0}
                          max={200}
                          step={5}
                          value={srCfg.notHitMult}
                          onChange={(e) =>
                            updateSr({ notHitMult: Number(e.target.value) })
                          }
                          className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
                        />
                      </label>

                      <label className="space-y-1 block">
                        <span className="text-[11px] text-slate-400 block">
                          {t('admin.shieldRegenHitPenaltyPct')}
                        </span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={5}
                          value={srCfg.hitPenaltyPct}
                          onChange={(e) =>
                            updateSr({ hitPenaltyPct: Number(e.target.value) })
                          }
                          className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
                        />
                      </label>

                      <label className="space-y-1 block">
                        <span className="text-[11px] text-slate-400 block">
                          {t('admin.shieldRegenMinHitMultPct')}
                        </span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={5}
                          value={srCfg.minHitMultPct}
                          onChange={(e) =>
                            updateSr({ minHitMultPct: Number(e.target.value) })
                          }
                          className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
                        />
                      </label>

                      <label className="space-y-1 block">
                        <span className="text-[11px] text-slate-400 block">
                          {t('admin.shieldRegenRestartTurns')}
                        </span>
                        <input
                          type="number"
                          min={1}
                          max={3}
                          step={1}
                          value={srCfg.restartTurns}
                          onChange={(e) =>
                            updateSr({ restartTurns: Number(e.target.value) })
                          }
                          className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
                        />
                      </label>

                      <label className="space-y-1 block">
                        <span className="text-[11px] text-slate-400 block">
                          {t('admin.aegisSunderShieldMult')}
                        </span>
                        <input
                          type="number"
                          data-testid="admin-aegis-sunder-shield-mult"
                          min={1}
                          max={4}
                          step={0.1}
                          value={
                            adminConfig.shieldDamageOverrides?.sge_aegis_sunder ??
                            1.5
                          }
                          onChange={(e) =>
                            adminUpdateConfig({
                              shieldDamageOverrides:
                                sanitizeShieldDamageOverrides({
                                  ...(adminConfig.shieldDamageOverrides ?? {}),
                                  sge_aegis_sunder: Number(e.target.value),
                                }),
                            })
                          }
                          className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
                        />
                      </label>

                      <label className="space-y-1 block">
                        <span className="text-[11px] text-slate-400 block">
                          {t('admin.shieldCrackedMult')}
                        </span>
                        <input
                          type="number"
                          data-testid="admin-shield-cracked-mult"
                          min={1}
                          max={2}
                          step={0.1}
                          value={sanitizeShieldCrackedMult(
                            adminConfig.shieldCrackedMult
                          )}
                          onChange={(e) =>
                            adminUpdateConfig({
                              shieldCrackedMult: sanitizeShieldCrackedMult(
                                Number(e.target.value)
                              ),
                            })
                          }
                          className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
                        />
                      </label>

                      <label className="space-y-1 block">
                        <span className="text-[11px] text-slate-400 block">
                          {t('admin.shieldCrackedTurns')}
                        </span>
                        <input
                          type="number"
                          data-testid="admin-shield-cracked-turns"
                          min={1}
                          max={5}
                          step={1}
                          value={sanitizeShieldCrackedTurns(
                            adminConfig.shieldCrackedTurns
                          )}
                          onChange={(e) =>
                            adminUpdateConfig({
                              shieldCrackedTurns: sanitizeShieldCrackedTurns(
                                Number(e.target.value)
                              ),
                            })
                          }
                          className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
                        />
                      </label>
                    </div>
                  </div>
                );
              })()}

              {/* Supply Shop ("Cửa hàng vật tư") */}
              {(() => {
                const supCfg = sanitizeSupplyShopConfig(adminConfig);
                const updateSup = (patch: Partial<typeof supCfg>) =>
                  adminUpdateConfig(sanitizeSupplyShopConfig({ ...supCfg, ...patch }));
                const fields: Array<[keyof typeof supCfg, string, number, number, string]> = [
                  ['supplyShopMinTypes', t('admin.supplyShopMinTypes'), MIN_SUPPLY_SHOP_TYPES, MAX_SUPPLY_SHOP_TYPES, 'admin-supply-shop-min-types'],
                  ['supplyShopMaxTypes', t('admin.supplyShopMaxTypes'), MIN_SUPPLY_SHOP_TYPES, MAX_SUPPLY_SHOP_TYPES, 'admin-supply-shop-max-types'],
                  ['supplyShopMinQty', t('admin.supplyShopMinQty'), MIN_SUPPLY_SHOP_QTY, MAX_SUPPLY_SHOP_QTY, 'admin-supply-shop-min-qty'],
                  ['supplyShopMaxQty', t('admin.supplyShopMaxQty'), MIN_SUPPLY_SHOP_QTY, MAX_SUPPLY_SHOP_QTY, 'admin-supply-shop-max-qty'],
                ];
                return (
                  <div data-testid="admin-supply-shop-section" className="p-3.5 rounded-lg border border-slate-800 bg-[#0D1422] space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-semibold text-emerald-300">{t('admin.supplyShopTitle')}</div>
                        <p className="text-[11px] text-slate-400">{t('admin.supplyShopHint')}</p>
                      </div>
                      <button
                        type="button"
                        data-testid="admin-supply-shop-restock-btn"
                        onClick={() => { adminRestockShopNow(); flash(t('admin.supplyShopRestockNow')); }}
                        className="min-h-[36px] px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>{t('admin.supplyShopRestockNow')}</span>
                      </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {fields.map(([key, label, min, max, testId]) => (
                        <label key={key} className="space-y-1 block">
                          <span className="text-[11px] text-slate-400 block">{label}</span>
                          <input
                            type="number"
                            data-testid={testId}
                            min={min}
                            max={max}
                            value={supCfg[key]}
                            onChange={(e) => updateSup({ [key]: Number(e.target.value) })}
                            className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Reward Mult */}
              <div className="p-3.5 rounded-lg border border-slate-800 bg-[#0D1422] space-y-2">
                <div className="text-xs font-semibold text-slate-300">
                  {t('admin.rewardMult')}: {adminConfig.rewardMultiplier}x
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[1, 2, 5, 10].map((mult) => (
                    <button
                      key={mult}
                      type="button"
                      onClick={() =>
                        adminUpdateConfig({ rewardMultiplier: mult })
                      }
                      className={`h-8 px-3 rounded border text-xs font-mono-nums font-bold cursor-pointer ${
                        adminConfig.rewardMultiplier === mult
                          ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                          : 'border-slate-700 bg-slate-900 text-slate-300'
                      }`}
                    >
                      {mult}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Status Display Defaults ("Mặc định trạng thái") */}
              {(() => {
                const effDefaults: Required<StatusDisplayDefaults> = {
                  ...BUILTIN_STATUS_DISPLAY_DEFAULTS,
                  ...(adminConfig.statusDisplayDefaults ?? {}),
                };
                const patchStatusDefaults = (
                  patch: Partial<StatusDisplayDefaults>
                ) => {
                  adminUpdateConfig({
                    statusDisplayDefaults: {
                      ...effDefaults,
                      ...patch,
                    },
                  });
                };
                return (
                  <div
                    data-testid="admin-status-defaults-section"
                    className="p-3.5 rounded-lg border border-slate-800 bg-[#0D1422] space-y-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs font-bold uppercase tracking-wider text-amber-300">
                          {t('admin.statusDefaultsTitle')}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                          {t('admin.statusDefaultsSubtitle')}
                        </p>
                      </div>
                      <button
                        type="button"
                        data-testid="admin-status-defaults-reset"
                        onClick={() => {
                          adminUpdateConfig({
                            statusDisplayDefaults: {
                              ...BUILTIN_STATUS_DISPLAY_DEFAULTS,
                            },
                          });
                          flash(t('admin.statusDefaultsReset'));
                        }}
                        className="h-8 px-2.5 inline-flex items-center gap-1.5 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold cursor-pointer shrink-0"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>{t('admin.statusDefaultsReset')}</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                      <label className="space-y-1 block">
                        <span className="text-[11px] text-slate-400 block">
                          {t('admin.statusDefaultsBadgeLayout')}
                        </span>
                        <select
                          data-testid="admin-status-default-layout"
                          value={effDefaults.badgeLayout}
                          onChange={(e) =>
                            patchStatusDefaults({
                              badgeLayout: e.target.value as StatusBadgeLayout,
                            })
                          }
                          className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs"
                        >
                          <option value="B">B (Default)</option>
                          <option value="A">A</option>
                        </select>
                      </label>

                      <label className="space-y-1 block">
                        <span className="text-[11px] text-slate-400 block">
                          {t('admin.statusDefaultsPhoneRows')}
                        </span>
                        <input
                          type="number"
                          data-testid="admin-status-default-phone-rows"
                          min={1}
                          max={5}
                          value={effDefaults.phoneRows}
                          onChange={(e) =>
                            patchStatusDefaults({
                              phoneRows: clampStatusAreaRows(
                                e.target.value,
                                effDefaults.phoneRows
                              ),
                            })
                          }
                          className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
                        />
                      </label>

                      <label className="space-y-1 block">
                        <span className="text-[11px] text-slate-400 block">
                          {t('admin.statusDefaultsDesktopRows')}
                        </span>
                        <input
                          type="number"
                          data-testid="admin-status-default-desktop-rows"
                          min={1}
                          max={5}
                          value={effDefaults.desktopRows}
                          onChange={(e) =>
                            patchStatusDefaults({
                              desktopRows: clampStatusAreaRows(
                                e.target.value,
                                effDefaults.desktopRows
                              ),
                            })
                          }
                          className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
                        />
                      </label>

                      <label className="space-y-1 block">
                        <span className="text-[11px] text-slate-400 block">
                          {t('admin.statusDefaultsPlayerPhoneRows')}
                        </span>
                        <input
                          type="number"
                          data-testid="admin-status-default-player-phone-rows"
                          min={1}
                          max={2}
                          value={effDefaults.playerPhoneRows}
                          onChange={(e) =>
                            patchStatusDefaults({
                              playerPhoneRows: clampPlayerStatusRows(
                                e.target.value,
                                effDefaults.playerPhoneRows
                              ),
                            })
                          }
                          className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
                        />
                      </label>

                      <label className="space-y-1 block">
                        <span className="text-[11px] text-slate-400 block">
                          {t('admin.statusDefaultsPlayerDesktopRows')}
                        </span>
                        <input
                          type="number"
                          data-testid="admin-status-default-player-desktop-rows"
                          min={1}
                          max={2}
                          value={effDefaults.playerDesktopRows}
                          onChange={(e) =>
                            patchStatusDefaults({
                              playerDesktopRows: clampPlayerStatusRows(
                                e.target.value,
                                effDefaults.playerDesktopRows
                              ),
                            })
                          }
                          className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
                        />
                      </label>
                    </div>
                  </div>
                );
              })()}

              {/* Active Battle Live Controls */}
              <div className="p-3.5 rounded-lg border border-amber-500/30 bg-[#0D1422] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-300">
                    {t('admin.battleSkipRound')}
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    value={skipRoundInput}
                    onChange={(e) => setSkipRoundInput(e.target.value)}
                    className="w-20 h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
                  />
                  <button
                    type="button"
                    disabled={!battle || Boolean(battle.summary)}
                    onClick={() => {
                      adminSkipBattleToRound(Number(skipRoundInput) || 1);
                      flash(`Round → ${skipRoundInput}`);
                    }}
                    className="h-9 px-3 rounded bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-slate-950 font-bold text-xs cursor-pointer disabled:cursor-not-allowed"
                  >
                    {t('admin.battleSkipBtn')}
                  </button>
                </div>

                <button
                  type="button"
                  disabled={!battle || Boolean(battle.summary)}
                  onClick={() => {
                    forceWinBattle();
                    setAdminPanelOpen(false);
                  }}
                  className="min-h-[40px] px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-bold text-xs cursor-pointer disabled:cursor-not-allowed"
                >
                  {t('admin.battleInstantWin')}
                </button>
              </div>
            </div>
          )}

          {/* 6. CAMPAIGN TAB */}
          {tab === 'campaign' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-lg border border-slate-800 bg-[#0D1422] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-300">
                    {t('admin.campaignMonth')}
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    value={monthInput}
                    onChange={(e) => setMonthInput(e.target.value)}
                    className="w-20 h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      adminSetCampaignMonth(Number(monthInput) || 1);
                      flash(`Month → ${monthInput}`);
                    }}
                    className="h-9 px-3 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer"
                  >
                    {t('admin.campaignSetMonth')}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    adminUnlockAllSectors();
                    flash(t('admin.unlockAllSectors'));
                  }}
                  className="h-9 px-3.5 rounded border border-sky-500/50 bg-sky-500/15 hover:bg-sky-500/25 text-sky-200 font-semibold text-xs cursor-pointer"
                >
                  {t('admin.unlockAllSectors')}
                </button>
              </div>

              <div className="p-3.5 rounded-lg border border-slate-800 bg-[#0D1422] space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-bold text-amber-300">
                    {t('admin.campaignBasesTitle')}
                  </div>
                  <label className="inline-flex items-center gap-2 text-xs text-slate-200 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      data-testid="admin-ignore-frontline"
                      checked={Boolean(adminConfig.ignoreFrontline)}
                      onChange={(e) => {
                        adminUpdateConfig({ ignoreFrontline: e.target.checked });
                        flash(t('admin.campaignIgnoreFrontline'));
                      }}
                      className="w-4 h-4 accent-amber-400"
                    />
                    <span>{t('admin.campaignIgnoreFrontline')}</span>
                  </label>
                </div>
                <div className="divide-y divide-slate-800/80">
                  {SECTORS_CATALOG.map((sec) => {
                    const bs = pilot.baseStates[sec.id];
                    return (
                      <div
                        key={sec.id}
                        className="py-2 flex flex-wrap items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-100 truncate">
                            {getSectorName(lang, sec.id)}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {bs?.faction ?? 'hostile'} · {bs?.status ?? 'operational'}
                            {bs?.underAttack ? ' · UNDER ATTACK' : ''}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              adminSetBaseFaction(sec.id, 'allied');
                              flash(`${getSectorName(lang, sec.id)} → Allied`);
                            }}
                            className="h-8 px-2.5 rounded border border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200 text-[11px] font-semibold cursor-pointer"
                          >
                            {t('admin.campaignCapture')}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              adminSetBaseFaction(sec.id, 'neutral');
                              flash(`${getSectorName(lang, sec.id)} → Neutral`);
                            }}
                            className="h-8 px-2.5 rounded border border-slate-600 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold cursor-pointer"
                          >
                            {t('admin.campaignNeutral')}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              adminSetBaseFaction(sec.id, 'hostile');
                              flash(`${getSectorName(lang, sec.id)} → Hostile`);
                            }}
                            className="h-8 px-2.5 rounded border border-rose-500/40 bg-rose-500/15 hover:bg-rose-500/25 text-rose-200 text-[11px] font-semibold cursor-pointer"
                          >
                            {t('admin.campaignHostile')}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              adminTriggerEnemyAttack(sec.id);
                              flash(`Raid → ${getSectorName(lang, sec.id)}`);
                            }}
                            className="h-8 px-2.5 rounded border border-amber-500/50 bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 text-[11px] font-semibold cursor-pointer"
                          >
                            {t('admin.campaignTriggerAttack')}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* 7. FORMATION TAB */}
          {tab === 'formation' && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg border border-slate-800 bg-[#0D1422] space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {(
                    [
                      ['front', 'admin.formationFrontCap'],
                      ['middle', 'admin.formationMiddleCap'],
                      ['back', 'admin.formationBackCap'],
                    ] as const
                  ).map(([row, labelKey]) => (
                    <label key={row} className="space-y-1 block">
                      <span className="text-xs text-slate-300 block">
                        {t(labelKey)} (0–8)
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={8}
                        value={adminConfig.formation.rowCapacities[row]}
                        onChange={(e) => {
                          const nextCap = Math.max(
                            0,
                            Math.min(8, Math.floor(Number(e.target.value) || 0))
                          );
                          const next = cloneFormationConfig(
                            adminConfig.formation
                          );
                          next.rowCapacities[row] = nextCap;
                          adminUpdateConfig({ formation: next });
                        }}
                        className="w-full h-9 px-2.5 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
                      />
                    </label>
                  ))}

                  <label className="space-y-1 block">
                    <span className="text-xs text-slate-300 block">
                      {t('admin.formationMaxPerSide')} (1–8)
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={8}
                      value={adminConfig.formation.maxUnitsPerSide}
                      onChange={(e) => {
                        const nextMax = Math.max(
                          1,
                          Math.min(8, Math.floor(Number(e.target.value) || 1))
                        );
                        const next = cloneFormationConfig(adminConfig.formation);
                        next.maxUnitsPerSide = nextMax;
                        adminUpdateConfig({ formation: next });
                      }}
                      className="w-full h-9 px-2.5 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
                    />
                  </label>
                </div>

                {/* Per-Row Stat Modifiers */}
                <div className="pt-3 border-t border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-amber-300">
                      {t('admin.formationModifiersTitle')}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        adminUpdateConfig({
                          formation: cloneFormationConfig(
                            DEFAULT_FORMATION_CONFIG
                          ),
                        })
                      }
                      className="h-8 px-2.5 inline-flex items-center gap-1.5 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{t('admin.formationResetDefaults')}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {FORMATION_ROWS.map((row: CombatRow) => {
                      const mod = adminConfig.formation.rowModifiers[row];
                      const rowLabel =
                        row === 'front'
                          ? t('formation.row.front')
                          : row === 'middle'
                          ? t('formation.row.middle')
                          : t('formation.row.back');

                      const updateMod = (
                        field: 'defensePct' | 'damagePct' | 'rangedDamagePct',
                        rawPct: number
                      ) => {
                        const clamped = Math.max(-80, Math.min(100, rawPct));
                        const next = cloneFormationConfig(adminConfig.formation);
                        next.rowModifiers[row][field] = clamped / 100;
                        adminUpdateConfig({ formation: next });
                      };

                      return (
                        <div
                          key={row}
                          className="p-3 rounded border border-slate-800 bg-[#080C14] space-y-2"
                        >
                          <div className="text-xs font-bold text-slate-200">
                            {rowLabel}
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <label className="space-y-1 block">
                              <span className="text-[11px] text-slate-400 block">
                                {t('admin.formationDefMod')}
                              </span>
                              <input
                                type="number"
                                min={-80}
                                max={100}
                                value={Math.round(mod.defensePct * 100)}
                                onChange={(e) =>
                                  updateMod(
                                    'defensePct',
                                    Number(e.target.value) || 0
                                  )
                                }
                                className="w-full h-8 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
                              />
                            </label>
                            <label className="space-y-1 block">
                              <span className="text-[11px] text-slate-400 block">
                                {t('admin.formationDmgMod')}
                              </span>
                              <input
                                type="number"
                                min={-80}
                                max={100}
                                value={Math.round(mod.damagePct * 100)}
                                onChange={(e) =>
                                  updateMod(
                                    'damagePct',
                                    Number(e.target.value) || 0
                                  )
                                }
                                className="w-full h-8 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
                              />
                            </label>
                            <label className="space-y-1 block">
                              <span className="text-[11px] text-slate-400 block">
                                {t('admin.formationRangedDmgMod')}
                              </span>
                              <input
                                type="number"
                                min={-80}
                                max={100}
                                value={Math.round(mod.rangedDamagePct * 100)}
                                onChange={(e) =>
                                  updateMod(
                                    'rangedDamagePct',
                                    Number(e.target.value) || 0
                                  )
                                }
                                className="w-full h-8 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
                              />
                            </label>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 8. SYSTEM TAB */}
          {tab === 'system' && (
            <div className="space-y-4">
              {/* Debug Toggle: Show Raw i18n Keys */}
              <label className="p-3.5 rounded-lg border border-slate-800 bg-[#0D1422] flex items-center justify-between gap-2 cursor-pointer">
                <span className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-sky-400" />
                  <span>{t('admin.systemRawI18n')}</span>
                </span>
                <input
                  type="checkbox"
                  checked={adminConfig.showRawI18nKeys}
                  onChange={(e) =>
                    adminUpdateConfig({ showRawI18nKeys: e.target.checked })
                  }
                  className="w-4 h-4 accent-amber-400"
                />
              </label>

              {/* Export / Import Save JSON */}
              <div className="p-3.5 rounded-lg border border-slate-800 bg-[#0D1422] space-y-2.5">
                <div className="text-xs font-bold text-amber-300">
                  {t('admin.systemExportTitle')}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleCopyExport}
                    className="h-9 px-3 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5 text-sky-400" />
                    <span>{t('admin.systemExportCopy')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadExport}
                    className="h-9 px-3 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{t('admin.systemExportDownload')}</span>
                  </button>
                </div>

                <textarea
                  rows={3}
                  value={importJson}
                  onChange={(e) => setImportJson(e.target.value)}
                  placeholder={t('admin.systemImportPlaceholder')}
                  className="w-full p-2.5 rounded border border-slate-700 bg-[#070B12] text-xs font-mono text-slate-200"
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    disabled={!importJson.trim()}
                    onClick={handleImportSave}
                    className="h-9 px-4 rounded bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{t('admin.systemImportBtn')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (!confirmReset) {
                        setConfirmReset(true);
                        return;
                      }
                      resetCampaign();
                      setConfirmReset(false);
                      setAdminPanelOpen(false);
                    }}
                    className="h-9 px-4 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>
                      {confirmReset
                        ? t('admin.systemResetConfirm')
                        : t('admin.systemResetSave')}
                    </span>
                  </button>
                </div>
              </div>

              {/* Error Log Viewer */}
              <div className="p-3.5 rounded-lg border border-slate-800 bg-[#0D1422] space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-rose-300">
                    {t('admin.systemErrorLog', { count: errorLogs.length })}
                  </span>
                  {errorLogs.length > 0 && (
                    <button
                      type="button"
                      onClick={() => clearErrorLogs()}
                      className="text-[11px] text-slate-400 hover:text-slate-200 cursor-pointer"
                    >
                      {t('admin.systemClearErrors')}
                    </button>
                  )}
                </div>
                {errorLogs.length === 0 ? (
                  <div className="text-xs text-slate-500">
                    {t('admin.systemNoErrors')}
                  </div>
                ) : (
                  <div className="max-h-40 overflow-y-auto space-y-1.5">
                    {errorLogs.map((entry) => (
                      <div
                        key={entry.id}
                        className="p-2 rounded border border-rose-500/30 bg-[#070B12] text-[11px] font-mono text-rose-200"
                      >
                        <div className="text-[10px] text-slate-400">
                          [{new Date(entry.timestamp).toLocaleTimeString()}]{' '}
                          {entry.source}
                        </div>
                        <div className="break-words">{entry.message}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Live State Inspector */}
              <div className="p-3.5 rounded-lg border border-slate-800 bg-[#0D1422] space-y-2">
                <button
                  type="button"
                  onClick={() => setShowInspector((v) => !v)}
                  className="text-xs font-bold text-sky-300 hover:text-sky-200 cursor-pointer"
                >
                  {t('admin.systemInspector')} {showInspector ? '▾' : '▸'}
                </button>
                {showInspector && (
                  <pre className="max-h-60 overflow-auto rounded border border-slate-800 bg-[#070B12] p-2.5 text-[11px] font-mono text-slate-300">
                    {JSON.stringify(
                      {
                        pilotName: pilot.name,
                        activeGearId: pilot.activeGearId,
                        credits: pilot.credits,
                        warPoints: pilot.warPoints,
                        inventoryCount: pilot.inventory.length,
                        consumablesCount: (pilot.consumables ?? []).length,
                        shopStockTotal: shopStock.length,
                        shopStockAvailable: shopStock.filter((i) => !i.soldOut)
                          .length,
                        wpOffersAvailable: wpMarketOffers.filter(
                          (o) => !o.soldOut
                        ).length,
                        campaignMonth: pilot.campaignMonth,
                        inBattle: Boolean(battle),
                        battleRound: battle?.round ?? null,
                        adminConfig,
                      },
                      null,
                      2
                    )}
                  </pre>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
