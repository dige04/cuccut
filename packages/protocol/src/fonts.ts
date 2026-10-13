import type { Id } from './domain.ts';
import type { MessageRef } from './message-ref.ts';

/**
 * On-demand fonts (architecture design §9.1): the app ships a Google Fonts catalogue (metadata only). For a family named by typesetting that is neither in the render kernel nor on this machine,
 * it is downloaded into the Runtime Home's font cache, in the weights this family actually has in the catalogue. Preview and finished-video export use the same file.
 *
 * Rules:
 * - Resolution order: fonts shipped with the kernel → fonts already installed on this machine → the download cache → download. When the family is present on this machine, it is not downloaded (for a family, only the local copy is trusted).
 * - Requests carry only the family name, weight, and italic style (the public CSS endpoint, no API key, no other information sent); files are fetched only from the configured file host (https).
 * - A downloaded file is placed in the cache only after it passes font-parsing checks (family name matches, size within the limit). The cache is named by "family, face, content digest"; writes go to a temporary file first and are then renamed. The cache index records the family, weight, italic style, license, digest, size, and download time, but not the download address.
 * - A download is a task (`kind: 'fontDownload'`; progress through the `jobs` topic; cancel with `jobs.cancel`); the same face is downloaded only once at a time.
 */

/** Font licenses: SIL Open Font License 1.1, Apache License 2.0, Ubuntu Font Licence 1.0. */
export type FontLicence = 'OFL-1.1' | 'Apache-2.0' | 'UFL-1.0';

/** Categories in the font catalogue. */
export type FontCategory = 'sans-serif' | 'serif' | 'display' | 'handwriting' | 'monospace';

export const FONT_CATEGORIES: readonly FontCategory[] = ['sans-serif', 'serif', 'display', 'handwriting', 'monospace'];

/**
 * When choosing a font by text: each category corresponds to which character subsets in the catalogue (`subsets`). Subsets not listed here belong to `other`.
 */
export const FONT_SCRIPT_SUBSETS = {
  chinese: ['chinese-simplified', 'chinese-traditional', 'chinese-hongkong'],
  japanese: ['japanese'],
  korean: ['korean'],
  latin: ['latin', 'latin-ext'],
  cyrillic: ['cyrillic', 'cyrillic-ext'],
  greek: ['greek', 'greek-ext'],
  vietnamese: ['vietnamese'],
  arabic: ['arabic'],
  hebrew: ['hebrew'],
  thai: ['thai'],
  devanagari: ['devanagari'],
} as const satisfies Record<string, readonly string[]>;

export type FontScript = keyof typeof FONT_SCRIPT_SUBSETS | 'other';

export const FONT_SCRIPTS: readonly FontScript[] = [...(Object.keys(FONT_SCRIPT_SUBSETS) as FontScript[]), 'other'];

/** Which categories of writing a group of character subsets belongs to (in the order of `FONT_SCRIPTS`). */
export function fontScriptsOf(subsets: readonly string[]): FontScript[] {
  const scripts = new Set<FontScript>();
  for (const subset of subsets) {
    const found = (Object.entries(FONT_SCRIPT_SUBSETS) as [FontScript, readonly string[]][]).find(([, list]) => list.includes(subset));
    scripts.add(found ? found[0] : 'other');
  }
  return FONT_SCRIPTS.filter((script) => scripts.has(script));
}

/**
 * The state of a family now:
 * - `built-in`: shipped with the render kernel (not downloaded; downloading it would not be used);
 * - `installed`: already installed on this machine (for a family, only the local copy is trusted; not downloaded);
 * - `downloaded`: the download cache has a face for it (`downloaded` lists which);
 * - `downloadable`: in the font catalogue, not yet downloaded;
 * - `downloading`: a download task is running (`job`);
 * - `failed`: the most recent download failed (`error`); it can be downloaded again;
 * - `unavailable`: not found anywhere (appears only when looked up by name).
 */
export type FontFamilyState = 'built-in' | 'installed' | 'downloaded' | 'downloadable' | 'downloading' | 'failed' | 'unavailable';

/** A weight and whether it is italic. */
export interface FontFaceStyle {
  weight: number;
  italic: boolean;
}

/** A face in the download cache (`fonts.downloaded`). The download address is not recorded. */
export interface DownloadedFontFace extends FontFaceStyle {
  family: string;
  licence: FontLicence;
  /** sha256 of the file content (hexadecimal). */
  sha256: string;
  sizeBytes: number;
  downloadedAt: string;
}

