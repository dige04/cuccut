/**
 * Creative template (template package spec docs/spec/template-spec.md): the video-making template used by the “Templates” entry on the Home start page. A template is a directory `templates/<id>/`, containing the manifest `template.json`, the prompt body `prompt.md`, and optionally a cover `cover.*`, a preview `preview.*`, and materials under `assets/`.
 *
 * This file holds the manifest types, value sets and dependency-free check functions. It ships with the main entry into the UI and does not use zod. The zod schemas used for validation are in `template-schemas.ts`, exported through `@cuccut/protocol/schemas`.
 */

import { DEFAULT_LOCALE, LOCALES, localeOfTag, type Locale } from './i18n.ts';
import { ProtocolValidation as V } from './messages/protocol/protocol-validation.ts';

/** Manifest format version (the `schema` field). A version not recognized causes the whole file to be skipped (spec §2.3). */
export const TEMPLATE_SCHEMA_VERSION = 1;

/** File names of the manifest and the prompt. */
export const TEMPLATE_MANIFEST_FILE = 'template.json';
export const TEMPLATE_PROMPT_FILE = 'prompt.md';
/** Asset directory: all manifest `assets[].path` entries are under it. */
export const TEMPLATE_ASSETS_DIR = 'assets';
/** Translation directory (spec §3.6): `locales/<language>.json` is the copy, `locales/<language>.md` is the prompt. File names use the lowercase shipped-language code. */
export const TEMPLATE_LOCALES_DIR = 'locales';

/**
 * Two kinds of template (spec §1.2):
 * - `scene`: a scene template. It gives a creative direction, a default aspect ratio and a default duration. When used, the agent first guides the user through a brief, and only produces the video after confirmation.
 * - `example`: a work example. A complete prompt. Selecting it puts it straight into the input box and skips the brief.
 */
export const TEMPLATE_KINDS = ['scene', 'example'] as const;
export type TemplateKind = (typeof TEMPLATE_KINDS)[number];

/** Category by subject matter, shared by both kinds of template (spec §3.2). Display names are provided by the UI. */
export const TEMPLATE_CATEGORIES = [
  'marketing',
  'product-launch',
  'explainer',
  'news-data',
  'editing',
  'creative-short',
  'motion-design',
] as const;
export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

export const TEMPLATE_SOURCES = ['official', 'community'] as const;
export type TemplateSource = (typeof TEMPLATE_SOURCES)[number];

/** Default aspect ratio. When omitted, the agent decides. */
export const TEMPLATE_RATIOS = ['16:9', '9:16', '1:1'] as const;
export type TemplateRatio = (typeof TEMPLATE_RATIOS)[number];

/** Default duration (seconds): the same set of values as the Home duration slider, 5–600 seconds in steps of 5. */
export const TEMPLATE_DURATION_MIN = 5;
export const TEMPLATE_DURATION_MAX = 600;
export const TEMPLATE_DURATION_STEP = 5;

/** Background color of the placeholder cover. */
export const TEMPLATE_TONES = ['blue', 'orange', 'green', 'purple', 'cyan', 'indigo', 'magenta', 'seafoam', 'brown'] as const;
export type TemplateTone = (typeof TEMPLATE_TONES)[number];

/** How the shape on the placeholder cover is drawn. */
export const TEMPLATE_FIGURES = ['bars', 'ring', 'cards', 'steps'] as const;
export type TemplateFigure = (typeof TEMPLATE_FIGURES)[number];

/** Material kinds distributed with the template, and their allowed extensions (lowercase). */
export const TEMPLATE_ASSET_TYPES = ['image', 'svg', 'audio', 'video'] as const;
export type TemplateAssetType = (typeof TEMPLATE_ASSET_TYPES)[number];
export const TEMPLATE_ASSET_EXTENSIONS: Readonly<Record<TemplateAssetType, readonly string[]>> = {
  image: ['png', 'jpg', 'jpeg', 'webp', 'gif'],
  svg: ['svg'],
  audio: ['mp3', 'm4a', 'aac', 'wav', 'ogg', 'flac'],
  video: ['mp4', 'webm', 'mov'],
};
/** Allowed extensions for cover images and preview videos. */
export const TEMPLATE_COVER_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'svg'] as const;
export const TEMPLATE_PREVIEW_EXTENSIONS = ['mp4', 'webm'] as const;

