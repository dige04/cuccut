/**
 * 用运行时自己的编译器校验 deck 源文件（slides_check 工具，docs/design/slides §7.2）：
 *   - deck.json 能被 normalizeDeckMetadata 接受，order / sections / cover 指向存在的页
 *   - 每页 compileSlideHtml 无 error、无 unsupported（被丢弃的写法）、无 cellRemovals；与编辑器一样不收相对路径的图片，
 *     也不收页面文件里的 <title>、<link>、<style>
 *   - 引用的 /_blob/<id> 在 deck 的 assets/ 里
 *   - deck.json 的 faces 编辑器认得（Google Fonts 链接，或指向存在的字体文件的 src），designSystems 与 ds/<folder>/ 对得上
 *   - 序列化往返稳定：serialize(compile(src)) 再编译、再序列化结果不变
 * 问题与提示是给智能体看的，不进界面文案目录。
 */
// i18n-ignore-file: 给模型的校验结果
import { existsSync, readdirSync, readFileSync, statSync, type Dirent } from 'node:fs';
import path from 'node:path';
import type { CompileDiagnostic, CompileResult, SlidesRuntime } from './compiler-contract.ts';
import { deckReferenceProblems, type DeckMetadata } from './deck-metadata.ts';
import { ASSETS_DIR } from './deck-store.ts';

export interface SlideReport {
  id: string;
  /** 会让这一页编译失败或丢内容的问题。 */
  problems: string[];
  /** 编译器警告（不影响内容），verbose 时还包括排版建议。 */
  notes: string[];
  /** serialize(compile(src)) 再走一遍结果不同。 */
  roundTripDrift: boolean;
}

export interface CheckReport {
  title: string;
  /** deck.json 本身的问题。 */
  deckProblems: string[];
  /** slides/ 里有、但不在 order 里的文件。 */
  orphans: string[];
  slides: SlideReport[];
}

export function problemCount(report: CheckReport): number {
  return report.deckProblems.length + report.slides.reduce((n, s) => n + s.problems.length, 0);
}

/** 编译器对图片地址的建议指向它自己的构建脚本（「放在 deck 旁边、写相对路径」），在这里不适用。 */
const IMAGE_REF_ADVICE = /(?: — URLs are not fetched| — a relative path under the deck's folder| is a file reference with no data).*$/;
const IMPORT_ADVICE = ' — 图片先用 slides_import_asset 导入，src 写它返回的 /_blob/<id>';

const fmt = (d: CompileDiagnostic) => `${d.line}:${d.col} ${d.message.replace(IMAGE_REF_ADVICE, IMPORT_ADVICE)}`;

/** 中日韩文字。 */
const CJK = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af\uf900-\ufaff]/;

/**
 * 编译器按空格切词估算「会从词中间断开」，没有空格的中日韩句子整句算一个词；浏览器在这些字之间本来就能换行，这类提示是误报。
 */
export function isCjkWordBreakLint(message: string): boolean {
  if (!message.includes('break mid-word')) return false;
  // 消息里先引的可能是所在 section 的 id，要的是「needs」前面那段文字。
  const quoted = /"([^"]*)" needs ~/.exec(message)?.[1] ?? '';
  return CJK.test(quoted);
}

/** 编辑器认得的字体（packages/slides-runtime 的 deck 模型）：族名、Google Fonts 链接、字体文件地址。 */
const FACE_FAMILY = /^[A-Za-z][A-Za-z0-9 _-]{0,39}$/;
const GOOGLE_FONTS_CSS = /^https:\/\/fonts\.googleapis\.com\/css2\?[A-Za-z0-9&=+,.:;@_-]+$/;
const MAX_FONT_HREF = 1024;
const BLOB_SRC = /^\/_blob\/([0-9a-f]{32})$/;
const DS_FONT_SRC = /^project\/(ds\/[a-z0-9][a-z0-9_-]{0,63}\/(?:[A-Za-z0-9][A-Za-z0-9._-]{0,99}\/){0,8}[A-Za-z0-9][A-Za-z0-9._-]{0,99}\.(?:[Ww][Oo][Ff][Ff]2?|[Tt][Tt][Ff]|[Oo][Tt][Ff]))$/;
const MAX_FACES = 4;
/** 设计系统在 ds/ 下的目录名与个数上限（同 packages/slides-runtime/src/files/design-systems.ts）。 */
const DS_DIR = 'ds';
const DS_FOLDER = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const MAX_DESIGN_SYSTEMS = 4;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * 编辑器读取时把 deck.json 的 faces 拼成 <head>：href 是字体链接，src（上传或设计系统里的字体文件）是 @font-face；
 * 单页编译也带上，免得误报「字体未声明」。
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