/** Error code of a failed download (the task's `error.code`, and also `error.code` in the `failed` state). */
export type FontDownloadErrorCode =
  /** Cannot connect, disconnected, timed out (also what happens when offline). */
  | 'FONT_DOWNLOAD_NETWORK'
  /** The font service returned an unsuccessful HTTP status (`details.status`), or the response did not contain a file for this face. */
  | 'FONT_DOWNLOAD_SOURCE'
  /** The download is not a usable font, the family name does not match, or it exceeds the size limit: the bad file has been deleted. */
  | 'FONT_DOWNLOAD_INTEGRITY'
  /** The disk was full when writing the cache. */
  | 'FONT_DOWNLOAD_NO_SPACE';

/** One item of `fonts.catalogue`: the family in the catalogue, the family shipped with the kernel, and the family on this machine, merged together. */
export interface FontFamilyStatus {
  family: string;
  state: FontFamilyState;
  /** The category in the font catalogue; null when not in the catalogue. */
  category: FontCategory | null;
  /** Character subsets (from the catalogue; empty when not in the catalogue). */
  subsets: string[];
  scripts: FontScript[];
  /** Weights with an upright face and weights with an italic face in the catalogue (empty when not in the catalogue). */
  weights: number[];
  italics: number[];
  variable: boolean;
  /** License; null when the family is unknown to this machine. */
  licence: FontLicence | null;
  /** Where this family comes from: shipped with the kernel, this machine, or the Google Fonts catalogue. */
  source: 'built-in' | 'local' | 'google-fonts';
  /** Faces present in the download cache. */
  downloaded: (FontFaceStyle & { sizeBytes: number })[];
  /** Download tasks in progress and their current progress (bytes; null when the total is unknown). */
  job: { jobId: Id; doneBytes: number; totalBytes: number | null } | null;
  /** The most recent download failure: error code and description (cleared after a new download or a successful download). */
  error: {
    code: FontDownloadErrorCode | 'CANCELLED';
    message: string;
    /** When `message` is a Runtime text, the message reference (message-ref.ts): the UI and CLI regenerate it in the current language. */
    messageRef?: MessageRef;
    at: string;
  } | null;
}

export interface FontsCatalogueParams {
  /** Find by family name (case-insensitive; substring match is enough). */
  query?: string;
  category?: FontCategory;
  script?: FontScript;
  /** Only these families (matched exactly by name, case-insensitive; names not found are given `unavailable`); when given, no pagination. */
  families?: string[];
  /** Only certain states. */
  states?: FontFamilyState[];
  offset?: number;
  /** Items per page (default 100, maximum 500). */
  limit?: number;
}

export interface FontsCatalogueResult {
  /** Total number of matches (before pagination). */
  total: number;
  families: FontFamilyStatus[];
  /** Generation date of the font catalogue. */
  catalogueDate: string;
}

/** Result of `fonts.download`: the faces to download and the task; when all are already downloaded (or already downloading), `jobId` is the task in progress, or null. */
export interface FontDownloadResult {
  family: string;
  /** Faces matched to the catalogue (the requested weight mapped to the weight this family actually has). */
  faces: FontFaceStyle[];
  jobId: Id | null;
  status: FontFamilyStatus;
}

/** Result of `fonts.remove` / `fonts.clear`. */
export interface FontRemoveResult {
  removed: DownloadedFontFace[];
  freedBytes: number;
  /** Faces still in use by an unfinished export that were not deleted this time (`fonts.clear`). */
  kept: DownloadedFontFace[];
}

/** The font format of the sample (identified by the file header, not by what the CSS claims). */
export type FontSampleFormat = 'truetype' | 'opentype' | 'woff' | 'woff2';

/**
 * Result of `fonts.sample`: only a font subset containing the characters in the family name, which the UI uses to draw the family name in that family's own look. When unavailable, `data` is null
 * (`reason` explains: strictly offline, not in the font catalogue), and the UI writes the family name in the interface font.
 */
export interface FontSampleResult {
  family: string;
  /** Characters in the subset (the family name with duplicate characters removed). */
  text: string;
  /** Font file (base64). */
  data: string | null;
  format: FontSampleFormat | null;
  reason?: 'offline-strict' | 'not-in-catalogue';
}

/** One family in `fonts.usage`: the faces used, its current state, and how the render kernel draws it now. */
export interface FontUsageFamily {
  family: string;
  /** Weights and italic style named by typesetting. */
  faces: FontFaceStyle[];
  status: FontFamilyStatus;
  /**
   * The family that substitutes when this family cannot be drawn now (the kernel's fallback family); null when the family is shipped with the kernel, installed on this machine, or present in the download cache.
   * When the download cache has only other weights, it is also null (the engine picks the nearest weight).
   */
  fallback: string | null;
}

export interface FontsUsageResult {
  /** Families used by the video (by family name). */
  families: FontUsageFamily[];
  /** The render kernel's fallback family (any missing characters are drawn with it). */
  fallback: string;
  /** The families started for download in this call when `download: true` (automatic download is on, not strictly offline, and no recent failure). */
  started: string[];
}
