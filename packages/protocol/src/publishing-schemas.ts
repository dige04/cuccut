import { z } from 'zod';
import {
  CALENDAR_ARCHIVE_FORMAT,
  DELIVERY_STATES,
  PUBLICATION_STATUSES,
  PUBLISHING_BATCH_MAX,
  PUBLISHING_CALENDAR_MAX_LIMIT,
  PUBLISHING_FORMATS,
  PUBLISHING_PREPARE_MAX,
  RECONCILE_STATES,
  PUBLISHING_NETWORKS,
  PUBLISHING_PROVIDERS,
  PUBLISHING_SETTINGS_DEFAULTS,
  type CalendarArchive,
  type DestinationInput,
  type DestinationOptions,
  type PinnedExport,
  type Publication,
  type PublicationCopy,
  type PublicationDestination,
  type PublicationOverrides,
  type PublishingAccount,
  type PublishingConnection,
  type PublishingFileV1,
  type PublishingSettings,
  type ResolvedPayload,
} from './publishing.ts';
import { isMessageRef, type MessageRef } from './message-ref.ts';
import { SLOT_PLAN_MAX_DAYS, isCivilDate } from './publishing/schedule.ts';

/**
 * zod schemas for publishing records (types in `publishing.ts`). Exported through `@cuccut/protocol/schemas` only, so the UI bundle does not include
 * zod. Defaults fill fields that older records or inputs leave out; the store and the calendar import parse with them.
 *
 * Record schemas strip unknown keys (a record written by a later phase keeps loading). Inputs that clients send (`destinationInputSchema`,
 * `publicationCopySchema`, `publishingSettingsInputSchema`) are strict.
 */

