import {
  defineMessages,
  intlLocale,
  localizeText,
  type MessageRef,
  type ModelCapabilitiesView,
  type ModelInfoByCapability,
  type ModelRef,
  type ModelServiceCapability,
  type OnlineCapability,
} from '@cuccut/protocol';
import { cloudProviders, defaultKey, parseDefaultKey } from './models-cloud.ts';
import { zhHans } from './tools-models.zh-Hans.ts';
import { zhHant } from './tools-models.zh-Hant.ts';
import { ja } from './tools-models.ja.ts';
import { ko } from './tools-models.ko.ts';
import { es } from './tools-models.es.ts';
import { fr } from './tools-models.fr.ts';
import { de } from './tools-models.de.ts';
import { nl } from './tools-models.nl.ts';
import { ptBR } from './tools-models.pt-BR.ts';
import { it } from './tools-models.it.ts';
import { ru } from './tools-models.ru.ts';
import { pl } from './tools-models.pl.ts';
import { tr } from './tools-models.tr.ts';
import { vi } from './tools-models.vi.ts';

const en = {
  notConnected: 'Not connected',
  unavailable: 'Unavailable',
  notDownloaded: 'Not downloaded',
  unsupported: 'Not available on this platform or build',
  auto: 'Auto',
  anyLanguage: 'Many languages',
  languages: (named: readonly string[]) => named.join(', '),
  languagesMore: (first: readonly string[], total: number) => `${first.join(', ')} and ${total - first.length} more`,
};
export type ToolsModelsMessages = typeof en;
const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });

/**
 * The "pick a model" control on tool pages (design mocks tool-tts.jsx `ModelLine`, image-gen.jsx `ModelLine`, and the speech model Picker in tool-transcribe.jsx):
 * derives the selectable models from the capability view of the `models` topic. The provider list is not hard-coded; providers that are not connected are listed too, marked "Not connected", and selecting one shows a gate card on the page.
 * The key has the same shape as the default model menu on the models page: `providerId/modelId`.
 */

export interface ToolModelOption<M> {
  key: string;
  providerId: string;
  /** Provider name (OpenAI, or a self-hosted provider's name). */
  provider: string;
  modelId: string;
  /** Model name (a self-hosted provider may declare one that differs from its ID). */
  label: string;
  connected: boolean;
  /** Connected, usable at this tier, and this model is usable too: can be submitted. */
  usable: boolean;
  /** Reason it can't be used (not connected, no model declared, and so on); null when usable. */
  why: string | null;
  info: M;
  /** Local models (the design mock image-gen.jsx group "Local · no network"): can be selected even when not installed properly; choosing one shows a download card on the page; the fallback when opening the page doesn't go to it. */
  local?: boolean;
}

/**
 * Cloud (online provider) models: connected providers come first, listing each of their models; providers not connected list only their first model (design mock image-gen.jsx
 * `x.ready ? x.models : x.models.slice(0, 1)`); `all` lists everything (the transcription Picker lists everything, per the design). Agent providers such as Codex image generation are not here (`cloudProviders` only takes online ones).
 */
export function cloudModelOptions<C extends OnlineCapability>(
  view: ModelCapabilitiesView,
  capability: C,
  all = false,
): ToolModelOption<ModelInfoByCapability[C]>[] {
  return cloudProviders(view, capability).flatMap((card) => {
    const models = (card.connected || all ? card.models : card.models.slice(0, 1)) as ModelInfoByCapability[C][];
    return models.map((info) => {
      const why = !card.connected
        ? M.notConnected
        : !card.available
          ? (card.detail ?? M.unavailable)
          : info.available === false
            ? (localizeText(info.detail, info.detailRef) ?? M.unavailable)
            : null;
      return {
        key: defaultKey({ providerId: card.providerId, modelId: info.modelId }),
        providerId: card.providerId,
        provider: card.label,
        modelId: info.modelId,
        label: info.label || info.modelId,
        connected: card.connected,
        usable: why === null,
        why,
        info,
      };
    });
  });
}

/** Why a local model isn't ready (the page uses this to show a download card, and the main button says "Not installed yet"): in the current UI language; also called when matching against `why`. */
export function localNotDownloaded(): string {
  return M.notDownloaded;
}

/** Why a local model can't be used (design mock model-cloud-image.js `engines`' `why`). */
function localWhy(
  capability: { available: boolean; detail?: string; detailRef?: MessageRef },
  info: { unavailableReason?: string; available?: boolean; detail?: string; detailRef?: MessageRef },
): string | null {
  if (info.unavailableReason === 'not-installed') return M.notDownloaded;
  if (info.unavailableReason === 'unsupported') return M.unsupported;
  if (info.available === false) return localizeText(info.detail, info.detailRef) ?? M.unavailable;
  if (!capability.available) return localizeText(capability.detail, capability.detailRef) ?? M.unsupported;
  return null;
}

/**
 * Models of local providers (`kind: 'local'`): all are listed (uninstalled ones too; choosing one shows that it is not installed yet, with links to settings or download),
 * named with the model's name (product design §2.7, "Models" row).
 */
export function localModelOptions<C extends ModelServiceCapability>(
  view: ModelCapabilitiesView,
  capability: C,
): ToolModelOption<ModelInfoByCapability[C]>[] {
  return view[capability].providers
    .filter((p) => p.kind === 'local')
    .flatMap((p) =>
      (p.models as ModelInfoByCapability[C][]).map((info) => {
        const why = localWhy(p, info);
        return {
          key: defaultKey({ providerId: p.providerId, modelId: info.modelId }),
          providerId: p.providerId,
          provider: p.label,
          modelId: info.modelId,
          label: info.label || info.modelId,
          connected: true,
          usable: why === null,
          why,
          info,
          local: true,
        };
      }),
    );
}

