import type { Harness, ResolvedDesignAnnotation, ResolvedDesignSystemAnnotation, ResolvedSlideAnnotation } from '@cuccut/harness';
import { sendSkillRefs, type DesignAnnotation, type DesignSystemAnnotation, type Id, type SlideAnnotation } from '@cuccut/protocol';
import type { RpcHandlers } from '../handlers.ts';
import type { MediaRegistry } from '../media.ts';
import { resolveSendSkills } from '../skills/skill-brief.ts';
import type { SkillCatalog } from '../skills/skill-catalog.ts';
import { resolveSceneTemplate } from './template-brief.ts';
import type { TemplateCatalog } from './template-catalog.ts';

type TemplateMethod = 'templates.list' | 'templates.get' | 'templates.openHandle' | 'conversations.send';

/**
 * `templates.*` 与带模板的 `conversations.send`（模板包规范 §5.2、§6），由 `handlers.ts` 并进方法表。目录只读；
 * 句柄只发给清单登记的随附文件，媒体通道再按真实路径确认它在模板目录里。
 * 点选的 skill（架构设计 §3.8，一个或几个）、幻灯片标注（docs/design/slides §9）、设计稿标注（docs/design/canvas §9）
 * 与设计系统标注（§10.6）
 * 也在这一个发送入口里解析：
 * 模板、skill 与标注各自解析好，一起交给 Harness。
 */
export function templateMethods(deps: {
  templates: TemplateCatalog;
  media: MediaRegistry;
  harness: Harness;
  skills: SkillCatalog;
  slideAnnotationsOf: (conversationId: Id, annotations: readonly SlideAnnotation[] | undefined) => ResolvedSlideAnnotation[] | undefined;
  designAnnotationsOf: (conversationId: Id, annotations: readonly DesignAnnotation[] | undefined) => ResolvedDesignAnnotation[] | undefined;
  designSystemAnnotationsOf: (
    conversationId: Id,
    annotations: readonly DesignSystemAnnotation[] | undefined,
  ) => ResolvedDesignSystemAnnotation[] | undefined;
}): Pick<RpcHandlers['methods'], TemplateMethod> {
  const { templates, media, harness, skills, slideAnnotationsOf, designAnnotationsOf, designSystemAnnotationsOf } = deps;
  return {
    'templates.list': (p) => templates.list(p.language),
    'templates.get': (p) => templates.get(p.id, p.language),
    'templates.openHandle': async (p) => {
      const { root, file } = await templates.locate(p.id, p.path);
      return media.issue(root, file);
    },
    'conversations.send': async ({ template, skill, skills: picked, slideAnnotations, designAnnotations, designSystemAnnotations, ...params }) => {
      const annotations = slideAnnotationsOf(params.conversationId, slideAnnotations);
      const design = designAnnotationsOf(params.conversationId, designAnnotations);
      const system = designSystemAnnotationsOf(params.conversationId, designSystemAnnotations);
      const resolved = await resolveSendSkills(skills, sendSkillRefs({ skill, skills: picked }));
      return harness.send({
        ...params,
        ...(template ? { template: await resolveSceneTemplate(templates, template) } : {}),
        ...(resolved ? { skills: resolved } : {}),
        ...(annotations ? { slideAnnotations: annotations } : {}),
        ...(design ? { designAnnotations: design } : {}),
        ...(system ? { designSystemAnnotations: system } : {}),
      });
    },
  };
}
