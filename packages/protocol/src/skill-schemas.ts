import { z } from 'zod';
import { ProtocolValidation as V } from './messages/protocol/protocol-validation.ts';
import { SKILL_ID_PATTERN, SKILL_LIMITS } from './skill.ts';

/** `skills.*` and the skills picked when sending: inbound validation, merged into the method table by `schemas.ts`. */

const id = z.string().min(1).max(200);
const skillId = z.string().max(SKILL_LIMITS.id).regex(SKILL_ID_PATTERN, { error: () => V.skillIdChars().text });
/** A relative path inside a skill directory: `/`-separated, does not start with `/` or a drive letter, and contains no `..`, `.`, empty segments, backslashes or control characters. */
const skillPath = z
  .string()
  .min(1)
  .max(SKILL_LIMITS.path)
  .refine((p) => !/[\\\u0000-\u001f]/.test(p), { error: () => V.pathBadChars().text })
  .refine((p) => !p.startsWith('/') && !/^[A-Za-z]:/.test(p) && !p.startsWith('~'), { error: () => V.skillPathRelative().text })
  .refine((p) => !p.split('/').some((seg) => seg === '' || seg === '.' || seg === '..'), { error: () => V.pathBadSegments().text });
/** Absolute local path: a POSIX `/…` or a Windows `C:\…`. No NUL. */
const absolutePath = z
  .string()
  .max(4096)
  .regex(/^(?:\/|[A-Za-z]:[\\/])[^\0]*$/, { error: () => V.absolutePath().text });

/** The `skill` (single) of `conversations.send`, and each item of `skills`. */
export const skillSendRefSchema = z.object({ id: skillId }).strict();
/** The `skills` of `conversations.send`: in the order attached, at most `SKILL_LIMITS.perMessage`; duplicate ids are counted once by the Runtime. */
export const skillSendListSchema = z.array(skillSendRefSchema).max(SKILL_LIMITS.perMessage);

export const SKILL_PARAM_SCHEMAS = {
  'skills.list': z.object({}).strict(),
  'skills.get': z.object({ id: skillId }).strict(),
  'skills.readFile': z.object({ id: skillId, path: skillPath }).strict(),
  'skills.setEnabled': z.object({ id: skillId, enabled: z.boolean() }).strict(),
  'skills.add': z.object({ path: absolutePath, id: skillId.optional(), commandId: id.optional() }).strict(),
  'skills.importGithub': z.object({ url: z.string().trim().min(1).max(2000), id: skillId.optional(), commandId: id.optional() }).strict(),
  'skills.remove': z.object({ id: skillId }).strict(),
} as const;
