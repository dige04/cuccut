# 会话里的幻灯片

**状态：实施中（2026-10-10）。** 第 0 节的四项决定：D1 改为入库，其余按默认做法确认；第 1 阶段（原型）已确认，第 2 到 5 阶段已实现（运行时包与构建、Runtime 幻灯片服务、宿主 shim、skill 与工具、功能区标签、标注）；标注在 Web 上做过端到端验证，Electron 未实测。实现与方案稿不同的地方随文写明。

## 0. 决定

| # | 决定 | 默认做法 | 影响 |
| --- | --- | --- | --- |
| D1 | Slides 运行时如何进仓库 | 源码放进 `packages/slides-runtime/` 并入库，实现借鉴自 Claude Slides；目录、类型约定与 CucCut 的改动见包的 README（2026-10-10 改定；原先放在被忽略的 `vendor/`）。skill 正文按 CucCut 的工具自己写（7.1） | 第 3 节；发布 |
| D2 | 标注附件是否带截图 | P0 不带，只给结构化文字（第几页、哪个元素、元素文字、批注）。截图放到 P1，作为普通图片附件附上 | 附件协议与 composer 的改动面 |
| D3 | Web 端的范围 | 与桌面端同做。Web 服务的界面与桌面同一个包，会话可用（架构设计 §4.8、§14「Web 服务」一行），所以右侧幻灯片标签与标注都在 P0；路由由 Web 服务按会话 cookie 另挂一份 | 第 4、5 阶段的工作量 |
| D4 | 编辑器里的素材地址 | 保持运行时的格式 `/_blob/<id>`，由网关根级路由按「已打开的 deck」查找；不用 `*.localhost` 子域，因为 Web 端做不了 | 第 6.4 节 |

## 1. 目标与范围

在会话里做出、看到、改好一份幻灯片：

1. **创建**：智能体按用户的要求，在会话的工作目录里写一份 deck（第 2 节），写完调用 `slides_check` 校验，会话线程里出现一张幻灯片卡片。
2. **打开**：点卡片（或 Space 里的条目），在功能区新开一个「幻灯片」标签，里面是完整的 Slides 编辑器，可以预览、放映、直接编辑；改动写回 deck 文件。
3. **标注**：在编辑器里进入标注模式，点一个元素或框一块区域写批注；批注作为一个「幻灯片标注」附件进入当前会话的 composer，可以累积多条，用户再写一句话一起发出。
4. **据此修改**：智能体收到的是结构化的标注（哪份 deck、第几页、哪个元素、元素原文、批注），按标注改对应的 slide 文件；编辑器里的画面随之更新。

| 范围 | 内容 |
| --- | --- |
| P0 | 上面四步，桌面端与 Web 端（D3）；单用户；中英文以外的界面语言走现有多语言 |
| P1 | 标注附截图（D2）；导出 PPTX、PDF 的下载；从 Slides 导出的单文件 HTML 导入为 deck |
| 不做 | 多人协作与在线状态（room）；分享链接；评论线程的持久化（标注只是一次性附件）；发送到 Google Drive / Google Slides（运行时里的这部分已删除） |

## 2. deck 的文件

### 2.1 磁盘格式

一份 deck 是工作目录（无项目会话的 scratch 目录，或项目目录）里的一个子目录：

```text
<deck>/
  deck.json              索引：标题、order、sections、cover、faces、designSystems（Slides 格式 v4）
  slides/<id>.html       每页一个文件，恰好一个 <section id="<id>">，内联样式，1920×1080
  assets/<id>.<ext>      素材（图片与字体），<id> 是内容 sha256 的前 32 位十六进制
  assets/index.json      <id> → Content-Type（可选，缺省按扩展名）
  ds/<folder>/tokens.json  装进来的设计系统的 tokens 副本（可选；与 deck.json 的 designSystems 记录成对）
```

