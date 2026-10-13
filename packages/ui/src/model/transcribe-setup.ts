import {
  localizeText,
  type Id,
  type LibraryEntrySummary,
  type ModelCapabilitiesView,
  type ModelRef,
  type TranscribeModelInfo,
  type TranscribeParams,
  type TranscriptionGlossary,
} from '@cuccut/protocol';
import {
  cloudModelOptions,
  langName,
  languageOptions,
  languagesShort,
  modelKeyOf,
  type LanguageOption,
  type ToolModelOption,
} from './tools-models.ts';
import { transcribeOptions } from './tools-transcribe.ts';
import { M } from './transcribe-setup-copy.ts';

/**
 * Transcription settings for the subtitle panel's “Generate subtitles” (prototype glossary-tool.jsx `AsrHintBlock`, and the speech model and language in tool-transcribe.jsx):
 * language (automatic or specified), speech model, and recognition hints (the transcription glossaries enabled for the video, plus the custom prompt; whether they can be used is decided by this model's `acceptsHint`).
 *
 * The defaults equal setting nothing: when no model is picked, `provider` / `model` are not sent (the Runtime picks by the user's default, then the factory default; if neither exists, it still rejects with
 * `CAPABILITY_NOT_CONFIGURED` and gives a next step); when the language is automatic, `language` is not sent; the glossary is never sent explicitly, and the Runtime reads the ones enabled for the video
 * (`glossaries.transcribe` from `library.getVideoSelection`). So leaving the settings alone and pressing 「生成字幕」 directly behaves exactly as before.
 */

/** The limit on the hint (prompt + terms), the same as `hint` in `models.transcribe` (the Runtime's `TRANSCRIBE_HINT_MAX_CHARS`). */
export const TRANSCRIBE_HINT_MAX = 1200;

export interface TranscribeSetup {
  /** Empty string means automatic detection. */
  language: string;
  /** The chosen model (`providerId/modelId`); null means follow the default. */
  model: string | null;
  /** Custom prompt. */
  prompt: string;
}

export const DEFAULT_TRANSCRIBE_SETUP: TranscribeSetup = { language: '', model: null, prompt: '' };

export type TranscribeModelOption = ToolModelOption<TranscribeModelInfo>;

/** Model packs on remote nodes: nodes that are not connected and model packs that are unavailable are listed too, with the reason. */
function nodeOptions(view: ModelCapabilitiesView): TranscribeModelOption[] {
  return view.transcribe.providers
    .filter((p) => p.kind === 'node')
    .flatMap((p) =>
      p.models.map((info) => {
        const why = !p.available
          ? (localizeText(p.detail, p.detailRef) ?? M.notConnected)
          : info.available === false
            ? (localizeText(info.detail, info.detailRef) ?? M.unavailable)
            : null;
        return {
          key: modelKeyOf(p.providerId, info.modelId),
          providerId: p.providerId,
          provider: p.label,
          modelId: info.modelId,
          label: info.label || info.modelId,
          connected: true,
          usable: why === null,
          why,
          info,
        };
      }),
    );
}

/** Speech models that can be picked: local model packs, remote nodes, and cloud (all connected ones are listed; for those not connected, only the first is listed, using the same rule as the tool page). */
export function transcribeModelOptions(view: ModelCapabilitiesView): TranscribeModelOption[] {
  return [...transcribeOptions(view, 'local'), ...nodeOptions(view), ...cloudModelOptions(view, 'transcribe')];
}

export interface PickedModel {
  /** The model used this time; null when none is picked and there is no default (or the default is not on the list). */
  option: TranscribeModelOption | null;
  /** Whether the user picked it (so `provider` / `model` must be sent); false when following the default. */
  explicit: boolean;
}

