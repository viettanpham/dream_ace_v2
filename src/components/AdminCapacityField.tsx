import { useEffect, useState } from 'react';

export interface AdminCapacityFieldProps {
  label: string;
  description?: string;
  min: number;
  max: number;
  storedValue: number;
  usedCount: number;
  inputTestId: string;
  applyTestId: string;
  hintTestId?: string;
  appliedTestId?: string;
  overCapTestId?: string;
  overCapacityText: string;
  sanitize: (raw: unknown) => number;
  onApply: (sanitizedValue: number) => void;
  applyLabel: string;
  rangeHintText: string;
  formatAppliedText: (n: number) => string;
}

export function AdminCapacityField({
  label,
  description,
  min,
  max,
  storedValue,
  usedCount,
  inputTestId,
  applyTestId,
  hintTestId,
  appliedTestId,
  overCapTestId,
  overCapacityText,
  sanitize,
  onApply,
  applyLabel,
  rangeHintText,
  formatAppliedText,
}: AdminCapacityFieldProps) {
  const [draft, setDraft] = useState<string>(() => String(storedValue));
  const [appliedValue, setAppliedValue] = useState<number | null>(null);

  useEffect(() => {
    setDraft(String(storedValue));
  }, [storedValue]);

  useEffect(() => {
    if (appliedValue === null) return;
    const timer = window.setTimeout(() => {
      setAppliedValue(null);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [appliedValue]);

  const trimmed = draft.trim();
  const isWhole = /^-?\d+$/.test(trimmed);
  const parsed = isWhole ? Number(trimmed) : Number.NaN;
  const isValid =
    isWhole && Number.isSafeInteger(parsed) && parsed >= min && parsed <= max;
  const canApply = isValid && parsed !== storedValue;

  const targetCap = isValid ? parsed : storedValue;
  const isOverCapacity = usedCount > targetCap;

  const handleApply = () => {
    if (!canApply) return;
    const clamped = sanitize(parsed);
    onApply(clamped);
    setDraft(String(clamped));
    setAppliedValue(clamped);
  };

  return (
    <div className="space-y-1 min-w-0 sm:col-span-2">
      <label htmlFor={inputTestId} className="text-[11px] text-slate-400 block">
        {label}
      </label>
      {description && (
        <p className="text-[11px] text-slate-400 leading-snug">{description}</p>
      )}
      <div className="flex flex-wrap items-center gap-1.5 min-w-0">
        <input
          id={inputTestId}
          type="number"
          min={min}
          max={max}
          data-testid={inputTestId}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleApply();
            }
          }}
          className="min-w-[84px] flex-1 h-9 px-2 rounded border border-slate-700 bg-slate-900 text-xs font-mono-nums text-slate-100"
        />
        <button
          type="button"
          data-testid={applyTestId}
          disabled={!canApply}
          onClick={handleApply}
          className="h-9 px-3 rounded border border-amber-500/50 bg-amber-500/20 hover:bg-amber-500/30 disabled:opacity-40 disabled:cursor-not-allowed text-amber-200 text-xs font-semibold shrink-0 cursor-pointer"
        >
          {applyLabel}
        </button>
        {isOverCapacity && (
          <span
            data-testid={overCapTestId}
            className="text-[11px] font-medium text-amber-400 break-words"
          >
            {overCapacityText}
          </span>
        )}
      </div>
      <span
        data-testid={hintTestId}
        data-invalid={isValid ? 'false' : 'true'}
        className={`text-[10px] block ${
          isValid ? 'text-slate-500' : 'text-rose-400 font-medium'
        }`}
      >
        {rangeHintText}
      </span>
      {appliedValue !== null && (
        <span
          data-testid={appliedTestId}
          className="text-[11px] text-emerald-400 font-medium block"
        >
          {formatAppliedText(appliedValue)}
        </span>
      )}
    </div>
  );
}
