/**
 * Validates deck source files with the runtime's own compiler (the slides_check tool, docs/design/slides §7.2):
 *   - deck.json is accepted by normalizeDeckMetadata, and order / sections / cover point to existing slides
 *   - every slide passes compileSlideHtml with no error, no unsupported (dropped) markup and no cellRemovals; like the editor, images with relative paths are rejected,
 *     and so are <title>, <link> and <style> in slide files
 *   - every referenced /_blob/<id> exists in the deck's assets/
 *   - the editor recognizes deck.json's faces (a Google Fonts link, or a src pointing to an existing font file), and designSystems matches ds/<folder>/
 *   - serialization round-trips: compiling serialize(compile(src)) again and serializing it gives the same result
 * Problems and notes are for agents and do not go into the UI copy catalogs.
 */
import { existsSync, readdirSync, readFileSync, statSync, type Dirent } from 'node:fs';
import path from 'node:path';
import type { CompileDiagnostic, CompileResult, SlidesRuntime } from './compiler-contract.ts';
import { deckReferenceProblems, type DeckMetadata } from './deck-metadata.ts';
import { ASSETS_DIR } from './deck-store.ts';

export interface SlideReport {
  id: string;
  /** Problems that make this slide fail to compile or lose content. */
  problems: string[];
  /** Compiler warnings (content unaffected); with verbose, layout suggestions too. */
  notes: string[];
  /** A second pass of serialize(compile(src)) gives a different result. */
  roundTripDrift: boolean;
}

export interface CheckReport {
  title: string;
  /** Problems with deck.json itself. */
  deckProblems: string[];
  /** Files in slides/ that are not in order. */
  orphans: string[];
  slides: SlideReport[];
}

/** Prefix of the layout notes (`checkSlide` with `verbose`): overflow, overlapping text, words that do not fit. */
export const LAYOUT_NOTE_PREFIX = 'layout';

export function problemCount(report: CheckReport): number {
  return report.deckProblems.length + report.slides.reduce((n, s) => n + s.problems.length, 0);
}

/** The compiler's advice on image URLs points to its own build script ("put it next to the deck, use a relative path"), which does not apply here. */
const IMAGE_REF_ADVICE = /(?: — URLs are not fetched| — a relative path under the deck's folder| is a file reference with no data).*$/;
const IMPORT_ADVICE = ' — import the image with slides_import_asset first and set src to the /_blob/<id> it returns';

const fmt = (d: CompileDiagnostic) => `${d.line}:${d.col} ${d.message.replace(IMAGE_REF_ADVICE, IMPORT_ADVICE)}`;

/** CJK characters. */
const CJK = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af\uf900-\ufaff]/;

/**
 * The compiler estimates "will break mid-word" by splitting words on spaces, so a CJK sentence without spaces counts as one word; browsers can already break lines between these characters, so such hints are false positives.
 */
export function isCjkWordBreakLint(message: string): boolean {
  if (!message.includes('break mid-word')) return false;
  // The message may quote the enclosing section's id first; what we want is the text before "needs".
  const quoted = /"([^"]*)" needs ~/.exec(message)?.[1] ?? '';
  return CJK.test(quoted);
}

/** Fonts the editor recognizes (the deck model in packages/slides-runtime): family name, Google Fonts link, font file URL. */
const FACE_FAMILY = /^[A-Za-z][A-Za-z0-9 _-]{0,39}$/;
const GOOGLE_FONTS_CSS = /^https:\/\/fonts\.googleapis\.com\/css2\?[A-Za-z0-9&=+,.:;@_-]+$/;
const MAX_FONT_HREF = 1024;
const BLOB_SRC = /^\/_blob\/([0-9a-f]{32})$/;
const DS_FONT_SRC = /^project\/(ds\/[a-z0-9][a-z0-9_-]{0,63}\/(?:[A-Za-z0-9][A-Za-z0-9._-]{0,99}\/){0,8}[A-Za-z0-9][A-Za-z0-9._-]{0,99}\.(?:[Ww][Oo][Ff][Ff]2?|[Tt][Tt][Ff]|[Oo][Tt][Ff]))$/;
const MAX_FACES = 4;
/** Directory names of design systems under ds/ and their maximum count (same as packages/slides-runtime/src/files/design-systems.ts). */
const DS_DIR = 'ds';
const DS_FOLDER = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const MAX_DESIGN_SYSTEMS = 4;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * When reading, the editor turns deck.json's faces into a <head>: href becomes a font link, src (an uploaded or design system font file) an @font-face;
 * single-slide compiles include it too, to avoid false "font not declared" warnings.
 */
