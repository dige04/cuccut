/** Values at user-authored JavaScript, React host and expression boundaries. */
export type RuntimeValue = any;

/** Public types recovered from the component registry, keyframe tracks and bridge. */
export interface Keyframe {
  t: number;
  v: string | number;
  ease?: string;
  [metadata: string]: unknown;
}
export interface PropsMetadata {
  props: Record<string, unknown> | null;
  preview: Record<string, unknown> | null;
}
export interface ParsedDesignComponent extends PropsMetadata {
  template: string;
  js: string;
}
export interface ComponentEntry {
  html: string;
  tpl: ((values: Record<string, unknown>, host?: unknown) => unknown) & { __annotated?: string } | null;
  Logic: any;
  jsStreaming: boolean;
  htmlStreaming: boolean;
  ver: number;
  subs: Set<() => void>;
  fetched: boolean;
  propsMeta?: Record<string, { default?: unknown }>;
  preview?: Record<string, unknown>;
  propOverrides?: Record<string, unknown> | null;
  tplStale?: boolean;
  jsSeq?: number;
  logicError?: string | null;
}
export interface ComponentRegistry {
  entries: Record<string, ComponentEntry>;
  get(name: string): ComponentEntry;
  bump(name: string): void;
  bumpAll(): void;
}
export interface StreamingTracker {
  push(name: string, streaming: boolean, source?: string): void;
  live(name?: string): boolean;
}
export interface RuntimeOptions { omelette?: boolean }
export interface RuntimeWindow {
  React?: any;
  ReactDOM?: any;
  Babel?: any;
  __resources?: Record<string, string>;
  __resourceBlobs?: Record<string, Blob>;
  __dcRuntimeMode?: string;
  __dcContentKeyed?: boolean;
  [name: string]: any;
}
declare global {
  interface Window {
    React: any;
    ReactDOM: any;
    Babel: any;
    __resources?: Record<string, string>;
    __resourceBlobs?: Record<string, Blob>;
    __dcRuntimeMode?: string;
    __dcContentKeyed?: boolean;
    [name: string]: any;
  }
}

export interface TemplateHost {
  __name?: string;
  __streamingNow?: boolean;
  __htmlStreamingNow?: boolean;
}
export type RenderValues = Record<string, RuntimeValue>;
export type CompiledTemplate = ((values: RenderValues, host?: TemplateHost) => RuntimeValue) & {
  __annotated?: string;
};
export interface TemplateContext {
  component(name: string): RuntimeValue;
  placeholder(props: Record<string, RuntimeValue>): RuntimeValue;
  helmet(element: Element): RuntimeValue;
  loadExternal(kind: string, url: string, previousLoad?: Promise<unknown>): Promise<unknown>;
  resolveExternal(url: string, name: string): RuntimeValue;
  resolveExternalGlobal(url: string, name: string): RuntimeValue;
  resolveExternalError(url: string, name: string): string | null;
  pseudoClass(pseudo: string, css: string): string;
  keyframesPlayhead(): number;
  omelette: boolean;
}
export interface DesignRuntime {
  registry: ComponentRegistry;
  getDC(name: string): RuntimeValue;
  updateHtml(name: string, html: string): void;
  updateJs(name: string, javascript: string): void;
  dcUpdate(name: string, kind: 'html' | 'js' | 'props', content: string, streaming?: boolean): void;
  setProps(name: string, props: RenderValues | null): void;
  seekKeyframes(time: number): void;
  keyframesPlayhead(): number;
  adoptParsed(name: string, parsed: ParsedDesignComponent | null): void;
  setRootName(name: string): void;
  markFetched(name: string): void;
  annotatedTemplate(name: string): string | null;
  templateSource(name: string): string | null;
  StreamableLogic: RuntimeValue;
}
