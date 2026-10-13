import '@cuccut/slides-runtime/app.css';
import { createSlidesRuntime } from '@cuccut/slides-runtime';
import { installEditorHost } from '@cuccut/slides/editor';

// Install the host first (globalThis.slidesHost), then start the runtime: the runtime reads the host capabilities as soon as it starts (docs/design/slides §5).
installEditorHost();
createSlidesRuntime();
