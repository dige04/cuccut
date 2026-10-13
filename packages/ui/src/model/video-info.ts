import { live, type AssetRecord, type DocumentRecord, type Id, type Provenance, type Sequence, type SpaceEntry } from '@cuccut/protocol';
import { durationSeconds, formatFps } from './editor.ts';
import { assetFilePath } from './editor-ops.ts';
import { formatClock } from './format.ts';
import { measureText } from './space.ts';
import { readSpeechWords } from './speech-cues.ts';
import { transcriptParagraphs, transcriptWords } from './transcript-cut.ts';
import { M } from './video-info-copy.ts';

/**
 * Row assembly for the video details dialog (design mockup project-info.jsx, model-project-info.js). Pure functions; no React or Runtime.
 *
 * Both entry points share the same section rows: the ⓘ next to the editor's top-bar title, and “Video details…” on Space's video card and row. Rendering and “Copy all” share the same source as well:
 * every row visible on screen can be pasted out as is, and the copied text contains no row that is not on screen.
 *
 * Three rules from the mockup:
 * 1. A missing row is omitted entirely, with no placeholder. When all three content counts are 0, the “Content” row is omitted. An empty section drops its title too.
 * 2. Content and translations can only come from the editor path (they require reading the open video's transcript), and the caller passes them in as `extras`. The Space path only has entry records.
 * 3. Ellipses are for the eye only, not the clipboard: the hero's file name is truncated in the middle when shown, and copying takes the full value. The “Location” row is always the full path.
 *
 * Differences from the mockup:
 * - There is no “play count”: the source metadata recorded by a link import has no such item.
 * - “URL” is a read-only row in “Source info” (the original web page recorded by a link import), not an editable form field. Description and notes have nowhere to be stored, so the UI greys them out and says why,
 *   and they are not included in “Copy all” (the mockup's “Details” section).
 * - The source kind is written from the material's recorded `provenance.origin`. Unrecognized kinds are not written. The mockup's “Recording” has no matching source now.
 * - The mockup's “Location” is the source file. Here “Location” is the video directory. When the main material is the link's original file, an extra “Source file” row appears (for a download from a URL, it is in the downloads directory,
 *   not beside the video). Both rows carry `reveal`: on desktop, “Show in folder” sits at the end of the row. Material brought into the video directory is managed by CucCut, so it has no such row.
 *
 * The original title and original description in “Source info” are the platform's original text recorded at download time (`provenance.source.title`, `description`). The original title is omitted when it matches the video name
 * (the hero already shows it). The original description can be very long; it is marked `long`, shown in a height-limited box that scrolls, and copying still gives the full text.
 */

export interface InfoRow {
  label: string;
  value: string;
  /** Paths, IDs and URLs use a monospace font. */
  mono: boolean;
  /** Location on disk: “Show in folder” at the end of the row (when it can be handed to the system file manager). */
  reveal?: string;
  /** Long text (the original description): limited height, scrolls. */
  long?: boolean;
}

export interface InfoSection {
  title: string;
  rows: InfoRow[];
}

/** Number of characters the hero's second line (the source file name) fits in the dialog. */
export const HERO_NAME_MAX = 56;

/** Titles of the two sections: “Source and media”, “Source info”. */
export const VIDEO_INFO_SECTION: { media: string; source: string } = live(() => M.section);

const row = (label: string, value: string, mono = false, extra: Pick<InfoRow, 'reveal' | 'long'> = {}): InfoRow => ({ label, value, mono, ...extra });

const str = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value.trim() : null);

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** Middle truncation: keep the head and the tail and cut out the middle. The tail keeps the extension; the head keeps enough to tell what it is. Counted in characters (not UTF-16 code units). */
export function elideMiddle(value: string, max: number): string {
  const chars = Array.from(value);
  if (chars.length <= max || max < 4) return value;
  const tail = Math.floor((max - 1) / 3);
  const head = max - 1 - tail;
  return `${chars.slice(0, head).join('')}…${chars.slice(chars.length - tail).join('')}`;
}

