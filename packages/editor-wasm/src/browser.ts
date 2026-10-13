import { EditorSemantics, EditorWasmUnavailable, semanticsApi } from './semantics.ts';

export * from './semantics.ts';

/**
 * Loading in the browser: Vite inlines `generated/editor.wasm` into the bundle as a data URL (the dev server and the packaged file:// page take the same path, same as the WASM for preview). Uses an eager glob instead of a static import: without a build, this gets an empty object and only errors when called, so the rest of the UI still loads.
 * The Vite config must list `.wasm` in `assetsInclude`.
 */
const inlined = import.meta.glob<string>('./generated/editor.wasm', { eager: true, query: '?inline', import: 'default' });

let loaded: EditorSemantics | null = null;

function dataUrl(): string | null {
  return Object.values(inlined)[0] ?? null;
}

function decodeDataUrl(url: string): Uint8Array<ArrayBuffer> {
  const binary = atob(url.slice(url.indexOf(',') + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Loads once, then reuses synchronously. Throws `EditorWasmUnavailable` if not built. */
export function editorSemantics(): EditorSemantics {
  if (loaded) return loaded;
  const url = dataUrl();
  if (!url) throw new EditorWasmUnavailable('generated/editor.wasm is not in the bundle');
  loaded = EditorSemantics.instantiate(decodeDataUrl(url));
  return loaded;
}

/** Whether the WASM has been built. */
export function editorWasmAvailable(): boolean {
  return dataUrl() !== null;
}

/** Each function: see the same-named method on `EditorSemantics`. */
export const {
  speechSentences,
  stageBox,
  stagePlace,
  placeDefault,
  engineRanges,
  elementPresets,
  speakerProposal,
  applySpeakers,
  sourceChapters,
} = semanticsApi(editorSemantics);

/** Same name as on the Node side; there are no file paths in the browser. */
export function locateEditorWasm(): string | null {
  return null;
}
