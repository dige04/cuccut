import { z } from 'zod';
import type { PackRpcMethods } from './methods.ts';
import { ProtocolPacks as PP } from './messages/protocol/protocol-packs.ts';
import { ProtocolValidation as V } from './messages/protocol/protocol-validation.ts';
import {
  PACK_DEFAULT_VERSION,
  PACK_DIRS,
  PACK_EXAMPLE_EXTENSIONS,
  PACK_EXAMPLE_KINDS,
  PACK_FORMAT,
  PACK_ID_PATTERN,
  PACK_LIMITS,
  PACK_REFUSED_LIBRARY_EXTENSIONS,
  PACK_RESERVED_IDS,
  PACK_RULE_ID_PATTERN,
  PACK_SCHEMA_VERSION,
  PACK_SHA256_PATTERN,
  PACK_UNSUPPORTED_FIELDS,
  PACK_VERSION_PATTERN,
  packFileExtension,
  packPathProblem,
  type PackManifest,
} from './pack.ts';
import { SKILL_ID_PATTERN, SKILL_LIMITS } from './skill.ts';
import { TEMPLATE_ID_PATTERN, TEMPLATE_LIMITS } from './template.ts';

/** Validation of `pack.json` (pack spec §3) and of the `packs.*` parameters, merged into the method table by `schemas.ts`. Unknown fields are always rejected. */

const text = (max: number) =>
  z
    .string()
    .max(max)
    .refine((s) => s.trim().length > 0, { error: () => V.notEmpty().text })
    .refine((s) => s === s.trim(), { error: () => V.noSurroundingSpace().text });
/** Optional copy: may be empty, never padded. */
const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .refine((s) => s === s.trim(), { error: () => V.noSurroundingSpace().text });

const packPath = z.string().superRefine((path, ctx) => {
  const problem = packPathProblem(path);
  if (problem) ctx.addIssue({ code: 'custom', message: problem });
});
const under = (dir: string, message: () => string) => packPath.refine((p) => p.startsWith(`${dir}/`) && p.length > dir.length + 1, { error: message });
const rootFile = (extension: string, message: () => string) =>
  packPath.refine((p) => !p.includes('/') && packFileExtension(p) === extension, { error: message });

const packIdChars = z.string().max(PACK_LIMITS.id).regex(PACK_ID_PATTERN, { error: () => PP.idChars().text });
const templateId = z.string().max(TEMPLATE_LIMITS.id).regex(TEMPLATE_ID_PATTERN, { error: () => PP.templateIdChars().text });
const skillId = z.string().max(SKILL_LIMITS.id).regex(SKILL_ID_PATTERN, { error: () => V.skillIdChars().text });

const libraryItem = z
  .object({
    file: under(PACK_DIRS.library, () => PP.libraryDir({ dir: PACK_DIRS.library }).text).refine(
      (p) => !(PACK_REFUSED_LIBRARY_EXTENSIONS as readonly string[]).includes(packFileExtension(p)),
      { error: () => PP.libraryVoice().text },
    ),
    name: text(PACK_LIMITS.libraryName).optional(),
  })
  .strict();

const example = z
  .object({
    file: under(PACK_DIRS.examples, () => PP.examplesDir({ dir: PACK_DIRS.examples }).text),
    kind: z.enum(PACK_EXAMPLE_KINDS),
    title: optionalText(PACK_LIMITS.exampleTitle).default(''),
    note: optionalText(PACK_LIMITS.exampleNote).default(''),
    still: under(PACK_DIRS.examples, () => PP.examplesDir({ dir: PACK_DIRS.examples }).text)
      .refine((p) => PACK_EXAMPLE_EXTENSIONS.image.includes(packFileExtension(p)), {
        error: () => PP.stillExtension({ extensions: PACK_EXAMPLE_EXTENSIONS.image.join(', ') }).text,
      })
      .optional(),
  })
  .strict()
  .superRefine((e, ctx) => {
    const allowed = PACK_EXAMPLE_EXTENSIONS[e.kind];
    if (!allowed.includes(packFileExtension(e.file))) {
      ctx.addIssue({ code: 'custom', path: ['file'], message: PP.exampleExtension({ kind: e.kind, extensions: allowed.join(', ') }).text });
    }
  });

const quickAction = z.object({ label: text(PACK_LIMITS.quickActionLabel), text: text(PACK_LIMITS.quickActionText) }).strict();

const fileEntry = z
  .object({
    path: packPath,
    size: z.number().int().nonnegative().max(PACK_LIMITS.totalBytes),
    sha256: z.string().regex(PACK_SHA256_PATTERN, { error: () => PP.sha256Hex().text }),
  })
  .strict();

const unique = <T>(items: readonly T[], key: (item: T) => unknown = (x) => x) => new Set(items.map(key)).size === items.length;

