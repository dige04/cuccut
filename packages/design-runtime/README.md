# design-runtime

设计稿（画布）编辑器的运行时：画布与画板、属性编辑、预览文档的构建、画板运行时、注入脚本、快速编辑 Worker 与导出。源码按 1:1 移植自 Claude Design 类型的 TypeScript 重建（`src/design-type`），文件格式（`canvas.json` v3、`*.dc.html`、`support.js` / `dc-runtime.js`、快速编辑 Worker、`/_blob/<id>` 素材）、界面、行为与模块结构都不改，只改 CucCut 托管必需的部分，改动处带 `CucCut:` 注释（见下）。`apps/design-editor` 把它打成编辑器页面，宿主能力由 `packages/design` 的 shim 提供。用户可见的行为见[产品设计 §3.3](../../docs/product/product-design.md#33-功能区ux-07)。

## 结构

模块两阶段安装：每个模块导出 `install<名字>(runtime)`，先登记函数与可变绑定，返回的初始化函数再按固定顺序执行；模块之间只经 `runtime.<名字>` 互相访问。安装顺序在 `app-runtime.ts`，`createDesignRuntime()` 装完模块后挂界面。

类型：保留原工程的 `Dynamic`（即 `any`），不给整个代码库补类型。根 `tsconfig.json` 一次检查所有包，所以不加全局或 `react` 的类型增补：原工程的 `react-css.d.ts`（给 `CSSProperties` 加 `--变量`）没有搬过来，运行时里的内联样式本来就是 `Dynamic`，不需要它。`env.d.ts` 是 CucCut 加的，引入 `vite/client` 给 `?raw` 导入用（原工程写在自己的 tsconfig 里）。`application/design-bootstrap.tsx` 有一处 `@ts-expect-error`：TS 把原表达式 `x ?? null` 判为恒为空（TS2871），表达式照原样保留。

| 路径 | 内容 |
| --- | --- |
| `app-runtime.ts`、`dependencies.tsx`、`module-helpers.ts` | 入口与安装顺序；npm 依赖与 `generated/` 脚本文本的登记；CommonJS / ESM 互操作 |
| `runtime-types.ts`、`runtime-contracts.ts`、`ui-runtime-contracts.ts`、`types.ts`、`globals.d.ts`、`contracts/` | 绑定表与各模块之间的协议类型；页面全局 |
| `application/`、`bootstrap/` | 启动、设计稿根节点与封面；跟随系统明暗 |
| `canvas/`、`editor/`、`properties/`、`geometry/`、`find/` | 画布、画板、选择、侧栏、属性面板、吸附与变换、查找 |
| `preview/`、`scripts/` | 画板的预览文档（依赖图、模块缓存、CSS 与素材改写）；注入画板的脚本（预览桥、存储、XHR / fetch、截图、属性拖动等） |
| `runtime/` | 画板运行时，打成 `dc-runtime.js` 与导出文件用的 `support.js`（React 18；Babel 按需加载，不打进去） |
| `fast-edit/`、`worker/` | 快速编辑：控制器、草稿、日志；happy-dom Worker（`fast-edit-worker.js`） |
| `platform/` | 宿主能力、文件读写与发布、外部改动、frame 协议、权限、上报（已关） |
| `comments/`、`collaboration/` | 标注锚点与区域；多人在线的光标与选择（单用户下不出现） |
| `design-system/` | 设计稿引用的设计系统：已装列表、tokens 与字体解析 |
| `export/`、`assets/`、`thumbnail/` | HTML / PDF / 图片 / 压缩包导出；图片放置；缩略图 |
| `cds/` | 原平台的组件库（主题、弹层、表单、图标） |
| `app.css` | 编辑器界面的样式（含内联的图标字体） |
| `generated/` | 构建产物，不进 git：`apps/design-editor/build.mjs` 用 esbuild 打出的脚本文本，`dependencies.tsx` 以 `?raw` 导入 |
| `tools/worker-browser-plugin.mjs` | 打 Worker 时把 Node 内置模块换成浏览器适配（原工程的同名插件） |

## 宿主与平台

代码里以 `CucCut:` 注释标出，页面模板 `apps/design-editor/index.html` 的改动写在它开头的注释里。

- **宿主接口**：运行时从 `globalThis.designHost` 读宿主能力，原运行时读 `globalThis.claude`，每个读取点与提到它的报错文案都改了。宿主对象由 `packages/design/src/editor` 的 `installDesignEditorHost()` 装上，复用 `@cuccut/slides/editor` 的 `connectEditorHost`；提供哪些能力、缺的能力运行时怎么兜底，见 `packages/design/src/editor/design-host.ts`。
- **功能开关固定**：页面模板装固定取值的 `__appifact_flags`，不向宿主要；快速编辑关（不提供 `sample`），跨画布粘贴前确认开，其余是运行时读开关时的默认值。不装健康上报 `__appifact_health`。
- **能力声明**：页面的 `appifact-capabilities` 去掉 `room`、`sample`、`flags`；运行时只读其中的 `db` 与 `downloads`。
- **不信任外部来源**：父窗口的 origin 白名单为空（`platform/design-source.tsx`、`platform/frame-host-bridge.tsx`）；frame 协议另认 `__FRAME_PREAMBLE.trustParent`，只信任 `window.parent` 本身、回消息用 `"*"`（桌面端父页面是 `file://`，origin 为 `null`），由 `packages/design` 的 shim 在 CucCut 的 iframe 里声明，CucCut 借此驱动整份导出（[产品设计 §3.3](../../docs/product/product-design.md#33-功能区ux-07)）；链接不放行原平台的应用 scheme、编辑器扩展与网域（`cds/links.tsx`），设计系统不从托管地址安装（`design-system/install-identifiers.ts`）；桌面端按 Electron 判断（`cds/platform/runtime.ts`）。
- **不上报**：没有使用分析（`platform/health-and-analytics.ts`）。
- **字体**：不内置品牌字体，Anthropic Sans 退回系统字体（`app.css`），页面不从 `/_runtime/` 预载字体。
- **文案**：界面里称智能体为「the agent」。
- **页面模板**：不带写给托管平台的 README 注释与 meta、`mega-build-stamp`。
- **Babel 的来源**：画板 x-import 了 JSX 时运行时才加载 Babel standalone，原版从 CDN 取，编辑器的 CSP 不放行 CDN。预览文档用 `window.__resources` 把 CDN 地址映射到编辑器自带的 `artifact-type/babel.min.js`（页面 meta `dc-babel-file`，`preview/runtime-loading.ts` 的 `getBabelFileUrl`、`preview/build-document.ts`）；整份 HTML 导出要内嵌 Babel 时也从这份取（`export/asset-resolver.ts`），与 CDN 上的文件逐字节相同，过得了导出的完整性校验。
- **导出体积上限**：运行时交给宿主的单个导出文件原版最多 16 MB，CucCut 改为 256 MB，与一份设计稿的文件总量上限相同（`export/downloads.tsx`；保存桥另限 512 MB），超限提示里的数字跟着上限走（`export/html-producer.ts`、`canvas/design-canvas.tsx`）。

从 `src/design-type` 原样继承、与线上原页面不同的一点：

- 画板运行时的 React 18.3.1 用 npm 别名 `react-18` / `react-dom-18`（声明在 `apps/design-editor/package.json`）：`dc-runtime.js` 打进它们的 CommonJS 版本，两份 UMD 文件原样内嵌在页面里，导出时写成 `vendor/react.js`、`vendor/react-dom.js`。编辑器界面用工作区的 React 19，两者不混用。

## 重建代码的修正

重建代码里有几处从压缩代码还原时绑错的标识符，与原脚本对照后改回，带 `CucCut: restorer fix` 注释：

- `scripts/preview-viewport.ts`：调用保存下来的原生 `focus`（原脚本 `native.call`），重建代码调用了包装函数自己，聚焦画板里的元素时无限递归。
- `scripts/preview-storage.ts`：读作用域内的存储 `n`（原脚本 `real`），重建代码读成了循环上限的 `length.length` / `length.key`，列出画板存储的键时报错。
- `scripts/preview-xhr.ts`：按请求的 `responseType`（原脚本 `rt`）分支，重建代码判断的是响应文本，arraybuffer / blob / json / document 都按文本返回，6 处。
- `fast-edit/element-targets.ts`：点击位置用外层的 `x`（`click.x`），重建代码拿元素条目和矩形比，画板子元素横向永远命中不了。

另有两处不是绑错，带 `CucCut: restored from the shipped dc-runtime` 注释。`runtime/boot.ts` 的 `ensureReactAvailable` 在重建代码里是空函数（理由是 React 从 npm 打进来了）。编辑器里的预览与 `dc-runtime.js` 确实自带 React，但导出的整份 HTML 把 React 按 CDN 地址内嵌在 `window.__resources` 里，只有这个函数去找，画板因此白屏。按线上原版改回：页面上已有 React 就跳过，否则经 `resolveScriptResource` 找到内嵌的那份加载。

`runtime/resources.tsx` 的 `ensureBabel` 同样按线上原版改回：重建代码把 npm 的 `@babel/standalone` 7.29.0 打进画板运行时（`dc-runtime.js` 约 7.2 MB、`support.js` 约 6.1 MB，导出的整份 HTML 每个画板各带一份，约 7 个画板就超出 16 MB），原版只在 x-import 了 JSX 时才加载：页面上已有 Babel 就跳过，否则经 `resolveScriptResource` 找到映射的那份（没有映射就用 CDN 地址）。改回后 `dc-runtime.js` 约 1.2 MB、`support.js` 约 0.1 MB，Babel 另成 `artifact-type/babel.min.js`（约 3.1 MB），整份 HTML 导出只在有画板 x-import 了 JSX 时内嵌一份。

查法：用 `noUnusedLocals` 找没用上的局部变量（丢失的绑定常留下一个），再用 Babel 把线上原页面的 `app.js` 与我们的打包结果逐函数做结构指纹（局部变量按出现顺序编号，自由变量折成一类），找「结构相同、只有绑定不同」的函数对。主页面原有 20463 个函数，19111 个完全对上；剩下只差绑定的都落在依赖里（Base UI、ReactDOM 的版本与线上不同），注入脚本、`dc-runtime.js` 与 Worker 的差别只是打包方式。1019 个结构有差别的最内层函数没有逐个审，`scripts/property-scrubber.ts` 的内部属性名被重建改过名，两处都是残余风险。

## 随包的第三方代码与资源

- 打进页面、画板运行时、注入脚本与 Worker 的 npm 包（含 React 18、happy-dom、jQuery、dom-to-svg）与原样随附的 Babel standalone 按实际打进的模块收集许可，见根目录 [`THIRD_PARTY_NOTICES.md`](../../THIRD_PARTY_NOTICES.md)「设计稿编辑器」与 `apps/design-editor/licenses.mjs`。
- `app.css` 内联的图标字体（Anthropicons）随原样式搬来，不是仓库约定的 S2 图标（[仓库约定 §4](../../docs/repo-conventions.md#4-界面图标)），以后要换；它的分发许可也待确认。
- 依赖版本跟原工程或工作区对齐：Base UI 1.6.0、`@babel/standalone` 7.29.0 与原工程相同；React 19、TanStack Virtual 用工作区的版本；postcss 是 8.5.28（原工程 8.5.29），截图脚本 `svg-capture.js` 因此与原工程逐字节不同。
- 编辑器会向父窗口发 `__frame_claude_activity_ask`（`platform/claude-activity.tsx`），CucCut 不处理，无害。

## 验证

```bash
node apps/design-editor/build.mjs --force
```

```bash
npm run typecheck
```

```bash
npx vitest run tools/third-party-notices.test.ts apps/desktop/src/main/packaged-resources.test.ts apps/cli/src/runtime/connection.test.ts
```

改动后在 Web 或桌面端打开一份设计稿，过一遍选择、文字编辑、保存后重新载入、粘贴图片、标注与导出。
