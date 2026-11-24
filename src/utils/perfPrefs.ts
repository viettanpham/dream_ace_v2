import { useEffect, useState } from 'react';

export const PERF_MODE_STORAGE_KEY = 'dreamAce.perfMode.v1';

export type PerfMode = 'auto' | 'full' | 'low';
export type ResolvedPerfLevel = 'full' | 'low';

export const PERF_MODE_ORDER: readonly PerfMode[] = ['auto', 'full', 'low'];

export interface PerfEnvProbe {
  prefersReducedMotion?: boolean;
  hardwareConcurrency?: number;
}

const listeners = new Set<() => void>();

function notifyPerfListeners(): void {
  listeners.forEach((fn) => fn());
}

export function normalizePerfMode(raw: unknown): PerfMode {
  if (raw === 'auto' || raw === 'full' || raw === 'low') {
    return raw;
  }
  return 'auto';
}

export function readPerfMode(): PerfMode {
  if (typeof window === 'undefined') return 'auto';
  try {
    const raw = window.localStorage.getItem(PERF_MODE_STORAGE_KEY);
    return normalizePerfMode(raw);
  } catch {
    return 'auto';
  }
}

export function getEnvPrefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function getEnvHardwareConcurrency(): number | undefined {
  if (typeof navigator === 'undefined') return undefined;
  const hc = navigator.hardwareConcurrency;
  return typeof hc === 'number' && Number.isFinite(hc) ? hc : undefined;
}

export function resolvePerfLevel(
  mode: PerfMode,
  env?: PerfEnvProbe
): ResolvedPerfLevel {
  if (mode === 'low') return 'low';
  if (mode === 'full') return 'full';

  const reducedMotion =
    env?.prefersReducedMotion !== undefined
      ? env.prefersReducedMotion
      : getEnvPrefersReducedMotion();
  if (reducedMotion) return 'low';

  const cores =
    env?.hardwareConcurrency !== undefined
      ? env.hardwareConcurrency
      : getEnvHardwareConcurrency();
  if (typeof cores === 'number' && cores > 0 && cores <= 4) {
    return 'low';
  }
  return 'full';
}

export function syncPerfAttribute(
  mode: PerfMode = readPerfMode(),
  env?: PerfEnvProbe
): ResolvedPerfLevel {
  const resolved = resolvePerfLevel(mode, env);
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.setAttribute('data-perf', resolved);
  }
  return resolved;
}

export function writePerfMode(mode: PerfMode): PerfMode {
  const normalized = normalizePerfMode(mode);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(PERF_MODE_STORAGE_KEY, normalized);
    } catch {
      // Ignore storage quota errors
    }
  }
  syncPerfAttribute(normalized);
  notifyPerfListeners();
  return normalized;
}

export function getNextPerfMode(current: PerfMode): PerfMode {
  const idx = PERF_MODE_ORDER.indexOf(current);
  return PERF_MODE_ORDER[(idx + 1) % PERF_MODE_ORDER.length];
}

export function cyclePerfMode(): PerfMode {
  return writePerfMode(getNextPerfMode(readPerfMode()));
}

export function subscribePerfMode(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function usePerfMode(): [
  PerfMode,
  (mode: PerfMode) => void,
  ResolvedPerfLevel
] {
  const [mode, setModeState] = useState<PerfMode>(() => readPerfMode());
  const [resolved, setResolved] = useState<ResolvedPerfLevel>(() =>
    syncPerfAttribute(readPerfMode())
  );

  useEffect(() => {
    const sync = () => {
      const current = readPerfMode();
      setModeState(current);
      setResolved(syncPerfAttribute(current));
    };

    sync();
    const unsub = subscribePerfMode(sync);
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === PERF_MODE_STORAGE_KEY) {
        sync();
      }
    };
    window.addEventListener('storage', onStorage);

    let mql: MediaQueryList | null = null;
    if (typeof window.matchMedia === 'function') {
      try {
        mql = window.matchMedia('(prefers-reduced-motion: reduce)');
        if (typeof mql.addEventListener === 'function') {
          mql.addEventListener('change', sync);
        }
      } catch {
        mql = null;
      }
    }

    return () => {
      unsub();
      window.removeEventListener('storage', onStorage);
      if (mql && typeof mql.removeEventListener === 'function') {
        mql.removeEventListener('change', sync);
      }
    };
  }, []);

  const updateMode = (next: PerfMode) => {
    writePerfMode(next);
  };

  return [mode, updateMode, resolved];
}

export function syncPausedAttribute(paused: boolean): void {
  if (typeof document === 'undefined' || !document.documentElement) return;
  if (paused) {
    document.documentElement.setAttribute('data-paused', 'true');
  } else {
    document.documentElement.removeAttribute('data-paused');
  }
}

export function attachPerfDocumentListeners(): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {};
  }

  let windowBlurred =
    typeof document.hasFocus === 'function' ? !document.hasFocus() : false;

  const updatePaused = () => {
    const hasNoFocus =
      typeof document.hasFocus === 'function' ? !document.hasFocus() : false;
    const paused = Boolean(document.hidden || windowBlurred || hasNoFocus);
    syncPausedAttribute(paused);
  };

  const onVisibilityChange = () => {
    if (!document.hidden) {
      windowBlurred = false;
    }
    updatePaused();
  };

  const onBlur = () => {
    windowBlurred = true;
    updatePaused();
  };

  const onFocus = () => {
    windowBlurred = false;
    updatePaused();
  };

  const onMotionChange = () => {
    syncPerfAttribute();
    notifyPerfListeners();
  };

  syncPerfAttribute();
  updatePaused();

  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('blur', onBlur);
  window.addEventListener('focus', onFocus);

  let mql: MediaQueryList | null = null;
  if (typeof window.matchMedia === 'function') {
    try {
      mql = window.matchMedia('(prefers-reduced-motion: reduce)');
      if (typeof mql.addEventListener === 'function') {
        mql.addEventListener('change', onMotionChange);
      }
    } catch {
      mql = null;
    }
  }

  return () => {
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('blur', onBlur);
    window.removeEventListener('focus', onFocus);
    if (mql && typeof mql.removeEventListener === 'function') {
      mql.removeEventListener('change', onMotionChange);
    }
  };
}