/** Limits for copy and lists (character counts are measured in UTF-16 code units). */
export const TEMPLATE_LIMITS = {
  id: 64,
  title: 40,
  summary: 80,
  description: 400,
  /** The scene `brief`: the paragraph filled into the input box when the template is chosen. */
  brief: 400,
  /** Maximum number of fill-in slots (`fields`), and the limits for each one's label, hint and example. */
  fields: 8,
  fieldLabel: 24,
  fieldHint: 80,
  fieldExample: 80,
  /** Maximum number of suggested craft entries to read first (`skills`), and the limit for each id. */
  skills: 4,
  skill: 64,
  kicker: 24,
  beat: 60,
  beatsMin: 3,
  beatsMax: 5,
  tags: 8,
  tag: 24,
  assets: 64,
  note: 200,
  /** Limit for `prompt.md` (bytes, UTF-8). */
  promptBytes: 16 * 1024,
} as const;

/**
 * Size limit for cover images and preview videos (bytes, spec §3.3). Templates ship with the app. The preview is only a compressed illustration, and the cover is only a thumbnail.
 */
export const TEMPLATE_FILE_MAX_BYTES = {
  cover: 150 * 1024,
  preview: 2 * 1024 * 1024,
} as const;

/** Conclusion of a verification record (spec §3.5). */
export const TEMPLATE_VERIFICATION_OUTCOMES = ['pass', 'partial', 'fail'] as const;
export type TemplateVerificationOutcome = (typeof TEMPLATE_VERIFICATION_OUTCOMES)[number];

/**
 * Capabilities that were missing during verification and therefore degraded or skipped (spec §3.5). `transcribe`, `synthesizeSpeech`, `generateImage`, `generateText` and `generateMusic` share names with the model service's capabilities. Video and sound-effect generation have no matching Provider yet, so their names are reserved here.
 */
export const TEMPLATE_VERIFICATION_CAPABILITIES = [
  'transcribe',
  'synthesizeSpeech',
  'generateImage',
  'generateText',
  'generateVideo',
  'generateMusic',
  'generateSoundEffect',
] as const;
export type TemplateVerificationCapability = (typeof TEMPLATE_VERIFICATION_CAPABILITIES)[number];

/** Length limit for verification record copy. */
export const TEMPLATE_VERIFICATION_LIMITS = {
  engine: 32,
  input: 4000,
  materials: 16,
  materialTitle: 120,
  materialUrl: 500,
  materialLicense: 60,
  materialNote: 200,
  notes: 1000,
} as const;

/** Template id: starts with a lowercase letter; contains lowercase letters, digits and single hyphens; equals the directory name. */
export const TEMPLATE_ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

/** A craft id in `skills` (repo root `skills/cuccut/built-in-skills/<id>`): the same kebab-case as template ids. */
export const TEMPLATE_SKILL_ID_PATTERN = TEMPLATE_ID_PATTERN;

/**
 * Fill-in slot (spec §3.1, §5.5): a place in the template text marked `{{label}}` for the user to fill in. In a scene it is written in `brief`; in an example it is written in `prompt.md`.
 */
export interface TemplateField {
  /** Name in the placeholder, unique within the template. Does not contain `{`, `}` or newlines. */
  label: string;
  /** “What to fill in”, shown to the user. */
  hint?: string;
  /** Example value. Substituting it into the placeholder gives a sample sentence of the form “you can say it like this”. */
  example?: string;
}

export interface TemplateCover {
  /** Cover image: the `cover.<ext>` in the template directory. When absent, the UI draws a placeholder cover using the three fields below. */
  file?: string;
  tone?: TemplateTone;
  figure?: TemplateFigure;
  /** Small text in the top-left corner of the cover. */
  kicker?: string;
}

export interface TemplatePreview {
  /** Preview video: the `preview.<ext>` in the template directory. */
  file?: string;
  /** 3–5 storyboard points. Placeholder frames that rotate when there is no preview video. For display only; not concatenated into the prompt. */
  beats?: string[];
}

export interface TemplateAsset {
  /** Relative path under `assets/`. */
  path: string;
  type: TemplateAssetType;
  /** What this material is for. Shown to the user, and also handed to the agent along with the prompt. */
  note: string;
}

/** A public material used during verification: its source and license. The material itself is not distributed with the template. */
export interface TemplateVerificationMaterial {
  title: string;
  /** The https address of the material's page. */
  url: string;
  /** License, for example `CC0-1.0`, `Public-Domain`, or the material site's own license name. */
  license: string;
  note?: string;
}

/**
 * Verification record (spec §3.5): a real agent made one video with this template, and the input, conditions and result were recorded. `preview.file` and `cover.file` usually come from this run's finished cut. For maintenance and display only; not concatenated into the prompt.
 */
