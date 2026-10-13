import '@cuccut/design-runtime/app.css';
import { createDesignRuntime } from '@cuccut/design-runtime';
import { initializeThemeFromSystem } from '@cuccut/design-runtime/theme';
import { installDesignEditorHost } from '@cuccut/design/editor';

// Install the host (globalThis.designHost) first, then follow the system light/dark mode and start the runtime through the original page's entry: the runtime reads the host's capabilities as soon as it starts (docs/design/canvas §4, §5).
installDesignEditorHost();
initializeThemeFromSystem();
createDesignRuntime();
