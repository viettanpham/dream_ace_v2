import {
  Crosshair,
  HeartHandshake,
  Shield,
  ShieldAlert,
  Skull,
  Sparkles,
  Zap,
} from 'lucide-react';
import { getScaledSkillStats, getSkillById } from '../data/skills';
import { getEffectiveSpCost } from '../engine/skills';
import {
  getEffectiveUnitSpeed,
  getTeamColorRole,
  hasStatus,
} from '../engine/combat';
import {
  formatStatusEffectDetail,
  getArchetypeLabel,
  getClassName,
  getSkillDesc,
  getSkillName,
  getSkillTargetLabel,
  getStatusDesc,
  getTeamTagLabel,
  useI18n,
} from '../i18n';
import type { ActiveStatusEffect, CombatUnit, TeamColorRole } from '../types/game';
import {
  getCatalogRowForStatus,
  getFirstExpiringTurns,
  getStatusVisualKind,
  sortStatusEffects,
} from '../data/statusIconMap';
import { useGameStore } from '../store/useGameStore';
import { SP_COLOR_TOKENS } from '../utils/battleDisplay';
import { useStatusDisplaySettings } from '../utils/statusDisplayPrefs';
import { BottomSheet } from './BottomSheet';
import { CatalogIcon } from './CatalogIcon';
import { FighterSvg } from './FighterSvg';
import { LevelBadge } from './LevelBadge';
import { SkillIcon } from './SkillIcon';
import { StatBar } from './StatBar';

interface UnitDetailSheetProps {
  unit: CombatUnit | null;
  refLevel?: number;
  onClose: () => void;
  isTargeted: boolean;
  canLockEnemy: boolean;
  canLockAlly: boolean;
  frontRowBlocked?: boolean;
  onLockEnemy?: (unitId: string) => void;
  onLockAlly?: (unitId: string) => void;
}

function getTeamColorHex(role: TeamColorRole): string {
  switch (role) {
    case 'me':
      return 'var(--team-me)';
    case 'ally':
      return 'var(--team-ally)';
    case 'boss':
      return 'var(--team-boss)';
    case 'enemy':
    default:
      return 'var(--team-enemy)';
  }
}

function formatStatusDuration(st: ActiveStatusEffect): string {
  if (st.type === 'siege_mode' || st.type === 'siege_defense') return 'ON';
  if (st.type === 'charging') return '⚡';
  if (st.charges && st.charges > 0) return `${st.charges}x`;
  if (st.turnsRemaining >= 50) return '∞';
  return `${st.turnsRemaining}t`;
}

