import { loadRenderPlanner } from '@cuccut/ui/preview-kernel';

/** Result of `cuccutKernelCheck()`: which fonts the kernel injected, and a text box measured by the kernel. */
export interface KernelCheck {
  fonts: string[];
  box: { width: number; height: number };
}

declare global {
  var cuccutKernelCheck: (() => Promise<KernelCheck>) | undefined;
}

/**
 * Self-check entry point for the renderer build output (`npm run check:file-fonts`, `tools/check-file-fonts.mjs`): built along with the output, and the app itself does not load it.
 * After the check script opens the real `index.html` under `file://`, it dynamically imports this file and calls `cuccutKernelCheck()`: this goes through the same loading path as the preview
 * (the same module instance: WASM, reading all fonts by relative address, injection), then the kernel measures a text box. If any one font cannot be read, loading is rejected.
 */
globalThis.cuccutKernelCheck = async () => {
  const planner = await loadRenderPlanner();
  const style = { fontSize: 24, fontWeight: 'bold', lineHeight: 1.2 };
  // i18n-ignore: sample text used for measuring (it must contain Chinese, so that Chinese fonts can be measured)
  const box = planner.measureText('输入文字 CucCut', style, null, { width: 1920, height: 1080 });
  return { fonts: planner.fontFiles(), box };
};
