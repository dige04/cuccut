# design-system-runtime

设计系统编辑器的运行时：Overview（README 文档）、Colors、Typography、Spacing、Corner radius、Shadows、Border width、Components（组件预览）、Assets、Files 文件表、搜索，以及按 `layout: "files"` 读写设计系统目录的存储层。源码按 1:1 移植自原 Design System 类型的 TypeScript 重建（`src/design-system-type`），磁盘格式（`design-system.json`、`_files.json` 索引、`tokens.json` / `tokens.css`、`components/`、`assets/`、`/_blob/<id>` 素材）、界面、行为与模块结构都不改，只改 CucCut 托管必需的部分，改动处带 `CucCut:` 注释（见下）。`apps/design-system-editor` 把它打成编辑器页面，宿主能力由 `packages/design-system/src/editor` 的 shim 提供。

## 结构

模块两阶段安装：每个模块导出 `install<名字>(runtime)`，先用 `bindRuntimeValue` 登记函数与可变绑定，返回的初始化函数再按固定顺序执行；模块之间只经 `runtime.<名字>` 互相访问。安装顺序在 `runtime.ts`，`createDesignSystemRuntime()` 装完模块后由 `bootstrap.tsx` 挂界面。

| 路径 | 内容 |
| --- | --- |
| `runtime.ts`、`bootstrap.tsx`、`dependencies.ts`、`module-helpers.ts` | 入口与安装顺序；挂界面；npm 依赖的登记；CommonJS / ESM 互操作 |
| `runtime-api.ts`、`runtime-types.ts`、`reviewed-runtime-types.ts`、`inferred-runtime-types.ts`、`npm-runtime-types.ts`、`types.ts`、`contracts.ts`、`contracts/`、`reconstruction/` | 绑定表与各模块之间的协议类型（含宿主全局 `ProtocolGlobal`，`contracts/platform-host.ts`） |
| `files/`、`files/ui/` | 按文件存储：启动与读取、索引编解码、懒读、保存队列、外部改动、迁移（旧版单页存储）；应用外壳、导航与搜索、文件表、欢迎页 |
| `editor/` | 各章节的编辑器：色板与对比度、字体、间距与圆角、阴影、组件预览（`run.html` runner、swatch 运行时）、素材组与上传、Markdown 文档、向智能体发请求（`claude-delivery.tsx`、`claude-prompts.ts`）、迁移提示条 |
| `model/` | 设计系统模型：tokens、文件策略与分类、组件推断、文档生成（`documentation.ts`、`remote-text.ts`）、预览用的库目录（`libraries.ts`）、发布 |
| `documents/`、`media/` | 页面文档的存储、自动保存、自发布、写权限；素材上传能力 |
| `host/`、`platform/` | 宿主能力的读取、用户、外部改动（hot reload）、frame 协议（`frame-bridge.tsx`、`frame-chrome.tsx`） |
| `telemetry/` | 健康上报：页面不装 `__appifact_health`，读不到时不报 |
| `ui/` | 原平台的组件库（主题、弹层、表单、菜单、提示、图标） |
| `app.css` | 编辑器界面的样式（含内联的图标字体） |

原工程的 `tests/`、`tools/`、`reconstruction/` 里的笔记与证据、`dist/`、页面模板与 `main.ts` 不搬：页面模板与入口在 `apps/design-system-editor`。

## 类型

这份重建是 strict 的完整类型（不像设计稿运行时那样保留 `Dynamic`），按原工程的编译选项写成，与根 `tsconfig.json` 的选项不兼容（根开 `noUncheckedIndexedAccess`，会报几百处）。所以单独检查：本目录的 `tsconfig.json` 继承根配置，关掉 `noUncheckedIndexedAccess`，像原工程一样引入 `vite/client`（页面入口以副作用导入 `app.css`）与 `node`，连同 `apps/design-system-editor/src` 一起查；根 `tsconfig.json` 排除这两个目录，`npm run typecheck` 依次检查两者。`browser.d.ts` 是原工程的全局声明（`EyeDropper`），只在这份检查里出现。