- 目录名由智能体按标题取，不以点开头（以点开头的目录 Space 不扫描）。
- 认 deck 的条件：目录里有 `deck.json`，其中 `v` 为 4、`order` 是数组。与视频目录（认 `video.db`）同样作为一个条目，不再往里走。
- slide 的格式、`deck.json` 的字段与上限沿用运行时编译器（`compileSlideHtml`、`normalizeDeckMetadata`）的规则；规范写进 skill 的 `references/format.md`。
- 设计系统：智能体按 skill 的 `references/design-system.md` 把工作目录里的设计系统装进 deck——`tokens.json` 原样拷到 `ds/<folder>/`，`designSystems` 记一条 `{title, namespace, artifact, version, copiedAt}`（`namespace` 即 `<folder>`）；字体与标志经 `slides_import_asset` 导入，字体在 `faces` 里用 `src` 登记。两者都在时编辑器才提供这个设计系统的颜色与文字样式（运行时 `files/design-systems.ts`）。

### 2.2 与运行时 URL 的映射

| 运行时请求 | 磁盘 |
| --- | --- |
| `GET _files.json` | 列出 `deck.json`、`slides/*.html`、`ds/**`，键加 `project/` 前缀，带 sha256、size、contentType |
| `GET project/deck.json`、`project/slides/<id>.html`、`project/ds/**` | 去掉 `project/` 前缀后的同名文件 |
| `GET /_blob/<id>`（根级） | `assets/<id>.<ext>` |
| 发布 `project/<path>` | 写回去掉前缀的文件；`project/` 以外的路径拒绝为 `read_only_path` |
| 上传素材 | 写进 `assets/`，返回 `{ id, url: "/_blob/<id>" }` |

智能体直接写磁盘格式（2.1），不经过这层映射。skill 正文按磁盘路径写。

## 3. 运行时的放置与构建

| 位置 | 内容 |
| --- | --- |
| `packages/slides-runtime`（`@cuccut/slides-runtime`） | 运行时源码，进 git：文档模型、HTML 编译器、编辑器界面、放映与导出。目录、类型约定与 CucCut 的改动见包的 [README](../../../packages/slides-runtime/README.md) |
| `packages/slides`（`@cuccut/slides`） | 只有源码：文件协议的类型、deck 的存储（发布、素材、外部改动）、HTTP 路由 `SlidesServer`、编译器的加载；`./editor` 是宿主 shim，`./editor-messages` 是与父窗口之间的 postMessage 协议（界面也导入它） |
| `apps/slides-editor`（`@cuccut/slides-editor`） | Vite 构建编辑器页面，入口 `src/main.ts` 先装宿主 shim 再 `createSlidesRuntime()`；另用 esbuild 打一份不挂界面的运行时 `dist/node/compiler.cjs`，给 Node 里的 `slides_check` 用 |

- 运行时是普通的 workspace 包，依赖进根 lockfile，与工作区共用一份 React。PptxGenJS 固定 3.12.0：运行时要的 25 处扩展记在 `packages/slides-runtime/patches/`，构建时由 Vite 与 esbuild 插件改写读进来的发行文件（核对版本与 SHA-256），不改 `node_modules`、不靠安装脚本。
- `npm run build:slides-editor` 构建到 `apps/slides-editor/dist/`（不进 git）。页面模板是 `apps/slides-editor/index.html`（进 git），用 `appifact-capabilities` 声明文件模式（`db`）与能力；输入没变时跳过（`node apps/slides-editor/build.mjs --force` 强制重建）。
- 构建产物由 Runtime 的幻灯片路由提供（6.2），查找顺序与 Web 客户端相同：`CUCCUT_SLIDES_EDITOR_DIST` → 打包资源 `<resources>/slides-editor/` → 仓库的 `apps/slides-editor/dist/`，目录里有 `index.html` 才算；`startRuntime` 的 `slidesEditorDist` 可以覆盖（测试用）。缺产物时 `slides.open` 照常给地址、`editorAvailable` 为 false，页面回 503，不影响 Runtime 启动。`npm run setup` 与 `package:*` 脚本会先构建它，打包时缺产物直接失败（`apps/desktop/README.md`）。

## 4. 宿主能力的映射

运行时启动时从 `globalThis.slidesHost` 读能力（类型见 `packages/slides/src/editor/slides-host.ts`）。运行时用到的能力与 CucCut 里的对应：

