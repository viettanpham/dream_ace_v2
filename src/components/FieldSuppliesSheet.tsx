import { Settings, Zap } from 'lucide-react';
import type { TranslationKey } from '../i18n/en';
import { BottomSheet } from './BottomSheet';
import { ErrorBoundary } from './ErrorBoundary';

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
}

export function FieldSuppliesSheet({
  open,
  t,
  onClose,
  onOpenTactics,
  onReloadBattle,
}: FieldSuppliesSheetProps) {
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
        <div className="rounded-lg border border-slate-800 bg-[#080D16] p-4 text-[13px] text-slate-300 leading-relaxed flex items-start gap-2">
          <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <span>{t('battle.noConsumables')}</span>
        </div>
      </BottomSheet>
    </ErrorBoundary>
  );
}
