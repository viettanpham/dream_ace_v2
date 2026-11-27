import { getSkillById } from '../data/skills';
import { canUnitUseSkill } from '../engine/skills';
import { getBattleSkillReason, getSkillDesc, getSkillName } from '../i18n';
import type { TranslationKey } from '../i18n/en';
import type { AdminConfig, CombatUnit, Language } from '../types/game';
import { SP_COLOR_TOKENS } from '../utils/battleDisplay';
import { BottomSheet } from './BottomSheet';
import { SkillIcon } from './SkillIcon';

type TranslateFn = (
  key: TranslationKey,
  params?: Record<string, string | number>
) => string;

export interface PhoneSkillsSheetProps {
  open: boolean;
  playerUnit: CombatUnit | null | undefined;
  playerSkillIds: string[];
  canPlayerManualAct: boolean;
  adminConfig?: Pick<AdminConfig, 'spEconomy' | 'fluxTransfer' | 'skillMods'> | null;
  turnLockedSkillIds?: readonly string[];
  lang: Language;
  t: TranslateFn;
  onClose: () => void;
  onUseSkill: (skillId: string) => void;
}

export function PhoneSkillsSheet({
  open,
  playerUnit,
  playerSkillIds,
  canPlayerManualAct,
  adminConfig,
  turnLockedSkillIds,
  lang,
  t,
  onClose,
  onUseSkill,
}: PhoneSkillsSheetProps) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('battle.skillsSheetTitle')}
      subtitle={
        playerUnit
          ? `SP ${playerUnit.sp}/${playerUnit.derived.maxSp}`
          : undefined
      }
    >
      {playerSkillIds.length === 0 ? (
        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-4 text-center text-[13px] text-slate-400">
          {t('battle.noSkillsSlotted')}
        </div>
      ) : (
        <div className="space-y-2">
          {playerSkillIds.slice(0, 6).map((skillId) => {
            const skill = getSkillById(skillId, adminConfig);
            if (!skill || !playerUnit) return null;
            const usability = canUnitUseSkill(
              playerUnit,
              skill.id,
              adminConfig,
              turnLockedSkillIds
            );
            const clickable = canPlayerManualAct && usability.canUse;
            const isToggleOn = Boolean(usability.isToggleActive);
            const isUsedOnce =
              skill.oncePerBattle &&
              playerUnit.usedOnceSkills.includes(skill.id);
            const reasonText = getBattleSkillReason(lang, usability);

            return (
              <button
                key={skill.id}
                type="button"
                disabled={!clickable}
                onClick={() => {
                  if (clickable) {
                    onUseSkill(skill.id);
                    onClose();
                  }
                }}
                className={`w-full min-h-[56px] p-3 rounded-lg border text-left flex items-start justify-between gap-3 transition-colors ${
                  isToggleOn
                    ? 'border-emerald-400 bg-emerald-500/20 text-emerald-100'
                    : !clickable
                    ? 'border-slate-800 bg-slate-900/70 text-slate-500 opacity-65'
                    : skill.category === 'elite'
                    ? 'border-amber-400/80 bg-amber-500/15 text-amber-100 cursor-pointer'
                    : skill.category === 'special'
                    ? 'border-purple-400/80 bg-purple-500/15 text-purple-100 cursor-pointer'
                    : 'border-sky-500/50 bg-sky-500/15 text-sky-100 cursor-pointer'
                }`}
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <span className="w-8 h-8 rounded bg-slate-950/80 border border-slate-700 flex items-center justify-center shrink-0">
                    <SkillIcon icon={skill.icon} className="w-4 h-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="text-[15px] font-bold leading-tight truncate">
                      {getSkillName(skill, lang)}
                    </div>
                    <div className="text-[12px] text-slate-300 mt-0.5 leading-snug">
                      {getSkillDesc(skill, lang)}
                    </div>
                    {!usability.canUse && reasonText && (
                      <div className="text-[12px] text-red-400 font-semibold mt-0.5">
                        {reasonText}
                      </div>
                    )}
                  </div>
                </div>
                <div
                  className={`text-right font-mono-nums text-[12px] font-bold shrink-0 ${
                    usability.cooldownRemaining > 0
                      ? 'text-red-300'
                      : SP_COLOR_TOKENS.textClass
                  }`}
                >
                  {isToggleOn
                    ? t('battle.skillOnTag')
                    : isUsedOnce
                    ? t('battle.skillUsedTag')
                    : usability.cooldownRemaining > 0
                    ? t('battle.skillCdShort', {
                        turns: usability.cooldownRemaining,
                      })
                    : `${usability.spCost} SP`}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </BottomSheet>
  );
}