| 能力 | 运行时用它做什么 | CucCut 里 |
| --- | --- | --- |
| `artifact` / `self.publish(batch)` | 保存：批量写文件，每个文件带 `ifMatch`（上次读到的 sha256），冲突整批拒绝 | 幻灯片路由的 `POST __deck/publish`，原子批量写回 deck 目录（6.3） |
| `assets.upload(blob)` | 粘贴、拖入图片 | `POST __deck/assets`，按内容寻址写进 `assets/` |
| `user` | 当前用户、能否编辑、显示名 | 固定 `user_local`；桌面端可编辑；Web 端服务配置为只读时不可编辑；显示名用界面语言的「你」 |
| `comments.customAnchors` / `openComposer` | 标注：运行时算好锚点与给模型看的描述，交给宿主弹出批注框 | 第 8 节：iframe 把请求交给父窗口，父窗口弹出批注框，结果进 composer |
| `hot.accept` | 文件在外部变化时，只重读变化的文件并就地应用 | 路由推送 deck 目录的外部改动（6.5）；优先接 `hot`，契约核实不可行时退化为重载 iframe |
| `db` | 只给旧的「数据库存储」模式的 deck 用；文件模式不读 | **不需要**。讲者备注在 slide 的 `<aside>` 里，标注不持久化。不提供 `db`，运行时按文件模式工作 |
| `room` | 多人在线、光标、选区 | 不提供（单用户），运行时跳过协作层 |
| `downloads` | 导出 PPTX、PDF 后交给用户保存 | P1：桌面端经主进程的下载处理保存，Web 端由浏览器下载 |
| `chat.suggestPrompt` | 「让智能体修好这页」等提示直接放进会话 | 经 `editor:suggest-prompt` 交给父窗口，放进这个会话的输入框（接在已有输入后面，由用户自己发送）；标签不属于会话或父窗口 5 秒没回应时，运行时退为把提示复制到剪贴板 |
| `commentLabels` | 标注位置标签（`label`）里的词：页号、文字角色、元素种类与形状、区域方位、框选盖住的元素数 | CucCut 加的。按编辑器地址上的 `?lang=`（打开标签时的界面语言）给词；没带时运行时用自己的英文。`detail` 不经这里，保持英文（8.2） |


## 5. 编辑器页面与宿主 shim

- 编辑器页面由幻灯片路由提供：`<base>/index.html` 与静态资源，加一段宿主 shim（构建时打进入口，在 `createSlidesRuntime()` 之前执行）。
- 文件、素材、外部改动走同源 HTTP（shim 直接请求路由，不经父窗口）。
- 标注与「在会话里打开」这类需要 CucCut 界面的能力走 `postMessage`：
  - 桌面端父页面是 `file://`，origin 是 `null`。iframe → 父窗口只能用 `targetOrigin: "*"`，父窗口收消息时必须校验 `event.source === iframe.contentWindow`，消息里不放内容以外的东西。父窗口 → iframe 指定路由的 origin。
  - 消息类型以 `packages/slides/src/editor-messages.ts` 为准，两边收消息时都逐字段校验，不认识的丢掉：
    - iframe → 父窗口：`editor:ready { canEdit }`、`editor:mode { on }`、`editor:compose`（锚点、iframe 视口里的坐标、`label`、`detail`、`area`）、`editor:flushed { requestId, saved }`、`editor:external-change { paths }`、`editor:suggest-prompt { requestId, prompt }`（§4 的 `chat.suggestPrompt`）、`editor:save-file { requestId, filename, data }`（只有设计稿编辑器发：运行时导出的文件交给父窗口保存，`data` 是 `ArrayBuffer` 或 `Blob`）。
    - 父窗口 → iframe：`editor:threads`（未发送的标注 `{ id, anchor, n }`，iframe 画编号标记）、`editor:compose-result { opened }`、`editor:composer-closed`、`editor:reveal`、`editor:set-mode { on }`（标签条上的标注开关）、`editor:flush`（发送前，6.5）、`editor:suggest-prompt-result { requestId, ok }`（提示放进输入框没有）、`editor:save-file-result { requestId, outcome }`（`saved`、`declined` 用户取消、`failed`）。
    - 与方案稿相比多了 `mode`/`set-mode`（标注模式两边都能开关）、`flush`/`flushed`、`external-change` 与 `suggest-prompt`/`suggest-prompt-result`。编号标记由 shim 画在 iframe 里（不拦截指针），位置用运行时的 `placed` 回调。
