# slides-runtime

幻灯片编辑器的运行时：deck 的文档模型、HTML 编译器、编辑器界面、放映与 PPTX / PDF / HTML 导出，实现借鉴自 Claude Slides。`apps/slides-editor` 把它打成编辑器页面与 Node 里用的编译器（`slides_check`），宿主能力由 `packages/slides` 的 shim 提供。设计见[幻灯片设计 §3、§4](../../docs/design/slides/slides-design.md#3-运行时的放置与构建)。

## 结构

模块两阶段安装：每个模块导出 `install<名字>(runtime)`，先用 `bindRuntimeValue` 登记函数与可变绑定，返回的初始化函数再按固定顺序执行。模块之间只经 `runtime.<名字>` 互相访问，运行时只 `import "../bindings"`（类型可以 `import type` 别的模块）。安装顺序在 `index.ts`；`createSlidesRuntime({ boot: false })` 只装模块不挂界面，编译器走这条。

类型：不用 `any`。模块在自己文件顶层用 `declare module "../bindings" { interface RuntimeBindings { … } }` 声明自己登记的绑定的类型，别的模块读 `runtime.<名字>` 就有类型；没声明的名字读出来是 `unknown`，要先声明才能用。`bindRuntimeValue` 是泛型的，登记处会核对局部变量与声明是否一致。除这一处外不做类型增补：根 `tsconfig.json` 一次检查所有包，给 `react` 或全局加声明会影响别的包；带 `--变量` 的内联样式用 `bindings.ts` 的 `CssVariableStyle`。补类型只改类型：去掉类型后的 JS 必须与改之前一致，编辑器页面打出的 `assets/index-*.js` 文件名哈希不变。

| 路径 | 内容 |
| --- | --- |
| `index.ts`、`bindings.ts`、`module-interop.ts` | 入口与安装顺序、绑定表、CommonJS / ESM 互操作 |
| `deck-contracts.ts`、`globals.d.ts` | 文档、节点与文件协议的类型；页面全局（`slidesHost` 等） |
| `boot/` | 启动：按页面声明的能力选文件模式或旧模式 |
| `model/`、`layout/` | 节点规范化、样式、几何、编辑操作与吸附 |
| `compiler/`、`serialization/` | HTML / CSS 子集解析、诊断、序列化与富文本 |
| `rendering/`、`media/`、`embeds/`、`fonts/` | React 渲染、图片与视频、嵌入、字体目录与加载 |
| `editor/`、`ui/`、`design-system/` | 画布、选择、侧栏、属性控件、菜单与对话框；设计系统 |
| `presentation/`、`creation/` | 放映与转场；智能体生成时的进度画面 |
| `files/`、`documents/` | 文件读写、保存队列、并发编辑、冲突与恢复 |
| `host/`、`bridge/`、`comments/`、`collaboration/`、`environment/` | 宿主能力、frame 协议、评论锚点、协作；运行环境与链接 |
| `export/`、`delivery/` | PPTX / PDF / HTML 导出；导出对话框与交给宿主保存 |
| `third-party/` | npm 库的适配 |
| `app.css` | 编辑器界面的样式（含内联的图标字体） |
| `patches/` | PptxGenJS 3.12.0 的应用扩展，构建时套用（见下） |

## 宿主与平台

- **宿主接口**：运行时从 `globalThis.slidesHost` 读宿主能力（类型见 `packages/slides/src/editor/slides-host.ts`）。宿主能力相关的函数以 `Host*` 命名，智能体光标、会话与活动以 `Agent*` 命名。
- **不信任外部来源**：父窗口的 origin 白名单、链接放行的域名与应用 scheme、设计系统的允许主机都为空；桌面端按 Electron 判断。
- **不上报**：没有使用分析与健康诊断的上报。
- **导出**：PPTX、PDF、HTML 只交给宿主保存为文件，没有发送到云端文档的功能。PPTX 导出的「Google Slides 兼容字体」选项只改写字体名。
- **字体**：不内置品牌字体，`anthropic` 主题的无衬线默认字体是 `system-ui`。`theme: "anthropic"`、`font: "anthropic"` 是 deck 格式的取值。
- **文案**：界面里称智能体为「the agent」。
- **页面模板**：在 `apps/slides-editor/index.html`。

## CucCut 的行为

代码里以 `CucCut:` 注释标出：

- **幻灯片栏**（`editor/app.ts`）：编辑器在可调宽度的侧边标签里，挂上时可能还窄。用户手动开关幻灯片栏之前，它跟着视口大小开合。
- **标注位置标签**（`comments/labels.ts`）：拼 `label` 时向宿主的 `slidesHost.commentLabels` 要页号、文字角色、元素种类、区域方位等词，跟随 CucCut 的界面语言；宿主没给时用英文。给智能体看的 `detail` 保持英文。
- **提示交给会话**（`host/agent-session.ts`）：`chat.suggestPrompt` 成功时报 `"staged"`（提示已放进会话的输入框，由用户发送），界面提示为「已加进给智能体的消息」。

## PptxGenJS 扩展

运行时用的 PptxGenJS 带 25 处扩展（渐变、平铺填充、图片圆角、占位符继承、自定义主题与母版等），记录在 `patches/pptxgenjs-3.12.0.json`。`patches/pptxgenjs.mjs` 在构建时改写读进来的发行文件（`pptxgen.es.js`、`pptxgen.cjs.js`），先核对版本与 SHA-256，对不上就报错；`apps/slides-editor` 的 Vite 与 esbuild 插件调用它。不改 `node_modules`，也不靠安装脚本。

## 随包的第三方代码与资源

- `media/video-worker.ts` 以字符串内嵌了编译后的 mediabunny 1.27.3（MPL-2.0），保留原有的许可头；见根目录 [`THIRD_PARTY_NOTICES.md`](../../THIRD_PARTY_NOTICES.md)。
- `app.css` 内联、`fonts/` 里的图标字体不是仓库约定的 S2 图标（[仓库约定 §4](../../docs/repo-conventions.md#4-界面图标)），以后要换。

## 验证

```bash
node apps/slides-editor/build.mjs --force
```

```bash
npm run typecheck
```

```bash
npx vitest run packages/slides
```

改动后在 Web 或桌面端打开一份 deck，过一遍编辑、保存、标注与发送。
