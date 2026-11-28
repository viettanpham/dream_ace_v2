import { useEffect, useState } from 'react';
import { MessageSquare, RotateCcw } from 'lucide-react';
import {
  cloneVoiceConfig,
  sanitizeVoiceConfig,
  VOICE_TRIGGERS,
} from '../../engine/voice';
import { useI18n } from '../../i18n';
import { useGameStore } from '../../store/useGameStore';
import type { VoiceConfig, VoiceTrigger } from '../../types/game';

interface DraftNumberFieldProps {
  testId: string;
  label: string;
  exampleTestId: string;
  renderExample: (val: number) => string;
  value: number;
  min: number;
  max: number;
  onCommit: (nextVal: number) => void;
}

function DraftNumberField({
  testId,
  label,
  exampleTestId,
  renderExample,
  value,
  min,
  max,
  onCommit,
}: DraftNumberFieldProps) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = (rawStr: string) => {
    const trimmed = rawStr.trim();
    const parsed = Number(trimmed);
    if (trimmed === '' || !Number.isFinite(parsed)) {
      setDraft(String(value));
      return;
    }
    const clamped = Math.max(min, Math.min(max, Math.round(parsed)));
    setDraft(String(clamped));
    onCommit(clamped);
  };

  const trimmedDraft = draft.trim();
  const parsedDraft = trimmedDraft === '' ? NaN : Number(trimmedDraft);
  const liveVal = Number.isFinite(parsedDraft)
    ? Math.max(min, Math.min(max, Math.round(parsedDraft)))
    : value;

  return (
    <div className="space-y-1 min-w-0 p-2 rounded border border-slate-800/80 bg-slate-900/40">
      <label className="space-y-1 block min-w-0">
        <span className="text-[11px] text-slate-300 block">{label}</span>
        <input
          type="number"
          data-testid={testId}
          min={min}
          max={max}
          step={1}
          value={draft}
          onChange={(e) => {
            const rawVal = e.target.value;
            setDraft(rawVal);
            const trimmed = rawVal.trim();
            if (trimmed !== '') {
              const parsed = Number(trimmed);
              if (Number.isFinite(parsed) && parsed >= min && parsed <= max) {
                onCommit(Math.round(parsed));
              }
            }
          }}
          onBlur={(e) => commit(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              commit(e.currentTarget.value);
              (e.currentTarget as HTMLInputElement).blur();
            }
          }}
          className="w-full h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums"
        />
      </label>
      <div
        data-testid={exampleTestId}
        className="text-[11px] text-cyan-300/90 leading-snug"
      >
        {renderExample(liveVal)}
      </div>
    </div>
  );
}

const TRIGGER_LABEL_KEYS: Record<
  VoiceTrigger,
  | 'admin.voiceTrigger.startTaunt'
  | 'admin.voiceTrigger.skillAttack'
  | 'admin.voiceTrigger.skillSupport'
  | 'admin.voiceTrigger.supplyUse'
  | 'admin.voiceTrigger.kill'
  | 'admin.voiceTrigger.crit'
  | 'admin.voiceTrigger.evade'
  | 'admin.voiceTrigger.lowHp'
  | 'admin.voiceTrigger.shieldBreak'
  | 'admin.voiceTrigger.allyDown'
  | 'admin.voiceTrigger.win'
  | 'admin.voiceTrigger.lose'
> = {
  startTaunt: 'admin.voiceTrigger.startTaunt',
  skillAttack: 'admin.voiceTrigger.skillAttack',
  skillSupport: 'admin.voiceTrigger.skillSupport',
  supplyUse: 'admin.voiceTrigger.supplyUse',
  kill: 'admin.voiceTrigger.kill',
  crit: 'admin.voiceTrigger.crit',
  evade: 'admin.voiceTrigger.evade',
  lowHp: 'admin.voiceTrigger.lowHp',
  shieldBreak: 'admin.voiceTrigger.shieldBreak',
  allyDown: 'admin.voiceTrigger.allyDown',
  win: 'admin.voiceTrigger.win',
  lose: 'admin.voiceTrigger.lose',
};

const TRIGGER_NOUN_KEYS: Record<
  VoiceTrigger,
  | 'admin.voiceNoun.startTaunt'
  | 'admin.voiceNoun.skillAttack'
  | 'admin.voiceNoun.skillSupport'
  | 'admin.voiceNoun.supplyUse'
  | 'admin.voiceNoun.kill'
  | 'admin.voiceNoun.crit'
  | 'admin.voiceNoun.evade'
  | 'admin.voiceNoun.lowHp'
  | 'admin.voiceNoun.shieldBreak'
  | 'admin.voiceNoun.allyDown'
  | 'admin.voiceNoun.win'
  | 'admin.voiceNoun.lose'