- 能否编辑由 shim 启动时读 `__deck/session` 得到，交给运行时的 `user.canEdit`。

## 6. Runtime：幻灯片服务与路由

### 6.1 打开

新方法 `slides.open(FileTarget) → { url, deck: { title, slideCount }, editorAvailable }`（参数就是 `FileTarget` 本身，与 `videos.open` 相同）：

- 目标指向 deck 目录（会话工作目录或项目里的相对路径，或 Space 条目）：按真实路径防越界（符号链接指到外面的拒绝）、不进隐藏与依赖目录，目录必须认得出是 deck（2.1），否则 `SLIDES_NOT_A_DECK`。
- 发一个猜不到的 grant（24 字节随机数），登记 `grant → deck 目录`，同一个目录复用同一个 grant。桌面界面与 CLI 拿到 `<网关 HTTP 基址>/slides/<grant>/`，Web 服务给同源的相对地址 `/slides/<grant>/`。grant 只在内存里，Runtime 重启后由界面重新 `slides.open`。
- Web 的默认集合与只读集合都有 `slides.open`；只读时仍可打开，编辑器只读，发布与上传被拒为 403 `not_writer`（运行时认得的错误码；方案稿写的 `WEB_READ_ONLY` 是网关方法的错误码，这里是 HTTP 路由）。

### 6.2 路由

网关与 Web 服务共用一个 `SlidesServer`（同一份 deck 只有一个存储，发布串行）：网关在 `runtime.ts` 的 HTTP 链里接在 `media.handle` 之后；Web 服务在 `web-service.ts` 里插在「只允许 GET/HEAD」之前，要会话 cookie、同源，白名单里要有 `slides.open`。

| 路径 | 方法 | 内容 |
| --- | --- | --- |
| `/slides/<grant>/`、`/slides/<grant>/assets/*` | GET | 编辑器页面与静态资源 |
| `/slides/<grant>/_files.json`、`/slides/<grant>/project/*` | GET | 2.2 的映射 |
| `/slides/<grant>/__deck/publish` | POST | 6.3 |
| `/slides/<grant>/__deck/assets` | POST | 上传素材 |
| `/slides/<grant>/__deck/events` | GET（SSE） | 6.5 |
| `/slides/<grant>/__deck/session` | GET | `{ canEdit }`（实现时新增） |
| `/_blob/<id>`、`/slides/<grant>/_blob/<id>` | GET | 在已打开的 deck 的 `assets/` 里查找（后者是实现时新增的同义地址） |

- `/slides/<grant>` 缺结尾的 `/` 时 308 重定向。编辑器的静态文件不给 `node/`（编译器）、以点开头的与经符号链接出去的。
- **写请求**：`Origin` 与 `Host` 不同源的拒绝为 403 `not_writer`；发布要 `application/json`（否则 415），请求体上限发布 64 MB、素材 256 MB（413 `too_large`）。
- **响应头**：编辑器页面需要执行脚本、加载 Google Fonts（`faces.href`）、显示 `/_blob/` 与 `data:` 图片，所以不能沿用 `/media/*` 的 `sandbox; default-src 'none'`。它有自己的 CSP：`default-src 'self'`，`script-src 'self'` 加页面里内联脚本的 sha256（提供页面时现算），`style-src`/`font-src`/`connect-src` 放行 Google Fonts，图片、媒体与 worker 放行 `blob:`。deck 文件与素材是数据，仍是 `sandbox; default-src 'none'`。
- **嵌入**：Web 服务给所有响应加的 `X-Frame-Options: DENY` 在这组路由上去掉，改为 `frame-ancestors 'self'`。**与方案稿不同**：网关上不设 `frame-ancestors`，因为桌面界面是 `file://` 页面，CSP 表达不了只放行它；网关只监听回环，grant 本身就是凭证（同 `/media/`）。

**桌面端 CSP**：渲染进程 `index.html` 的 `frame-src 'self' blob:` 补上网关回环地址。

### 6.3 发布