shim（`packages/design-system/src/editor`）不用 `declare global` 声明 `designSystemHost`：运行时的 `ProtocolGlobal` 已经声明了它（类型是运行时的 `ClaudeBridge`），两份放进同一个检查会冲突。shim 经 `DesignSystemHostWindow` 赋值。

## 宿主与平台

代码里以 `CucCut:` 注释标出，页面模板 `apps/design-system-editor/index.html` 的改动写在它开头的注释里。

- **宿主接口**：运行时从 `globalThis.designSystemHost` 读宿主能力，原运行时读 `globalThis.claude`。统一入口 `host/claude-capabilities.ts` 之外另有直接读的地方，都改了：`contracts/platform-host.ts`、`contracts/model-core.ts`、`contracts/editor-runtime.ts`、`reviewed-runtime-types.ts`、`host/hot-reload.ts`、`media/assets.ts`、`model/asset-store.ts`、`model/derive-system.ts`、`files/reopen.ts`、`editor/claude-delivery.tsx`（5 处）、`documents/storage.ts`、`documents/self-publish.ts`、`files/debug-panel.ts`；提到它的报错文案也改了。宿主对象由 `installDesignSystemEditorHost()` 装上，复用 `@cuccut/slides/editor` 的 `connectEditorHost`；提供哪些能力（`artifact`、`self`、`user`（另给 `name()`）、`assets`，在会话的标签里另有 `chat`）、不提供哪些（`use`、`comments`、`room`、`hot`、`db`、`downloads`、`commentLabels`；运行时本来就不调 `comments`，标注的桥交给 shim 自己的目标层 `comment-targets.ts`），见 `packages/design-system/src/editor/design-system-host.ts`。
- **标注**：原版不画批注层，只在 DOM 上标目标，批注层归宿主；CucCut 的父窗口跨源读不到 DOM，所以这一层在 shim 里（`packages/design-system/src/editor/comment-targets.ts`）。运行时这边只改两处：`commentTargetProps` 另标原名 `data-comment-name`（`editor/comment-anchors.ts`，类型在 `reviewed-runtime-types.ts`），名字截短加哈希后位置标签仍能写原名；`files/ui/design-system-app.tsx` 监听 `cuccut:reveal-comment-target`，跳回一处时与搜索里选中一条走同一条路（`navigationSearch.onPick`），索引里没有那个目标时按给的章节去等它出现。
- **frame 协议**：父窗口的 origin 白名单为空（`host/frame-bridge.tsx` 的 `DEFAULT_HOST_ORIGINS`），编辑器自己画保存状态与只读标记，不把导出、保存、只读交给宿主画。
- **功能开关固定**：页面模板装固定取值的 `__appifact_flags`，不向宿主要；`design_system_clean_up_button` 取原版的 `true`，其余是运行时读开关时的默认值。不装健康上报 `__appifact_health`。
- **能力声明**：页面的 `appifact-capabilities` 去掉 `room`；运行时只读其中的 `db`（判断存储方式）与 `downloads`（是否声明了下载）。
- **不上报**：迁移提示条的使用分析不发（`editor/migration-banners.tsx`，不向父窗口发 `__frame_cap`）。
- **提示词**：原版用页面地址指代这个设计系统（`artifactPageAddress()`）；CucCut 的页面地址带 grant，对智能体没用，改成页面地址 `path` 参数给的设计系统目录路径（反引号括起，控制字符与反引号换成 `?`；没有时说 “this design system”），函数签名不变（`editor/claude-prompts.ts`）。提到原平台 skill、`artifact-type/` 文件与 Artifact 工具的说法改成 CucCut 的 skill `design-system`（`SKILL.md` 与 `references/`）与工作目录里的文件：`editor/claude-prompts.ts`（from-code、空系统的 Build from connectors / Sync from GitHub、对比度修复、上传后起草、改 token）、`editor/migration-banners.tsx`（Finish the migration 的清理提示，地址同上，`isArtifactAddress` 改成认反引号括起的路径）、`model/documentation.ts`（素材与字体在 `_blobs/`、消费方怎么引用、写作指引是 skill）、`model/remote-text.ts`（3 处，没有 Artifact 工具）。
- **送达状态**：CucCut 不提供 `room` 与 `comments.sendToClaude`，「Ask Claude」类请求一律走 `chat.suggestPrompt` 放进会话的输入框，所以 `suggested` 的状态文案改成 “The request is in your chat box — send it to the agent.”（原文是没找到会话的兜底说法）；不在会话里时退回复制，文案不变（`editor/claude-prompts.ts` 的 `claudeDeliveryStatusMessage`）。
- **文案**：界面里称智能体为「the agent」，不称 Claude（欢迎页、空状态、上传、色板、阴影、组件、素材组、保存与启动提示、写权限、迁移等，各处单独标注）。
- **预览用的 React**：组件预览的 React 18.3.1 UMD 不从 jsDelivr 加载，取页面自带的 `artifact-type/vendor/react*.production.min.js`（`model/libraries.ts` 的 `pageVendorUrl`，根相对地址；文件与 jsDelivr 上的同字节，integrity 不变）；`editor/swatch-runtime.tsx` 的 `SWATCH_RUNTIME_TAG_URL_PATTERN` 相应只认这个路径。
- **链接**：不放行原平台的应用 scheme（claude、claude-cli、claude-nest）、编辑器扩展与网域，只跟随 VS Code 设置链接；桌面端按 Electron 判断（`ui/overlays.tsx`）。
- **字体**：不内置 Anthropic Sans，`anthropic` 字体退回系统 UI 字体（`app.css`）。
- **页面模板**：不带写给托管平台的 README 注释与 meta；样式与脚本由 Vite 打进 `assets/`，`artifact-type/` 下只有原样的 `run.html` 与 `vendor/`。

