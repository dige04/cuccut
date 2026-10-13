import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EditorSemantics, EditorWasmUnavailable, semanticsApi } from './semantics.ts';

export * from './semantics.ts';

const RELATIVE = path.join('generated', 'editor.wasm');
const IN_REPO = path.join('packages', 'editor-wasm', 'src', RELATIVE);

let loaded: EditorSemantics | null = null;

/**
 * Location of the WASM file: `generated/editor.wasm` next to this module. When the Runtime is bundled into another bundle, search upward from the bundle for `packages/editor-wasm/src/generated/editor.wasm` in the repo (same method as finding cargo artifacts). Returns null if not found.
 */
export function locateEditorWasm(here = path.dirname(fileURLToPath(import.meta.url))): string | null {
  const beside = path.join(here, RELATIVE);
  if (existsSync(beside)) return beside;
  // Multiple main-process entries share this module in a Rollup `chunks/` file.
  // The WASM is still shipped beside the entry points, outside that directory.
  if (path.basename(here) === 'chunks') {
    const bundled = path.join(path.dirname(here), RELATIVE);
    if (existsSync(bundled)) return bundled;
  }
  for (let dir = here; ; dir = path.dirname(dir)) {
    const candidate = path.join(dir, IN_REPO);
    if (existsSync(candidate)) return candidate;
    if (path.dirname(dir) === dir) return null;
  }
}

/** Loads once, then reuses synchronously. Throws `EditorWasmUnavailable` if not built. */
export function editorSemantics(): EditorSemantics {
  if (loaded) return loaded;
  const file = locateEditorWasm();
  if (!file) throw new EditorWasmUnavailable('generated/editor.wasm not found');
  const bytes = readFileSync(file);
  loaded = EditorSemantics.instantiate(
    new Uint8Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer),
  );
  return loaded;
}

/** Whether the WASM has been built (tests skip based on this). */
export function editorWasmAvailable(): boolean {
  return locateEditorWasm() !== null;
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
