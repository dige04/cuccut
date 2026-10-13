import { z } from 'zod';
import { ProtocolValidation as V } from './messages/protocol/protocol-validation.ts';

/** Inbound validation for `externalTools.*` (architecture design §12.9), merged into the method table by `schemas.ts`. */

const id = z.string().min(1).max(200);
const name = z.string().regex(/^[a-z][a-z0-9-]{0,31}$/, { error: () => V.toolNameChars().text });
/** An absolute local path: POSIX `/…` or Windows `C:\…`. Does not contain NUL. */
const absolutePath = z
  .string()
  .max(4096)
  .regex(/^(?:\/|[A-Za-z]:[\\/])[^\0]*$/, { error: () => V.absolutePath().text });
/** The consent method expressed through the gateway: the UI or the CLI. Approval within a session (`agent-approval`) is recorded by the Runtime alone. */
const via = z.enum(['app', 'cli']);

export const EXTERNAL_TOOL_PARAM_SCHEMAS = {
  'externalTools.list': z.object({}).strict(),
  'externalTools.detect': z.object({ name: name.optional() }).strict(),
  'externalTools.install': z.object({ name, consent: z.boolean().optional(), via: via.optional(), commandId: id.optional() }).strict(),
  'externalTools.update': z.object({ name, command: z.string().min(1).max(8192).optional(), commandId: id.optional() }).strict(),
  'externalTools.setPath': z.object({ name, path: absolutePath.nullable() }).strict(),
  'externalTools.remove': z.object({ name }).strict(),
  'externalTools.consent': z.object({ name, grant: z.boolean(), via: via.optional() }).strict(),
  'externalTools.cookieBrowsers': z.object({}).strict(),
};