/** Which one is used this time: the one picked, if it is still on the list; otherwise the default (the view's `effective`). */
export function pickModel(options: readonly TranscribeModelOption[], picked: string | null, effective: ModelRef | null): PickedModel {
  const chosen = picked ? options.find((o) => o.key === picked) : undefined;
  if (chosen) return { option: chosen, explicit: true };
  const key = effective ? modelKeyOf(effective.providerId, effective.modelId) : null;
  return { option: options.find((o) => o.key === key) ?? null, explicit: false };
}

/** Language dropdown: automatic detection plus the languages this model recognizes (when not restricted, the common ones are listed). */
export function languageChoices(option: TranscribeModelOption | null): LanguageOption[] {
  return languageOptions(option?.info.languages ?? 'any', M.autoDetect);
}

/** Whether this model recognizes the selected language; when the model changes and it no longer does, it returns to automatic (the Runtime rejects languages it does not support). */
export function effectiveLanguage(language: string, option: TranscribeModelOption | null): string {
  return language && languageChoices(option).some((l) => l.key === language) ? language : '';
}

/** Why the recognition hint section cannot be used; null when it can be used. */
export function hintBlock(option: TranscribeModelOption | null, options: readonly TranscribeModelOption[] = []): string | null {
  if (!option) return M.hintNoModel;
  if (option.info.acceptsHint) return null;
  const alt = options.find((o) => o.usable && o.info.acceptsHint);
  return M.hintUnsupported(option.label, alt ? alt.label : null);
}

/** Truncates by UTF-16 length (the `hint` limit is checked by string length), without splitting a surrogate pair. */
function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  let out = '';
  for (const ch of text) {
    if (out.length + ch.length > max) break;
    out += ch;
  }
  return out;
}

export type TranscribeOptions = Pick<TranscribeParams, 'provider' | 'model' | 'language' | 'hint'>;

/**
 * Options passed to the transcription flow (`transcribe` in `pipelines.start`), apart from `videoId` / `assetId`. Only values that differ from the default are included: the model picked,
 * the specified language (asserted, the same as the command-line `--language`), and the prompt that this model can accept. The glossary is not included; the Runtime uses the one enabled for the video.
 */
export function transcribeRequestOptions(setup: TranscribeSetup, picked: PickedModel): TranscribeOptions {
  const { option, explicit } = picked;
  const language = effectiveLanguage(setup.language, option);
  const prompt = setup.prompt.trim();
  return {
    ...(explicit && option ? { provider: option.providerId, model: option.modelId } : {}),
    ...(language ? { language } : {}),
    ...(prompt && option?.info.acceptsHint ? { hint: clip(prompt, TRANSCRIBE_HINT_MAX) } : {}),
  };
}

export interface HintBudget {
  /** Character count of the prompt. */
  custom: number;
  /** Number of terms (in canonical form) composed into the hint, and the number that do not fit. */
  terms: number;
  dropped: number;
  /** Character count after composing. */
  chars: number;
}

/**
 * How long the prompt plus the glossary is once composed (copied from the Runtime's `composeTranscribeHint`: canonical spellings de-duplicated and kept in glossary order; the first term follows the prompt after a line break,
 * and later ones are separated by 、; anything over the limit is dropped). The UI uses it to show “what is sent to the model”; the Runtime does the actual composing.
 */
export function hintBudget(prompt: string, glossaries: readonly Pick<TranscriptionGlossary, 'terms'>[], max = TRANSCRIBE_HINT_MAX): HintBudget {
  const seen = new Set<string>();
  const canonical: string[] = [];
  for (const g of glossaries) {
    for (const t of g.terms) {
      if (seen.has(t.canonical)) continue;
      seen.add(t.canonical);
      canonical.push(t.canonical);
    }
  }
  const base = clip(prompt.trim(), max);
  let hint = base;
  let terms = 0;
  for (const term of canonical) {
    // i18n-ignore: Hint composed for the speech model, formatted per the Runtime's composeTranscribeHint (、-separated), not UI text
    const next = hint ? (terms === 0 ? `${hint}\n${term}` : `${hint}、${term}`) : term;
    if ([...next].length > max) break;
    hint = next;
    terms++;
  }
  return { custom: [...base].length, terms, dropped: canonical.length - terms, chars: [...hint].length };
}

