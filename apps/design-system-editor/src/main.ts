import '@cuccut/design-system-runtime/app.css';
import { createDesignSystemRuntime } from '@cuccut/design-system-runtime';
import { installDesignSystemEditorHost } from '@cuccut/design-system/editor';

// Install the host (globalThis.designSystemHost) first, then start the runtime through the original page's entry: the runtime reads the host's capabilities as soon as it starts (docs/design/canvas §10.2, §10.3).
installDesignSystemEditorHost();
createDesignSystemRuntime();
