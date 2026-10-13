/**
 * Structure of deck.json in a deck directory (docs/design/slides §2.1); the runtime's model/deck-metadata.ts
 * (normalizeDeckMetadata) is authoritative; authoring rules are in skills/slides/references/format.md.
 * Reference problem messages are for agents (slides_check) and do not go into the UI copy catalogs.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

/** A slide id is the file name of slides/<id>.html. */
export type SlideId = string;

export interface DeckSection {
  /** What this section covers, in one sentence. */
  description: string;
  /** First slide of this section. */
  start: SlideId;
}

/** Font: a Google Fonts link (href) or an uploaded font file (src). */
export interface DeckFace {
  family: string;
  href?: string;
  src?: string;
}

export interface DeckMetadata {
  v: 4;
  /** Only decks created in file mode have this; `at` is an ISO time (second precision). */
  createdOnFiles?: { v: 1; at: string };
  /** "css" means lists are rendered with CSS; old decks lack this field. */
  lists?: 'css';
  title: string;
  order: SlideId[];
  sections: Record<string, DeckSection>;
  cover?: SlideId;
  faces: Record<string, DeckFace>;
  designSystems: Record<string, unknown>[];
}

/** Checks deck.json's references by the rules in SKILL.md and returns a list of problems (empty = no problems). */
export function deckReferenceProblems(deck: DeckMetadata, slideFiles: ReadonlySet<SlideId>): string[] {
  const problems: string[] = [];
  const seen = new Set<SlideId>();
  for (const id of deck.order) {
    if (seen.has(id)) problems.push(`order: ${id} is duplicated`);
    seen.add(id);
    if (!slideFiles.has(id)) problems.push(`order: ${id} has no matching slides/${id}.html`);
  }
  for (const [key, section] of Object.entries(deck.sections)) {
    if (!seen.has(section.start)) problems.push(`section ${key}: start "${section.start}" is not in order`);
  }
  if (deck.cover !== undefined && !seen.has(deck.cover)) problems.push(`cover "${deck.cover}" is not in order`);
  return problems;
}

/** Entry file of a deck directory. */
export const DECK_FILE = 'deck.json';

/** When a directory is a deck (§2.1): `v` is 4 and `order` is an array. The runtime fills in the other fields; they are not checked here. */
export function isDeckMetadata(value: unknown): value is Pick<DeckMetadata, 'v' | 'order'> & Partial<DeckMetadata> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const deck = value as { v?: unknown; order?: unknown };
  return deck.v === 4 && Array.isArray(deck.order);
}

/** Summary needed by cards, Space entries and slides.open. */
export interface DeckSummary {
  title: string;
  slideCount: number;
}

/** Reads a directory's deck.json; null when it is not a deck (missing, unreadable, not §2.1). Does not follow symlinks. */
export async function readDeckSummary(dir: string): Promise<DeckSummary | null> {
  const file = path.join(dir, DECK_FILE);
  try {
    const stat = await fs.lstat(file);
    if (!stat.isFile() || stat.size > 4 * 1024 * 1024) return null;
    const parsed: unknown = JSON.parse(await fs.readFile(file, 'utf8'));
    if (!isDeckMetadata(parsed)) return null;
    const title = typeof parsed.title === 'string' ? parsed.title.trim() : '';
    return { title, slideCount: parsed.order.filter(id => typeof id === 'string').length };
  } catch {
    return null;
  }
}

/** Deck directory summary for the Space scan: size is the total of deck.json and the files one level down (slides/, assets/ etc.); time is the latest modification among them. */
export interface DeckDirStat extends DeckSummary {
  size: number;
  mtimeMs: number;
  birthtimeMs: number;
}

/** Returns the summary when the directory is a deck, otherwise null. Does not follow symlinks; skips dotfiles and dot-directories. */
export async function inspectDeck(dir: string): Promise<DeckDirStat | null> {
  const summary = await readDeckSummary(dir);
  if (!summary) return null;
  const deckFile = await fs.lstat(path.join(dir, DECK_FILE)).catch(() => null);
  if (!deckFile) return null;
  let size = 0;
  let mtimeMs = deckFile.mtimeMs;
  const add = async (folder: string, depth: number): Promise<void> => {
    const entries = await fs.readdir(folder, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const full = path.join(folder, entry.name);
      if (entry.isDirectory()) {
        if (depth === 0) await add(full, 1);
        continue;
      }
      if (!entry.isFile()) continue;
      const stat = await fs.lstat(full).catch(() => null);
      if (!stat) continue;
      size += stat.size;
      mtimeMs = Math.max(mtimeMs, stat.mtimeMs);
    }
  };
  await add(dir, 0);
  return { ...summary, size, mtimeMs, birthtimeMs: deckFile.birthtimeMs };
}