const id = z.string().min(1).max(200);
const instant = z.iso.datetime({ offset: true });
const hashtag = z.string().trim().min(1).max(200).regex(/^[^#\s]+$/u);
const messageRef = z.custom<MessageRef>((value) => isMessageRef(value));

export const publishingNetworkSchema = z.enum(PUBLISHING_NETWORKS);
export const publishingProviderSchema = z.enum(PUBLISHING_PROVIDERS);
export const publishingFormatSchema = z.enum(PUBLISHING_FORMATS);
export const deliveryStateSchema = z.enum(DELIVERY_STATES);

export const publicationCopySchema = z
  .object({
    title: z.string().max(10_000).default(''),
    description: z.string().max(100_000).default(''),
    hashtags: z.array(hashtag).max(500).default([]),
  })
  .strict();

const overridesFields = {
  title: z.string().max(10_000).nullable(),
  description: z.string().max(100_000).nullable(),
  hashtags: z.array(hashtag).max(500).nullable(),
};

export const publicationOverridesSchema = z.object({
  title: overridesFields.title.default(null),
  description: overridesFields.description.default(null),
  hashtags: overridesFields.hashtags.default(null),
});

const optionsFields = {
  useProviderDefaults: z.boolean(),
  privacy: z.enum(['public', 'private', 'unlisted']),
  madeForKids: z.boolean().nullable(),
  synthetic: z.boolean(),
  branded: z.boolean(),
  ownBrand: z.boolean(),
  comments: z.boolean(),
  duet: z.boolean(),
  stitch: z.boolean(),
  tags: z.array(z.string().trim().min(1).max(500)).max(500),
};

export const destinationOptionsSchema = z.object({
  useProviderDefaults: optionsFields.useProviderDefaults.default(false),
  privacy: optionsFields.privacy.default('public'),
  madeForKids: optionsFields.madeForKids.default(null),
  synthetic: optionsFields.synthetic.default(false),
  branded: optionsFields.branded.default(false),
  ownBrand: optionsFields.ownBrand.default(false),
  comments: optionsFields.comments.default(true),
  duet: optionsFields.duet.default(false),
  stitch: optionsFields.stitch.default(false),
  tags: optionsFields.tags.default([]),
});

/** Changes to a destination's overrides or options: only the fields given (no defaults filled in). */
export const publicationOverridesPatchSchema = z.object(overridesFields).partial().strict();
export const destinationOptionsPatchSchema = z.object(optionsFields).partial().strict();

export const publishingAccountSchema = z.object({
  id,
  connectionId: id,
  remoteId: z.string().trim().min(1).max(500),
  network: publishingNetworkSchema,
  name: z.string().trim().min(1).max(500),
  disabled: z.boolean().default(false),
  needsReconnect: z.boolean().default(false),
  equivalentTo: id.nullable().default(null),
});

export const publishingConnectionSchema = z.object({
  id,
  provider: publishingProviderSchema,
  name: z.string().trim().min(1).max(500),
  baseUrl: z.string().max(2000).default(''),
  configured: z.boolean().default(false),
  checkedAt: instant.nullable().default(null),
  error: z.string().nullable().default(null),
  errorRef: messageRef.nullable().default(null),
});

export const pinnedExportSchema = z.object({
  id,
  videoId: id,
  sequenceId: id,
  videoRevision: z.string(),
  sequenceRevision: z.string().nullable().default(null),
  jobId: id,
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  bytes: z.number().int().nonnegative(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  durationSec: z.number().nonnegative(),
  fps: z.string().nullable().default(null),
  codec: z.string(),
  createdAt: instant,
});

export const resolvedPayloadSchema = z.object({
  exportId: id,
  accountId: id,
  connectionId: id,
  remoteAccountId: z.string(),
  network: publishingNetworkSchema,
  format: publishingFormatSchema,
  title: z.string(),
  caption: z.string(),
  hashtags: z.array(z.string()),
  options: destinationOptionsSchema,
  scheduledAt: instant.nullable(),
  timezone: z.string(),
});

export const publicationDestinationSchema = z.object({
  id,
  accountId: id,
  format: publishingFormatSchema,
  overrides: publicationOverridesSchema.prefault({}),
  options: destinationOptionsSchema.prefault({}),
  scheduledAt: instant.nullable().default(null),
  state: deliveryStateSchema.default('not_sent'),
  payload: resolvedPayloadSchema.nullable().default(null),
  payloadHash: z.string().nullable().default(null),
  remoteId: z.string().nullable().default(null),
  remoteUrl: z.string().nullable().default(null),
  confirmedAt: instant.nullable().default(null),
  publishedAt: instant.nullable().default(null),
  checkedAt: instant.nullable().default(null),
  error: z.string().nullable().default(null),
  errorRef: messageRef.nullable().default(null),
  evidence: z.array(z.string()).default([]),
  verification: z
    .object({ state: deliveryStateSchema, note: z.string(), by: z.string(), at: instant })
    .nullable()
    .default(null),
});

export const publicationSchema = z.object({
  id,
  videoId: id,
  sequenceId: id,
  projectId: id.nullable().default(null),
  videoName: z.string().default(''),
  label: z.string().max(500),
  copy: publicationCopySchema.prefault({}),
  scheduledAt: instant.nullable().default(null),
  timezone: z.string().min(1),
  priority: z.number().int().min(-1000).max(1000).default(0),
  expiresAt: instant.nullable().default(null),
  exportId: id.nullable().default(null),
  approval: z
    .object({ exportId: id, by: z.enum(['human', 'agent']), actor: z.string(), at: instant })
    .nullable()
    .default(null),
  authorization: z.object({ revision: z.number().int().nonnegative(), at: instant }).nullable().default(null),
  proposal: z
    .object({ revision: z.number().int().nonnegative(), copy: publicationCopySchema, reason: z.string(), jobId: id.nullable(), at: instant })
    .nullable()
    .default(null),
  proposalError: z.object({ jobId: id.nullable(), error: z.string(), errorRef: messageRef.nullable(), at: instant }).nullable().default(null),
  pinJob: z.object({ jobId: id, at: instant, error: z.string().nullable(), errorRef: messageRef.nullable() }).nullable().default(null),
  destinations: z.array(publicationDestinationSchema).max(50).default([]),
  revision: z.number().int().nonnegative(),
  createdAt: instant,
  updatedAt: instant,
  origin: z.string().nullable().default(null),
  archived: z.boolean().default(false),
  archivedAt: instant.nullable().default(null),
});

const slotTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const slot = z.object({ weekday: z.number().int().min(0).max(6), time: slotTime }).strict();
const minutes = z.number().int().min(1).max(10_080);
const retentionDays = z.number().int().min(1).max(3650);

/** Stored settings (unknown keys stripped; missing fields take the defaults). */
export const publishingSettingsSchema = z.object({
  timezone: z.string().min(1).max(100),
  slots: z.array(slot).max(200).default([...PUBLISHING_SETTINGS_DEFAULTS.slots]),
  minGapMinutes: minutes.default(PUBLISHING_SETTINGS_DEFAULTS.minGapMinutes),
  leadMinutes: minutes.default(PUBLISHING_SETTINGS_DEFAULTS.leadMinutes),
  defaultAccountIds: z.array(id).max(50).default([...PUBLISHING_SETTINGS_DEFAULTS.defaultAccountIds]),
  writing: z.string().max(10_000).default(PUBLISHING_SETTINGS_DEFAULTS.writing),
  autoPrepare: z.boolean().default(PUBLISHING_SETTINGS_DEFAULTS.autoPrepare),
  archivedRetentionDays: retentionDays.default(PUBLISHING_SETTINGS_DEFAULTS.archivedRetentionDays),
  revision: z.number().int().nonnegative().default(PUBLISHING_SETTINGS_DEFAULTS.revision),
});

/** Settings as a client saves them (`publishing.settings.save`): strict, every field required, `revision` names the revision read. */
export const publishingSettingsInputSchema = z
  .object({
    timezone: z.string().min(1).max(100),
    slots: z.array(slot).max(200),
    minGapMinutes: minutes,
    leadMinutes: minutes,
    defaultAccountIds: z.array(id).max(50),
    writing: z.string().max(10_000),
    autoPrepare: z.boolean(),
    archivedRetentionDays: retentionDays,
    revision: z.number().int().nonnegative(),
  })
  .strict();

export const destinationInputSchema = z
  .object({
    id: id.optional(),
    accountId: id,
    format: publishingFormatSchema,
    overrides: publicationOverridesPatchSchema.optional(),
    options: destinationOptionsPatchSchema.optional(),
    scheduledAt: instant.nullable().optional(),
  })
  .strict();

export const publishingFileSchema = z.object({
  schemaVersion: z.literal(1),
  settings: publishingSettingsSchema,
  connections: z.array(publishingConnectionSchema).default([]),
  accounts: z.array(publishingAccountSchema).default([]),
  publications: z.array(publicationSchema).default([]),
  exports: z.array(pinnedExportSchema).default([]),
  history: z
    .array(z.object({ publicationId: id, destinationId: id, payload: resolvedPayloadSchema, replacedAt: instant }))
    .default([]),
  imports: z.array(z.object({ id, at: instant, added: z.array(id), backup: z.string() })).default([]),
});

/** A calendar file (`cuccut-calendar` version 1). The top level is strict; records are parsed like stored ones. */
export const calendarArchiveSchema = z
  .object({
    format: z.literal(CALENDAR_ARCHIVE_FORMAT),
    version: z.literal(1),
    exportedAt: instant,
    timezone: z.string().min(1),
    publications: z.array(publicationSchema).max(50_000),
    accounts: z.array(
      publishingAccountSchema.pick({ id: true, connectionId: true, remoteId: true, network: true, name: true, equivalentTo: true }),
    ),
    connections: z.array(publishingConnectionSchema.pick({ id: true, provider: true, name: true })),
  })
  .strict();

// ---- RPC parameters (`publishing.*`, merged into `methodParamSchemas` by `schemas.ts`) ----

const civilDate = z.string().refine(isCivilDate);
const revision = z.number().int().nonnegative();
const publicationRef = z.object({ publicationId: id }).strict();
const atRevision = z.object({ publicationId: id, revision }).strict();
const destinationAction = z.object({ publicationId: id, revision, destinationId: id }).strict();
const label = z.string().trim().min(1).max(500);
const name = z.string().trim().min(1).max(500);

export const PUBLISHING_PARAM_SCHEMAS = {
  'publishing.get': publicationRef,
  'publishing.calendar': z
    .object({
      from: civilDate,
      to: civilDate,
      projectId: id.nullable().optional(),
      accountIds: z.array(id).max(200).optional(),
      statuses: z.array(z.enum(PUBLICATION_STATUSES)).max(PUBLICATION_STATUSES.length).optional(),
      includeUnscheduled: z.boolean().optional(),
      offset: z.number().int().nonnegative().max(1_000_000).optional(),
      limit: z.number().int().positive().max(PUBLISHING_CALENDAR_MAX_LIMIT).optional(),
    })
    .strict(),
  'publishing.prepare': z
    .object({
      videoIds: z.array(id).min(1).max(PUBLISHING_PREPARE_MAX),
      sequenceId: id.optional(),
      accountIds: z.array(id).max(50).optional(),
      repeat: z.boolean().optional(),
      origin: z.string().trim().min(1).max(200).optional(),
    })
    .strict(),
  'publishing.update': z
    .object({
      publicationId: id,
      revision,
      patch: z
        .object({
          label: label.optional(),
          copy: publicationCopySchema.optional(),
          scheduledAt: instant.nullable().optional(),
          timezone: z.string().min(1).max(100).optional(),
          priority: z.number().int().min(-1000).max(1000).optional(),
          expiresAt: instant.nullable().optional(),
        })
        .strict(),
      destinations: z.array(destinationInputSchema).max(50).optional(),
    })
    .strict(),
  'publishing.reschedule': z
    .object({
      publicationId: id,
      revision,
      placements: z
        .array(z.object({ destinationId: id, at: instant.nullable() }).strict())
        .min(1)
        .max(50),
    })
    .strict(),
  'publishing.slots': z
    .object({
      publicationIds: z.array(id).min(1).max(PUBLISHING_PREPARE_MAX),
      from: civilDate.optional(),
      days: z.number().int().positive().max(SLOT_PLAN_MAX_DAYS).optional(),
      reserve: z.boolean().optional(),
      revisions: z.record(id, revision).optional(),
    })
    .strict(),
  'publishing.pin': z
    .object({
      publicationId: id,
      revision,
      source: z.union([z.object({ jobId: id }).strict(), z.object({ render: z.literal(true) }).strict()]),
    })
    .strict(),
  'publishing.exports': z.object({ videoId: id }).strict(),
  'publishing.approve': atRevision,
  'publishing.validate': publicationRef,
  'publishing.authorize': atRevision,
  'publishing.send': z.object({ publicationId: id, revision, confirmed: z.literal(true) }).strict(),
  'publishing.batch': z
    .object({
      action: z.enum(['authorize', 'send']),
      items: z.array(atRevision).min(1).max(PUBLISHING_BATCH_MAX),
      confirmed: z.literal(true),
    })
    .strict(),
  'publishing.withdraw': destinationAction,
  'publishing.cancel': destinationAction,
  'publishing.reconcile': z
    .object({
      publicationId: id,
      revision,
      destinationId: id,
      state: z.enum(RECONCILE_STATES),
      remoteUrl: z.url({ protocol: /^https?$/ }).max(2000).nullable(),
      at: instant.nullable(),
      note: z.string().trim().min(10).max(2000),
    })
    .strict(),
  'publishing.archive': atRevision,
  'publishing.unarchive': atRevision,
  'publishing.cleanup': z.object({ dryRun: z.boolean().optional() }).strict(),
  'publishing.copy.propose': z.object({ publicationId: id, instruction: z.string().trim().max(2000).optional() }).strict(),
  'publishing.copy.apply': z.object({ publicationId: id, revision, copy: publicationCopySchema }).strict(),
  'publishing.openHandle': publicationRef,
  'publishing.settings.save': z.object({ settings: publishingSettingsInputSchema }).strict(),
  'publishing.connections.save': z.object({ id: id.optional(), provider: publishingProviderSchema, name }).strict(),
  'publishing.connections.remove': z.object({ connectionId: id }).strict(),
  'publishing.accounts.save': z
    .object({
      id: id.optional(),
      connectionId: id,
      network: publishingNetworkSchema,
      name,
      remoteId: z.string().trim().min(1).max(500),
      disabled: z.boolean().optional(),
    })
    .strict(),
  'publishing.accounts.remove': z.object({ accountId: id }).strict(),
  'publishing.accounts.link': z.object({ accountId: id, equivalentTo: id.nullable() }).strict(),
  'publishing.transfer.export': z.object({}).strict(),
  'publishing.transfer.preview': z.object({ archive: z.unknown() }).strict(),
  'publishing.transfer.apply': z.object({ archive: z.unknown() }).strict(),
};

// Compile-time checks: each schema's output is exactly its protocol type.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;
export type PublishingSchemaChecks = [
  Assert<Same<z.output<typeof publicationCopySchema>, PublicationCopy>>,
  Assert<Same<z.output<typeof publicationOverridesSchema>, PublicationOverrides>>,
  Assert<Same<z.output<typeof destinationOptionsSchema>, DestinationOptions>>,
  Assert<Same<z.output<typeof publishingAccountSchema>, PublishingAccount>>,
  Assert<Same<z.output<typeof publishingConnectionSchema>, PublishingConnection>>,
  Assert<Same<z.output<typeof pinnedExportSchema>, PinnedExport>>,
  Assert<Same<z.output<typeof resolvedPayloadSchema>, ResolvedPayload>>,
  Assert<Same<z.output<typeof publicationDestinationSchema>, PublicationDestination>>,
  Assert<Same<z.output<typeof publicationSchema>, Publication>>,
  Assert<Same<z.output<typeof publishingSettingsSchema>, PublishingSettings>>,
  Assert<Same<z.output<typeof publishingSettingsInputSchema>, PublishingSettings>>,
  Assert<Same<z.output<typeof destinationInputSchema>, DestinationInput>>,
  Assert<Same<z.output<typeof publishingFileSchema>, PublishingFileV1>>,
  Assert<Same<z.output<typeof calendarArchiveSchema>, CalendarArchive>>,
];
