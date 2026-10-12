/**
 * 运行时编译器在 CucCut 里用到的那几个入口的类型（slides_check 经 slides-compiler.ts 调构建好的 dist/node/compiler.cjs）。
 * 这里按源码手写 CucCut 用到的形状：
 *   compiler/html.ts        compileSlideHtml
 *   serialization/html.ts   serializeSlideHtml
 *   model/deck-metadata.ts  normalizeDeckMetadata
 * 路径相对 packages/slides-runtime/src。Node 里不直接导入运行时源码：它要经编辑器构建打包（含 PptxGenJS 补丁）。
 */

/** 编译器报告的位置都指向传入 HTML 的行列（从 1 开始）。 */
export interface SourcePosition {
  line: number;
  col: number;
}

export interface CompileDiagnostic extends SourcePosition {
  message: string;
}

/** 同一类提示合并后的说明，count 是出现次数。 */
export interface CompileNote extends SourcePosition {
  key: string;
  count: number;
}

/** 页面引用、但不在 fileMap 里的文件（collectFiles: true 时收集）。 */
export interface CompileFileRef extends SourcePosition {
  ref: string;
  kind: 'image' | 'font' | (string & {});
}

export interface CompileOptions {
  /** deck.json 的 lists；只有 "css" 有意义。 */
  lists?: 'css';
  collectFiles?: boolean;
  fileMap?: ReadonlyMap<string, string>;
}

/** 编译后的单页。字段很多且随版本变，这里只声明本站读的。 */
export interface CompiledSlide {
  readonly id: string;
  readonly [field: string]: unknown;
}

export interface CompiledDeck {
  order: string[];
  slides: Record<string, CompiledSlide>;
  readonly [field: string]: unknown;
}

export interface CompileResult {
  content: CompiledDeck;
  /** <head><title> 的内容。 */
  title?: string;
  warnings: CompileDiagnostic[];
  /** 写法错误，这一页会编译失败或缺内容。 */
  errors: CompileDiagnostic[];
  /** 被编译器丢弃的写法（不支持的 CSS、标签）。 */
  unsupported: CompileDiagnostic[];
  /** 为了让表格行列对齐而删掉的单元格数量。 */
  cellRemovals: number;
  /** 移到 <head> 的元素个数。 */
  hoisted: number;
  notes: CompileNote[];
  /** 排版建议（比如文字会在词中间断行），不影响编译。 */
  lints: CompileDiagnostic[];
  files: CompileFileRef[];
}

export interface NormalizedDeckFace {
  family: string;
  href?: string;
  src?: string;
}

/** normalizeDeckMetadata 的输出：缺省字段补齐，非法项丢掉。 */
export interface NormalizedDeckMetadata {
  v: number;
  title: string;
  cover?: string;
  order: string[];
  sections: Record<string, unknown>;
  faces: Record<string, NormalizedDeckFace>;
  designSystems: Record<string, unknown>[];
  attachments: Record<string, unknown>;
  readonly [field: string]: unknown;
}

export interface SlidesRuntime {
  compileSlideHtml(html: string, options?: CompileOptions): CompileResult;
  serializeSlideHtml(deck: CompiledDeck, slide: CompiledSlide): string;
  normalizeDeckMetadata(raw: unknown): NormalizedDeckMetadata;
}
