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
 * `templates.*` and `conversations.send` with a template (template package spec §5.2, §6), merged into the method table by `handlers.ts`. The directory is read-only;
 * handles are issued only for the bundled files listed in the manifest, and the media channel then checks by real path that the file is inside the template directory.
 * The picked skills (architecture design §3.8, one or several), slide annotations (docs/design/slides §9), canvas annotations (docs/design/canvas §9)
 * and design-system annotations (§10.6)
 * are also resolved in this one send entry point:
 * the template, skills and annotations are each resolved, then handed to the Harness together.
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