/** `20260420` → `2026-04-20`. If it is not eight digits, null (the whole row is omitted; the format is not guessed). */
export function prettyDate(raw: unknown): string | null {
  if (typeof raw !== 'string' || !/^\d{8}$/.test(raw)) return null;
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6)}`;
}

/** The “Content” row: `3 speakers · 4 chapters · 62 segments`. Items that are 0 are omitted; when all are 0, the whole row is absent. */
export function contentsRow(speakers: number, chapters: number, paragraphs: number): InfoRow | null {
  const parts: string[] = [];
  if (speakers > 0) parts.push(M.speakers(speakers));
  if (chapters > 0) parts.push(M.chapters(chapters));
  if (paragraphs > 0) parts.push(M.paragraphs(paragraphs));
  return parts.length ? row(M.row.contents, parts.join(' · ')) : null;
}

/** The “Translations” row: the target languages of the translations, joined with “、”. Absent when there are no translations. */
export function translationRow(targets: readonly string[]): InfoRow | null {
  const names = targets.map((t) => t.trim()).filter(Boolean);
  return names.length ? row(M.row.translation, M.list(names)) : null;
}

/** Source kind (the material's `provenance.origin`). Returns null for unrecognized kinds rather than guessing. */
export function sourceKindLabel(origin: string | null | undefined): string | null {
  switch (origin) {
    case 'link-import':
    case 'user-import':
    case 'generated':
    case 'library':
      return M.sourceKind[origin];
    default:
      return null;
  }
}

export interface HeroSource {
  /** Source kind: URL import, local file, …. null when it is not recognized. */
  kind: string | null;
  /** Original file name at import time (full value). */
  fileName: string | null;
}

/** The copy form of the hero row: `本地文件 · talk.mp4` (local file · talk.mp4). The half that is missing is dropped; null when both are missing. */
export function heroLine(source: HeroSource | null): string | null {
  if (!source) return null;
  return [source.kind, source.fileName?.trim()].filter(Boolean).join(' · ') || null;
}

/** The source metadata recorded by a link import (`provenance.source`), passed through item by item. */
export interface LinkFacts {
  /** The title on the platform (recorded at download time; it does not change when the video is renamed). */
  title: string | null;
  /** The original description text on the platform. */
  description: string | null;
  uploader: string | null;
  /** Publish date, `YYYY-MM-DD`. */
  published: string | null;
  platform: string | null;
  /** The video ID on the platform. */
  mediaId: string | null;
  /** The original web page (or, if there is none, the link used for download). */
  url: string | null;
}

export function linkFacts(provenance: Pick<Provenance, 'origin' | 'source'> | null | undefined): LinkFacts | null {
  if (provenance?.origin !== 'link-import' || !isObject(provenance.source)) return null;
  const s = provenance.source;
  return {
    title: str(s.title),
    description: str(s.description),
    uploader: str(s.uploader),
    published: prettyDate(s.uploadDate),
    platform: str(s.platform),
    mediaId: str(s.mediaId),
    url: str(s.webpageUrl) ?? str(s.url),
  };
}

/**
 * The model used for transcription (`engine` in `cuccut.speech/1`): for online models, the model ID; for local models, the model pack (or the model family when there is no pack). The body of projects imported from older versions
 * has varying shapes; null when it is not recognized.
 */
export function speechModel(body: unknown): string | null {
  if (!isObject(body)) return null;
  const engine = body.engine;
  if (typeof engine === 'string') return str(engine);
  if (!isObject(engine)) return null;
  const asr = isObject(engine.models) && isObject(engine.models.asr) ? engine.models.asr : null;
  if (engine.backend === 'online') return str(asr?.revision) ?? str(engine.provider);
  return str(engine.bundleId) ?? str(asr?.family) ?? str(engine.model) ?? str(engine.provider);
}

/** The facts the read-only area needs. Missing ones are null, and the corresponding row is omitted entirely. */
export interface VideoInfoFacts {
  title: string;
  source: HeroSource | null;
  /** The full path of the video directory. */
  location: string | null;
  /** The original file of the main material (only for linked material; material brought into the video directory is managed by CucCut and gives no path). */
  file?: string | null;
  /** `duration · resolution · frame rate` (the Space path has only duration and resolution). */
  media: string | null;
  /** `model · language`. */
  transcript: string | null;
  link: LinkFacts | null;
}

export interface SnapshotInput {
  title: string;
  location: string | null;
  sequence: Sequence | null;
  /** The video and audio placed on the timeline, in order of first appearance (`mediaCandidates`); the first one is treated as the main material. */
  candidates: readonly { asset: AssetRecord; speech: DocumentRecord | null }[];
  /** The body of the first transcript (the first material that has one); undefined if not fetched yet. */
  speechBody: unknown;
  /** Language tag → name (`langName`); injected in tests so they do not depend on the runtime Intl. */
  languageName: (tag: string) => string;
}

/** The editor path: assembled from a snapshot of the open video. */
export function snapshotFacts(input: SnapshotInput): VideoInfoFacts {
  const { sequence, candidates } = input;
  const main = candidates[0]?.asset ?? null;
  const provenance = main?.revisions[main.currentRevision]?.provenance ?? null;
  const source: HeroSource | null = main
    ? { kind: sourceKindLabel(provenance?.origin), fileName: str(provenance?.importedFrom?.originalName) ?? str(main.name) }
    : null;
  const media = sequence
    ? [formatClock(durationSeconds(sequence), { tenths: true }), `${sequence.canvas.width}×${sequence.canvas.height}`, formatFps(sequence.fps)].join(' · ')
    : null;
  const speech = candidates.find((c) => c.speech)?.speech ?? null;
  const transcript = speech
    ? [speechModel(input.speechBody), speech.language ? input.languageName(speech.language) : null].filter(Boolean).join(' · ') || null
    : null;
  const file = main ? assetFilePath(main, input.location) : null;
  return { title: input.title, source, location: input.location, file, media, transcript, link: linkFacts(provenance) };
}

/** The Space path: only entry records are at hand; it does not open the video for the details dialog. Missing rows are omitted. */
export function entryFacts(entry: Pick<SpaceEntry, 'kind' | 'media'>, title: string, location: string | null): VideoInfoFacts {
  return { title, source: null, location, media: measureText(entry), transcript: null, link: null };
}

export interface ContentCounts {
  speakers: number;
  chapters: number;
  paragraphs: number;
}

/**
 * Content counts, using the same basis as the transcript panel. Speakers are summed over the number of speakers appearing in each transcript; segments are summed by the transcript panel's paragraphing; chapters are the chapter markers on the sequence.
 * Transcripts whose body has not been fetched yet are not counted for now.
 */
export function contentCounts(sequence: Sequence, sources: readonly { assetId: Id; body: unknown }[]): ContentCounts {
  let speakers = 0;
  let paragraphs = 0;
  for (const source of sources) {
    const read = source.body === undefined ? null : readSpeechWords(source.body);
    if (!read) continue;
    const words = transcriptWords(sequence, source.assetId, read.words);
    speakers += new Set(words.flatMap((w) => (w.speaker === undefined ? [] : [w.speaker]))).size;
    paragraphs += transcriptParagraphs(words).length;
  }
  const chapters = sequence.markers.filter((m) => m.kind === 'chapter').length;
  return { speakers, chapters, paragraphs };
}

/** The target languages of the translations (deduplicated, in order of appearance). */
export function translationTargets(documents: Record<Id, DocumentRecord>, languageName: (tag: string) => string): string[] {
  const tags: string[] = [];
  for (const record of Object.values(documents)) {
    if (record.kind === 'translation' && record.language && !tags.includes(record.language)) tags.push(record.language);
  }
  return tags.map(languageName);
}

/** The two extra rows on the editor path. Their order is the rendering order. */
export function editorExtras(counts: ContentCounts, targets: readonly string[]): InfoRow[] {
  return [contentsRow(counts.speakers, counts.chapters, counts.paragraphs), translationRow(targets)].filter((r): r is InfoRow => r !== null);
}

/** All sections of the read-only area. `extras` is attached to the end of “Source and media”; empty sections are dropped entirely. */
export function sections(facts: VideoInfoFacts, extras: readonly InfoRow[] = []): InfoSection[] {
  const media: InfoRow[] = [];
  if (facts.location) media.push(row(M.row.location, facts.location, true, { reveal: facts.location }));
  if (facts.file) media.push(row(M.row.file, facts.file, true, { reveal: facts.file }));
  if (facts.media) media.push(row(M.row.media, facts.media));
  if (facts.transcript) media.push(row(M.row.transcript, facts.transcript));
  media.push(...extras);

  const link = facts.link;
  const meta: InfoRow[] = [];
  if (link?.title && link.title !== facts.title.trim()) meta.push(row(M.row.title, link.title));
  if (link?.uploader) meta.push(row(M.row.channel, link.uploader));
  if (link?.published) meta.push(row(M.row.published, link.published));
  if (link?.platform) meta.push(row(M.row.platform, link.platform));
  if (link?.mediaId) meta.push(row(M.row.mediaId, link.mediaId, true));
  if (link?.url) meta.push(row(M.row.url, link.url, true));
  if (link?.description) meta.push(row(M.row.description, link.description, false, { long: true }));

  return [
    { title: VIDEO_INFO_SECTION.media, rows: media },
    { title: VIDEO_INFO_SECTION.source, rows: meta },
  ].filter((s) => s.rows.length > 0);
}

/** Plain text that can be pasted as is: the title and the hero, one line each; sections separated by a blank line; line breaks inside a value indented by two spaces. */
export function copyText(title: string, hero: string | null, list: readonly InfoSection[]): string {
  const lines: string[] = [];
  if (title.trim()) lines.push(title.trim());
  if (hero?.trim()) lines.push(hero.trim());
  for (const section of list) {
    lines.push('', section.title);
    for (const r of section.rows) lines.push(`${r.label}: ${r.value.replace(/\n/g, '\n  ')}`);
  }
  return `${lines.join('\n')}\n`;
}