/** `pack.json` (pack spec §3.2). `format`, `schema`, unsupported fields and reserved ids are checked first by `parsePackManifest`, each with its own code. */
export const packManifestSchema = z
  .object({
    format: z.literal(PACK_FORMAT),
    schema: z.literal(PACK_SCHEMA_VERSION),
    id: packIdChars.refine((id) => !(PACK_RESERVED_IDS as readonly string[]).includes(id), {
      error: (issue) => PP.idReserved({ id: String(issue.input) }).text,
    }),
    name: text(PACK_LIMITS.name),
    version: z
      .string()
      .max(PACK_LIMITS.version)
      .regex(PACK_VERSION_PATTERN, { error: () => PP.versionChars().text })
      .default(PACK_DEFAULT_VERSION),
    description: optionalText(PACK_LIMITS.description).default(''),
    author: optionalText(PACK_LIMITS.author).default(''),
    license: optionalText(PACK_LIMITS.license).default(''),
    templates: z.array(templateId).max(PACK_LIMITS.templates).default([]),
    skills: z.array(skillId).max(PACK_LIMITS.skills).default([]),
    library: z.array(libraryItem).max(PACK_LIMITS.library).default([]),
    style: z
      .union([z.literal(''), rootFile('md', () => PP.styleFile().text)])
      .default(''),
    examples: z.array(example).max(PACK_LIMITS.examples).default([]),
    quickActions: z.array(quickAction).max(PACK_LIMITS.quickActions).default([]),
    rules: z
      .array(z.string().max(64).regex(PACK_RULE_ID_PATTERN, { error: () => PP.ruleIdChars().text }))
      .max(PACK_LIMITS.rules)
      .default([]),
    review: z
      .union([z.literal(''), rootFile('json', () => PP.reviewFile().text)])
      .default(''),
    // The count and the total are the Runtime's to check (`PACK_TOO_LARGE`), before anything is downloaded.
    files: z.array(fileEntry).optional(),
  })
  .strict()
  .superRefine((m, ctx) => {
    const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message });
    if (!unique(m.templates)) issue(['templates'], PP.duplicateTemplates().text);
    if (!unique(m.skills)) issue(['skills'], PP.duplicateSkills().text);
    if (!unique(m.library, (l) => l.file)) issue(['library'], PP.duplicateLibrary().text);
    const exampleFiles = m.examples.flatMap((e) => [e.file, ...(e.still ? [e.still] : [])]);
    if (!unique(exampleFiles)) issue(['examples'], PP.duplicateExamples().text);
    if (!unique(m.quickActions, (q) => q.label)) issue(['quickActions'], PP.duplicateQuickActions().text);
    if (!unique(m.rules)) issue(['rules'], PP.duplicateRules().text);
    if (m.files && !unique(m.files, (f) => f.path)) issue(['files'], PP.duplicateFiles().text);
  });

/** Compile-time check: the type inferred from the schema matches `PackManifest`. */
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const manifestTypeMatches: Same<z.infer<typeof packManifestSchema>, PackManifest> = true;
void manifestTypeMatches;

/** Why a manifest is refused: the `details.code` the Runtime reports. */
export type PackManifestProblem = 'PACK_INVALID' | 'PACK_FOREIGN_FORMAT' | 'PACK_UNSUPPORTED_SCHEMA' | 'PACK_UNSUPPORTED_FIELD' | 'PACK_ID_RESERVED';

export type PackManifestResult = { ok: true; manifest: PackManifest } | { ok: false; code: PackManifestProblem; issues: string[] };

/** agentcut manifest fields: a manifest without `format` that carries one of them is an agentcut pack. */
const AGENTCUT_FIELDS = ['templates', 'rules', 'glossary', 'assets', 'quickActions', 'style', 'examples', 'recipes', 'review'];

/**
 * Reads a manifest (a value already run through JSON.parse), in order: not an object or no `format` → `PACK_INVALID`, except an agentcut manifest (no `format`, an id and
 * one of its fields) → `PACK_FOREIGN_FORMAT`; another `format` → `PACK_FOREIGN_FORMAT`; `recipes` / `recipeFiles` → `PACK_UNSUPPORTED_FIELD`; `schema` other than 1 →
 * `PACK_UNSUPPORTED_SCHEMA`; a reserved id → `PACK_ID_RESERVED`; then the schema → `PACK_INVALID` with every issue as `path: message`.
 */
