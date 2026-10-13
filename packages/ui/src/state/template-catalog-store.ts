import { create } from 'zustand';
import type { TemplateDiagnostic, TemplateListResult } from '@cuccut/protocol';
import { templateCatalogOf, type HomeTemplate } from '../model/home-templates.ts';

/**
 * The UI copy of the Runtime's template catalog (`templates.list`, template pack spec §6): shared by the start page and the "All templates" dialog.
 * The Runtime neither caches the catalog nor pushes changes, so the UI fetches it once each when the start page mounts, when the dialog opens, and on reconnect (runtime/template-commands.ts).
 * Once fetched, the old list keeps showing on later fetches, and a failed fetch does not clear it; loading or failed is shown only if it has never been fetched.
 */
export interface TemplateCatalogStore {
  /** `loading`: fetching now (whether or not there was data before); `failed`: the latest fetch did not succeed. */
  status: 'idle' | 'loading' | 'ready' | 'failed';
  /** Has been fetched at least once. */
  loaded: boolean;
  templates: HomeTemplate[];
  diagnostics: TemplateDiagnostic[];
  error: string | null;
  begin(): void;
  succeed(result: TemplateListResult): void;
  fail(message: string): void;
}

/** The state before any fetch (also used to reset in tests). */
export function emptyTemplateCatalog(): Pick<TemplateCatalogStore, 'status' | 'loaded' | 'templates' | 'diagnostics' | 'error'> {
  return { status: 'idle', loaded: false, templates: [], diagnostics: [], error: null };
}

export const useTemplateCatalog = create<TemplateCatalogStore>()((set) => ({
  ...emptyTemplateCatalog(),
  begin: () => set({ status: 'loading' }),
  succeed: (result) =>
    set({ status: 'ready', loaded: true, templates: templateCatalogOf(result.templates), diagnostics: result.diagnostics, error: null }),
  fail: (message) => set({ status: 'failed', error: message }),
}));