- 请求：`{ files: { "project/<path>": { base64, contentType, ifMatch? } | { delete: true, ifMatch? } | null } }`。
- 写入的 `ifMatch` 可以是 `null`，表示这个文件必须还不存在（编辑器新建文件时这样发）；删除的 `ifMatch` 只能是 sha256 或省略。
- 同一 deck 的发布串行执行：先逐个核对 `ifMatch` 与磁盘上的 sha256（文件不存在按 `null` 比），有不符就整批返回 409 `{ code: "conflict", live, paths }`，一个文件也不写。全部通过后逐个原子写入（临时文件加 rename，复用 `writeJsonAtomic` 的做法）。
- 错误码沿用运行时认得的 13 种（`packages/slides/src/file-protocol.ts` 的 `PublishErrorCode`），运行时据此提示用户刷新或重试。
- 每次写入记下「自己写的 sha256」，用来区分外部改动（6.5）。

### 6.4 素材

- 上传写进 `<deck>/assets/<id>.<ext>`，`<id>` 为内容 sha256 前 32 位；`assets/index.json` 记 Content-Type。
- deck 目录里的符号链接按不存在处理：不列、不读、不写（发布到这样的路径拒绝为 `read_only_path`）。
- `/_blob/<id>` 是根级路由，因为 slide 里写的是 `<img src="/_blob/<id>">`，在 `/slides/<grant>/` 下仍解析到站点根。查找范围只限当前已打开（有 grant）的 deck；找不到返回 404。
- 安全性：id 是内容哈希，不知道内容就猜不到；网关只监听回环，Web 端另要会话 cookie。
- 不用 Artifact Store：它的句柄一小时过期，没有引用的文件会被清扫，扩展名白名单里也没有 svg、gif。

### 6.5 外部改动

- 智能体用 Driver 的文件工具直接改 deck 文件。路由用非递归 `fs.watch` 监听 deck 根目录、`slides/` 与 `ds/` 的各级普通目录（不跟随符号链接，去抖 300 ms）；只监听目录，避免 Linux 的递归文件监听在原子保存替换 inode 后丢掉后续修改。收到变化后重建增删目录的监听，并对完整清单（含上次存在、现在删除的文件）比摘要。sha256 与「自己写的」、开始监听时盘上的内容（以及报过的内容）都不同的才算外部改动，经 `__deck/events` 推给编辑器。macOS 的 FSEvents 会补报监听开始前不久的写入（刚建好的 deck），只比「自己写的」会误报，编辑器白白重载一次。
- 编辑器收到后：shim 先通知父窗口（`editor:external-change`），把自己未保存的改动发布完，再重新载入页面。**与方案稿不同**：P0 不接运行时的 `hot`（契约没有读懂，见第 12 节），代价是丢掉当前选中与滚动位置。
- 发送消息前（ContextBarrier，架构设计 §4.6）：界面先等编辑器把未保存的改动发布完（父窗口发 `editor:flush`，shim 回 `editor:flushed`），再发出消息，保证智能体读到的是用户最后看到的版本。运行时只在 `beforeunload` 时立刻发布，shim 发一个可取消的 `beforeunload` 探测有没有未保存的改动，有就等这一轮发布结束再问，最多等 8 秒。

## 7. 智能体

### 7.1 skill `slides`

- 新建 `skills/cuccut/built-in-skills/slides/SKILL.md`：何时用（做幻灯片、演示文稿、deck；不用于视频画面里的字卡与动效）、deck 的磁盘格式、创建步骤、修改已有 deck、设计原则。
- `references/`：`format.md`（slide 标签与样式的闭合子集、`faces` 的写法、上限）、`design.md`（版式、字号阶梯、配色、图表）、`images.md`（图从哪来、哪几页配图、用图片生成模型画插图、占位图框）、`design-system.md`（找、读、装设计系统，按它写页面）。各控制在 `SKILL_LIMITS` 内。
- 插图不加新工具：智能体用模型工具 `image` 生成（不带 `video`），`artifacts_save` 存进 deck 目录的 `images/`，再经 `slides_import_asset` 导入；图片生成没有配置时整份照做，不放插图，交付时说明。
- 同步：`skills/cuccut/built-in-skills/README.md` 的表、`builtin-skills.test.ts` 的 `EXPECTED_IDS`、`skills/cuccut/SKILL.md` §1 的路由表与 media 目录页（都只在 agent 面）、产品设计 §6.9 的「来源」，然后 `npm run build:agent-skill`。
- 两个工具只在会话里有，CLI 面的 craft 副本里没有它们：`SESSION_ONLY_TOOLS` 把「调用 `slides_check`」「逐张调用 `slides_import_asset`」「逐个用 `slides_import_asset` 导入」（字体）三种说法从那里换到行尾，换成终端里的说法（自查格式、先不放图片、设计系统的字体拷进 `ds/<folder>/fonts/` 并以 `project/ds/…` 作 `src`），所以 skill 与 references 里这两个工具名只用这三种说法。