export function parsePackManifest(value: unknown): PackManifestResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ok: false, code: 'PACK_INVALID', issues: [PP.notObject().text] };
  const raw = value as Record<string, unknown>;
  if (raw.format === undefined) {
    const agentcut = typeof raw.id === 'string' && AGENTCUT_FIELDS.some((field) => field in raw);
    return agentcut
      ? { ok: false, code: 'PACK_FOREIGN_FORMAT', issues: [PP.foreignFormat().text] }
      : { ok: false, code: 'PACK_INVALID', issues: [PP.formatMissing().text] };
  }
  if (raw.format !== PACK_FORMAT) return { ok: false, code: 'PACK_FOREIGN_FORMAT', issues: [PP.otherFormat({ format: String(raw.format).slice(0, 80) }).text] };
  const unsupported = PACK_UNSUPPORTED_FIELDS.filter((field) => field in raw);
  if (unsupported.length) return { ok: false, code: 'PACK_UNSUPPORTED_FIELD', issues: unsupported.map((field) => PP.unsupportedField({ field }).text) };
  if (raw.schema !== PACK_SCHEMA_VERSION) return { ok: false, code: 'PACK_UNSUPPORTED_SCHEMA', issues: [PP.unsupportedSchema({ schema: String(raw.schema) }).text] };
  if (typeof raw.id === 'string' && (PACK_RESERVED_IDS as readonly string[]).includes(raw.id)) {
    return { ok: false, code: 'PACK_ID_RESERVED', issues: [PP.idReserved({ id: raw.id }).text] };
  }
  const result = packManifestSchema.safeParse(value);
  if (!result.success) return { ok: false, code: 'PACK_INVALID', issues: result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`) };
  return { ok: true, manifest: result.data };
}

// ---- `packs.*`: inbound validation ----

const id = z.string().min(1).max(200);
const packId = packIdChars;
/** Absolute local path: a POSIX `/…` or a Windows `C:\…`. No NUL. */
const absolutePath = z
  .string()
  .max(4096)
  .regex(/^(?:\/|[A-Za-z]:[\\/])[^\0]*$/, { error: () => V.absolutePath().text });
/** A folder, a GitHub address or an `https://` address; classified by the Runtime (`PACK_URL_INVALID`). */
const source = z.string().trim().min(1).max(4096);
const token = z.string().regex(/^[A-Za-z0-9_-]{8,128}$/);
const commandId = id.optional();
const manifestSummary = z
  .object({
    id: packId.refine((value) => !(PACK_RESERVED_IDS as readonly string[]).includes(value), {
      error: (issue) => PP.idReserved({ id: String(issue.input) }).text,
    }),
    name: text(PACK_LIMITS.name),
    version: z.string().max(PACK_LIMITS.version).regex(PACK_VERSION_PATTERN, { error: () => PP.versionChars().text }).optional(),
    author: optionalText(PACK_LIMITS.author).optional(),
    description: optionalText(PACK_LIMITS.description).optional(),
    license: optionalText(PACK_LIMITS.license).optional(),
  })
  .strict();

export const PACK_PARAM_SCHEMAS = {
  'packs.list': z.object({}).strict(),
  'packs.get': z.object({ id: packId }).strict(),
  'packs.openHandle': z.object({ id: packId, path: packPath }).strict(),
  'packs.active': z.union([z.object({ conversationId: id }).strict(), z.object({ projectId: id }).strict()]),
  'packs.choose': z.object({ projectId: id, pack: z.union([packId, z.literal('none'), z.null()]) }).strict(),
  'packs.inspect': z.object({ source, commandId }).strict(),
  'packs.install': z.union([
    z.object({ token, replace: z.boolean().optional(), commandId }).strict(),
    z.object({ source, replace: z.boolean().optional(), commandId }).strict(),
  ]),
  'packs.remove': z.object({ id: packId }).strict(),
  'packs.restore': z.object({ trashId: token }).strict(),
  // The text may be longer than the limit: the Runtime answers `PACK_STYLE_TOO_LONG` with the length, which a schema issue would not say.
  'packs.setStyle': z.object({ id: packId, text: z.string().max(64 * 1024), expectedHash: z.string().max(200).optional() }).strict(),
  'packs.addExample': z
    .object({
      id: packId,
      path: absolutePath,
      title: optionalText(PACK_LIMITS.exampleTitle).optional(),
      note: optionalText(PACK_LIMITS.exampleNote).optional(),
    })
    .strict(),
  'packs.updateExample': z
    .object({
      id: packId,
      file: packPath,
      title: optionalText(PACK_LIMITS.exampleTitle).optional(),
      note: optionalText(PACK_LIMITS.exampleNote).optional(),
    })
    .strict(),
  'packs.removeExample': z.object({ id: packId, file: packPath }).strict(),
  'packs.restoreExample': z.object({ id: packId, trashId: token }).strict(),
  'packs.export': z
    .object({
      dir: absolutePath,
      manifest: manifestSummary,
      templates: z.array(templateId).max(PACK_LIMITS.templates),
      skills: z.array(skillId).max(PACK_LIMITS.skills),
      library: z.array(z.object({ library: z.enum(['glossaries', 'brand']), id }).strict()).max(PACK_LIMITS.library),
      quickActions: z.array(quickAction).max(PACK_LIMITS.quickActions),
      stylePack: packId.optional(),
    })
    .strict(),
} as const satisfies { [M in keyof PackRpcMethods]: z.ZodType };
