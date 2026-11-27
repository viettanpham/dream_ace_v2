import { useEffect, useState } from 'react';

export const ACTION_STAGE_STORAGE_KEY = 'dreamAce.actionStage.v1';
export const DEFAULT_ACTION_STAGE_ENABLED = true;

const actionStageListeners = new Set<() => void>();

export function subscribeActionStageEnabled(listener: () => void): () => void {
  actionStageListeners.add(listener);
  return () => {
    actionStageListeners.delete(listener);
  };
}

function emitActionStageChanged(): void {
  actionStageListeners.forEach((fn) => {
    try {
      fn();
    } catch {
      // Ignore subscriber errors
    }
  });
}

export function readActionStageEnabled(): boolean {
  if (typeof window === 'undefined') return DEFAULT_ACTION_STAGE_ENABLED;
  try {
    const raw = window.localStorage.getItem(ACTION_STAGE_STORAGE_KEY);
    if (raw === null || raw === '') return DEFAULT_ACTION_STAGE_ENABLED;
    const trimmed = raw.trim();
    if (trimmed === 'false' || trimmed === 'off' || trimmed === '0') {
      return false;
    }
    if (trimmed === 'true' || trimmed === 'on' || trimmed === '1') {
      return true;
    }
    const parsed = JSON.parse(trimmed) as unknown;
    if (typeof parsed === 'boolean') return parsed;
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof (parsed as { enabled?: unknown }).enabled === 'boolean'
    ) {
      return Boolean((parsed as { enabled: boolean }).enabled);
    }
    return DEFAULT_ACTION_STAGE_ENABLED;
  } catch {
    return DEFAULT_ACTION_STAGE_ENABLED;
  }
}

export function writeActionStageEnabled(enabled: boolean): boolean {
  const next = Boolean(enabled);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(
        ACTION_STAGE_STORAGE_KEY,
        JSON.stringify(next)
      );
    } catch {
      // Ignore storage quota/privacy errors
    }
  }
  emitActionStageChanged();
  return next;
}

export function useActionStageEnabled(): [boolean, (enabled: boolean) => void] {
  const [enabled, setEnabled] = useState<boolean>(() =>
    readActionStageEnabled()
  );

  useEffect(() => {
    const sync = () => setEnabled(readActionStageEnabled());
    const unsub = subscribeActionStageEnabled(sync);
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === ACTION_STAGE_STORAGE_KEY) {
        sync();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => {
      unsub();
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const update = (next: boolean) => {
    const saved = writeActionStageEnabled(next);
    setEnabled(saved);
  };

  return [enabled, update];
}
