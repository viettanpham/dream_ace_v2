import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useI18n } from '../i18n';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  maxHeightClass?: string;
  bodyScrollable?: boolean;
  size?: 'default' | 'large';
  zIndexClass?: string;
  testId?: string;
}

export function BottomSheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxHeightClass = 'max-h-[86dvh]',
  bodyScrollable = true,
  size = 'default',
  zIndexClass = 'z-50',
  testId,
}: BottomSheetProps) {
  const { t } = useI18n();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const panelSizeClasses =
    size === 'large'
      ? `w-full md:w-[90vw] md:max-w-none md:h-[90dvh] ${maxHeightClass} md:max-h-[90dvh]`
      : `w-full md:max-w-lg ${maxHeightClass}`;

  return (
    <div
      data-testid={testId}
      className={`fixed inset-0 ${zIndexClass} flex items-end md:items-center justify-center bg-slate-950/75 backdrop-blur-sm`}
      role="dialog"
      aria-modal="true"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`${panelSizeClasses} flex flex-col rounded-t-2xl md:rounded-xl border-t md:border border-slate-700/90 bg-[#0B111C] text-slate-100 shadow-2xl overflow-hidden pb-safe`}
      >
        {/* Mobile grab handle */}
        <div className="md:hidden pt-2.5 pb-1 flex justify-center shrink-0">
          <span className="w-10 h-1 rounded-full bg-slate-700" />
        </div>

        {/* Sheet Header */}
        <div className="px-4 py-2.5 border-b border-slate-800/90 flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <div className="text-base font-bold text-slate-100 truncate">
              {title}
            </div>
            {subtitle && (
              <div className="text-xs text-slate-400 truncate mt-0.5">
                {subtitle}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-slate-100 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        {bodyScrollable ? (
          <div className="flex-1 min-h-0 overflow-y-auto tactical-scroll p-4 text-sm">
            {children}
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {children}
          </div>
        )}

        {/* Optional Sticky Footer */}
        {footer && (
          <div className="px-4 py-3 border-t border-slate-800/90 bg-[#080C14]/95 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
