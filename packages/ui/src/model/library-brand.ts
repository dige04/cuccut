import { defineMessages, type AssetRecord, type BrandContent, type BrandKind, type BrandMediaKind, type DocumentRecord, type Id, type LibrarySource, type Sequence } from '@cuccut/protocol';
import { placeBox, type VisualLayer } from './new-items.ts';
import { zhHans } from './library-brand.zh-Hans.ts';
import { zhHant } from './library-brand.zh-Hant.ts';
import { ja } from './library-brand.ja.ts';
import { ko } from './library-brand.ko.ts';
import { es } from './library-brand.es.ts';
import { fr } from './library-brand.fr.ts';
import { de } from './library-brand.de.ts';
import { nl } from './library-brand.nl.ts';
import { ptBR } from './library-brand.pt-BR.ts';
import { it } from './library-brand.it.ts';
import { ru } from './library-brand.ru.ts';
import { pl } from './library-brand.pl.ts';
import { tr } from './library-brand.tr.ts';
import { vi } from './library-brand.vi.ts';

/** Copy for the brand library model (English is the source for keys and types; translations are in `library-brand.zh-Hans.ts`). */
const en = {
  videoTitle: 'Videos',
  videoEmpty: 'No videos saved yet',
  videoHint: 'Intros, outros, transitions, and other video clips you use in every video.',
  imageTitle: 'Images',
  imageEmpty: 'No images saved yet',
  imageHint: 'Logos, QR codes, avatars, and other images you use often.',
  stickerTitle: 'Stickers',
  stickerEmpty: 'No stickers uploaded yet',
  stickerHint: 'Accepts images (PNG, WebP, GIF, JPG) and Lottie animations (.json or .lottie). The type is detected from the file contents, not the extension.',
  colorTitle: 'Brand colors',
  colorEmpty: 'No brand colors yet',
  colorHint: 'Brand colors appear in every color picker in the Inspector.',
  fontTitle: 'Brand fonts',
  fontEmpty: 'No brand fonts yet',
  fontHint: 'Accepts TTF, OTF, and WOFF2 (not WOFF). Adding one to a video copies it into the asset library.',
  captionStyleTitle: 'Subtitle styles',
  captionStyleEmpty: 'No subtitle styles saved yet',
  captionStyleHint: 'Save this video’s current subtitle style here and apply it to other videos in one click.',
  filterImages: 'Images',
  filterVideos: 'Videos',
  filterStickers: 'Images and Lottie animations',
  filterFonts: 'Fonts',
  untitled: 'Untitled',
  captionStyle: 'Subtitle style',
  lottie: 'Lottie animation',
  image: 'Image',
  noRevision: 'This asset has no usable version',
  embedded: 'This asset has already been copied into the video folder, so the original file isn’t available. Please add the original file from your computer.',
  styleEmpty: 'The subtitle style document is empty',
  styleNoSchema: 'The subtitle style document has no schema, so it can’t be saved to the brand kit',
  styleTooLarge: 'The subtitle style is larger than 64 KiB',
};
export type LibraryBrandMessages = typeof en;
const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });

/**
 * Pure model for Editor › Brand (product design §13.7, design draft designs/cuccut/app/panel-brand.jsx): videos, images, stickers, brand colors, fonts and caption styles in the brand library.
 * The brand library lives in the Runtime Home and is reused across videos (architecture design §5.9); when put into a video, a copy is taken, and later changes or deletions in the library do not affect the video.
 * Templates (`overlayTemplate`) keep only their kind; they are not handled here.
 */

export type BrandSectionKind = Exclude<BrandKind, 'overlayTemplate'>;

export interface BrandSection {
  kind: BrandSectionKind;
  title: string;
  empty: string;
  hint: string;
}

/** The order and descriptions of the sections (design draft: videos, images, stickers, brand colors, brand fonts, caption styles). */
export const BRAND_SECTIONS: readonly BrandSection[] = [
  {
    kind: 'video',
    get title() { return M.videoTitle; },
    get empty() { return M.videoEmpty; },
    get hint() { return M.videoHint; },
  },
  {
    kind: 'image',
    get title() { return M.imageTitle; },
    get empty() { return M.imageEmpty; },
    get hint() { return M.imageHint; },
  },
  {
    kind: 'sticker',
    get title() { return M.stickerTitle; },
    get empty() { return M.stickerEmpty; },
    get hint() { return M.stickerHint; },
  },
  {
    kind: 'color',
    get title() { return M.colorTitle; },
    get empty() { return M.colorEmpty; },
    get hint() { return M.colorHint; },
  },
  {
    kind: 'font',
    get title() { return M.fontTitle; },
    get empty() { return M.fontEmpty; },
    get hint() { return M.fontHint; },
  },
  {
    kind: 'captionStyle',
    get title() { return M.captionStyleTitle; },
    get empty() { return M.captionStyleEmpty; },
    get hint() { return M.captionStyleHint; },
  },
];

export const BRAND_MEDIA_KINDS: readonly BrandMediaKind[] = ['image', 'video', 'sticker', 'font'];