export function fontHead(deck: Pick<DeckMetadata, 'faces'>): string {
  const parts: string[] = [];
  for (const f of Object.values(deck.faces ?? {})) {
    if (typeof f?.href === 'string') {
      parts.push(`<link rel="stylesheet" href="${f.href.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}">`);
    } else if (typeof f?.src === 'string' && typeof f.family === 'string' && FACE_FAMILY.test(f.family) && (BLOB_SRC.test(f.src) || DS_FONT_SRC.test(f.src))) {
      parts.push(`<style>@font-face{font-family:'${f.family}';src:url(${f.src})}</style>`);
    }
  }
  return `<head>${parts.join('')}</head>\n`;
}

const facesOf = (r: CompileResult) => (Array.isArray(r.content.faces) ? r.content.faces.length : 0);

/** Number of fonts fontHead() itself brings in, cached per head. */
const headFaceCounts = new Map<string, number>();
function headFaces(rt: SlidesRuntime, head: string): number {
  let n = headFaceCounts.get(head);
  if (n === undefined) {
    n = facesOf(rt.compileSlideHtml(`${head}<section id="probe"></section>`));
    if (headFaceCounts.size > 64) headFaceCounts.clear();
    headFaceCounts.set(head, n);
  }
  return n;
}

/** Validates the source HTML of one slide. head is the result of fontHead(). */
export function checkSlide(
  rt: SlidesRuntime,
  id: string,
  html: string,
  options: { head: string; lists?: 'css'; blobExists?: (id: string) => boolean; verbose?: boolean },
): SlideReport {
  const report: SlideReport = { id, problems: [], notes: [], roundTripDrift: false };
  // collectFiles stays off: the editor does not enable it when reading slides either, so relative image paths are errors there.
  const r = rt.compileSlideHtml(options.head + html, { lists: options.lists });
  for (const e of r.errors) report.problems.push(`error ${fmt(e)}`);
  // The editor rejects these too when reading files slide by slide (packages/slides-runtime/src/documents/slide-codec.ts): fonts are registered in deck.json's faces.
  if (r.hoisted > 0 || r.title !== undefined || facesOf(r) > headFaces(rt, options.head)) {
    report.problems.push('error slide files must not contain <title>, <link> or <style>: put styles in style attributes and register web fonts in deck.json faces');
  }
  for (const u of r.unsupported) report.problems.push(`unsupported ${fmt(u)}`);
  if (r.cellRemovals > 0) report.problems.push(`${r.cellRemovals} table cell(s) removed (rows have uneven cell counts)`);
  if (r.content.order.length !== 1) report.problems.push(`expected exactly one <section>, found ${r.content.order.length}`);
  for (const w of r.warnings) report.notes.push(`warning ${fmt(w)}`);
  if (options.verbose) for (const l of r.lints) if (!isCjkWordBreakLint(l.message)) report.notes.push(`${LAYOUT_NOTE_PREFIX} ${fmt(l)}`);

  if (options.blobExists) {
    for (const ref of html.matchAll(/\/_blob\/([0-9a-f]{32})/g)) {
      if (!options.blobExists(ref[1]!)) report.problems.push(`referenced /_blob/${ref[1]} does not exist`);
    }
  }

  const slide = r.content.slides[r.content.order[0] ?? ''];
  if (slide !== undefined) {
    const once = rt.serializeSlideHtml(r.content, slide);
    const again = rt.compileSlideHtml(options.head + once, { lists: options.lists });
    const againSlide = again.content.slides[again.content.order[0] ?? ''];
    report.roundTripDrift = againSlide === undefined || rt.serializeSlideHtml(again.content, againSlide) !== once;
  }
  return report;
}