export function UnitDetailSheet({
  unit,
  refLevel,
  onClose,
  isTargeted,
  canLockEnemy,
  canLockAlly,
  frontRowBlocked = false,
  onLockEnemy,
  onLockAlly,
}: UnitDetailSheetProps) {
  const { lang, t } = useI18n();
  const adminStatusDefaults = useGameStore(
    (s) => s.adminConfig.statusDisplayDefaults
  );
  const iconMods = useGameStore((s) => s.adminConfig.iconCatalogMods);
  const spEconomy = useGameStore((s) => s.adminConfig.spEconomy);
  const skillMods = useGameStore((s) => s.adminConfig.skillMods);
  const { settings: statusSettings } =
    useStatusDisplaySettings(adminStatusDefaults);

  if (!unit) return null;

  const isEnemy = unit.side === 'enemy';
  const teamRole = getTeamColorRole(unit);
  const teamColor = getTeamColorHex(teamRole);
  const teamTag = getTeamTagLabel(lang, teamRole);
  const effectiveSpeed = getEffectiveUnitSpeed(unit);
  const shieldBroken = hasStatus(unit, 'shield_break');
  const isStealthed = hasStatus(unit, 'stealth');
  const hpRatio = Math.max(
    0,
    Math.min(1, unit.hp / Math.max(1, unit.derived.maxHp))
  );
  const hpBarColor =
    hpRatio <= 0.25
      ? 'bg-red-500'
      : hpRatio <= 0.55
      ? 'bg-orange-400'
      : 'bg-emerald-500';

  const roleSubtitle = `${
    unit.archetype
      ? getArchetypeLabel(lang, unit.archetype)
      : getClassName(lang, unit.classId)
  } · ${t('common.levelShort')}${unit.level} · ${
    unit.row === 'front'
      ? t('common.frontRow')
      : unit.row === 'middle'
      ? t('common.middleRow')
      : t('common.backRow')
  }`;

  const showEnemyLockBtn =
    unit.alive && isEnemy && !isStealthed && canLockEnemy && Boolean(onLockEnemy);
  const showAllyLockBtn =
    unit.alive && !isEnemy && canLockAlly && Boolean(onLockAlly);

  const footer =
    showEnemyLockBtn || showAllyLockBtn ? (
      <div className="flex items-center gap-2">
        {showEnemyLockBtn && onLockEnemy && (
          <button
            type="button"
            disabled={isTargeted}
            onClick={() => {
              onLockEnemy(unit.id);
              onClose();
            }}
            className={`w-full min-h-[48px] px-4 rounded-lg font-semibold text-sm inline-flex items-center justify-center gap-2 transition-colors ${
              isTargeted
                ? 'border border-red-500/50 bg-red-500/15 text-red-200 cursor-default'
                : 'bg-red-500 hover:bg-red-400 text-slate-950 cursor-pointer'
            }`}
          >
            <Crosshair className="w-4 h-4 shrink-0" />
            <span>
              {isTargeted ? t('battle.targetLockedBtn') : t('battle.lockTargetBtn')}
            </span>
          </button>
        )}

        {showAllyLockBtn && onLockAlly && (
          <button
            type="button"
            disabled={isTargeted}
            onClick={() => {
              onLockAlly(unit.id);
              onClose();
            }}
            className={`w-full min-h-[48px] px-4 rounded-lg font-semibold text-sm inline-flex items-center justify-center gap-2 transition-colors ${
              isTargeted
                ? 'border border-emerald-500/50 bg-emerald-500/15 text-emerald-200 cursor-default'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 cursor-pointer'
            }`}
          >
            <HeartHandshake className="w-4 h-4 shrink-0" />
            <span>
              {isTargeted ? t('battle.targetLockedBtn') : t('battle.lockAllyBtn')}
            </span>
          </button>
        )}
      </div>
    ) : undefined;

  return (
    <BottomSheet
      open={Boolean(unit)}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 min-w-0">
          {unit.isBoss && (
            <Skull
              className="w-4 h-4 shrink-0"
              style={{ color: 'var(--team-boss)' }}
            />
          )}
          <span
            className="text-[10px] font-mono-nums font-bold px-1.5 py-0.5 rounded border shrink-0"
            style={{
              color: teamColor,
              borderColor: teamColor,
            }}
          >
            {teamTag}
          </span>
          {isEnemy && (
            <LevelBadge
              level={unit.level}
              refLevel={refLevel ?? unit.level}
              side={unit.side}
            />
          )}
          <span className="truncate" style={{ color: unit.alive ? teamColor : undefined }}>
            {unit.name}
          </span>
          {unit.isStructure && (
            <span className="text-[10px] font-mono-nums font-bold px-1.5 py-0.5 rounded bg-orange-500/20 border border-orange-400/50 text-orange-300 shrink-0">
              {t('battle.structureTag')}
            </span>
          )}
        </div>
      }
      subtitle={roleSubtitle}
      footer={footer}
    >
      <div className="space-y-4">
        {/* Ship Preview + Vital Bars */}
        <div className="rounded-lg border border-slate-800 bg-[#080D16] p-3 flex items-center gap-3.5">
          <div className="shrink-0">
            <FighterSvg
              classId={unit.classId}
              side={unit.side}
              facing={isEnemy ? 'left' : 'right'}
              size="md"
              destroyed={!unit.alive}
              defending={unit.isDefending || hasStatus(unit, 'invincible')}
            />
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <StatBar
              label="HP"
              value={unit.hp}
              max={unit.derived.maxHp}
              fillClassName={hpBarColor}
              heightClassName="h-2.5"
              showTrail
            />
            <StatBar
              label="SHD"
              labelClassName={
                shieldBroken ? 'text-red-400 line-through' : 'text-sky-400'
              }
              valueClassName={shieldBroken ? 'text-red-300' : 'text-sky-200'}
              value={unit.shield}
              max={Math.max(1, unit.derived.maxShield)}
              valueText={`${unit.shield}/${unit.derived.maxShield}`}
              fillClassName={shieldBroken ? 'bg-red-500/50' : 'bg-sky-400'}
              heightClassName="h-2"
              compactHeader
            />
            <StatBar
              label="SP"
              labelClassName={SP_COLOR_TOKENS.textClass}
              valueClassName={SP_COLOR_TOKENS.textClass}
              value={unit.sp}
              max={Math.max(1, unit.derived.maxSp)}
              valueText={`${unit.sp}/${unit.derived.maxSp}`}
              fillClassName={SP_COLOR_TOKENS.barFillClass}
              heightClassName="h-2"
              compactHeader
            />
          </div>
        </div>

        {/* Front Row Block Notice */}
        {frontRowBlocked && unit.alive && isEnemy && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 flex items-center gap-2 text-xs text-amber-200">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{t('battle.frontRowBlocked')}</span>
          </div>
        )}

        {/* Combat Telemetry Grid */}
        <div className="space-y-1.5">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {t('battle.inspectStats')}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded border border-slate-800 bg-[#080D16] px-2.5 py-2">
              <div className="text-[11px] text-slate-400">ATK</div>
              <div className="font-mono-nums text-sm font-bold text-slate-100">
                {unit.derived.attackPower}
              </div>
            </div>
            <div className="rounded border border-slate-800 bg-[#080D16] px-2.5 py-2">
              <div className="text-[11px] text-slate-400">DEF</div>
              <div className="font-mono-nums text-sm font-bold text-slate-100">
                {unit.derived.defenseRating}
              </div>
            </div>
            <div className="rounded border border-slate-800 bg-[#080D16] px-2.5 py-2">
              <div className="text-[11px] text-slate-400">SPD</div>
              <div className="font-mono-nums text-sm font-bold text-sky-300">
                {effectiveSpeed}
              </div>
            </div>
            <div className="rounded border border-slate-800 bg-[#080D16] px-2.5 py-2">
              <div className="text-[11px] text-slate-400">EVA</div>
              <div className="font-mono-nums text-sm font-bold text-emerald-300">
                {unit.derived.dodgeChance}%
              </div>
            </div>
            <div className="rounded border border-slate-800 bg-[#080D16] px-2.5 py-2">
              <div className="text-[11px] text-slate-400">CRIT</div>
              <div className="font-mono-nums text-sm font-bold text-amber-300">
                {unit.derived.critChance}%
              </div>
            </div>
            <div className="rounded border border-slate-800 bg-[#080D16] px-2.5 py-2">
              <div className="text-[11px] text-slate-400">ROW</div>
              <div className="font-mono-nums text-sm font-bold text-slate-200">
                {unit.row === 'front'
                  ? t('common.frontRow')
                  : unit.row === 'middle'
                  ? t('common.middleRow')
                  : t('common.backRow')}
              </div>
            </div>
          </div>
        </div>

        {/* Active Statuses */}
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-sky-400" />
            <span>{t('battle.inspectStatuses')}</span>
          </div>
          {unit.statuses.length === 0 ? (
            <div className="rounded border border-slate-800/80 bg-[#080D16] px-3 py-2 text-xs text-slate-500">
              {t('battle.inspectNoStatuses')}
            </div>
          ) : (
            <div className="space-y-1.5">
              {sortStatusEffects(unit.statuses, iconMods).map((st) => {
                const detail = formatStatusEffectDetail(lang, st, unit);
                const catalogRow = getCatalogRowForStatus(st.type, iconMods);
                const visualKind = getStatusVisualKind(st, catalogRow);
                const turnsLeft = getFirstExpiringTurns(st, undefined, false);
                return (
                  <div
                    key={st.type}
                    data-testid={`detail-status-${st.type}`}
                    className={`rounded border px-3 py-2 flex items-start justify-between gap-2.5 ${
                      visualKind === 'debuff'
                        ? 'border-red-500/40 bg-red-500/10'
                        : visualKind === 'buff'
                        ? 'border-emerald-500/35 bg-emerald-500/10'
                        : 'border-sky-500/35 bg-sky-500/10'
                    }`}
                  >
                    <div className="pt-0.5 shrink-0">
                      <CatalogIcon
                        row={catalogRow}
                        fallbackStatusType={st.type}
                        kindOverride={visualKind}
                        size="md"
                        badgeLayout={statusSettings.badgeLayout}
                        turnsLeft={turnsLeft}
                        stacks={1}
                        allowStack={false}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div
                        className={`text-xs font-bold font-mono-nums ${
                          visualKind === 'debuff'
                            ? 'text-red-300'
                            : visualKind === 'buff'
                            ? 'text-emerald-200'
                            : 'text-sky-200'
                        }`}
                      >
                        {detail.fullText}
                      </div>
                      <div className="text-xs text-slate-300 mt-0.5 leading-snug">
                        {getStatusDesc(lang, st.type, st.turnsRemaining)}
                      </div>
                    </div>
                    <span className="font-mono-nums text-xs font-bold px-1.5 py-0.5 rounded bg-slate-950/70 text-slate-200 shrink-0">
                      {formatStatusDuration(st)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Known Skills */}
        {unit.equippedSkillIds.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>{t('battle.inspectSkills')}</span>
            </div>
            <div className="space-y-1.5">
              {unit.equippedSkillIds.map((skillId) => {
                const skill = getSkillById(skillId, skillMods);
                if (!skill) return null;
                const lv = unit.skillLevels[skillId] ?? 1;
                const cdRem = unit.skillCooldowns[skillId] ?? 0;
                const effectiveCost = getEffectiveSpCost(skill, unit, {
                  spEconomy,
                });
                return (
                  <div
                    key={skillId}
                    className="rounded border border-slate-800 bg-[#080D16] px-3 py-2 flex items-start gap-2.5"
                  >
                    <span className="w-8 h-8 rounded bg-slate-900 border border-slate-700 flex items-center justify-center shrink-0 text-sky-300">
                      <SkillIcon icon={skill.icon} className="w-4 h-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-100 truncate">
                          {getSkillName(skill, lang)} · Lv.{lv}
                        </span>
                        <span className="text-[11px] font-mono-nums text-amber-300 shrink-0">
                          {effectiveCost} SP
                          {cdRem > 0 ? ` · CD ${cdRem}` : ''}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                        {getSkillDesc(skill, lang)}
                      </div>
                      <div className="text-[10px] font-mono-nums text-sky-400/90 mt-1 flex items-center gap-1.5">
                        <Shield className="w-3 h-3" />
                        <span>{getSkillTargetLabel(lang, skill.targetType)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
