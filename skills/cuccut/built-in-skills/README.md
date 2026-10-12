# 内置 skill

CucCut 随应用分发的内置 Agent skill，也叫 craft（做法）：一件事怎么判断、按什么步骤做。由 Runtime 从这个目录加载（[架构设计 §3.8](../../../docs/architecture/architecture-design.md) 的「Agent skill」），一个 skill 一个目录，目录名就是 skill 的 `id`。内置 skill 默认开着，用户可以关，不能移除。

这个目录在说明书 [`skills/cuccut/`](../../README.md) 下面。说明书讲通用的「怎么用 CucCut」（启动、能力目录、硬规则、交付），由渲染器按面分别交给会话内智能体与外部 Agent：按任务类型列出动手前要读哪个 skill 的路由在 [`SKILL.md`](../SKILL.md) 的 §1，全部 craft 的一句话目录在 §3 末尾的「内置 skill」（只给 CLI 面；会话内智能体看会话开始的 skill 索引）。外部 Agent 读到的是同步脚本生成的副本（`../references/craft/<id>.md`），单一来源仍是这里。`cuccut-` 开头的 id 留给说明书页（`cuccut-catalog-*`、`cuccut-workflows`、`cuccut-conventions`），这里不用。

## 索引

| id | 名称 | 一句话 |
| --- | --- | --- |
| [`subtitle-workflow`](subtitle-workflow/SKILL.md) | 转录与字幕 | 从链接或本机音视频建可编辑视频，转写、润色、按需翻译，放上字幕层，再按需导出 |
| [`polish-transcript`](polish-transcript/SKILL.md) | 润色转写 | 改错字与误听、统一术语与标点，写回同一份转写，词的时间不变 |
| [`speaker-labeling`](speaker-labeling/SKILL.md) | 说话人标注 | 按声纹区分说话人，凭文稿与来源里的证据起真名，写回转写的说话人 |
| [`translate-subtitles`](translate-subtitles/SKILL.md) | 翻译字幕 | 自己逐句翻译成视频里的译文，建译文或双语字幕层；也用来更新过期的译文 |
| [`video-summary`](video-summary/SKILL.md) | 视频内容总结 | 挑出最值得带走的两三件事讲透，另附一组带视频时间的要点 |
| [`video-blog`](video-blog/SKILL.md) | 写成博客文章 | 把视频写成不看视频也能读明白的完整文章，分作者视角与观众视角 |
| [`titles-and-description`](titles-and-description/SKILL.md) | 起标题与写简介 | 标题候选与视频简介（说明、章节、标签），每句都由视频兑现 |
| [`cover-and-title`](cover-and-title/SKILL.md) | 封面与标题 | 标题与封面文案候选，用户挑定后按画幅生成封面图，放进候选素材 |
| [`video-chapters`](video-chapters/SKILL.md) | 分章节 | 在话题自然转换处分章，每章一个标题和一句摘要，写进视频的章节 |
| [`talking-head-cut`](talking-head-cut/SKILL.md) | 剪口播 | 去口癖、长停顿与录废的部分，收紧节奏，按需加强调、B-roll、竖屏取景与配乐闪避 |
| [`shorts-segments`](shorts-segments/SKILL.md) | 切短视频 | 从长视频里挑出能单独发布的几段，每段建成可编辑的子视频 |
| [`narration`](narration/SKILL.md) | 旁白成片 | 按实测语速写稿，一个音色一次合成，量时长、只重配不合格的句子，再把画面剪到旁白上 |
| [`video-production`](video-production/SKILL.md) | 从简报到成片 | 从零做一条完整成片：风格与分镜规划，逐镜出画面，配旁白、混音、导出验收 |
| [`motion-graphics`](motion-graphics/SKILL.md) | 动效图形 | 写一个自包含的 HTML 画面做下横栏、关键词、大数字、标注或品牌贴片，打包导入后放上时间线 |
| [`slides`](slides/SKILL.md) | 幻灯片 | 在工作目录写一份 deck，校验通过后在线程里出卡片，用户在功能区预览、编辑与标注（只给会话内智能体） |
| [`design`](design/SKILL.md) | 设计稿 | 在工作目录写一份设计稿（界面、网页、海报、图表、示意图、原型），校验通过后在线程里出卡片，用户在功能区预览、编辑与标注（只给会话内智能体） |
| [`design-system`](design-system/SKILL.md) | 设计系统 | 在工作目录写一个设计系统目录（tokens、品牌手册、组件、素材），可从代码仓库或设计工具整理，供设计稿装用（只给会话内智能体） |

## 新增或修改一个 skill

1. 新建 `skills/cuccut/built-in-skills/<id>/`，`id` 用 kebab-case，不与已有目录重名。
2. 写 `SKILL.md`：front matter 的 `name`（界面直接显示的短名）、`description`（做什么、什么时候用、什么时候不用；会话开始的索引只取前 300 个字符）、`version`；正文是做法，保持精炼。长的细则放进 `references/`，由智能体用 `skills_read` 按需取。
3. skill 之间不互相引用文件，每个 skill 自包含；共享的模型资料与参考表放在说明书 `references/catalog/`，用 `skills_read` 读 `cuccut-catalog-<页>`，同步脚本会为外部 Agent 改成目录页链接，不复制数据。正文只引用 Agent 真实拥有的 cuccut 工具与文档类型，不重复说明书（入口指导）已经说过的通用规则。
4. 做法对任意语言的视频与目标语言都适用，不假定中文或英文。
5. 不放符号链接，不用点开头的文件（不算 skill 的内容）；上限见 `@cuccut/protocol` 的 `SKILL_LIMITS`。
6. 运行 `npm test -- packages/runtime-core/src/skills`：`builtin-skills.test.ts` 会加载这里的全部 skill，并核对清单、上限、上面的索引与说明书「内置 skill」表；新增或改名时同步更新测试里的清单、上面的索引、说明书 SKILL.md §1 的路由与 §3 的「内置 skill」表（之后运行 `npm run build:agent-skill` 重新生成 craft 副本）与[产品设计 §6.9](../../../docs/product/product-design.md#69-skillag-07) 的「来源」一条。