### 7.2 工具

| 工具 | 作用 |
| --- | --- |
| `slides_check { path }` | 用运行时编译器逐页校验 deck，规则与编辑器读页面时一致：格式外的标签、会被丢弃的 CSS、页面文件里的 `<title>`/`<link>`/`<style>`、相对路径或网上的图片、缺失的素材、引用不一致、序列化往返不稳定；`faces` 里编辑器认不得的字体或缺失的字体文件，`designSystems` 记录的写法、重复与个数，以及 `ds/<folder>/` 没有记录。返回问题清单；每页另带不算问题的提示（编译器警告，以及以「排版」开头的放不下、互相压住，中日韩整句的「断词」误报滤掉）。没有问题时在会话线程里登记或更新一张幻灯片卡片（7.3）。智能体写完或改完 deck 必须调用一次 |
| `slides_import_asset { deck, path }` | 把工作目录里的图片或字体（woff2、woff、ttf、otf）拷进 deck 的 `assets/`，返回 `/_blob/<id>`：图片写进 `<img src>`，字体写进 `faces` 那一项的 `src` |

- 写 deck 文件本身用 Driver 自带的文件工具（与 `video-blog` 写文章相同）。
- 两个工具进工具目录（`agent-tools/all-tool-sets.ts`），同步说明书（`skills/cuccut/`）的目录页与 `npm run build:catalog`。
- 编译器在 Node 里运行：运行时包另外导出一个不带界面的编译入口，Runtime 直接 import，不打包整个编辑器。

### 7.3 线程卡片与 Space

- 新增时间线条目 `slides-created { target: FileTarget, title, slideCount }`，仿 `video-created`：同一 deck 只登记一次，之后的 `slides_check` 更新标题、页数与 `taskId`。
- 线程卡片与会话头「产物」同源：一份 deck 一项，挂在最近一次校验通过的那个任务的最后一条回复下面（没有回复时只在「产物」里列）。卡片是一行：图标、标题、「幻灯片 · N 页」，点了在功能区开幻灯片标签。P0 没有第一页的缩略图（D2）。
- `SpaceEntryKind` 新增 `slides`：deck 目录作为一个条目，不再拆成 1+N 个 `document`。界面的类型名、图标随之补上。

## 8. 界面

### 8.1 功能区的幻灯片标签

- `WorkspaceItem` 新增 `{ kind: 'slides', target: FileTarget }`；`itemKey`、标题、图标、`paneQuery`/`parsePane` 同步。
- 内容是一个 iframe，地址来自 `slides.open`，加上打开时的界面语言 `?lang=<Locale>`（标注位置标签按它写，8.2；之后换界面语言不重新载入，免得丢掉还没保存的改动，下次打开时跟上）。标签条右侧的动作：标注开关、在 Space 中显示。
- 每次连上 Runtime（连接号变了，含断开后很快重连、界面没来得及显示断开的）都重新 `slides.open`：Runtime 重启后 grant 与地址都会变，iframe 跟着重新载入；没重启时地址不变，不重载。
- 标签不在前台、或整个右侧区域收起时，幻灯片标签不用 `display: none`，而是按原来的大小叠放、不可见、不接收指针：编辑器在零尺寸里会把缩放算成很小，再显示时先缩小再弹回。其他标签照旧隐藏。
- 打开入口：线程里的幻灯片卡片、Space 条目、文件标签里打开 `deck.json` 时的「用幻灯片编辑器打开」。

### 8.2 标注