export function isBrandMediaKind(kind: string): kind is BrandMediaKind {
  return (BRAND_MEDIA_KINDS as readonly string[]).includes(kind);
}

/** File types in the open dialog (only narrows the candidates; the real type is judged by the Runtime from the content). */
export const BRAND_FILE_FILTERS: Record<BrandMediaKind, { name: string; extensions: string[] }[]> = {
  image: [{ get name() { return M.filterImages; }, extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }],
  video: [{ get name() { return M.filterVideos; }, extensions: ['mp4', 'mov', 'm4v', 'webm', 'mkv'] }],
  sticker: [{ get name() { return M.filterStickers; }, extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'json', 'lottie'] }],
  font: [{ get name() { return M.filterFonts; }, extensions: ['ttf', 'otf', 'woff2'] }],
};

/** Upper limit on names (consistent with the Runtime). */
export const BRAND_NAME_MAX = 200;

/** Trims leading and trailing whitespace from an entry name and truncates it to the limit (by characters, without splitting surrogate pairs). */
export function clipBrandName(name: string): string {
  return [...name.trim()].slice(0, BRAND_NAME_MAX).join('');
}

/** Default entry name for a local file: the file name without its extension. */
export function nameFromPath(path: string): string {
  const base = path.split(/[\\/]/).pop() ?? '';
  const name = base.replace(/\.[^.]+$/, '').trim() || base.trim();
  return [...name].slice(0, BRAND_NAME_MAX).join('') || M.untitled;
}