/** When the selected local model isn't installed yet, which one to switch to (design mock tool-tts.jsx "Switch to installed X"): the first installed, usable local model in the menu; null if there is none. */
export function installedAlternative<M>(options: readonly ToolModelOption<M>[], selected: ToolModelOption<M> | null): ToolModelOption<M> | null {
  return options.find((o) => o.local && o.usable && o.key !== selected?.key) ?? null;
}

/** The "Model" row's menu: configured cloud models for this capability first, then local models. */
export function modelOptions<C extends OnlineCapability>(view: ModelCapabilitiesView, capability: C): ToolModelOption<ModelInfoByCapability[C]>[] {
  return [...cloudModelOptions(view, capability), ...localModelOptions(view, capability)];
}

/**
 * Which one is picked on opening: the last one chosen (kept if it is still in the list, even if it can't be used now; the page shows a gate card), then this capability's effective default,
 * then the first usable one, and finally the first one. null when the list is empty. The last two steps only pick among what `fallback` accepts (image generation doesn't fall back to local models,
 * design mock model-cloud-image.js `preferred`).
 */
export function initialModelKey<M>(
  options: readonly ToolModelOption<M>[],
  saved: string | null,
  effective: ModelRef | null,
  fallback: (option: ToolModelOption<M>) => boolean = () => true,
): string | null {
  if (saved && options.some((o) => o.key === saved)) return saved;
  const preferred = effective ? defaultKey(effective) : null;
  const hit = options.find((o) => o.key === preferred && o.usable);
  const pool = options.filter(fallback);
  return (hit ?? pool.find((o) => o.usable) ?? pool[0] ?? options[0])?.key ?? null;
}

export function findOption<M>(options: readonly ToolModelOption<M>[], key: string | null): ToolModelOption<M> | null {
  return options.find((o) => o.key === key) ?? null;
}

/** Key → provider and model (used when restoring the settings of a saved record). */
export function modelKeyOf(providerId: string, modelId: string): string {
  return defaultKey({ providerId, modelId });
}

export function parseModelKey(key: string): ModelRef | null {
  return parseDefaultKey(key);
}

// ---- Languages ----

/** Common languages listed in the Picker when a model accepts any language (`any`). */
const COMMON_LANGUAGES = ['zh', 'en', 'ja', 'ko', 'fr', 'de', 'es', 'it', 'pt', 'ru', 'ar'];

const namesByLocale = new Map<string, Intl.DisplayNames | null>();

/** Language names written in the UI's language (for the Chinese UI, `zh` → 中文; for the English UI, → Chinese); returned unchanged when not recognized. */
export function langName(tag: string): string {
  const locale = intlLocale();
  let names = namesByLocale.get(locale);
  if (names === undefined) {
    try {
      names = new Intl.DisplayNames([locale], { type: 'language' });
    } catch {
      names = null;
    }
    namesByLocale.set(locale, names);
  }
  try {
    return names?.of(tag) ?? tag;
  } catch {
    return tag;
  }
}

/** The primary language subtag of a BCP 47 tag (`zh-CN` → `zh`). */
export function primaryLanguage(tag: string): string {
  return tag.split('-')[0]!.toLowerCase();
}

export interface LanguageOption {
  /** An empty string means "auto": don't send `language`. */
  key: string;
  label: string;
}

/** Language dropdown: auto, plus the languages the model declares (the common ones when it accepts any). */
export function languageOptions(languages: 'any' | readonly string[], auto: string = M.auto): LanguageOption[] {
  const list = languages === 'any' ? COMMON_LANGUAGES : languages;
  return [{ key: '', label: auto }, ...list.map((tag) => ({ key: tag, label: langName(tag) }))];
}

/** Whether this model can speak or recognize this language (`any` means all of them). */
export function speaks(languages: 'any' | readonly string[], tag: string): boolean {
  if (languages === 'any') return true;
  const want = primaryLanguage(tag);
  return languages.some((l) => primaryLanguage(l) === want);
}

/** Rough per-character guess of a text's language (design mock model-tools.js `detectLang`): kana, Hangul, Arabic, Han characters, Latin letters; null when none apply. */
export function detectLang(text: string): string | null {
  if (/[぀-ヿ]/.test(text)) return 'ja';
  if (/[가-힯]/.test(text)) return 'ko';
  if (/[؀-ۿ]/.test(text)) return 'ar';
  if (/[㐀-鿿]/.test(text)) return 'zh';
  if (/[A-Za-z]/.test(text)) return 'en';
  return null;
}

/** Counted in Unicode code points (the Runtime's limits are also counted that way). */
export function codePoints(text: string): number {
  return Array.from(text).length;
}

/** Seed: empty, or a non-negative integer. */
export function parseSeed(text: string): { ok: true; seed: number | null } | { ok: false } {
  const t = text.trim();
  if (!t) return { ok: true, seed: null };
  if (!/^\d+$/.test(t)) return { ok: false };
  const n = Number(t);
  return Number.isSafeInteger(n) ? { ok: true, seed: n } : { ok: false };
}

/** Provider name on a record card: looked up by provider ID in this capability's view; if not found (a deleted self-hosted provider), the ID is written. */
export function providerName(view: ModelCapabilitiesView | null, capability: ModelServiceCapability, providerId: string): string {
  return view?.[capability].providers.find((p) => p.providerId === providerId)?.label ?? providerId;
}

/** Short form of a language list: "multiple languages" when unrestricted, names for up to three, otherwise "Chinese, English and N more". */
export function languagesShort(languages: 'any' | readonly string[]): string {
  if (languages === 'any') return M.anyLanguage;
  const named = languages.map(langName);
  if (named.length <= 3) return M.languages(named);
  return M.languagesMore(named.slice(0, 2), named.length);
}