/** fontHead() 自己带进来的字体数，按 head 缓存。 */
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

/** 校验一页源 HTML。head 是 fontHead() 的结果。 */
export function checkSlide(
  rt: SlidesRuntime,
  id: string,
  html: string,
  options: { head: string; lists?: 'css'; blobExists?: (id: string) => boolean; verbose?: boolean },
): SlideReport {
  const report: SlideReport = { id, problems: [], notes: [], roundTripDrift: false };
  // 不开 collectFiles：编辑器读页面时也不开，相对路径的图片在那里是错误。
  const r = rt.compileSlideHtml(options.head + html, { lists: options.lists });
  for (const e of r.errors) report.problems.push(`错误 ${fmt(e)}`);
  // 编辑器按页读文件时同样拒绝（packages/slides-runtime/src/documents/slide-codec.ts）：字体在 deck.json 的 faces 里登记。
  if (r.hoisted > 0 || r.title !== undefined || facesOf(r) > headFaces(rt, options.head)) {
    report.problems.push('错误 页面文件里不能有 <title>、<link> 或 <style>：样式写进 style 属性，网络字体登记在 deck.json 的 faces');
  }
  for (const u of r.unsupported) report.problems.push(`不支持 ${fmt(u)}`);
  if (r.cellRemovals > 0) report.problems.push(`表格有 ${r.cellRemovals} 个单元格被删（行列数不齐）`);
  if (r.content.order.length !== 1) report.problems.push(`应该恰好一个 <section>，实际 ${r.content.order.length} 个`);
  for (const w of r.warnings) report.notes.push(`警告 ${fmt(w)}`);
  if (options.verbose) for (const l of r.lints) if (!isCjkWordBreakLint(l.message)) report.notes.push(`排版 ${fmt(l)}`);

  if (options.blobExists) {
    for (const ref of html.matchAll(/\/_blob\/([0-9a-f]{32})/g)) {
      if (!options.blobExists(ref[1]!)) report.problems.push(`引用的 /_blob/${ref[1]} 不存在`);
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

/** 校验 deckDir（含 deck.json、slides/、assets/）下的整份 deck。 */
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
  if (dropped > 0) deckProblems.push(`order 里有 ${dropped} 个无效或重复的 id 会被运行时丢掉`);

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
 * deck.json 里指向文件的两处：faces（字体链接或字体文件）与 designSystems（ds/<folder>/ 里拷来的设计系统）。每条问题以
 * 所在的文件开头（`deck.json: ` 或 `ds/…`）。
 * 编辑器丢掉认不得的字体，只在记录与 ds/<folder>/ 都在时才提供设计系统的颜色与文字样式；有记录、目录里还没有
 * tokens.json 不算问题（设计系统没有 tokens.json 时照装，编辑器只是给不出它的颜色）。
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
  if (faces !== undefined && !isRecord(faces)) problems.push('deck.json: faces 要是对象：{"<键>": {"family": …, "href" 或 "src": …}}');
  const entries = isRecord(faces) ? Object.entries(faces) : [];
  if (entries.length > MAX_FACES) problems.push(`deck.json: faces 有 ${entries.length} 项，编辑器只认前 ${MAX_FACES} 个`);
  const families = new Set<string>();
  for (const [key, face] of entries) {
    const where = `deck.json: faces.${key}`;
    if (!isRecord(face) || typeof face.family !== 'string') {
      problems.push(`${where} 要写成 {"family": <页面 font-family 里的名字>, "href": <Google Fonts 链接>} 或 {"family": …, "src": <slides_import_asset 返回的 /_blob/<id>>}`);
      continue;
    }
    if (!FACE_FAMILY.test(face.family)) problems.push(`${where}.family「${face.family}」编辑器认不得：以英文字母开头，只用字母、数字、空格、- 与 _，至多 40 个字符`);
    else if (families.has(face.family.toLowerCase())) problems.push(`${where}.family「${face.family}」重复了，编辑器只认第一个`);
    families.add(face.family.toLowerCase());
    const { href, src } = face;
    if (href !== undefined && src !== undefined) problems.push(`${where} 只写 href 或 src 中的一个`);
    else if (href !== undefined) {
      if (typeof href !== 'string' || !GOOGLE_FONTS_CSS.test(href)) problems.push(`${where}.href 要是 https://fonts.googleapis.com/css2?… 的链接`);
      else if (href.length > MAX_FONT_HREF) problems.push(`${where}.href 有 ${href.length} 个字符，编辑器只认 ${MAX_FONT_HREF} 个以内：少列几个字重`);
    } else if (src !== undefined) {
      const blob = typeof src === 'string' ? BLOB_SRC.exec(src) : null;
      const dsFile = typeof src === 'string' ? DS_FONT_SRC.exec(src) : null;
      if (blob) {
        if (!blobExists(blob[1]!)) problems.push(`${where}.src 引用的 /_blob/${blob[1]} 不存在：用 slides_import_asset 导入字体文件，写它返回的 src`);
      } else if (dsFile) {
        if (!fileExists(dsFile[1]!)) problems.push(`${where}.src 指向的 ${dsFile[1]} 不在 deck 里`);
      } else {
        problems.push(`${where}.src 要是 slides_import_asset 返回的 /_blob/<id>（字体文件 woff2、woff、ttf、otf 先导入）`);
      }
    } else {
      problems.push(`${where} 要有 href（Google Fonts 链接）或 src（slides_import_asset 返回的 /_blob/<id>）`);
    }
  }
  problems.push(...designSystemProblems(raw.designSystems, deckDir));
  return problems;
}

/** designSystems 与 ds/<folder>/ 对得上：每个目录都有记录，记录的形状与个数编辑器认得。 */
function designSystemProblems(value: unknown, deckDir: string): string[] {
  const problems: string[] = [];
  const folders: string[] = [];
  let listing: Dirent[] = [];
  try {
    listing = readdirSync(path.join(deckDir, DS_DIR), { withFileTypes: true }).sort((x, y) => (x.name < y.name ? -1 : x.name > y.name ? 1 : 0));
  } catch {
    // 没有 ds/ 目录
  }
  for (const entry of listing) {
    if (entry.name.startsWith('.')) continue;
    if (!entry.isDirectory()) problems.push(`${DS_DIR}/${entry.name}: ${DS_DIR}/ 下只放目录，一个设计系统一个 ${DS_DIR}/<folder>/`);
    else if (!DS_FOLDER.test(entry.name)) problems.push(`${DS_DIR}/${entry.name}/: 设计系统的目录名只用小写字母、数字、- 与 _，以字母或数字开头，至多 64 个字符`);
    else folders.push(entry.name);
  }
  const records = Array.isArray(value) ? value : isRecord(value) ? Object.values(value) : value === undefined ? [] : null;
  if (records === null) problems.push('deck.json: designSystems 要是数组：[{"title","namespace","artifact","version","copiedAt"}]');
  const recorded = new Set<string>();
  if (records && records.length > MAX_DESIGN_SYSTEMS) problems.push(`deck.json: designSystems 有 ${records.length} 项，一份 deck 至多 ${MAX_DESIGN_SYSTEMS} 个`);
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
      problems.push(`${where} 要写成 {"title": <名字>, "namespace": <ds/ 下的目录名>, "artifact": <从哪里拷来>, "version": <字符串或 null>, "copiedAt": <RFC 3339 时间>}`);
      return;
    }
    if (recorded.has(record.namespace)) problems.push(`${where}: namespace「${record.namespace}」出现了不止一次`);
    recorded.add(record.namespace);
  });
  for (const folder of folders) {
    if (!recorded.has(folder)) problems.push(`${DS_DIR}/${folder}/ 在 designSystems 里没有记录：编辑器要两者都在才提供这个设计系统`);
  }
  return problems;
}
