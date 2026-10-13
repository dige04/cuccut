import { getLocale, type Locale, type MediaHandle } from '@cuccut/protocol';
import { useTemplateCatalog } from '../state/template-catalog-store.ts';
import type { RuntimeSession } from './session.ts';

/**
 * Reads the template catalog (`templates.*`, command and protocol spec §4.1; template package spec §6). The catalog is stored in state/template-catalog-store,
 * prompts are cached by “id@version:locale” (the body for the same version and locale never changes), and handles for attached files expire and are re-requested before they expire.
 * The catalog is requested in the current UI language (template package spec §3.6): after the UI language changes, it is fetched again and the copy comes in that language.
 * Kept in its own file so the session channel does not grow (same as library-commands.ts).
 */

type Session = Pick<RuntimeSession, 'client'>;

let listing: { language: Locale; done: Promise<void> } | null = null;
/** A prompt for the same version never changes: remember it together with requests still in flight; failed ones are not remembered and are fetched again next time. */
const prompts = new Map<string, Promise<string>>();
/** File handles expire: stop using one 30 seconds before it expires. */
const handles = new Map<string, Promise<MediaHandle>>();
const HANDLE_MARGIN_MS = 30_000;

/**
 * Fetch the catalog once in the current UI language; do not send it again if the same language is already being fetched. The old list keeps displaying while the fetch is in progress.
 * If the UI language changes during the fetch, the result for the old language is not put into the mirror; the fetch for the new language does that.
 */
export function loadTemplates(session: Session): Promise<void> {
  const language = getLocale();
  if (listing?.language === language) return listing.done;
  const store = useTemplateCatalog.getState();
  store.begin();
  const current = (): boolean => getLocale() === language;
  const done: Promise<void> = session.client
    .request('templates.list', { language })
    .then(
      (result) => {
        if (current()) useTemplateCatalog.getState().succeed(result);
      },
      (error: Error) => {
        if (current()) useTemplateCatalog.getState().fail(error.message);
      },
    )
    .finally(() => {
      if (listing?.done === done) listing = null;
    });
  listing = { language, done };
  return done;
}

/**
 * The template's prompt (`prompt.md`, or the full text of the translation in the chosen language). `language` uses this template's language from the catalog (`HomeTemplate.language`),
 * the same version as the copy on the card. `templates.get` does not take a version and always returns the current version, so a copy is also recorded under the version actually read.
 */
export function templatePrompt(session: Session, id: string, version: string, language: string): Promise<string> {
  const key = `${id}@${version}:${language}`;
  const cached = prompts.get(key);
  if (cached) return cached;
  const pending = session.client.request('templates.get', { id, language }).then(({ template, prompt }) => {
    // The catalog changed version between two reads: also record under the version actually read.
    const actual = `${id}@${template.manifest.version}:${language}`;
    if (actual !== key) prompts.set(actual, Promise.resolve(prompt));
    return prompt;
  });
  prompts.set(key, pending);
  pending.catch(() => prompts.delete(key));
  return pending;
}

/** Media URLs for the attached files registered in the manifest (`cover.file`, `preview.file`, `assets[].path`). */
export function templateFileUrl(session: Session, id: string, path: string): Promise<string> {
  const key = `${id}:${path}`;
  const cached = handles.get(key);
  if (cached) return cached.then((handle) => (fresh(handle) ? handle.url : renew()));
  return renew();

  function renew(): Promise<string> {
    const pending = session.client.request('templates.openHandle', { id, path });
    handles.set(key, pending);
    pending.catch(() => handles.delete(key));
    return pending.then((handle) => handle.url);
  }
}

function fresh(handle: MediaHandle): boolean {
  return Date.parse(handle.expiresAt) - Date.now() > HANDLE_MARGIN_MS;
}

/** File cannot be fetched (media element error, Runtime restart): drop this handle and request it again next time. */
export function forgetTemplateFile(id: string, path: string): void {
  handles.delete(`${id}:${path}`);
}

/** For tests: clear in-flight requests and the cache. */
export function resetTemplateCommands(): void {
  listing = null;
  prompts.clear();
  handles.clear();
}
