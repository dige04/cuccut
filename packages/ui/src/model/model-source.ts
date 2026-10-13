import { DEFAULT_MODELS_ENDPOINT, isModelScopeEndpoint, MODELSCOPE_ENDPOINT } from '@cuccut/protocol';
import { M } from './model-source-copy.ts';

/**
 * Download source for local models (architecture design §6.3 “来源” (source), §5.10 `models.downloadEndpoint`; design model-local-models.js `SOURCES` /
 * `sourceOf`, settings-local.jsx `SourceRow`). Settings › Local models › Download and storage, shared with Settings › General › Download source and offline.
 *
 * The three options write the same setting: Hugging Face stores null (the default source), ModelScope stores its base URL, and custom stores the mirror base URL entered. A stored value is matched back to its option by host,
 * so `https://huggingface.co` and `https://www.modelscope.cn`, which were earlier typed into the text box, still land on the matching option.
 * The environment variable `CUCCUT_MODELS_ENDPOINT` takes precedence over this setting; the Runtime does not tell the UI whether it is set, so it is only mentioned here.
 */

export const MODEL_SOURCE_COPY = M;

/** Environment variable name (same as `MODELS_ENDPOINT_ENV` in `@cuccut/models`). */
export const MODELS_ENDPOINT_ENV = 'CUCCUT_MODELS_ENDPOINT';
/** Example shown in the custom base URL box. */
export const MIRROR_PLACEHOLDER = 'https://mirror.example.com';

export type ModelSourceId = 'hf' | 'ms' | 'custom';

export interface ModelSourceItem {
  id: ModelSourceId;
  /** Option names: the two repositories are names and are not translated. */
  name: string;
  /** One line of small text below an option. */
  hint: string;
}

const HF_HOST = new URL(DEFAULT_MODELS_ENDPOINT).hostname;
const MS_HOST = new URL(MODELSCOPE_ENDPOINT).hostname.replace(/^www\./, '');

/** The three items in the picker, in the order of the design. */
export function modelSources(): ModelSourceItem[] {
  return [
    { id: 'hf', name: 'Hugging Face', hint: `${HF_HOST} · ${M.isDefault}` },
    { id: 'ms', name: 'ModelScope', hint: `${MS_HOST} · ${M.msHint}` },
    { id: 'custom', name: M.custom, hint: M.customHint },
  ];
}

/** Which option a stored base URL belongs to: unset (null or empty) or the root of the public model repository is Hugging Face; a host of ModelScope is ModelScope; anything else is custom. */
export function sourceOf(endpoint: string | null | undefined): ModelSourceId {
  const value = endpoint?.trim();
  if (!value) return 'hf';
  if (isModelScopeEndpoint(value)) return 'ms';
  try {
    const url = new URL(value);
    if ((url.hostname === HF_HOST || url.hostname === `www.${HF_HOST}`) && url.pathname.replace(/\/+$/, '') === '') return 'hf';
  } catch {
    // Not a URL: the contract does not allow such a value to be stored; if one exists anyway, show it as custom.
  }
  return 'custom';
}

/** The value to store when Hugging Face or ModelScope is picked. */
export function sourceEndpoint(id: 'hf' | 'ms'): string | null {
  return id === 'ms' ? MODELSCOPE_ENDPOINT : null;
}

/** The source name shown to people: the two repositories use their names; custom uses the host (if no host can be determined, the value is written as is). */
export function sourceLabel(endpoint: string | null | undefined): string {
  const id = sourceOf(endpoint);
  if (id === 'hf') return 'Hugging Face';
  if (id === 'ms') return 'ModelScope';
  try {
    return new URL(endpoint!.trim()).host;
  } catch {
    return endpoint!.trim();
  }
}

/** One-sentence description of an option (below the row name). */
export function sourceDesc(id: ModelSourceId): string {
  return id === 'hf' ? M.hfDesc : id === 'ms' ? M.msDesc : M.customDesc;
}

/** Text in the base URL box → value to store: trims leading and trailing whitespace and the trailing `/`; empty becomes null (not filled in yet). Whether it is valid is decided separately by `endpointProblem`. */
export function customEndpoint(text: string): string | null {
  const value = text.trim().replace(/\/+$/, '');
  return value === '' ? null : value;
}

/**
 * The supplementary note on the whole line below the picker, in order: the ModelScope fallback and check; where downloads actually come from now when “自定义” (custom) is picked but not yet saved; the environment variable takes precedence.
 * `picked` is the item on the picker (it may be the unsaved “自定义”), and `saved` is the stored base URL.
 */
export function sourceNotes(picked: ModelSourceId, saved: string | null | undefined): string[] {
  const notes: string[] = [];
  if (picked === 'ms') notes.push(M.msNote);
  if (picked === 'custom' && sourceOf(saved) !== 'custom') notes.push(M.pending(sourceLabel(saved)));
  notes.push(M.envNote(MODELS_ENDPOINT_ENV));
  return notes;
}
