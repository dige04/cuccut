import { z } from 'zod';
import { ProtocolValidation as V } from './messages/protocol/protocol-validation.ts';
import { TOOL_CANDIDATES_MAX_LIMIT } from './tool-catalogue.ts';

/** Inbound validation for `tools.*` (tool catalogue, architecture design §7.9), merged into the method table by `schemas.ts`. */

const id = z.string().min(1).max(200);

export const TOOL_CATALOGUE_PARAM_SCHEMAS = {
  'tools.list': z.object({}).strict(),
  'tools.candidates': z
    .object({
      toolId: z.string().regex(/^[a-z][a-z0-9-]{0,63}$/, { error: () => V.toolIdChars().text }),
      projectId: id.nullable().optional(),
      cursor: z
        .string()
        .regex(/^\d{1,9}$/)
        .optional(),
      limit: z.number().int().positive().max(TOOL_CANDIDATES_MAX_LIMIT).optional(),
    })
    .strict(),
};