/** Brand colors accept only `#RRGGBB` or `#RRGGBBAA` (the Runtime stores them in uppercase). `#RGB` is expanded to six digits; null when invalid. */
export function normalizeColor(text: string): string | null {
  const raw = text.trim().replace(/^#/, '');
  const hex = /^[0-9a-f]{3}$/i.test(raw) ? [...raw].map((c) => c + c).join('') : raw;
  return /^([0-9a-f]{6}|[0-9a-f]{8})$/i.test(hex) ? `#${hex.toUpperCase()}` : null;
}

/** Converts the color to `rgba()` that CSS can read: the eight-digit hex form cannot show its opacity in some color pickers. */
export function colorCss(value: string): string {
  const hex = normalizeColor(value) ?? '#000000';
  const n = Number.parseInt(hex.slice(1, 7), 16);
  const alpha = hex.length === 9 ? Number.parseInt(hex.slice(7), 16) / 255 : 1;
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.round(alpha * 1000) / 1000})`;
}

/** Media types of Lottie animations: bodymovin JSON and `.lottie` archives (zip). */
const LOTTIE_MEDIA_TYPES: readonly string[] = ['application/json', 'application/zip'];

/** Stickers are Lottie animations (not images). */
export function isLottieSticker(content: BrandContent): boolean {
  return content.kind === 'sticker' && LOTTIE_MEDIA_TYPES.includes(content.file.mediaType);
}

/**
 * Which page a brand library sticker goes to in the element page (design draft `BC_STSRC.isDynamicPage`; the two pages complement each other, no duplicates): Lottie and GIF go to “Animated stickers”
 * (preview and export both play them with GIF's own frame timing), and the rest of the images go to “Stickers”.
 */
export function isDynamicSticker(content: BrandContent): boolean {
  return isLottieSticker(content) || (content.kind === 'sticker' && content.file.mediaType === 'image/gif');
}

/**
 * Searching brand library stickers in the element page: by name, “My stickers”, “Brand library”, and the name and kind words of its page (the same rule as built-in cells matching by section name: searching “stickers” finds both pages).
 */
export function stickerMatches(name: string, dynamic: boolean, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  // i18n-ignore-start: search keywords; both Chinese and English terms are accepted, independent of interface language
  const words = dynamic ? '动态贴纸 lottie 动画 animation' : '贴纸 sticker 图片 image';
  return `${name}\n我的贴纸 品牌库 brand ${words}`.toLowerCase().includes(q);
  // i18n-ignore-end
}

/** Description of a brand entry: stickers say whether they are images or animations, files say their size. */
export function brandMeta(content: BrandContent): string {
  if (content.kind === 'color') return content.value;
  if (content.kind === 'captionStyle') return M.captionStyle;
  const size = formatSize(content.file.byteLength);
  if (content.kind === 'sticker') return `${isLottieSticker(content) ? M.lottie : M.image} · ${size}`;
  return size;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

// ---- Save from this video's media into the brand library ----

function isAbsolutePath(path: string): boolean {
  return path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path) || path.startsWith('\\\\');
}

/** Generated media records the output ID in its source (`provenance.source.artifactId`). */
function artifactIdOf(source: unknown): string | null {
  const id = source && typeof source === 'object' ? (source as { artifactId?: unknown }).artifactId : undefined;
  return typeof id === 'string' && id.trim() ? id : null;
}

/**
 * Where the media file comes from: generated media uses the copy in the output library; linked media uses the registered absolute path.
 * Media that was already copied into the video directory at import: the Runtime does not give its location on disk, so this explains the reason and asks the user to add it from a local file instead.
 */
export function assetLibrarySource(asset: AssetRecord): { source: LibrarySource } | { reason: string } {
  const revision = asset.revisions[asset.currentRevision];
  if (!revision) return { reason: M.noRevision };
  const artifactId = artifactIdOf(revision.provenance.source);
  if (artifactId) return { source: { artifactId } };
  if (revision.storage.mode === 'linked' && isAbsolutePath(revision.storage.locator.path)) {
    return { source: { path: revision.storage.locator.path } };
  }
  return { reason: M.embedded };
}

/**
 * Which kind the media counts as in the brand library; media that cannot be stored (audio, documents, etc.) returns null. Lottie animation media counts as a sticker; JSON media that was earlier recorded as `other` while it was Lottie also counts (the Runtime checks the content again when storing).
 */
export function brandKindForAsset(asset: AssetRecord): BrandMediaKind | null {
  if (asset.kind === 'image' || asset.kind === 'video' || asset.kind === 'font') return asset.kind;
  if (asset.kind === 'lottie') return 'sticker';
  const revision = asset.revisions[asset.currentRevision];
  return revision?.mediaType === 'application/json' ? 'sticker' : null;
}

export interface BrandCandidate {
  asset: AssetRecord;
  source: LibrarySource | null;
  /** The reason it cannot be stored. */
  reason: string | null;
}

/** Media in this video that can be stored into a section (the sticker section takes images and Lottie). Sorted by name. */
export function brandCandidates(assets: Record<Id, AssetRecord>, kind: BrandMediaKind): BrandCandidate[] {
  return Object.values(assets)
    .filter((asset) => {
      const own = brandKindForAsset(asset);
      return kind === 'sticker' ? own === 'sticker' || own === 'image' : own === kind;
    })
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
    .map((asset) => {
      const found = assetLibrarySource(asset);
      return 'source' in found ? { asset, source: found.source, reason: null } : { asset, source: null, reason: found.reason };
    });
}

// ---- How it is placed after being copied into the video ----

/**
 * Where copied media goes: images, videos and image stickers go onto the timeline at the playhead; Lottie stickers use the built-in Lottie player;
 * fonts only go to the media library (the text font box cannot yet pick a font from the media).
 */
export type BrandPlacement = 'asset' | 'lottie' | 'import-only';

export function brandPlacement(content: BrandContent): BrandPlacement {
  if (content.kind === 'image' || content.kind === 'video') return 'asset';
  if (content.kind === 'sticker') return isLottieSticker(content) ? 'lottie' : 'asset';
  return 'import-only';
}

/**
 * One layer for a Lottie sticker: the media sticker points to the current version of the media and loops; width 18%, height follows the animation's aspect ratio, placed in the center of the frame.
 */
export function lottieLayer(name: string, asset: AssetRecord, _canvas: { width: number; height: number }): VisualLayer {
  return {
    type: 'sticker',
    name,
    place: placeBox({ x: 50, y: 50, w: 18 }),
    assetRef: { id: asset.id, revision: asset.currentRevision },
    sticker: { source: 'asset', loop: 'loop' },
  };
}

/** How long (in seconds) a Lottie sticker lasts: same as built-in stickers. */
export const LOTTIE_SECONDS = 3;

// ---- Caption styles ----

/** Upper limit on the body of a caption style (consistent with the Runtime). */
export const CAPTION_STYLE_MAX_BYTES = 64 * 1024;

/** Whether the body of a caption style can be stored in the brand library: it must be an object with a string `schema`, and no more than 64 KiB. */
export function captionStyleProblem(body: unknown): string | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return M.styleEmpty;
  if (typeof (body as { schema?: unknown }).schema !== 'string') return M.styleNoSchema;
  if (new TextEncoder().encode(JSON.stringify(body)).byteLength > CAPTION_STYLE_MAX_BYTES) return M.styleTooLarge;
  return null;
}

export interface CaptionStyleCandidate {
  documentId: Id;
  name: string;
  /** Number of caption instances that use this style. */
  uses: number;
}

/** What “Save current style” can store: the caption style documents used by caption instances on the sequence, the most used first, ties sorted by name. */
export function captionStyleCandidates(sequence: Sequence, documents: Record<Id, DocumentRecord>): CaptionStyleCandidate[] {
  const uses = new Map<Id, number>();
  for (const item of sequence.items) {
    if (item.type !== 'caption' || !item.styleDocumentId) continue;
    if (documents[item.styleDocumentId]?.kind !== 'caption-style') continue;
    uses.set(item.styleDocumentId, (uses.get(item.styleDocumentId) ?? 0) + 1);
  }
  return [...uses]
    .map(([documentId, n]) => ({ documentId, name: documents[documentId]!.name, uses: n }))
    .sort((a, b) => b.uses - a.uses || a.name.localeCompare(b.name) || a.documentId.localeCompare(b.documentId));
}

/** Which captions to change when applying a caption style: caption instances on the sequence, skipping locked instances and those on locked tracks. */
export function captionStyleTargets(sequence: Sequence): Id[] {
  const locked = new Set(sequence.tracks.filter((track) => track.locked).map((track) => track.id));
  return sequence.items.filter((item) => item.type === 'caption' && !item.locked && !locked.has(item.trackId)).map((item) => item.id);
}