/** The budget line (`gls-asr__sum` in the prototype's `AsrHintBlock`). */
export function budgetLine(model: string, budget: HintBudget): string {
  return M.budget(model, budget, TRANSCRIBE_HINT_MAX);
}

/** The contents of one glossary in the library: `undefined` while still loading, null when it cannot be read. */
export type GlossaryContentState = TranscriptionGlossary | null | undefined;

export interface TranscribeGlossaryRow {
  id: Id;
  name: string;
  /** Enabled for this video (`glossaries.transcribe`). */
  enabled: boolean;
  /** Usable for transcription: enabled, still in the library, and a transcription glossary. */
  used: boolean;
  /** The line below the checkbox: applicable languages and entry count, or the reason it cannot be used. */
  meta: string;
}

/**
 * Rows of the “Glossary” section: all transcription glossaries in the library are listed (checked = enabled for this video). Glossaries that are enabled but cannot be used this time (no longer in the library, or translation glossaries)
 * are also listed, checked, with the reason written; the Runtime skips them in the same way when it merges the glossaries enabled for the video. Enabled ones come first, in the order they were enabled (earlier ones get priority in the hint),
 * and non-enabled ones keep their order in the library. The Runtime does not pick glossaries by language; here only the applicable languages are written out.
 */
export function transcribeGlossaryRows(
  library: readonly Pick<LibraryEntrySummary, 'id' | 'name' | 'kind' | 'termCount'>[],
  contents: Record<Id, GlossaryContentState>,
  enabled: readonly Id[],
): TranscribeGlossaryRow[] {
  const byId = new Map(library.map((e) => [e.id, e]));
  const row = (id: Id, on: boolean): TranscribeGlossaryRow => {
    const entry = byId.get(id);
    if (!entry) return { id, name: id, enabled: on, used: false, meta: M.glossaryGone };
    if (entry.kind !== 'transcription') return { id, name: entry.name, enabled: on, used: false, meta: M.glossaryTranslation };
    const content = contents[id];
    const terms = content ? content.terms.length : entry.termCount;
    const language = content === undefined ? null : content ? (content.language ? langName(content.language) : M.anyLanguage) : null;
    const count = terms === undefined ? null : M.termCount(terms);
    return { id, name: entry.name, enabled: on, used: on, meta: [language, count].filter(Boolean).join(' · ') };
  };
  const rest = library.filter((e) => e.kind === 'transcription' && !enabled.includes(e.id)).map((e) => row(e.id, false));
  return [...enabled.map((id) => row(id, true)), ...rest];
}

/** Summary line when collapsed: language · model · recognition hint. */
export function setupSummary(setup: TranscribeSetup, picked: PickedModel, glossaries: number, hintBlocked: boolean): string {
  const language = effectiveLanguage(setup.language, picked.option);
  const model = !picked.option ? M.noDefaultModel : picked.explicit ? picked.option.label : M.defaultModel(picked.option.label);
  const parts = [language ? langName(language) : M.autoDetectLanguage, model];
  if (!hintBlocked) {
    if (glossaries) parts.push(M.glossaries(glossaries));
    if (setup.prompt.trim()) parts.push(M.hasPrompt);
  }
  return parts.join(' · ');
}

/** The line below the model: whether it follows the default, which languages it recognizes, whether it accepts hints; the reason is written when it cannot be used. */
export function modelFacts(picked: PickedModel): string {
  const { option, explicit } = picked;
  if (!option) return M.noDefaultFacts;
  if (!option.usable) return option.why ?? M.modelUnusable;
  const facts = `${languagesShort(option.info.languages)} · ${option.info.acceptsHint ? M.acceptsHint : M.noHint}`;
  return explicit ? facts : M.followDefault(facts);
}
