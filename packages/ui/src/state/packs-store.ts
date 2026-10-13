import { create } from 'zustand';
import type { PackDiagnostic, PackListResult, PackPreview, PackSummary } from '@cuccut/protocol';
import { sortPacks } from '../model/packs.ts';

/** A line the list says once after coming back from a flow (pack design §2.2): what was installed, or where the export went. */
export type PackNotice = { kind: 'installed'; name: string } | { kind: 'exported'; dir: string };

/**
 * The UI copy of the installed packs (`packs.list`, pack design §6): Settings › Packs, the rail's count, and the quick
 * actions above the composer. The Runtime does not push changes; the UI fetches the list when those mount and on
 * reconnect (runtime/pack-commands.ts), and install, remove and restore return the whole list, which is written back
 * whole. Once fetched, the old list keeps showing on later fetches, and a failed fetch does not clear it.
 *
 * `preview` is the pack read by `packs.inspect` and not yet installed: the import page shows it and installs its token.
 */
export interface PacksStore {
  /** `loading`: fetching now (whether or not there was data before); `failed`: the latest fetch did not succeed. */
  status: 'idle' | 'loading' | 'ready' | 'failed';
  /** Has been fetched at least once. */
  loaded: boolean;
  packs: PackSummary[];
  diagnostics: PackDiagnostic[];
  error: string | null;
  preview: PackPreview | null;
  notice: PackNotice | null;
  begin(): void;
  /** Result of `packs.list` or of a change: written back as a whole. */
  succeed(result: PackListResult): void;
  fail(message: string): void;
  /** One pack's newer summary (after saving its guide), in place; an unknown id is ignored. */
  patch(pack: PackSummary): void;
  setPreview(preview: PackPreview | null): void;
  setNotice(notice: PackNotice | null): void;
}

/** The state before any fetch (also used to reset in tests). */
export function emptyPacks(): Pick<PacksStore, 'status' | 'loaded' | 'packs' | 'diagnostics' | 'error' | 'preview' | 'notice'> {
  return { status: 'idle', loaded: false, packs: [], diagnostics: [], error: null, preview: null, notice: null };
}

export const usePacks = create<PacksStore>()((set) => ({
  ...emptyPacks(),
  begin: () => set({ status: 'loading' }),
  succeed: (result) => set({ status: 'ready', loaded: true, packs: sortPacks(result.packs), diagnostics: result.diagnostics, error: null }),
  fail: (message) => set({ status: 'failed', error: message }),
  patch: (pack) =>
    set((s) => (s.packs.some((p) => p.id === pack.id) ? { packs: s.packs.map((p) => (p.id === pack.id ? pack : p)) } : {})),
  setPreview: (preview) => set({ preview }),
  setNotice: (notice) => set({ notice }),
}));
