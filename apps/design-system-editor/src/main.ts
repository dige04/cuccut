import '@cuccut/design-system-runtime/app.css';
import { createDesignSystemRuntime } from '@cuccut/design-system-runtime';
import { installDesignSystemEditorHost } from '@cuccut/design-system/editor';

// 先装宿主（globalThis.designSystemHost），再照原页面的入口启动运行时：运行时启动时就读宿主能力（docs/design/canvas §10.2、§10.3）。
installDesignSystemEditorHost();
createDesignSystemRuntime();
