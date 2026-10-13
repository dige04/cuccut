import { z } from 'zod';
import { MAX_ATTACHMENTS_PER_MESSAGE } from './limits.ts';
import { AI_TOOL_KINDS, AI_TOOL_PROMPT_MAX } from './pipelines.ts';
import { languageTag } from './language-schemas.ts';
import { skillSendListSchema } from './skill-schemas.ts';

/**
 * Parameters for the `ai-tool` flow (`params` of `pipelines.start`, product design §5.10): the flow's `parse` validates with it, and the UI and tests use it too.
 * `chapters` always covers the whole piece: a range given with it is rejected.
 */
export const aiToolParamsSchema = z
  .object({
    videoId: z.string().min(1).max(128),
    tool: z.enum(AI_TOOL_KINDS),
    prompt: z.string().max(AI_TOOL_PROMPT_MAX),
    range: z
      .object({ start: z.number().finite().min(0), end: z.number().finite().min(0) })
      .strict()
      .refine((r) => r.end > r.start)
      .optional(),
    documentId: z.string().min(1).max(128).optional(),
    attachments: z.array(z.string().min(1).max(200)).max(MAX_ATTACHMENTS_PER_MESSAGE).optional(),
    skills: skillSendListSchema.optional(),
    provider: z.string().min(1).max(128).optional(),
    model: z.string().min(1).max(256).optional(),
    uiLanguage: languageTag.optional(),
  })
  .strict()
  .refine((p) => !(p.tool === 'chapters' && p.range), { path: ['range'] });
