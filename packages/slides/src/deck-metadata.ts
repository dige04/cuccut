/**
 * deck 目录里 deck.json 的结构（docs/design/slides §2.1），以运行时的 model/deck-metadata.ts
 * （normalizeDeckMetadata）为准；写法规范见 skills/slides/references/format.md。
 * 引用问题的说明是给智能体看的（slides_check），不进界面文案目录。
 */
// i18n-ignore-file: 给模型的校验结果
import fs from 'node:fs/promises';
import path from 'node:path';

/** 页 id 即 slides/<id>.html 的文件名。 */
export type SlideId = string;

export interface DeckSection {
  /** 这一段讲什么，一句话。 */
  description: string;
  /** 这一段的第一页。 */
  start: SlideId;
}

/** 字体：Google Fonts 链接（href）或上传的字体文件（src）。 */
export interface DeckFace {
  family: string;
  href?: string;
  src?: string;
}

export interface DeckMetadata {
  v: 4;
  /** 由文件模式创建的 deck 才有；`at` 是 ISO 时间（秒精度）。 */
  createdOnFiles?: { v: 1; at: string };
  /** "css" 表示列表用 CSS 渲染；旧 deck 没有这个字段。 */
  lists?: 'css';
  title: string;
  order: SlideId[];
  sections: Record<string, DeckSection>;
  cover?: SlideId;
  faces: Record<string, DeckFace>;
  designSystems: Record<string, unknown>[];
}

/** 按 SKILL.md 的规则检查 deck.json 的引用关系，返回问题列表（空 = 没问题）。 */
export function deckReferenceProblems(deck: DeckMetadata, slideFiles: ReadonlySet<SlideId>): string[] {
  const problems: string[] = [];
  const seen = new Set<SlideId>();
  for (const id of deck.order) {
    if (seen.has(id)) problems.push(`order 里 ${id} 重复`);
    seen.add(id);
    if (!slideFiles.has(id)) problems.push(`order 里的 ${id} 没有对应的 slides/${id}.html`);
  }
  for (const [key, section] of Object.entries(deck.sections)) {
    if (!seen.has(section.start)) problems.push(`章节 ${key} 的 start「${section.start}」不在 order 里`);
  }
  if (deck.cover !== undefined && !seen.has(deck.cover)) problems.push(`cover「${deck.cover}」不在 order 里`);
  return problems;
}

/** deck 目录的入口文件。 */
export const DECK_FILE = 'deck.json';

/** 认 deck 的条件（§2.1）：`v` 为 4、`order` 是数组。其余字段由运行时补齐，这里不管。 */
export function isDeckMetadata(value: unknown): value is Pick<DeckMetadata, 'v' | 'order'> & Partial<DeckMetadata> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const deck = value as { v?: unknown; order?: unknown };
  return deck.v === 4 && Array.isArray(deck.order);
}

/** 卡片、Space 条目与 slides.open 要的概况。 */
export interface DeckSummary {
  title: string;
  slideCount: number;
}

/** 读一个目录的 deck.json；不是 deck（没有、读不了、不合 §2.1）时返回 null。不跟随符号链接。 */
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

/** Space 扫描用的 deck 目录概况：大小是 deck.json 与一层子目录（slides/、assets/ 等）里文件的合计；时间取其中最新的修改。 */
export interface DeckDirStat extends DeckSummary {
  size: number;
  mtimeMs: number;
  birthtimeMs: number;
}

/** 目录是 deck 时返回它的概况，否则 null。不跟随符号链接，跳过以点开头的文件与目录。 */
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