export interface TemplateVerification {
  /** Date of verification, `YYYY-MM-DD`. */
  date: string;
  /** Which template version was run (if the template is later changed after problems are found, `version` will be newer than this). */
  version: string;
  /** Agent engine, for example `codex`. */
  engine: string;
  /** Message given to the agent. For a scene, it is the user message. For an example, write “as in the prompt” or a description of the changes. */
  input: string;
  materials: TemplateVerificationMaterial[];
  /** Capabilities that were missing and therefore degraded or skipped. */
  capabilities: TemplateVerificationCapability[];
  outcome: TemplateVerificationOutcome;
  /** Measured aspect ratio of the finished cut (`W:H`, reduced by GCD) and duration (seconds). May be omitted when the result is `fail` and there is no finished cut. */
  output?: { ratio: string; durationSeconds: number };
  /** Problems found, and changes made to the template. */
  notes: string;
}

export interface TemplateManifest {
  schema: typeof TEMPLATE_SCHEMA_VERSION;
  id: string;
  /** The template's own version, semver. */
  version: string;
  kind: TemplateKind;
  title: string;
  /** One-sentence line on the card. */
  summary: string;
  /** A short paragraph in the details. */
  description: string;
  /**
   * Language tag (BCP 47) of the copy (title, summary, description, brief, fields, beats, prompt.md). This is not the language of the finished cut.
   * Copy in other languages is in `locales/` (spec §3.6). A manifest from `templates.*` has already been switched to the chosen language, and this field changes to match it.
   */
  language: string;
  category: TemplateCategory;
  /** Defaults to auto. Required for scene. */
  ratio?: TemplateRatio;
  /** Defaults to auto. Required for scene. */
  durationSeconds?: number;
  /**
   * The paragraph filled into the input box when the template is chosen: in the user's voice, one to three sentences, with `{{label}}` marking the fill-in slots. Required for scene, and must not be present for example (an example's fill-in slots are written directly in `prompt.md`).
   */
  brief?: string;
  /** Fill-in slots. Every placeholder in `brief` (scene) or `prompt.md` (example) must be declared here, and every declared item must be referenced. */
  fields?: TemplateField[];
  /** Craft to read first when making this kind of finished cut (`skills/cuccut/built-in-skills/<id>`). */
  skills?: string[];
  author: string;
  source: TemplateSource;
  /** SPDX license identifier. */
  license: string;
  tags: string[];
  cover: TemplateCover;
  preview: TemplatePreview;
  assets?: TemplateAsset[];
  /** Most recent verification record. */
  verification?: TemplateVerification;
}

/**
 * Translation for one language (`locales/<language>.json`, spec §3.6). Copy only. Language-independent fields (kind, category, aspect ratio, duration, skills, files, verification record) are inherited from `template.json`. A scene must give `brief`, and an example must not. The number of items in `fields` and `beats` is the same as in `template.json`, matched one-to-one in order. `kicker` and material `note` are inherited from `template.json` when not given.
 */
export interface TemplateTranslation {
  title: string;
  summary: string;
  description: string;
  brief?: string;
  fields?: TemplateField[];
  tags: string[];
  cover?: { kicker?: string };
  preview?: { beats?: string[] };
  /** Translation of a material's usage note. `path` is a material registered in `template.json`. */
  assets?: { path: string; note: string }[];
}

/** The two translation files for one language: `locales/<language lowercase>.json` and `.md`. */
export function templateTranslationFiles(locale: Locale): { text: string; prompt: string } {
  const stem = `${TEMPLATE_LOCALES_DIR}/${locale.toLowerCase()}`;
  return { text: `${stem}.json`, prompt: `${stem}.md` };
}

/** Which language and which translation of it a file under `locales/` is. null when it is not `<shipped language lowercase>.json|md`. */
export function templateTranslationFile(file: string): { locale: Locale; part: 'text' | 'prompt' } | null {
  const match = new RegExp(`^${TEMPLATE_LOCALES_DIR}/([a-z-]+)\\.(json|md)$`).exec(file);
  const locale = match ? LOCALES.find((l) => l.toLowerCase() === match[1]) : undefined;
  return locale ? { locale, part: match![2] === 'json' ? 'text' : 'prompt' } : null;
}

/**
 * Picks a template's language version by UI language (spec §3.6). First, the same shipped language; then another spelling of the same primary language (when Traditional has no translation, Simplified is used, and vice versa); then English; and when none exist, `template.json` itself. Returns the translation language to use. null means use `template.json`.
 */