从原工程原样继承、在 CucCut 里不起作用的部分：

- `editor/swatch-runtime.tsx` 的 `ADMITTED_PREVIEW_CDN_PREFIXES` 仍允许预览引用 jsDelivr 的脚本，但 CucCut 的 CSP 不放行外部地址，这类预览载不出来。
- `run.html` 里的 `delete window.claude` 原样保留，无害。
- `ui/overlays.tsx` 里拒绝链接时的控制台说明仍提到原平台的应用与扩展；`trustedAnthropicDomains` 为空。
- 字体 token 名 `anthropic`（`contracts/dom.ts`、`contracts/layers.ts`、`ui/foundation.tsx`）与 `app.css` 里的 `--font-anthropic-*` 变量名照旧。
- 迁移（旧版单页存储转成 `layout: "files"`）的代码整套保留，CucCut 不测试这条路。

## 随包的第三方代码与资源

- 打进页面的 npm 包与预览用的 React 18.3.1 UMD 按实际打进的模块收集许可，见根目录 [`THIRD_PARTY_NOTICES.md`](../../THIRD_PARTY_NOTICES.md)「设计系统编辑器」与 `apps/design-system-editor/licenses.mjs`。
- `app.css` 内联的图标字体（Anthropicons）随原样式搬来，不是仓库约定的 S2 图标（[仓库约定 §4](../../docs/repo-conventions.md#4-界面图标)），以后要换；它的分发许可也待确认。
- 依赖版本跟原工程对齐：Base UI 1.6.0、TanStack Virtual 3.14.9 / virtual-core 3.17.7、class-variance-authority 0.7.1、clsx 2.1.1、tailwind-merge 3.6.0；React 19 用工作区的版本。

## 验证

```bash
node apps/design-system-editor/build.mjs --force
```

```bash
npm run typecheck
```

```bash
npx vitest run packages/design-system/src/editor apps/desktop/src/main/packaged-resources.test.ts apps/cli/src/runtime/connection.test.ts tools/third-party-notices.test.ts
```

改动后在 Web 或桌面端打开一份 `layout: "files"` 的设计系统与一份只有 `design-system.json` 的空系统，过一遍 Overview、Colors、Components（预览载出）、Assets（素材缩略图）、编辑后保存再重新载入、只读打开，以及空系统欢迎页的三张卡片（请求进会话的输入框）。
