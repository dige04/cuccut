import { defineMessages } from '@cuccut/protocol';
import { zhHans } from './tool-frame.zh-Hans.ts';
import { zhHant } from './tool-frame.zh-Hant.ts';
import { ja } from './tool-frame.ja.ts';
import { ko } from './tool-frame.ko.ts';
import { es } from './tool-frame.es.ts';
import { fr } from './tool-frame.fr.ts';
import { de } from './tool-frame.de.ts';
import { nl } from './tool-frame.nl.ts';
import { ptBR } from './tool-frame.pt-BR.ts';
import { it } from './tool-frame.it.ts';
import { ru } from './tool-frame.ru.ts';
import { pl } from './tool-frame.pl.ts';
import { tr } from './tool-frame.tr.ts';
import { vi } from './tool-frame.vi.ts';
import { localNotDownloaded, type ToolModelOption } from './tools-models.ts';

/** The model row’s copy (translations are in `tool-frame.<lang>.ts`). `noun` is what this kind of model is called; the caller supplies it in the current language. */
const en = {
  noneAvailable: (noun: string) => `No ${noun} available yet; set one up in Settings`,
  pickOne: (noun: string) => `Choose a ${noun} first`,
  notInstalled: (name: string) => `${name} isn’t installed yet`,
  notConnected: (provider: string) => `${provider} isn’t connected yet`,
  unavailable: (name: string, why: string | null) => `${name} · ${why ?? 'Unavailable'}`,
  notInstalledWarning: (name: string) => `${name} isn’t installed yet. Choose an installed one, or download it in Settings`,
  notConnectedWarning: (provider: string) => `${provider} isn’t connected yet. Choose one that works, or connect it in Settings`,
  noModel: (noun: string, local: boolean) =>
    local
      ? `No ${noun} available yet. Install a local model or connect a cloud service in Settings.`
      : `No ${noun} available yet. Connect a cloud service in Settings.`,
};
export type ToolFrameMessages = typeof en;
const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });

/**
 * The shared skeleton of tool pages (product design §2.7; design file tool-frame.jsx): input → model → options → save location → start.
 * This is the pure logic for the “model” row: when there is no usable model, or the selected one is not installed or not connected, what that row says, and what reason is shown beside the main button.
 * It does not block the whole page. The page can still be filled in; only the start button is disabled, and it explains why.
 */

/** The name shown to people for the selected model: for a local model, the model’s name; for a cloud one, the provider. */
function nameOf<M>(o: ToolModelOption<M>): string {
  return o.local ? o.label : o.provider;
}

/** The reason line beside the main button (design file `modelReason`); null when usable. `noun` is what this kind of model is called (“speech synthesis model”). */
export function modelReason<M>(options: readonly ToolModelOption<M>[], selected: ToolModelOption<M> | null, noun: string): string | null {
  if (!options.length) return M.noneAvailable(noun);
  if (!selected) return M.pickOne(noun);
  if (selected.usable) return null;
  if (selected.local) return selected.why === localNotDownloaded() ? M.notInstalled(selected.label) : M.unavailable(selected.label, selected.why ?? null);
  if (!selected.connected) return M.notConnected(selected.provider);
  return M.unavailable(selected.provider, selected.why ?? null);
}

/** The warning under the model row (design file `ToolModelRow` warning). null when the selected model is usable. */
export function modelWarning<M>(selected: ToolModelOption<M> | null): string | null {
  if (!selected || selected.usable) return null;
  if (selected.local && selected.why === localNotDownloaded()) return M.notInstalledWarning(selected.label);
  if (!selected.local && !selected.connected) return M.notConnectedWarning(selected.provider);
  return M.unavailable(nameOf(selected), selected.why ?? null);
}

/** The row when no model is usable (design file `ToolModelRow` empty state). `local` says whether this capability has local models (text generation has none). */
export function noModelText(noun: string, local = true): string {
  return M.noModel(noun, local);
}

// ---- Save location ----

/**
 * Display name of the save location (design file model-tool-save-dir.js `label`): the home directory is shortened to `~`. With more than three levels, only the last two are kept and “…” is written in between.
 * Backslashes in Windows paths are kept as they are.
 */
export function saveDirLabel(path: string): string {
  const p = path
    .replace(/^\/Users\/[^/]+/, '~')
    .replace(/^\/home\/[^/]+/, '~')
    .replace(/^([A-Za-z]:)\\Users\\[^\\]+/, '~')
    .replace(/[\\/]+$/, '');
  if (!p) return path;
  const sep = p.includes('\\') && !p.includes('/') ? '\\' : '/';
  const parts = p.split(sep);
  return parts.length > 3 ? `${parts[0]}${sep}…${sep}${parts.slice(-2).join(sep)}` : p;
}

/**
 * The directory handed to Runtime for this run (`saveDir` for direct tasks, `outDir` for fixed flows): the one chosen with “Change…” takes priority; otherwise the save location given by `tools.list`.
 * If neither exists (the web service does not provide a save location), nothing is passed, and Runtime uses its own default (direct tasks do not write a copy; flows write to the save location).
 */
export function saveTarget(saveDirectory: string | null, override: string | null): string | undefined {
  return override?.trim() || saveDirectory || undefined;
}

/** The request for a direct task includes `saveDir` (when there is a directory). */
export function withSaveDir<T extends object>(request: T, saveDir: string | undefined): T & { saveDir?: string } {
  return saveDir ? { ...request, saveDir } : request;
}
