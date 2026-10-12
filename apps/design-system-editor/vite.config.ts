import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { bundledPackageDirs, thirdPartyLicenses } from './licenses.mjs';

/** 按 Node 的查找方式，从本目录往上找一个包装在哪（npm 别名包没有可解析的入口，不能用 require.resolve）。 */
function packageDir(name: string): string {
  for (let dir = import.meta.dirname; ; dir = dirname(dir)) {
    const candidate = join(dir, 'node_modules', name);
    if (existsSync(join(candidate, 'package.json'))) return candidate;
    if (dirname(dir) === dir) throw new Error(`Cannot find ${name}; run npm install`);
  }
}

/**
 * 组件预览用的 React 18.3.1 UMD（npm 别名 react-18 / react-dom-18 的原文件）。运行时原本从 jsDelivr 加载，
 * CucCut 改成页面自带的这两份（packages/design-system-runtime/src/model/libraries.ts），放在 artifact-type/vendor/。
 */
const VENDOR_FILES = [
  { fileName: 'artifact-type/vendor/react.production.min.js', source: () => join(packageDir('react-18'), 'umd', 'react.production.min.js') },
  { fileName: 'artifact-type/vendor/react-dom.production.min.js', source: () => join(packageDir('react-dom-18'), 'umd', 'react-dom.production.min.js') },
];

function previewVendorFiles(): Plugin {
  return {
    name: 'cuccut-design-system-vendor-files',
    apply: 'build',
    generateBundle() {
      for (const file of VENDOR_FILES) this.emitFile({ type: 'asset', fileName: file.fileName, source: readFileSync(file.source()) });
    },
  };
}

/** 页面与上面两个文件打进去的第三方代码的原始许可，放在产物根目录的 third-party-licenses.txt。 */
function editorLicenses(): Plugin {
  return {
    name: 'cuccut-design-system-editor-licenses',
    apply: 'build',
    generateBundle() {
      const source = thirdPartyLicenses(bundledPackageDirs([...this.getModuleIds(), ...VENDOR_FILES.map(file => file.source())]));
      this.emitFile({ type: 'asset', fileName: 'third-party-licenses.txt', source });
    },
  };
}

/**
 * 设计系统编辑器页面（docs/design/canvas §10.2）：由 Runtime 在 `/design-system/<grant>/` 下提供，所以资源用相对地址。
 * 运行时是工作区里的 @cuccut/design-system-runtime，页面模板是本目录的 index.html；public/artifact-type/run.html 是预览的
 * runner，原样拷进产物。
 */
export default defineConfig({
  root: import.meta.dirname,
  base: './',
  plugins: [previewVendorFiles(), editorLicenses()],
  build: {
    target: 'es2022',
    outDir: resolve(import.meta.dirname, 'dist'),
    emptyOutDir: true,
    // 运行时本身就是一个大包（React、各章节的编辑器、预览与文件表）
    chunkSizeWarningLimit: 4000,
    rollupOptions: {
      // @base-ui 等依赖带 "use client" 指令，打成单包时 Rollup 会逐个警告，这里没有意义。
      onwarn(warning, warn) {
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return;
        warn(warning);
      },
    },
  },
});
