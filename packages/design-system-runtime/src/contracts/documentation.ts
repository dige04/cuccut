import type * as React from "react";
import type * as Core from "../contracts";
import type * as Application from "./application";
import type * as Files from "./file-browser";
import type * as Tokens from "./token-editors";
export interface SelectionStyleState {
  bold: boolean;
  italic: boolean;
  code: boolean;
  link: boolean;
}
export interface MarkdownFormattingToolbarProps {
  root: React.RefObject<HTMLElement | null>;
  hold: React.RefObject<HTMLDivElement | null>;
  onApplied(): void;
  onLeave(): void;
  className?: string;
}
export interface MarkdownLinkPopoverProps {
  root: React.RefObject<HTMLElement | null>;
  className?: string;
}
export interface MarkdownLinkState {
  href: string;
  rect: DOMRect;
}
export interface MarkdownAutoformatState {
  intermediate: string;
  undoArmed: boolean;
  redoArmed: boolean;
}
export type MarkdownShortcutBlock =
  | "p"
  | "h1"
  | "h2"
  | "h3"
  | "quote"
  | "ul"
  | "ol";
export interface UntrustedMarkdownBlock {
  readonly type?: unknown;
  readonly text?: unknown;
  readonly items?: unknown;
  readonly src?: unknown;
  readonly alt?: unknown;
  readonly size?: unknown;
  readonly rows?: unknown;
  readonly header?: unknown;
}
export type NormalizedMarkdownBlock =
  | Core.MarkdownBlock
  | { type: "p"; text: undefined };
export type CommitQueueRegistration = Pick<
  Core.MarkdownCommitQueue<unknown>,
  "flush" | "pending" | "dispose"
>;
export interface DocumentSectionsProps {
  docs: Core.ParsedDesignSystem["docs"];
  edit?: { setText(path: string, markdown: string): void; done(): void };
  headFor(
    document: Core.ParsedDesignSystem["docs"][number],
  ): Tokens.SectionHead;
}
export interface EditorCardTarget {
  kind: string;
  key: string;
  focus?: boolean | "title";
}
export interface EditorCardFlashState {
  reveal: React.Dispatch<React.SetStateAction<EditorCardTarget | null>>;
  pending: EditorCardTarget | null;
}
export interface SectionNavigationProps {
  sections: React.RefObject<Record<string, HTMLElement | null | undefined>>;
  port: HTMLElement | null;
  shown(target: Application.EditorSectionReveal): void;
  miss(target: Application.EditorSectionReveal): void;
}
export interface SectionNavigationState {
  reveal(target: Application.EditorSectionReveal): void;
  release(): void;
}
export interface SectionNavigationTarget
  extends Application.EditorSectionReveal {
  until: number;
}
export interface SectionFlash {
  el: HTMLElement;
  timer: number;
}
export type ExternalLinkProps =
  React.AnchorHTMLAttributes<HTMLAnchorElement> & { "data-href"?: string };
export type LinkKeyEvent = React.KeyboardEvent<HTMLElement>;
export interface MarkdownToolbarController {
  open: boolean;
  style: React.CSSProperties;
  placed: "above" | "below";
  stripRef: React.RefObject<HTMLElement | null>;
  range(): Range | null;
  refresh(): void;
}

export interface TypeDeclaration {
  kind: "interface" | "type" | "const" | "enum";
  head: string;
  body: string;
}
export interface TypeBodyMember {
  name: string;
  optional: boolean;
  type: string;
  doc: string;
}
export type InferredControl = Pick<
  Core.InferredPropControl,
  "kind" | "options" | "numeric" | "withBool" | "typeName"
>;
export interface TypeInferenceState {
  literals: string[];
  numeric: boolean;
  str: boolean;
  num: boolean;
  bool: boolean;
  node: boolean;
  other: boolean;
  unresolved: string[];
}
export interface TypeDeclarationResolver {
  readonly texts: readonly string[];
  readonly textBytes: number;
  decls: Map<string, TypeDeclaration | null>;
  named: Map<string, InferredControl | null>;
  busy: Set<string>;
  work: number;
  scanned: number;
  headBodies: Map<string, string[]>;
  bodies: Map<string, TypeBodyMember[]>;
  reuse(): this;
  tick(units?: number): void;
  charge(characters: number): void;
  heads(typeText: string): string[];
  members(body: string): TypeBodyMember[];
  decl(name: string): TypeDeclaration | null;
  resolve(typeText: string, depth: number): InferredControl | null;
  resolveName(name: string, depth: number): InferredControl | null;
  arms(typeText: string, depth: number, state: TypeInferenceState): void;
  special(typeText: string, depth: number): InferredControl | null | undefined;
  extract(
    isExtract: boolean,
    sourceType: string,
    filterType: string,
    depth: number,
  ): InferredControl | null;
  keysOf(name: string, isTypeof: boolean, depth: number): string[] | null;
  memberType(name: string, property: string, depth: number): string | null;
  template(templateText: string, depth: number): string[] | null;
  control(state: TypeInferenceState, typeText: string): InferredControl | null;
}
export interface TypeDeclarationResolverConstructor {
  new (texts: readonly string[]): TypeDeclarationResolver;
}
export interface ResolverCache {
  texts: readonly string[];
  rs: TypeDeclarationResolver;
}
export interface TokenNameGroup<Token> {
  name: string;
  tokens: Token[];
}
export interface ColorPaletteGroup
  extends TokenNameGroup<Core.NormalizedTokens["color"]["tokens"][number]> {
  numeric: boolean;
}
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };
export interface ComponentMountOptions {
  namespace: string;
  globals: readonly string[];
  values: { [name: string]: JsonValue };
}

