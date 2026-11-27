import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

export type AdminSectionsBatchAction = 'collapse' | 'expand' | null;

interface AdminSectionsContextValue {
  action: AdminSectionsBatchAction;
  version: number;
  collapseAll: () => void;
  expandAll: () => void;
}

const AdminSectionsContext = createContext<AdminSectionsContextValue | null>(null);

export function getAdminSectionStorageKey(id: string): string {
  return `admin.section.${id}`;
}

function readStoredOpenState(id: string): boolean | null {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return null;
    const raw = window.sessionStorage.getItem(getAdminSectionStorageKey(id));
    if (raw === '1' || raw === 'true') return true;
    if (raw === '0' || raw === 'false') return false;
  } catch {
    // Ignore storage errors (e.g. private mode / disabled sessionStorage)
  }
  return null;
}

function writeStoredOpenState(id: string, open: boolean): void {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    window.sessionStorage.setItem(getAdminSectionStorageKey(id), open ? '1' : '0');
  } catch {
    // Ignore storage errors
  }
}

export function AdminSectionsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{
    action: AdminSectionsBatchAction;
    version: number;
  }>({
    action: null,
    version: 0,
  });

  const collapseAll = () => {
    setState((prev) => ({ action: 'collapse', version: prev.version + 1 }));
  };

  const expandAll = () => {
    setState((prev) => ({ action: 'expand', version: prev.version + 1 }));
  };

  return (
    <AdminSectionsContext.Provider
      value={{
        action: state.action,
        version: state.version,
        collapseAll,
        expandAll,
      }}
    >
      {children}
    </AdminSectionsContext.Provider>
  );
}

export function useAdminSections(): AdminSectionsContextValue | null {
  return useContext(AdminSectionsContext);
}

export interface AdminSectionsToolbarProps {
  collapseLabel: string;
  expandLabel: string;
}

export function AdminSectionsToolbar({
  collapseLabel,
  expandLabel,
}: AdminSectionsToolbarProps) {
  const ctx = useAdminSections();
  if (!ctx) return null;
  return (
    <div className="sticky -top-4 z-10 -mx-4 px-4 py-2 bg-[#0A101B]/95 backdrop-blur-xs border-b border-slate-800/80 flex flex-wrap items-center justify-end gap-2">
      <button
        type="button"
        data-testid="admin-collapse-all"
        onClick={ctx.collapseAll}
        className="min-h-[32px] px-2.5 rounded border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-semibold cursor-pointer"
      >
        {collapseLabel}
      </button>
      <button
        type="button"
        data-testid="admin-expand-all"
        onClick={ctx.expandAll}
        className="min-h-[32px] px-2.5 rounded border border-amber-500/40 bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 text-xs font-semibold cursor-pointer"
      >
        {expandLabel}
      </button>
    </div>
  );
}

export interface AdminSectionProps {
  id: string;
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children?: ReactNode;
}

export function AdminSection({
  id,
  title,
  description,
  defaultOpen = false,
  children,
}: AdminSectionProps) {
  const ctx = useAdminSections();
  const [open, setOpen] = useState<boolean>(() => {
    const stored = readStoredOpenState(id);
    return stored !== null ? stored : defaultOpen;
  });
  const seenVersionRef = useRef<number>(ctx?.version ?? 0);

  useEffect(() => {
    if (!ctx) return;
    if (ctx.version === seenVersionRef.current) return;
    seenVersionRef.current = ctx.version;
    if (ctx.action === 'collapse') {
      setOpen(false);
      writeStoredOpenState(id, false);
    } else if (ctx.action === 'expand') {
      setOpen(true);
      writeStoredOpenState(id, true);
    }
  }, [ctx, ctx?.version, ctx?.action, id]);

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      writeStoredOpenState(id, next);
      return next;
    });
  };

  const bodyId = `admin-section-body-${id}`;

  return (
    <section
      data-testid={`admin-section-${id}`}
      className="rounded-lg border border-slate-800 bg-[#0D1422] min-w-0"
    >
      <button
        type="button"
        data-testid={`admin-section-toggle-${id}`}
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggle();
          }
        }}
        onKeyUp={(e) => {
          if (e.key === ' ') {
            e.preventDefault();
          }
        }}
        className="w-full px-3.5 py-2.5 flex items-start gap-2 text-left cursor-pointer hover:bg-slate-800/40 rounded-lg transition-colors min-w-0"
      >
        <span className="mt-0.5 text-slate-400 shrink-0">
          {open ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs sm:text-sm font-bold text-slate-200 break-words">
            {title}
          </span>
          {description && (
            <span className="block text-[11px] text-slate-400 mt-0.5 leading-snug break-words">
              {description}
            </span>
          )}
        </span>
      </button>

      <div
        id={bodyId}
        data-testid={bodyId}
        hidden={!open}
        className={
          open
            ? 'px-3.5 pb-3.5 pt-2.5 border-t border-slate-800/80 min-w-0'
            : 'hidden'
        }
      >
        {children}
      </div>
    </section>
  );
}
