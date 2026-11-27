import { useEffect, useState } from 'react';

export const VOUCHER_AUTO_STORAGE_KEY = 'dreamAce.voucherAuto.v1';

const listeners = new Set<() => void>();

export function subscribeAutoVoucherPrefs(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emitAutoVoucherChanged(): void {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      // Ignore subscriber errors
    }
  });
}

export function readAutoVoucherEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.localStorage.getItem(VOUCHER_AUTO_STORAGE_KEY);
    return raw === '1' || raw === 'true';
  } catch {
    return false;
  }
}

export function writeAutoVoucherEnabled(enabled: boolean): void {
  const next = Boolean(enabled);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(
        VOUCHER_AUTO_STORAGE_KEY,
        next ? '1' : '0'
      );
    } catch {
      // Ignore storage quota/privacy errors
    }
  }
  emitAutoVoucherChanged();
}

export function useAutoVoucherPref(): [boolean, (next: boolean) => void] {
  const [enabled, setEnabled] = useState<boolean>(() =>
    readAutoVoucherEnabled()
  );

  useEffect(() => {
    const sync = () => setEnabled(readAutoVoucherEnabled());
    const unsub = subscribeAutoVoucherPrefs(sync);
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === VOUCHER_AUTO_STORAGE_KEY) {
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
    writeAutoVoucherEnabled(next);
    setEnabled(Boolean(next));
  };

  return [enabled, update];
}