export function pickTemplateLanguage(baseLanguage: string, translations: readonly Locale[], wanted: string | null | undefined): Locale | null {
  const base = localeOfTag(baseLanguage);
  const want = localeOfTag(wanted);
  const primary = (locale: Locale) => locale.split('-')[0];
  const candidates = want ? [want, ...LOCALES.filter((l) => l !== want && primary(l) === primary(want))] : [];
  for (const locale of [...candidates, DEFAULT_LOCALE]) {
    if (locale === base) return null;
    if (translations.includes(locale)) return locale;
  }
  return null;
}

/** Applies one language's translation to the manifest: the copy is replaced with the translation, `language` is changed to it, and other fields are unchanged. */
export function localizeTemplateManifest(manifest: TemplateManifest, locale: Locale, translation: TemplateTranslation): TemplateManifest {
  const notes = new Map((translation.assets ?? []).map((a) => [a.path, a.note]));
  return {
    ...manifest,
    language: locale,
    title: translation.title,
    summary: translation.summary,
    description: translation.description,
    ...(translation.brief != null ? { brief: translation.brief } : {}),
    ...(translation.fields ? { fields: translation.fields } : {}),
    tags: translation.tags,
    cover: { ...manifest.cover, ...(translation.cover?.kicker != null ? { kicker: translation.cover.kicker } : {}) },
    preview: { ...manifest.preview, ...(translation.preview?.beats ? { beats: translation.preview.beats } : {}) },
    ...(manifest.assets ? { assets: manifest.assets.map((a) => ({ ...a, note: notes.get(a.path) ?? a.note })) } : {}),
  };
}

/**
 * A problem with a file path inside a template (spec §4.1). Returns null when compliant. Only relative paths inside the directory are accepted: forward-slash separated, not starting with `/` or a drive letter, and not containing `..`, `.`, empty segments, backslashes or control characters.
 */
export function templatePathProblem(path: string): string | null {
  if (!path) return V.pathEmpty().text;
  if (path.length > 200) return V.pathTooLong().text;
  if (/[\\\u0000-\u001f]/.test(path)) return V.pathBadChars().text;
  if (path.startsWith('/') || /^[A-Za-z]:/.test(path) || path.startsWith('~')) return V.templatePathRelative().text;
  if (path.split('/').some((seg) => seg === '' || seg === '.' || seg === '..')) return V.pathBadSegments().text;
  return null;
}

// ---- Fill-in slots (spec §5.5) ----

/** One placeholder: `{{label}}`. The label does not contain braces or newlines, and is not empty. */
const TEMPLATE_SLOT = /\{\{([^{}\n]+)\}\}/g;

/** Placeholder labels in the text, in order of appearance (repeated ones are listed each time). */
export function templateSlots(text: string): string[] {
  return [...text.matchAll(TEMPLATE_SLOT)].map((m) => m[1]!);
}

/** Replaces each placeholder with the result of `fill(label)`. Text that is not a placeholder is kept as is. */
export function replaceTemplateSlots(text: string, fill: (label: string) => string): string {
  return text.replace(TEMPLATE_SLOT, (_whole, label: string) => fill(label));
}

/**
 * Example sentence (spec §5.5): replaces each placeholder with that item's `example`. Where there is no example (or none is declared), the label itself is used.
 * A scene uses `brief`, and an example uses `prompt.md`.
 */
export function templateExampleText(text: string, fields: readonly TemplateField[] = []): string {
  const examples = new Map(fields.map((f) => [f.label, f.example ?? f.label]));
  return replaceTemplateSlots(text, (label) => examples.get(label) ?? label);
}

/**
 * Fill-in slots left unfilled at send time (spec §5.5): each placeholder is replaced with “[label]” in the message, and the agent asks about them as missing brief items.
 */
export function templateUnfilledText(text: string): string {
  return replaceTemplateSlots(text, (label) => `[${label}]`);
}

/**
 * Places where the text does not match the fill-in declarations (spec §3.1). An empty array when compliant. Every `{{…}}` in the text must correspond to a declared label, and every declared item must be referenced at least once. A `{{` that cannot be split into a placeholder also counts as a problem. Pass `brief` for a scene and `prompt.md` for an example.
 */
export function templateSlotProblems(text: string, fields: readonly TemplateField[] = []): string[] {
  const problems: string[] = [];
  const declared = new Set(fields.map((f) => f.label));
  const used = templateSlots(text);
  for (const label of new Set(used)) if (!declared.has(label)) problems.push(V.templateSlotUndeclared({ label }).text);
  for (const label of declared) if (!used.includes(label)) problems.push(V.templateFieldUnused({ label }).text);
  if (replaceTemplateSlots(text, () => '').includes('{{')) problems.push(V.templateSlotUnclosed().text);
  return problems;
}