/** Validates the whole deck under deckDir (containing deck.json, slides/, assets/). */
export function checkDeck(rt: SlidesRuntime, deckDir: string, options: { verbose?: boolean } = {}): CheckReport {
  const raw = JSON.parse(readFileSync(path.join(deckDir, 'deck.json'), 'utf8')) as DeckMetadata;
  const normalized = rt.normalizeDeckMetadata(raw);
  const slidesDir = path.join(deckDir, 'slides');
  const slideFiles = new Set(
    existsSync(slidesDir)
      ? readdirSync(slidesDir)
          .filter(f => f.endsWith('.html'))
          .map(f => f.slice(0, -'.html'.length))
      : [],
  );

  const deckProblems = deckReferenceProblems(raw, slideFiles);
  const dropped = (raw.order ?? []).length - normalized.order.length;
  if (dropped > 0) deckProblems.push(`order has ${dropped} invalid or duplicate id(s) that the runtime will drop`);

  const head = fontHead(raw);
  const assetsDir = path.join(deckDir, ASSETS_DIR);
  const assets = existsSync(assetsDir) ? readdirSync(assetsDir) : [];
  const slides = normalized.order
    .filter(id => slideFiles.has(id))
    .map(id =>
      checkSlide(rt, id, readFileSync(path.join(slidesDir, `${id}.html`), 'utf8'), {
        head,
        lists: raw.lists,
        blobExists: blobId => assets.some(name => name.startsWith(`${blobId}.`)),
        verbose: options.verbose,
      }),
    );

  return {
    title: normalized.title,
    deckProblems: [...deckProblems.map(p => `deck.json: ${p}`), ...deckFileProblems(raw, deckDir)],
    orphans: [...slideFiles].filter(id => !normalized.order.includes(id)),
    slides,
  };
}

/**
 * The two places in deck.json that point to files: faces (font links or font files) and designSystems (design systems copied into ds/<folder>/). Each problem starts with
 * the file it is about (`deck.json: ` or `ds/…`).
 * The editor drops fonts it does not recognize, and only offers a design system's colors and text styles when both the record and ds/<folder>/ exist; a record whose directory has no
 * tokens.json yet is not a problem (a design system without tokens.json still installs; the editor just cannot offer its colors).
 */
export function deckFileProblems(raw: Pick<DeckMetadata, 'faces' | 'designSystems'>, deckDir: string): string[] {
  const problems: string[] = [];
  const faces: unknown = raw.faces;
  const fileExists = (rel: string) => {
    try {
      return statSync(path.join(deckDir, rel)).isFile();
    } catch {
      return false;
    }
  };
  const blobExists = (id: string) => {
    try {
      return readdirSync(path.join(deckDir, ASSETS_DIR)).some(name => name.startsWith(`${id}.`));
    } catch {
      return false;
    }
  };
  if (faces !== undefined && !isRecord(faces)) problems.push('deck.json: faces must be an object: {"<key>": {"family": …, "href" or "src": …}}');
  const entries = isRecord(faces) ? Object.entries(faces) : [];
  if (entries.length > MAX_FACES) problems.push(`deck.json: faces has ${entries.length} entries; the editor only reads the first ${MAX_FACES}`);
  const families = new Set<string>();
  for (const [key, face] of entries) {
    const where = `deck.json: faces.${key}`;
    if (!isRecord(face) || typeof face.family !== 'string') {
      problems.push(`${where} must be {"family": <name used in the slide's font-family>, "href": <Google Fonts link>} or {"family": …, "src": <the /_blob/<id> returned by slides_import_asset>}`);
      continue;
    }
    if (!FACE_FAMILY.test(face.family)) problems.push(`${where}.family "${face.family}" is not recognized by the editor: start with an ASCII letter and use only letters, digits, spaces, - and _, at most 40 characters`);
    else if (families.has(face.family.toLowerCase())) problems.push(`${where}.family "${face.family}" is a duplicate; the editor only reads the first one`);
    families.add(face.family.toLowerCase());
    const { href, src } = face;
    if (href !== undefined && src !== undefined) problems.push(`${where}: set only one of href or src`);
    else if (href !== undefined) {
      if (typeof href !== 'string' || !GOOGLE_FONTS_CSS.test(href)) problems.push(`${where}.href must be a https://fonts.googleapis.com/css2?… link`);
      else if (href.length > MAX_FONT_HREF) problems.push(`${where}.href has ${href.length} characters; the editor only reads up to ${MAX_FONT_HREF}: list fewer weights`);
    } else if (src !== undefined) {
      const blob = typeof src === 'string' ? BLOB_SRC.exec(src) : null;
      const dsFile = typeof src === 'string' ? DS_FONT_SRC.exec(src) : null;
      if (blob) {
        if (!blobExists(blob[1]!)) problems.push(`${where}.src references /_blob/${blob[1]}, which does not exist: import the font file with slides_import_asset and use the src it returns`);
      } else if (dsFile) {
        if (!fileExists(dsFile[1]!)) problems.push(`${where}.src points to ${dsFile[1]}, which is not in the deck`);
      } else {
        problems.push(`${where}.src must be the /_blob/<id> returned by slides_import_asset (import the font file first: woff2, woff, ttf, otf)`);
      }
    } else {
      problems.push(`${where} needs an href (Google Fonts link) or a src (the /_blob/<id> returned by slides_import_asset)`);
    }
  }
  problems.push(...designSystemProblems(raw.designSystems, deckDir));
  return problems;
}

