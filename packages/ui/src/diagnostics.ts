// Entry point for diagnostics and benchmarks (the page side of `npm run bench:preview`, `apps/desktop/src/renderer/preview-bench.ts`): it is built with the artifacts, and the app itself does not load it.
// It shares the same module instance as the app, so it can find the engine from the preview canvas on the page and open a video through the shell.
export { useShell } from './state/shell-store.ts';
export { previewEngineOf, type PlaybackStats } from './components/editor/preview-engine.ts';
export type { StallReport } from './components/editor/preview-watch.ts';