> = {
  startTaunt: 'admin.voiceNoun.startTaunt',
  skillAttack: 'admin.voiceNoun.skillAttack',
  skillSupport: 'admin.voiceNoun.skillSupport',
  supplyUse: 'admin.voiceNoun.supplyUse',
  kill: 'admin.voiceNoun.kill',
  crit: 'admin.voiceNoun.crit',
  evade: 'admin.voiceNoun.evade',
  lowHp: 'admin.voiceNoun.lowHp',
  shieldBreak: 'admin.voiceNoun.shieldBreak',
  allyDown: 'admin.voiceNoun.allyDown',
  win: 'admin.voiceNoun.win',
  lose: 'admin.voiceNoun.lose',
};

function formatPerTen(pct: number): string {
  const val = Math.round((pct / 10) * 10) / 10;
  return Number.isInteger(val) ? String(val) : val.toFixed(1);
}

export function VoiceAdminBlock() {
  const { t } = useI18n();
  const voice = useGameStore((s) => s.adminConfig.voice);
  const adminUpdateConfig = useGameStore((s) => s.adminUpdateConfig);

  const cfg = sanitizeVoiceConfig(voice);

  const updateCfg = (patch: Partial<VoiceConfig>) => {
    adminUpdateConfig({
      voice: sanitizeVoiceConfig({
        ...cfg,
        ...patch,
        chances: {
          ...cfg.chances,
          ...(patch.chances ?? {}),
        },
      }),
    });
  };

  const resetDefaults = () => {
    adminUpdateConfig({
      voice: cloneVoiceConfig(),
    });
  };

  return (
    <div
      data-testid="admin-voice-section"
      className="p-3.5 rounded-lg border border-slate-800 bg-[#0D1422] space-y-3 min-w-0"
    >
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="space-y-0.5 min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-cyan-300">
            <MessageSquare className="w-4 h-4 shrink-0" />
            <span className="truncate">{t('admin.voiceTitle')}</span>
          </div>
          <div className="text-[11px] text-slate-400">
            {t('admin.voiceDesc')}
          </div>
        </div>
        <button
          type="button"
          data-testid="admin-voice-reset"
          onClick={resetDefaults}
          className="px-2.5 py-1.5 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-[11px] font-semibold text-slate-200 inline-flex items-center gap-1 shrink-0 cursor-pointer"
        >
          <RotateCcw className="w-3 h-3" />
          <span>{t('admin.voiceReset')}</span>
        </button>
      </div>

      <label className="flex items-center justify-between gap-2 px-2.5 py-2 rounded border border-slate-800 bg-slate-900/70 cursor-pointer">
        <span className="text-xs text-slate-200">{t('admin.voiceEnabled')}</span>
        <input
          type="checkbox"
          data-testid="admin-voice-enabled"
          checked={cfg.enabled}
          onChange={(e) => updateCfg({ enabled: e.target.checked })}
          className="w-4 h-4 accent-cyan-400 cursor-pointer shrink-0"
        />
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <DraftNumberField
          testId="admin-voice-cooldown"
          exampleTestId="admin-voice-ex-cooldown"
          label={t('admin.voiceCooldown')}
          value={cfg.actionCooldown}
          min={0}
          max={10}
          renderExample={(n) =>
            n === 0
              ? t('admin.voiceExCooldownZero')
              : t('admin.voiceExCooldown', { n })
          }
          onCommit={(v) => updateCfg({ actionCooldown: v })}
        />

        <DraftNumberField
          testId="admin-voice-max-per-round"
          exampleTestId="admin-voice-ex-max-per-round"
          label={t('admin.voiceMaxPerRound')}
          value={cfg.maxPerRound}
          min={0}
          max={6}
          renderExample={(n) => t('admin.voiceExMaxPerRound', { n })}
          onCommit={(v) => updateCfg({ maxPerRound: v })}
        />
      </div>

      <div className="space-y-1.5">
        <div className="text-[11px] font-semibold text-slate-300">
          {t('admin.voiceChancesLabel')}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {VOICE_TRIGGERS.map((trigger) => (
            <DraftNumberField
              key={trigger}
              testId={`admin-voice-chance-${trigger}`}
              exampleTestId={`admin-voice-ex-chance-${trigger}`}
              label={`${t(TRIGGER_LABEL_KEYS[trigger])} (%)`}
              value={cfg.chances[trigger]}
              min={0}
              max={100}
              renderExample={(pct) => {
                const count = formatPerTen(pct);
                if (trigger === 'win' || trigger === 'lose') {
                  return t('admin.voiceExOutcomeChance', {
                    noun: t(TRIGGER_NOUN_KEYS[trigger]),
                    pct,
                  });
                }
                if (trigger === 'lowHp') {
                  return t('admin.voiceExLowHpChance', {
                    noun: t(TRIGGER_NOUN_KEYS[trigger]),
                    count,
                  });
                }
                return t('admin.voiceExTriggerChance', {
                  noun: t(TRIGGER_NOUN_KEYS[trigger]),
                  count,
                });
              }}
              onCommit={(v) =>
                updateCfg({
                  chances: {
                    ...cfg.chances,
                    [trigger]: v,
                  },
                })
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}