/** designSystems matches ds/<folder>/: every directory has a record, and the editor recognizes the records' shape and count. */
function designSystemProblems(value: unknown, deckDir: string): string[] {
  const problems: string[] = [];
  const folders: string[] = [];
  let listing: Dirent[] = [];
  try {
    listing = readdirSync(path.join(deckDir, DS_DIR), { withFileTypes: true }).sort((x, y) => (x.name < y.name ? -1 : x.name > y.name ? 1 : 0));
  } catch {
    // No ds/ directory
  }
  for (const entry of listing) {
    if (entry.name.startsWith('.')) continue;
    if (!entry.isDirectory()) problems.push(`${DS_DIR}/${entry.name}: only directories go under ${DS_DIR}/, one ${DS_DIR}/<folder>/ per design system`);
    else if (!DS_FOLDER.test(entry.name)) problems.push(`${DS_DIR}/${entry.name}/: design system directory names use only lowercase letters, digits, - and _, start with a letter or digit, and are at most 64 characters`);
    else folders.push(entry.name);
  }
  const records = Array.isArray(value) ? value : isRecord(value) ? Object.values(value) : value === undefined ? [] : null;
  if (records === null) problems.push('deck.json: designSystems must be an array: [{"title","namespace","artifact","version","copiedAt"}]');
  const recorded = new Set<string>();
  if (records && records.length > MAX_DESIGN_SYSTEMS) problems.push(`deck.json: designSystems has ${records.length} entries; a deck holds at most ${MAX_DESIGN_SYSTEMS}`);
  (records ?? []).forEach((record, i) => {
    const where = `deck.json: designSystems[${i}]`;
    if (
      !isRecord(record) ||
      typeof record.title !== 'string' ||
      typeof record.namespace !== 'string' ||
      !DS_FOLDER.test(record.namespace) ||
      typeof record.artifact !== 'string' ||
      !(record.version === undefined || record.version === null || typeof record.version === 'string') ||
      !(record.copiedAt === undefined || typeof record.copiedAt === 'string')
    ) {
      problems.push(`${where} must be {"title": <name>, "namespace": <directory name under ds/>, "artifact": <where it was copied from>, "version": <string or null>, "copiedAt": <RFC 3339 time>}`);
      return;
    }
    if (recorded.has(record.namespace)) problems.push(`${where}: namespace "${record.namespace}" appears more than once`);
    recorded.add(record.namespace);
  });
  for (const folder of folders) {
    if (!recorded.has(folder)) problems.push(`${DS_DIR}/${folder}/ has no record in designSystems: the editor offers this design system only when both exist`);
  }
  return problems;
}