1. 用户在编辑器里打开标注模式（标签头部的「标注」开关，或运行时自带的按钮与快捷键 C；三者经 `editor:mode` / `editor:set-mode` 同步），点一个元素或框一块区域。
2. 运行时调用宿主的 `compose(anchor, point, { label, detail, area? })`。shim 把它转成 `editor:compose` 发给父窗口。
3. 父窗口在 iframe 对应位置弹出批注框（S2 Popover，跟随界面语言），回 `editor:compose-result`：上方是运行时给的 `label`（运行时生成，词跟随界面语言，经 §4 的 `commentLabels` 取，例如 `第 3 页 › 三级标题 "AI 时代该学什么"`；给智能体定位的 `detail` 保持英文），一个输入框，按钮「取消」与「添加到对话」，⌘/Ctrl+Enter 添加。批注框关掉（添加、取消、切走标签、退出标注模式）时回 `editor:composer-closed`。
4. 添加后，这条标注进入当前会话的草稿（按会话分，只在这个窗口里，不持久化）；父窗口把草稿里属于这份 deck 的标注经 `editor:threads` 交给编辑器，编辑器在对应位置画编号标记。幻灯片标签所在的位置还没有会话时不收，提示先发一句话开始会话。
5. composer 上方显示一个引用标签「幻灯片标注 · N 条」；点开列出各条（编号、位置、批注），可逐条或全部移除，移除时标记同步消失；点一条打开（或切到）那份幻灯片并跳到那一页。
6. 发送：
   - 只带标注、没写话时，消息正文是固定的一句（「请按这些幻灯片标注修改。」，跟随界面语言）。
   - 发出前，对带标注的每份 deck，让打开着的编辑器把未保存的改动发布完（`editor:flush` / `editor:flushed`，最多等 10 秒），智能体读到的是用户看到的版本；没保存成时不发，输入与标注都留着，提示里点名没保存好的那份幻灯片，请用户再发一次或先移除标注（产品设计 §3.2.4：不带着旧上下文提交）。等待期间发送按钮显示进行中，输入框里的文字不清空。
   - 会话忙时消息连同标注进排队；排队消息「立即发送」走 `steer`，同样带标注。
   - 发出去（或排进队列）后，这几条从草稿里摘掉，编辑器里的标记随之消失；发送期间新加的留着。
7. 已发送的消息下面显示一行「幻灯片标注 · N 条」，点开能看到每条内容，点一条打开那份幻灯片并跳到那一页（`editor:reveal`）。运行时只认得手上的标注，所以不在草稿里的那条先作为一条临时标注（编号为 0，不画标记）交给编辑器，等它渲染后再跳，随后撤掉。

编号是在整份草稿（发出后是在整条消息）里的序号：composer 列表、编辑器里的编号标记与给智能体的那段文字一致；同一份 deck 的标注编号可以不连续。

## 9. 标注附件的协议

调研结论：现有的 `AttachmentRef` 是上传字节的仓库，带 MIME 白名单与 24 小时过期，不适合结构化内容。标注照 `skills`、`references` 的做法挂在消息上，发送时拼成一段文字交给智能体。