export interface RawDocComponent {
  readonly name?: unknown;
  readonly group?: unknown;
  readonly summary?: unknown;
  readonly page?: unknown;
}
export interface CheckedDocComponent extends RawDocComponent {
  readonly name: string;
}
export interface RawDocLibrary {
  readonly name?: unknown;
  readonly version?: unknown;
  readonly file?: unknown;
  readonly global?: unknown;
}
export interface CheckedDocLibrary extends RawDocLibrary {
  readonly name: string;
  readonly version: string;
}
export interface RawDocManifest {
  readonly files?: unknown;
  readonly components?: unknown;
  readonly libraries?: unknown;
  readonly namespace?: unknown;
  readonly assetGroups?: unknown;
  readonly storage?: { readonly files?: unknown } | null;
}
export interface DocumentationComponent {
  name: string;
  group: string;
  summary: string;
  page: boolean;
  readme: boolean;
}
export interface DocumentationLibrary {
  name: string;
  version: string;
  file: string | null;
  global: string | null;
}
export interface ManifestDocumentationFacts {
  ns: string | null;
  comps: DocumentationComponent[];
  libs: DocumentationLibrary[];
  bundle: boolean;
  listed: boolean;
  css: boolean;
  dts: boolean;
  tokensCss: boolean;
  icon: string | null;
}
export interface ApiDocumentationCard {
  kind: string;
  name: string;
  purpose: string;
  path: string;
  text: string;
}
export interface ComponentApiCards {
  iconNames: string[];
  icons: ApiDocumentationCard | null;
  components: ApiDocumentationCard[];
}
export interface CachedComponentApiCards {
  dts: string | null;
  key: string;
  out: ComponentApiCards;
}
export interface ColorDocumentationGroup {
  key: string;
  title: string;
  test: RegExp;
}
export interface ConsumptionDocumentationOptions {
  tokens: Core.NormalizedTokens | null;
  manifest: RawDocManifest;
  dts: string | null;
  readme: string;
  assetReadmes: Core.FileTable;
  root?: string;
  cssReadsTokens?: boolean;
  tokenCards?: "single" | "per-group" | "inline";
}
export interface CssReadsTokensCache {
  css: string;
  tokens: string | null;
  reads: boolean;
}
export interface ConsumptionDocumentationCache {
  key: (string | null)[];
  notes: string;
  out: Core.ConsumptionDocumentation;
}
export type DocDeclarationRange = [
  kind: string,
  docStart: number,
  declarationStart: number,
  end: number,
];
export type DocPropRow = [
  name: string,
  required: string,
  type: string,
  doc: string,
];
export type DocPropOrigin = [row: DocPropRow, origin: string];
export type DocResolvedProps = [
  rows: DocPropRow[],
  external: string[],
  unresolved: string | null,
];
export type DocComponentPart = [
  name: string,
  propsName: string | null,
  rows: DocPropRow[] | null,
];
export interface DocComponentParts {
  parts: DocComponentPart[];
  callable: boolean;
}
export interface DocImportName {
  name: string;
  from: string;
}
export interface DocStoredFile {
  store?: unknown;
  id?: unknown;
}
export interface RawDocAssetFile {
  path?: unknown;
  id?: unknown;
}
export interface CheckedDocAssetFile extends RawDocAssetFile {
  path: string;
  id: string;
}
export interface RawDocAssetGroup {
  name?: unknown;
  files?: unknown;
}
export interface CheckedDocAssetGroup extends RawDocAssetGroup {
  name: string;
}

/** The Markdown toolbar sets a valid CSS custom property on the strip. */
export interface MarkdownStripStyle extends React.CSSProperties {
  "--mc-strip-pad"?: string;
}
