/**
 * Types for the entry points of the runtime compiler that CucCut uses (slides_check calls the built dist/node/compiler.cjs through slides-compiler.ts).
 * The shapes CucCut uses are hand-written here from the source:
 *   compiler/html.ts        compileSlideHtml
 *   serialization/html.ts   serializeSlideHtml
 *   model/deck-metadata.ts  normalizeDeckMetadata
 * Paths are relative to packages/slides-runtime/src. Node does not import the runtime source directly: it goes through the editor build bundle (which includes the PptxGenJS patch).
 */

/** Positions reported by the compiler point to the line and column of the input HTML (1-based). */
export interface SourcePosition {
  line: number;
  col: number;
}

export interface CompileDiagnostic extends SourcePosition {
  message: string;
}

/** Merged explanation for one kind of message; count is the number of occurrences. */
export interface CompileNote extends SourcePosition {
  key: string;
  count: number;
}

/** Files referenced by a page but not in fileMap (collected when collectFiles: true). */
export interface CompileFileRef extends SourcePosition {
  ref: string;
  kind: 'image' | 'font' | (string & {});
}

export interface CompileOptions {
  /** The lists in deck.json; only "css" is meaningful. */
  lists?: 'css';
  collectFiles?: boolean;
  fileMap?: ReadonlyMap<string, string>;
}

/** A compiled single page. Its many fields change between versions, so only those this site reads are declared. */
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
  /** Content of `<head><title>`. */
  title?: string;
  warnings: CompileDiagnostic[];
  /** Writing error: this page will fail to compile or will be missing content. */
  errors: CompileDiagnostic[];
  /** Constructs discarded by the compiler (unsupported CSS, tags). */
  unsupported: CompileDiagnostic[];
  /** Number of cells removed to keep table rows and columns aligned. */
  cellRemovals: number;
  /** Number of elements moved into `<head>`. */
  hoisted: number;
  notes: CompileNote[];
  /** Layout suggestion (e.g. text will break in the middle of a word); does not affect compilation. */
  lints: CompileDiagnostic[];
  files: CompileFileRef[];
}

export interface NormalizedDeckFace {
  family: string;
  href?: string;
  src?: string;
}

/** Output of normalizeDeckMetadata: missing fields filled in, invalid items dropped. */
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