/**
 * Placeholder problems in `prompt.md` (spec §2.2). For an example, the body is the text put into the input box, and its placeholders must match `fields`. For a scene, the body is production instructions for the agent and must not contain `{{` (fill-in slots are written in `brief`).
 */
export function templatePromptSlotProblems(manifest: Pick<TemplateManifest, 'kind' | 'fields'>, prompt: string): string[] {
  if (manifest.kind === 'scene') return prompt.includes('{{') ? [V.templateScenePromptSlots().text] : [];
  return templateSlotProblems(prompt, manifest.fields ?? []);
}

/** Lowercase extension. An empty string when there is none. */
export function templateFileExtension(path: string): string {
  const name = path.slice(path.lastIndexOf('/') + 1);
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
}

/** Whether the `schema` that was read is one this version recognizes. A template not recognized is skipped entirely, without dragging down the whole directory. */
export function isSupportedTemplateSchema(value: unknown): value is typeof TEMPLATE_SCHEMA_VERSION {
  return value === TEMPLATE_SCHEMA_VERSION;
}

// ---- Template directory (`templates.*`, template package spec §6, §8) ----

/** Where a template comes from: the built-in directory shipped with the app, or the user's own `templates/` under the Runtime Home. Unrelated to the manifest's `source`. */
export const TEMPLATE_ORIGINS = ['builtin', 'user'] as const;
export type TemplateOrigin = (typeof TEMPLATE_ORIGINS)[number];

/**
 * Reasons a template is skipped (spec §6):
 * - `unsupported-schema`: `schema` is missing or not recognized;
 * - `invalid`: the manifest, `prompt.md` or a file in the directory is non-compliant (including an id that does not match the directory name, a path that escapes the directory, symbolic links, and unregistered files);
 * - `duplicate-id`: two templates in the same source have the same id. Both are skipped;
 * - `builtin-conflict`: a template in the user directory has the same id as a built-in template. The user's copy is skipped, and the built-in one is still provided.
 */
export const TEMPLATE_DIAGNOSTIC_CODES = ['unsupported-schema', 'invalid', 'duplicate-id', 'builtin-conflict'] as const;
export type TemplateDiagnosticCode = (typeof TEMPLATE_DIAGNOSTIC_CODES)[number];

/** A template directory that could not be loaded. */
export interface TemplateDiagnostic {
  code: TemplateDiagnosticCode;
  origin: TemplateOrigin;
  /** Name of the template directory (expected to equal the id). */
  dir: string;
  /** Absolute path of the template directory, so the user can find it. */
  path: string;
  /** A one-sentence explanation for people. */
  message: string;
  /** Specific problems, one per item. May be empty. */
  issues: string[];
}

/** An available template in the directory: the manifest in the chosen language (spec §3.6), plus its source, optional language, and an overview of its accompanying files. */
export interface TemplateSummary {
  /** The manifest already switched to the chosen language. `manifest.language` is the language actually used. */
  manifest: TemplateManifest;
  origin: TemplateOrigin;
  /** Which language versions this template has. `language` from `template.json` comes first, and translations follow the order of `LOCALES`. */
  languages: string[];
  /** Whether it has a cover image and a preview video, and how many material items it has. The files are all obtained through `templates.openHandle`. */
  files: { cover: boolean; preview: boolean; assets: number };
}

export interface TemplateListResult {
  templates: TemplateSummary[];
  /** Skipped template directories. Only given in `templates.list`. */
  diagnostics: TemplateDiagnostic[];
}

export interface TemplateDetail {
  template: TemplateSummary;
  /** Full prompt text: `prompt.md`, or the chosen language's `locales/<language>.md`. */
  prompt: string;
}

/**
 * Scene template attached when a message is sent (`template` of `conversations.send`, spec §5.2). `version` is for reference only: the Runtime always uses the current version in the directory, and the version actually used is recorded on the message. `assets` are materials the user left (manifest `assets[].path`). When not given, all of them are attached; when given as an empty array, none are attached.
 */
export interface TemplateSendRef {
  id: string;
  version?: string;
  assets?: string[];
  /** Which language of the template copy to use (spec §3.6), usually the UI language. When not given, the Runtime's UI language is used. */
  language?: string;
}

/** Template marker on a user message. The conversation shows “Template: title”, without the prompt body. */
export interface TemplateMessageRef {
  id: string;
  /** The version actually used. */
  version: string;
  title: string;
  kind: TemplateKind;
  origin: TemplateOrigin;
}
