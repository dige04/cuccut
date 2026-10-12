/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";
import type { SlideId } from "../deck-contracts";

/** What the editor persists across reloads: presentation mode, the current slide and the selection. */
export interface EditorViewState {
  presenting: boolean;
  slideId: SlideId | null;
  /** Node selections of the current slide; opaque until the editor validates it on restore. */
  selection: unknown;
}
/** The mounted editor's hooks into the view-state store. */
export interface EditorViewStateAdapter {
  snapshot(): EditorViewState;
  /** True while the editor holds uncommitted work and should not take remote updates. */
  busy(): boolean;
  restore(state: EditorViewState): void;
}

declare module "../bindings" {
  interface RuntimeBindings {
    editorViewStateAdapter: EditorViewStateAdapter | undefined;
    deferredEditorViewState: EditorViewState | undefined;
    parseEditorViewState: (state: unknown) => EditorViewState | undefined;
    registerEditorViewStateAdapter: (
      adapter: EditorViewStateAdapter,
    ) => () => void;
    captureEditorViewState: () => EditorViewState | undefined;
    editorViewStateBusy: () => boolean;
    restoreEditorViewState: (value: unknown) => void;
  }
}

export function installEditorViewState(runtime: RuntimeBindings): () => void {
  var editorViewStateAdapter: RuntimeBindings["editorViewStateAdapter"];
  var deferredEditorViewState: RuntimeBindings["deferredEditorViewState"];
  var captureEditorViewState: RuntimeBindings["captureEditorViewState"];
  var editorViewStateBusy: RuntimeBindings["editorViewStateBusy"];
  function parseEditorViewState(state: unknown): EditorViewState | undefined {
    if (typeof state !== "object" || state === null) {
      return;
    }
    let record = state as Record<string, unknown>;
    return {
      presenting: record.presenting === true,
      slideId: typeof record.slideId === "string" ? record.slideId : null,
      selection: record.selection,
    };
  }
  function registerEditorViewStateAdapter(
    adapter: EditorViewStateAdapter,
  ): () => void {
    editorViewStateAdapter = adapter;
    if (deferredEditorViewState !== undefined) {
      let value = deferredEditorViewState;
      deferredEditorViewState = undefined;
      adapter.restore(value);
    }
    return (): void => {
      if (editorViewStateAdapter === adapter) {
        editorViewStateAdapter = undefined;
      }
    };
  }
  function restoreEditorViewState(value: unknown): void {
    let viewState = parseEditorViewState(value);
    if (viewState === undefined) {
      return;
    }
    if (editorViewStateAdapter !== undefined) {
      editorViewStateAdapter.restore(viewState);
    } else {
      deferredEditorViewState = viewState;
    }
  }
  bindRuntimeValue(
    runtime,
    "editorViewStateAdapter",
    () => editorViewStateAdapter,
    (value) => {
      editorViewStateAdapter = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "deferredEditorViewState",
    () => deferredEditorViewState,
    (value) => {
      deferredEditorViewState = value;
    },
  );
  bindRuntimeValue(runtime, "parseEditorViewState", () => parseEditorViewState);
  bindRuntimeValue(
    runtime,
    "registerEditorViewStateAdapter",
    () => registerEditorViewStateAdapter,
  );
  bindRuntimeValue(
    runtime,
    "captureEditorViewState",
    () => captureEditorViewState,
    (value) => {
      captureEditorViewState = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "editorViewStateBusy",
    () => editorViewStateBusy,
    (value) => {
      editorViewStateBusy = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "restoreEditorViewState",
    () => restoreEditorViewState,
  );
  return () => {
    captureEditorViewState = (): EditorViewState | undefined =>
      editorViewStateAdapter?.snapshot();
    editorViewStateBusy = (): boolean =>
      editorViewStateAdapter?.busy() === true ||
      (0, runtime.hasVideoShrinkJobs)();
  };
}