```ts
interface SlideAnnotation {
  /** deck 目录，与 slides.open 的 target 相同。 */
  deck: FileTarget;
  /** 运行时的锚点串，用来在编辑器里重新定位与画标记；智能体不需要读懂。 */
  anchor: string;
  /** slide id；运行时给的 detail 里能解析到（`Slide 3 #s03 …`）时填。 */
  slideId?: string;
  /** 给人看的位置，运行时生成，例如 `Slide 3 › Heading 3 "…"`。 */
  label: string;
  /** 运行时为模型生成的定位描述：页号、slide id、元素路径与原文。 */
  detail?: string;
  /** 区域标注为 true。 */
  area?: boolean;
  /** 用户写的批注。 */
  text: string;
}
```

- 协议里的标注没有 id：草稿里的每条另带一个只在界面里用的 id（删除、编号标记、跳转），发送时去掉；已发送的那几条按「消息 id + 序号」拼跳转用的 id。
- `conversations.send`、`steer` 新增可选参数 `slideAnnotations?: SlideAnnotation[]`（每条消息至多 20 条，单条批注去掉首尾空白后 1 到 2000 字，`SLIDE_ANNOTATION_LIMITS`；不收别的字段）；user-message 新增同名字段，原样记下请求里的标注。旧记录没有这个字段，回放不受影响。
- Runtime 用会话的工作目录与 `locateMedia` 找到每份 deck 的目录，找不到时整条 `not-found`，不建任务。
- Harness 新增 `withSlideAnnotations()`，与 `withSpaceReferences()` 并列，在给智能体的文字最后追加，每份 deck 一段，按 deck 第一次出现的顺序；编号是在整条消息里的序号：

  ```text
  <cuccut-slide-annotations deck="talk/">
  1. Slide 3 › Heading 3 "AI 时代该学什么"
     定位：Slide 3 #s03: …
     批注：标题太长，拆成两行
  3. …（框选的区域：运行时给的位置说明）
     定位：Area on slide 5 #s05 … (…)
     批注：这里换成一张图
  </cuccut-slide-annotations>
  <cuccut-slide-annotations deck="decks/intro/">
  2. Slide 1 › Heading 1 "开场"
     批注：多行批注
          第二行缩进对齐
  </cuccut-slide-annotations>
  ```

  `deck` 是相对会话工作目录的路径，以 `/` 结尾（就是工作目录时是 `./`）；在工作目录外时是绝对路径。
- 排队消息（`QueuedMessage`）、任务恢复（重试原样重发）、会话回放带上这个字段。
- 文档补登：`docs/spec/command-protocol-spec.md` 补上了 `attachments.prepare` 与 `conversations.steer`。

## 10. 要修订的规范与文档

- 产品设计：新增「幻灯片」小节（会话里创建、功能区标签、标注）；§3.2.3 composer 的附件与引用标签；§6.9 skill 来源。
- 架构设计：§3.5 工具目录、§3.10 工作目录里的 deck、§4.6 发送前同步（编辑器 flush）、§4.8 Web 服务新增路由、§5.7 Space 条目类型。
- 命令与协议规范：`slides.open`、`conversations.send` 的新参数、`attachments` 补登。
- 验收与测试：新增幻灯片的验收条目。
- 原型 `designs/cuccut/`：先改原型，确认后再改 Electron 与 Web（`AGENTS.md`）。

## 11. 分阶段

| 阶段 | 内容 | 验证 |
| --- | --- | --- |
| 1 | 原型：线程里的幻灯片卡片、功能区幻灯片标签（编辑器用静态画面占位）、批注框、composer 的标注引用标签、已发送消息里的标注行；App 入口（Web 入口按 `BC_SURFACE` 规则） | `npm --prefix designs/cuccut run build`、`node --test`、两个入口过一遍预览；截图给你确认 |
| 2 | 运行时包与构建；Runtime 幻灯片服务（`slides.open`、路由、发布、素材、外部改动）；宿主 shim | 协议与存储测试；HTTP 往返测试；Electron 里打开示例 deck |
| 3 | skill、`slides_check`、`slides_import_asset`、时间线条目、Space 条目类型 | `builtin-skills.test.ts`；工具测试；在开发态用真实 Driver 让智能体做一份 deck |
| 4 | 功能区幻灯片标签（桌面与 Web）、CSP 与响应头 | 组件测试；桌面与 Web 实际页面 |
| 5 | 标注：shim 的 `comments`、批注框、composer 引用标签、协议与 Harness、回放 | 协议与 Harness 测试；端到端：标注 → 发送 → 智能体改 slide → 编辑器更新 |

## 12. 风险

- **运行时的维护**：运行时约 25 万行，出了问题要读运行时代码排查。源码已有完整类型、不用 `any`，改类型只改类型、不改生成的 JS（包的 README「结构」）；CucCut 的行为改动在代码里以 `CucCut:` 注释标出，README 逐项列出。
- **图标**：编辑器界面的图标是随包的图标字体，不是仓库约定的 S2 图标（[仓库约定 §4](../../repo-conventions.md#4-界面图标)），以后要换。
- **`hot` 契约**：外部改动就地应用依赖 `slidesHost.hot.accept` 的回调格式，还没完全读懂；P0 用退路重载 iframe（6.5），代价是丢掉当前选中与滚动位置。
- **跨源 iframe**：桌面端父页面是 `file://`，消息来源只能靠 `event.source` 校验；shim 不把任何文件内容发给父窗口，父窗口也不执行来自 iframe 的指令，只接受第 5 节列出的消息类型。
- **体积**：编辑器 bundle 约 4 MB（gzip 后约 1.3 MB），只在打开幻灯片标签时加载，不进主界面的包。
