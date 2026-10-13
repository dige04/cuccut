import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import {
  CAPTION_LIMITS,
  FORMAT_NETWORK,
  PUBLICATION_STATUSES,
  PUBLISHING_CALENDAR_MAX_LIMIT,
  PUBLISHING_FORMATS,
  PUBLISHING_PREPARE_MAX,
  RpcError,
  SLOT_PLAN_MAX_DAYS,
  YOUTUBE_TITLE_LIMIT,
  addCivilDays,
  calendarInstant,
  codePointLength,
  composeCaption,
  formatRef,
  isCivilDate,
  isEditableDelivery,
  localizeText,
  parseHashtags,
  publicationAuthorized,
  resolveCopy,
  todayInZone,
  type Id,
  type Publication,
  type PublicationCopy,
  type PublicationDetail,
  type PublicationIssue,
  type PublicationRow,
  type PublishingAccount,
  type SlotPlan,
} from '@cuccut/protocol';
import { RcAgentTools } from '@cuccut/protocol/messages/runtime-core';
import { destinationInputSchema } from '@cuccut/protocol/schemas';
import type { PublishingActor, PublishingService } from '../publishing/publishing-service.ts';
import { ToolError, type ToolInfo, type ToolSet } from './tool-catalog.ts';
import { approvalField, confirmSummary, type ToolAccess, type ToolPrincipal, type ToolScope } from './tool-scope.ts';

/**
 * Publishing tools (design `docs/cuccut/m2-publishing.md` §5): agents, MCP clients and the command line plan releases through the same
 * `PublishingService` as the UI's `publishing.*` methods (one gateway). The tool layer only adds the scope rules:
 *
 * - **Visibility**: a publication is visible only when its video is in the caller's scope (`ToolScope.visibleVideoIds`): a session agent sees its own
 *   project's publications only. A publication out of scope is answered like a missing one (`PUBLICATION_NOT_FOUND`), and lists leave it out before
 *   pagination.
 * - **Actor**: a session agent and an external service act as `agent`, the terminal as `cli` (design §4.2). Neither may authorize, record results
 *   (`reconcile`) or manage connections, accounts and the schedule: those are the owner's, in CucCut. Sending needs the owner's authorization of the
 *   exact revision (`AUTHORIZATION_REQUIRED` otherwise); any change voids it.
 * - **Confirmation**: every write is confirmed through the scope with its risk (`TOOL_RISK`); approving and sending are `high`.
 *
 * Errors from the service keep their code (`details.code`) and get a `next` step for the agent.
 */

export interface PublishingToolsDeps {
  /** The publishing service; read at call time (empty for the catalog shells in `allToolSets`). */
  publishing: PublishingService;
  scope: ToolScope;
}

const publicationArg = z.string().min(1).max(200).describe('Publication ID (pub_…), from publications_list or publications_prepare');
const revisionArg = z
  .number()
  .int()
  .nonnegative()
  .describe('The publication revision you read last (from publications_inspect or the previous result); a stale one is refused with PUBLICATION_CONFLICT');
const instant = z.iso.datetime({ offset: true });
const civilDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(isCivilDate, 'Not a calendar date');
const copyPatch = z
  .strictObject({
    title: z.string().max(10_000).optional().describe('YouTube title (at most 100 characters)'),
    description: z.string().max(100_000).optional().describe('Description, the caption shared by every account'),
    hashtags: z.array(z.string().max(200)).max(500).optional().describe('Hashtags; a leading # is stripped and duplicates are dropped'),
  })
  .describe('Text fields to change; the ones you leave out keep their value');
const copyFull = z.strictObject({
  title: z.string().max(10_000).describe('YouTube title (at most 100 characters)'),
  description: z.string().max(100_000).describe('Description, the caption shared by every account'),
  hashtags: z.array(z.string().max(200)).max(500).describe('Hashtags; a leading # is stripped'),
});

const FORMATS_TEXT = PUBLISHING_FORMATS.join(', ');
const STATUSES_TEXT = PUBLICATION_STATUSES.join(', ');

const schemas = {
  publications_list: z.strictObject({
    from: civilDate.optional().describe('Optional. First day (YYYY-MM-DD, workspace timezone); default today'),
    to: civilDate.optional().describe('Optional. Last day (YYYY-MM-DD, inclusive); default 30 days after from; at most 93 days in all'),
    video: z.string().min(1).max(1000).optional().describe('Optional. Only publications of this video: a path or videoId from videos_list'),
    accounts: z.array(z.string().min(1).max(200)).max(200).optional().describe('Optional. Only publications going to one of these account IDs'),
    statuses: z
      .array(z.enum(PUBLICATION_STATUSES))
      .max(PUBLICATION_STATUSES.length)
      .optional()
      .describe(`Optional. Only these statuses: ${STATUSES_TEXT}`),
    unscheduled: z.boolean().optional().describe('Optional. Also list publications with an account that can still be scheduled and has no time yet; default true'),
    offset: z.number().int().nonnegative().max(1_000_000).optional().describe('Optional. Skip this many rows (nextOffset of the previous page)'),
    limit: z.number().int().positive().max(PUBLISHING_CALENDAR_MAX_LIMIT).optional().describe('Optional. Rows per page, default 50, at most 200'),
  }),
  publications_inspect: z.strictObject({ publication: publicationArg }),
  publications_prepare: z.strictObject({
    videos: z
      .array(z.string().min(1).max(1000))
      .min(1)
      .max(PUBLISHING_PREPARE_MAX)
      .describe('Videos to publish: paths or videoIds from videos_list (one publication each, at most 50)'),
    sequence: z.string().min(1).max(200).optional().describe('Optional, with a single video only. The sequence of that video to publish; default the video\'s main sequence'),
    accounts: z
      .array(z.string().min(1).max(200))
      .max(50)
      .optional()
      .describe('Optional. Account IDs (from publications_list) for new publications; default the owner\'s default accounts'),
    repeat: z
      .boolean()
      .optional()
      .describe('Optional. Prepare a new release even when the video already has one that is not archived; default false reuses that one'),
  }),
  publications_update: z.strictObject({
    publication: publicationArg,
    revision: revisionArg,
    label: z.string().trim().min(1).max(500).optional().describe('Optional. The name shown on the calendar'),
    copy: copyPatch.optional(),
    scheduledAt: instant
      .nullable()
      .optional()
      .describe('Optional. Default publication time (ISO 8601 with offset) for accounts without their own time; null clears it'),
    timezone: z.string().min(1).max(100).optional().describe('Optional. IANA timezone the times were chosen in'),
    priority: z.number().int().min(-1000).max(1000).optional().describe('Optional. Higher goes first when planning slots'),
    expiresAt: instant.nullable().optional().describe('Optional. The content must go out before this time (ISO 8601 with offset); null clears it'),
    destinations: z
      .array(destinationInputSchema)
      .max(50)
      .optional()
      .describe(
        `Optional. The full list of accounts: {id?, accountId, format, overrides?, options?, scheduledAt?}; keep an existing one by giving its id; one you leave out is removed. format: ${FORMATS_TEXT}. overrides: {title, description, hashtags}, null inherits the shared text, an empty value clears it. scheduledAt: this account's own time, null uses the default time`,
      ),
    archived: z.literal(false).optional().describe('Optional. false restores an archived publication (after publications_archive)'),
  }),
  publications_reschedule: z.strictObject({
    publication: publicationArg,
    revision: revisionArg,
    placements: z
      .array(
        z.strictObject({
          destinationId: z.string().min(1).max(200).describe('The account entry (destinationId from publications_inspect)'),
          at: instant.nullable().describe('New time (ISO 8601 with offset); null falls back to the default time'),
        }),
      )
      .min(1)
      .max(50)
      .describe('New times for accounts that were not sent yet; all apply together or none do'),
  }),
  publications_slots: z.strictObject({
    publications: z.array(publicationArg).min(1).max(PUBLISHING_PREPARE_MAX).describe('Publications to plan times for'),
    from: civilDate.optional().describe('Optional. First day to consider (YYYY-MM-DD, workspace timezone); default today'),
    days: z.number().int().positive().max(SLOT_PLAN_MAX_DAYS).optional().describe('Optional. Days to look ahead, default 30, at most 90'),
  }),
  publications_reserve: z.strictObject({
    publications: z.array(publicationArg).min(1).max(PUBLISHING_PREPARE_MAX).describe('Publications to reserve times for'),
    revisions: z
      .record(z.string().min(1).max(200), z.number().int().nonnegative())
      .describe('The revision you read for each publication: {"pub_…": 3}'),
    from: civilDate.optional().describe('Optional. First day to consider (YYYY-MM-DD, workspace timezone); default today'),
    days: z.number().int().positive().max(SLOT_PLAN_MAX_DAYS).optional().describe('Optional. Days to look ahead, default 30, at most 90'),
  }),
  publications_pin: z.strictObject({
    publication: publicationArg,
    revision: revisionArg,
    job: z
      .string()
      .min(1)
      .max(200)
      .optional()
      .describe('Optional. A finished whole-video MP4 export job of this video to pin; without it, the video is rendered (an export job) and pinned when it finishes'),
  }),
  publications_propose_copy: z.strictObject({
    publication: publicationArg,
    revision: revisionArg,
    copy: copyFull.describe('The proposed shared text: {title, description, hashtags}'),
    reason: z.string().trim().min(1).max(2000).describe('One sentence for the owner on what the text is based on'),
  }),
  publications_approve: z.strictObject({ publication: publicationArg, revision: revisionArg }),
  publications_send: z.strictObject({
    publication: publicationArg,
    revision: revisionArg,
    confirmed: z.literal(true).describe('Must be true: you checked the publication with publications_inspect and the owner authorized this revision'),
  }),
  publications_withdraw: z.strictObject({
    publication: publicationArg,
    revision: revisionArg,
    destination: z.string().min(1).max(200).describe('The account entry waiting for the owner (destinationId from publications_inspect)'),
  }),
  publications_archive: z.strictObject({ publication: publicationArg, revision: revisionArg }),
  publications_export_calendar: z.strictObject({
    file: z
      .string()
      .min(1)
      .max(1000)
      .optional()
      .describe('Optional. The file to write, relative to the current directory; default cuccut-calendar-<date>.json there'),
    overwrite: z.boolean().optional().describe('Optional. Replace an existing file; default false refuses'),
  }),
  publications_import_calendar: z.strictObject({
    file: z.string().min(1).max(1000).describe('A cuccut-calendar file, relative to the current directory'),
    dryRun: z.boolean().optional().describe('Optional. true only previews what would be added; nothing is written'),
  }),
};

type ToolName = keyof typeof schemas;
type Args<N extends ToolName> = z.infer<(typeof schemas)[N]>;

const ALL = ['agent', 'mcp', 'cli'] as const;
const NO_MCP = ['agent', 'cli'] as const;

const DEFINITIONS: Record<ToolName, ToolInfo> = {
  publications_list: {
    title: 'List publications',
    description: [
      'Lists planned releases on the publishing calendar.',
      'One publication is one release of one video to several accounts, each with its own text, format and time. Rows give the status, revision and each account\'s delivery state and time; the result also lists the accounts and the workspace schedule (timezone, weekly slots, spacing). Filters apply before pagination.',
      'Read a publication in full with publications_inspect.',
    ].join('\n'),
    annotations: { readOnlyHint: true },
    effect: 'query',
    examples: [
      { title: 'This month and unscheduled ones', args: {} },
      { title: 'One video', args: { video: 'video_0123456789abcdef' } },
      { title: 'Needs attention', args: { from: '2026-10-01', to: '2026-10-31', statuses: ['attention'] } },
    ],
    surfaces: ALL,
  },
  publications_inspect: {
    title: 'Inspect publication',
    description: [
      'Reads one publication: text, accounts, times, export, approval and problems.',
      'Gives the full record of one release.',
      'Each account entry gives its composed caption and limit, options and delivery state; issues lists what blocks delivery. Also returns the owner\'s writing guidance and the caption limits.',
      'Authorizing delivery, recording results, accounts and the schedule are the owner\'s, in CucCut: when one of them is needed, ask the owner.',
    ].join('\n'),
    annotations: { readOnlyHint: true },
    effect: 'query',
    examples: [{ title: 'Read a publication', args: { publication: 'pub_0123456789abcdef' } }],
    surfaces: ALL,
    positional: 'publication',
  },
  publications_prepare: {
    title: 'Prepare publications',
    description: [
      'Prepares one publication per video for the publishing calendar.',
      'Each starts from the video name and the owner\'s default accounts.',
      'Reuses the video\'s latest publication that is not archived unless repeat is true. Nothing is sent: pin an export (publications_pin), write text (publications_update), plan times (publications_reserve), then the owner reviews it.',
    ].join('\n'),
    effect: 'mutation',
    examples: [
      { title: 'One video', args: { videos: ['video_0123456789abcdef'] } },
      { title: 'Two shorts to chosen accounts', args: { videos: ['shorts/hook.cuccut', 'shorts/tips.cuccut'], accounts: ['pacct_0123456789abcdef'] } },
    ],
    surfaces: ALL,
  },
  publications_update: {
    title: 'Update publication',
    description: [
      'Changes a publication\'s text, accounts, formats, options or times.',
      'Give the revision you read; a stale one is refused. Text, times and accounts of a publication whose delivery has started are locked. Any change voids the owner\'s authorization to send. archived: false restores an archived publication.',
    ].join('\n'),
    effect: 'mutation',
    examples: [
      { title: 'Write the text', args: { publication: 'pub_0123456789abcdef', revision: 2, copy: { title: 'Three editing tips', hashtags: ['editing', 'shorts'] } } },
      { title: 'Set the default time', args: { publication: 'pub_0123456789abcdef', revision: 3, scheduledAt: '2026-10-20T18:00:00+02:00' } },
      { title: 'Restore an archived one', args: { publication: 'pub_0123456789abcdef', revision: 5, archived: false } },
    ],
    surfaces: ALL,
  },
  publications_reschedule: {
    title: 'Reschedule publication',
    description: [
      'Moves accounts of a publication to new times, all together.',
      'Only accounts that were not sent yet can move. A time closer than the owner\'s spacing to another post on the same account is refused (SLOT_TAKEN).',
    ].join('\n'),
    effect: 'mutation',
    examples: [
      {
        title: 'Move one account',
        args: { publication: 'pub_0123456789abcdef', revision: 4, placements: [{ destinationId: 'pdest_0123456789abcdef', at: '2026-10-21T09:30:00+02:00' }] },
      },
    ],
    surfaces: ALL,
  },
  publications_slots: {
    title: 'Plan publishing times',
    description: [
      'Plans free weekly slots for publications without writing anything.',
      'Uses the owner\'s weekly times, spacing and lead time; publications that already have a default time keep it. Reserve the plan with publications_reserve.',
    ].join('\n'),
    annotations: { readOnlyHint: true },
    effect: 'query',
    examples: [{ title: 'Plan two publications', args: { publications: ['pub_0123456789abcdef', 'pub_fedcba9876543210'] } }],
    surfaces: ALL,
  },
  publications_reserve: {
    title: 'Reserve publishing times',
    description: [
      'Reserves the next free weekly slots as the publications\' default times.',
      'The same plan as publications_slots, written in one change; the planned publications\' account-specific times are cleared. A reservation is local: nothing is scheduled on a network.',
    ].join('\n'),
    effect: 'mutation',
    examples: [{ title: 'Reserve one', args: { publications: ['pub_0123456789abcdef'], revisions: { pub_0123456789abcdef: 3 } } }],
    surfaces: ALL,
  },
  publications_pin: {
    title: 'Pin export to publication',
    description: [
      'Pins the video file a publication will post.',
      'The file is a finished MP4 export, or a new render.',
      'Without job, renders the whole video (an export job; wait with jobs_wait) and pins the output when it finishes. With job, pins that finished export now; it must be of the video\'s current revision. The owner (or publications_approve) then approves that exact file.',
    ].join('\n'),
    effect: 'job',
    examples: [
      { title: 'Render and pin', args: { publication: 'pub_0123456789abcdef', revision: 1 } },
      { title: 'Pin a finished export', args: { publication: 'pub_0123456789abcdef', revision: 1, job: 'job_0123456789abcdef' } },
    ],
    surfaces: NO_MCP,
  },
  publications_propose_copy: {
    title: 'Propose publication text',
    description: [
      'Stores proposed text on a publication for the owner to review.',
      'The proposal is not applied: the owner chooses what to use in CucCut. Ground the text in the video (its transcript) and the owner\'s writing guidance from publications_inspect. To change the text directly, use publications_update.',
    ].join('\n'),
    effect: 'mutation',
    examples: [
      {
        title: 'Propose text',
        args: {
          publication: 'pub_0123456789abcdef',
          revision: 2,
          copy: { title: 'Three editing tips', description: 'Cut faster with these three habits.', hashtags: ['editing'] },
          reason: 'Based on the three tips in the transcript.',
        },
      },
    ],
    surfaces: ALL,
  },
  publications_approve: {
    title: 'Approve pinned export',
    description: [
      'Approves the publication\'s pinned export, attributed to you.',
      'Only after you checked that exact file (frames, length, captions). The approval stays with that file: pinning another one needs a new approval.',
    ].join('\n'),
    effect: 'mutation',
    examples: [{ title: 'Approve', args: { publication: 'pub_0123456789abcdef', revision: 3 } }],
    surfaces: NO_MCP,
  },
  publications_send: {
    title: 'Send publication',
    description: [
      'Sends a publication that the owner authorized for you.',
      'Each unsent account gets its frozen text and file.',
      'Refused with AUTHORIZATION_REQUIRED unless the owner authorized this exact revision in CucCut; any change after that voids it. By-hand accounts then wait for the owner to post them in the network\'s app and record the result.',
    ].join('\n'),
    effect: 'mutation',
    examples: [{ title: 'Send', args: { publication: 'pub_0123456789abcdef', revision: 6, confirmed: true } }],
    surfaces: NO_MCP,
  },
  publications_withdraw: {
    title: 'Withdraw from account',
    description: [
      'Takes an account that is waiting for the owner back to not sent.',
      'Its frozen text is kept in the history; the publication can be edited and sent again.',
    ].join('\n'),
    effect: 'mutation',
    examples: [{ title: 'Withdraw', args: { publication: 'pub_0123456789abcdef', revision: 7, destination: 'pdest_0123456789abcdef' } }],
    surfaces: NO_MCP,
  },
  publications_archive: {
    title: 'Archive publication',
    description: [
      'Archives a publication: it leaves the calendar.',
      'Refused while an account is waiting or sending. publications_update with archived: false restores it.',
    ].join('\n'),
    annotations: { destructiveHint: true },
    effect: 'destructive',
    examples: [{ title: 'Archive', args: { publication: 'pub_0123456789abcdef', revision: 4 } }],
    surfaces: NO_MCP,
  },
  publications_export_calendar: {
    title: 'Export publishing calendar',
    description: [
      'Writes the whole publishing calendar to a cuccut-calendar file.',
      'Every project, archived publications included; no credentials, frozen payloads or local paths. Import it on another computer with publications_import_calendar.',
    ].join('\n'),
    effect: 'mutation',
    examples: [
      { title: 'Export here', args: {} },
      { title: 'Export to a file', args: { file: 'backup/calendar.json' } },
    ],
    surfaces: ['cli'],
    positional: 'file',
  },
  publications_import_calendar: {
    title: 'Import publishing calendar',
    description: [
      'Imports a cuccut-calendar file into this computer\'s publishing calendar.',
      'Append-only: publications already here are skipped; new accounts must be connected again; deliveries that were in progress become unconfirmed. A backup is written first. dryRun previews it.',
    ].join('\n'),
    effect: 'mutation',
    examples: [
      { title: 'Preview', args: { file: 'calendar.json', dryRun: true } },
      { title: 'Import', args: { file: 'calendar.json' } },
    ],
    surfaces: ['cli'],
    positional: 'file',
  },
};

/** Next steps for the agent, by error code. */
const NEXT: Record<string, string> = {
  PUBLICATION_CONFLICT: 'The publication changed since you read it: read it again with publications_inspect and decide from the new state.',
  SETTINGS_CONFLICT: 'The publishing settings changed: list again with publications_list.',
  PUBLICATION_NOT_FOUND: 'Use a publication ID from publications_list; publications of videos outside your scope are not visible.',
  AUTHORIZATION_REQUIRED:
    'Only the owner can authorize a send: ask them to review this publication in CucCut and choose "Approve for agent delivery", then read it again (the revision changes) and send that revision. Do not try to work around it.',
  OWNER_REQUIRED: 'This is the owner\'s action in CucCut (authorizing, recording results, accounts and connections): tell the owner what to do there.',
  PUBLISHING_FORBIDDEN: 'This is the owner\'s action in CucCut: tell the owner what to do there.',
  PUBLICATION_INVALID: 'Fix what issues lists (text, accounts, export, times); tell the owner about the ones only they can fix (accounts, approval).',
  PUBLICATION_LOCKED: 'Delivery has started for this publication, so its shared content is locked: prepare a new release with publications_prepare and repeat: true.',
  DESTINATION_LOCKED: 'That account\'s delivery has started: withdraw it (publications_withdraw) if it is waiting, or ask the owner to record its result.',
  PUBLICATION_ARCHIVED: 'Restore it first with publications_update and archived: false.',
  SLOT_TAKEN: 'Choose a time further from the other post on that account, or plan one with publications_slots.',
  AFTER_EXPIRY: 'Choose a time before expiresAt, or change expiresAt.',
  SEQUENCE_NOT_FOUND: 'Leave sequence out to publish the video\'s main sequence, or use a sequenceId of that video from videos_inspect.',
  SEQUENCE_ONE_VIDEO: 'Give sequence only with a single video; prepare other videos in their own call.',
  EXPORT_REQUIRED: 'Pin an export first with publications_pin.',
  EXPORT_CHANGED: 'The pinned file changed on disk: pin a verified export again with publications_pin, then it needs a new approval.',
  EXPORT_STALE: 'That export is of an older revision: call publications_pin without job to render the current revision and pin it.',
  VIDEO_NOT_FOUND: 'Use a path or videoId from videos_list.',
  ACCOUNT_NOT_FOUND: 'Use an account ID from publications_list; adding accounts is the owner\'s, in Publishing settings.',
  NOTHING_TO_SEND: 'Every account was already sent: prepare a new release with publications_prepare and repeat: true.',
  NOT_WAITING: 'Only an account in state queued (waiting for the owner) can be withdrawn.',
  ARCHIVE_IN_FLIGHT: 'Withdraw waiting accounts first (publications_withdraw), or ask the owner to record their results.',
  PROVIDER_UNSUPPORTED: 'This version publishes by hand only: ask the owner to use a By hand connection.',
  LOCAL_TIME_GAP: 'That local time does not exist (clocks change): choose another time.',
  LOCAL_TIME_FOLD: 'That local time happens twice (clocks change): give the time with an explicit offset.',
  TIMEZONE_INVALID: 'Use an IANA timezone such as Europe/Paris.',
  CALENDAR_RANGE: 'Use a range of at most 93 days with from before to.',
  REVISION_REQUIRED: 'Give revisions for every publication you reserve.',
  TRANSFER_NOT_ALLOWED: 'Calendar import and export run from the command line or the CucCut app.',
  CALENDAR_INVALID: 'The file is not a cuccut-calendar file this version reads.',
};

export class PublishingTools implements ToolSet {
  readonly schemas = schemas;
  readonly definitions = DEFINITIONS;
  readonly #deps: PublishingToolsDeps;

  constructor(deps: PublishingToolsDeps) {
    this.#deps = deps;
  }

  async dispatch(name: string, args: unknown, principal: ToolPrincipal): Promise<unknown> {
    try {
      switch (name as ToolName) {
        case 'publications_list':
          return await this.#list(args as Args<'publications_list'>, principal);
        case 'publications_inspect':
          return await this.#inspect(args as Args<'publications_inspect'>, principal);
        case 'publications_prepare':
          return await this.#prepare(args as Args<'publications_prepare'>, principal);
        case 'publications_update':
          return await this.#update(args as Args<'publications_update'>, principal);
        case 'publications_reschedule':
          return await this.#reschedule(args as Args<'publications_reschedule'>, principal);
        case 'publications_slots':
          return await this.#slots(args as Args<'publications_slots'>, principal);
        case 'publications_reserve':
          return await this.#reserve(args as Args<'publications_reserve'>, principal);
        case 'publications_pin':
          return await this.#pin(args as Args<'publications_pin'>, principal);
        case 'publications_propose_copy':
          return await this.#proposeCopy(args as Args<'publications_propose_copy'>, principal);
        case 'publications_approve':
          return await this.#approve(args as Args<'publications_approve'>, principal);
        case 'publications_send':
          return await this.#send(args as Args<'publications_send'>, principal);
        case 'publications_withdraw':
          return await this.#withdraw(args as Args<'publications_withdraw'>, principal);
        case 'publications_archive':
          return await this.#archive(args as Args<'publications_archive'>, principal);
        case 'publications_export_calendar':
          return await this.#exportCalendar(args as Args<'publications_export_calendar'>, principal);
        case 'publications_import_calendar':
          return await this.#importCalendar(args as Args<'publications_import_calendar'>, principal);
        default:
          throw new ToolError('UNKNOWN_TOOL', `No such tool: ${name}`);
      }
    } catch (error) {
      throw toolErrorOf(error);
    }
  }

  get #service(): PublishingService {
    return this.#deps.publishing;
  }

  // ---- Reads ----

  async #list(args: Args<'publications_list'>, principal: ToolPrincipal) {
    const { scope } = this.#deps;
    const access = scope.authorize(principal, false);
    const service = this.#service;
    const settings = service.store.settings();
    const from = args.from ?? (args.to ? addCivilDays(args.to, -30) : todayInZone(settings.timezone));
    const to = args.to ?? addCivilDays(from, 30);
    const videoId = args.video !== undefined ? await this.#videoId(args.video, access) : null;
    const rows = service
      .calendarRows({
        from,
        to,
        ...(args.accounts ? { accountIds: args.accounts } : {}),
        ...(args.statuses ? { statuses: args.statuses } : {}),
        ...(args.unscheduled !== undefined ? { includeUnscheduled: args.unscheduled } : {}),
      })
      .filter((row) => videoId === null || row.videoId === videoId);
    const visible = await this.#visible(access, rows.map((row) => row.videoId));
    const matching = rows.filter((row) => visible.has(row.videoId));
    const offset = args.offset ?? 0;
    const limit = args.limit ?? 50;
    const page = matching.slice(offset, offset + limit);
    const accounts = service.store.accounts();
    const connections = service.store.connections();
    return {
      range: { from, to, timezone: settings.timezone },
      publications: page.map((row) => rowDigest(row, accounts)),
      total: matching.length,
      nextOffset: offset + page.length < matching.length ? offset + page.length : null,
      accounts: accounts.map((a) => ({
        accountId: a.id,
        name: a.name,
        network: a.network,
        handle: a.remoteId,
        connection: connections.find((c) => c.id === a.connectionId)?.name ?? null,
        provider: connections.find((c) => c.id === a.connectionId)?.provider ?? null,
        disabled: a.disabled,
        needsReconnect: a.needsReconnect,
        linkedTo: a.equivalentTo,
      })),
      schedule: {
        timezone: settings.timezone,
        weeklySlots: settings.slots,
        minGapMinutes: settings.minGapMinutes,
        leadMinutes: settings.leadMinutes,
        defaultAccountIds: settings.defaultAccountIds,
      },
      ...(service.store.problem ? { unavailable: formatRef(service.store.problem, service.store.problem.key) } : {}),
      next: 'Read a publication with publications_inspect; prepare new ones with publications_prepare.',
    };
  }

  async #inspect(args: Args<'publications_inspect'>, principal: ToolPrincipal) {
    const access = this.#deps.scope.authorize(principal, false);
    const p = await this.#find(args.publication, access);
    const settings = this.#service.store.settings();
    return {
      ...this.#digest(this.#service.detail(p)),
      writingGuidance: settings.writing || null,
      limits: { titleCharacters: YOUTUBE_TITLE_LIMIT, captionCharacters: CAPTION_LIMITS },
      ownerOnly:
        'Authorizing delivery, recording what happened on a network, accounts, connections and the schedule are the owner\'s, in CucCut. When one is needed, tell the owner.',
    };
  }

  // ---- Writes ----

  async #prepare(args: Args<'publications_prepare'>, principal: ToolPrincipal) {
    const { scope } = this.#deps;
    const access = scope.authorize(principal, true);
    const videoIds: Id[] = [];
    for (const video of args.videos) videoIds.push(await this.#videoId(video, access));
    const approval = await scope.confirm(access, {
      tool: 'publications_prepare',
      ...confirmSummary(RcAgentTools.publicationsPrepareSummary({ videos: args.videos.join(RcAgentTools.listSeparator().text), repeat: args.repeat === true })),
    });
    const publications = await this.#service.prepare(
      {
        videoIds,
        ...(args.sequence ? { sequenceId: args.sequence } : {}),
        ...(args.accounts ? { accountIds: args.accounts } : {}),
        ...(args.repeat !== undefined ? { repeat: args.repeat } : {}),
      },
      actorOf(access),
    );
    return {
      publications: publications.map((d) => this.#digest(d)),
      ...approvalField(approval),
      next: 'Pin the video file with publications_pin, write the text with publications_update, plan times with publications_slots or publications_reserve.',
    };
  }

  async #update(args: Args<'publications_update'>, principal: ToolPrincipal) {
    const { scope } = this.#deps;
    const access = scope.authorize(principal, true);
    const p = await this.#find(args.publication, access);
    const restore = args.archived === false && p.archived;
    const approval = await scope.confirm(access, {
      tool: 'publications_update',
      ...confirmSummary(
        restore ? RcAgentTools.publicationsRestoreSummary({ label: p.label }) : RcAgentTools.publicationsUpdateSummary({ label: p.label }),
      ),
    });
    const actor = actorOf(access);
    let revision = args.revision;
    let detail: PublicationDetail | null = null;
    if (restore) {
      detail = await this.#service.unarchive(p.id, revision, actor);
      revision = detail.revision;
    }
    const patch = {
      ...(args.label !== undefined ? { label: args.label } : {}),
      ...(args.copy !== undefined ? { copy: mergeCopy((detail ?? p).copy, args.copy) } : {}),
      ...(args.scheduledAt !== undefined ? { scheduledAt: args.scheduledAt } : {}),
      ...(args.timezone !== undefined ? { timezone: args.timezone } : {}),
      ...(args.priority !== undefined ? { priority: args.priority } : {}),
      ...(args.expiresAt !== undefined ? { expiresAt: args.expiresAt } : {}),
    };
    if (Object.keys(patch).length || args.destinations) {
      detail = await this.#service.update(
        { publicationId: p.id, revision, patch, ...(args.destinations ? { destinations: args.destinations } : {}) },
        actor,
      );
    }
    detail ??= this.#service.get(p.id);
    return { ...this.#digest(detail), ...approvalField(approval) };
  }

  async #reschedule(args: Args<'publications_reschedule'>, principal: ToolPrincipal) {
    const { scope } = this.#deps;
    const access = scope.authorize(principal, true);
    const p = await this.#find(args.publication, access);
    const approval = await scope.confirm(access, {
      tool: 'publications_reschedule',
      ...confirmSummary(RcAgentTools.publicationsRescheduleSummary({ label: p.label, count: args.placements.length })),
    });
    const detail = await this.#service.reschedule(p.id, args.revision, args.placements, actorOf(access));
    return { ...this.#digest(detail), ...approvalField(approval) };
  }

  async #slots(args: Args<'publications_slots'>, principal: ToolPrincipal) {
    const access = this.#deps.scope.authorize(principal, false);
    for (const id of new Set(args.publications)) await this.#find(id, access);
    const plan = await this.#service.slots(
      { publicationIds: args.publications, ...(args.from ? { from: args.from } : {}), ...(args.days ? { days: args.days } : {}) },
      actorOf(access),
    );
    return { ...planDigest(plan, this.#service.store.settings().timezone), next: 'Reserve these times with publications_reserve (give each publication\'s revision).' };
  }

  async #reserve(args: Args<'publications_reserve'>, principal: ToolPrincipal) {
    const { scope } = this.#deps;
    const access = scope.authorize(principal, true);
    const ids = [...new Set(args.publications)];
    for (const id of ids) await this.#find(id, access);
    const approval = await scope.confirm(access, {
      tool: 'publications_reserve',
      ...confirmSummary(RcAgentTools.publicationsReserveSummary({ count: ids.length })),
    });
    const result = await this.#service.slots(
      {
        publicationIds: ids,
        reserve: true,
        revisions: args.revisions,
        ...(args.from ? { from: args.from } : {}),
        ...(args.days ? { days: args.days } : {}),
      },
      actorOf(access),
    );
    return {
      ...planDigest(result, this.#service.store.settings().timezone),
      publications: result.publications.map((d) => this.#digest(d)),
      ...approvalField(approval),
    };
  }

  async #pin(args: Args<'publications_pin'>, principal: ToolPrincipal) {
    const { scope } = this.#deps;
    const access = scope.authorize(principal, true);
    const p = await this.#find(args.publication, access);
    if (args.job !== undefined) await scope.visibleJob(args.job, access);
    const approval = await scope.confirm(access, {
      tool: 'publications_pin',
      ...confirmSummary(RcAgentTools.publicationsPinSummary({ label: p.label, render: args.job === undefined })),
    });
    const { publication, jobId } = await this.#service.pin(p.id, args.revision, args.job ? { jobId: args.job } : { render: true }, actorOf(access));
    return {
      ...(jobId ? { jobId } : {}),
      publication: this.#digest(publication),
      ...approvalField(approval),
      next: jobId
        ? 'The export is rendering: wait with jobs_wait; the file is pinned when it finishes (read the publication again with publications_inspect).'
        : 'The export is pinned: it needs approval of that exact file (the owner, or publications_approve after you checked it).',
    };
  }

  async #proposeCopy(args: Args<'publications_propose_copy'>, principal: ToolPrincipal) {
    const { scope } = this.#deps;
    const access = scope.authorize(principal, true);
    const p = await this.#find(args.publication, access);
    const approval = await scope.confirm(access, {
      tool: 'publications_propose_copy',
      ...confirmSummary(RcAgentTools.publicationsProposeCopySummary({ label: p.label })),
    });
    const copy = mergeCopy({ title: '', description: '', hashtags: [] }, args.copy);
    const detail = await this.#service.copy.store(p.id, args.revision, copy, args.reason, actorOf(access));
    return { ...this.#digest(detail), ...approvalField(approval), next: 'The owner reviews the proposal in CucCut and chooses what to use.' };
  }

  async #approve(args: Args<'publications_approve'>, principal: ToolPrincipal) {
    const { scope } = this.#deps;
    const access = scope.authorize(principal, true);
    const p = await this.#find(args.publication, access);
    const approval = await scope.confirm(access, {
      tool: 'publications_approve',
      ...confirmSummary(RcAgentTools.publicationsApproveSummary({ label: p.label })),
    });
    const detail = await this.#service.approve(p.id, args.revision, actorOf(access));
    return { ...this.#digest(detail), ...approvalField(approval) };
  }

  async #send(args: Args<'publications_send'>, principal: ToolPrincipal) {
    const { scope } = this.#deps;
    const access = scope.authorize(principal, true);
    const p = await this.#find(args.publication, access);
    if (p.revision !== args.revision) throw new ToolError('PUBLICATION_CONFLICT', 'The publication changed since you read it', { revision: p.revision, next: NEXT.PUBLICATION_CONFLICT });
    // Refused before asking anyone: only the owner's authorization of this exact revision lets an agent or the command line send.
    if (!publicationAuthorized(p)) {
      throw new ToolError('AUTHORIZATION_REQUIRED', 'The owner must authorize this exact publication in CucCut before an agent can send it.', {
        next: NEXT.AUTHORIZATION_REQUIRED,
      });
    }
    const accounts = this.#service.store.accounts();
    const names = p.destinations
      .filter((d) => isEditableDelivery(d.state))
      .map((d) => accounts.find((a) => a.id === d.accountId)?.name ?? d.accountId);
    const approval = await scope.confirm(access, {
      tool: 'publications_send',
      ...confirmSummary(RcAgentTools.publicationsSendSummary({ label: p.label, accounts: names.join(RcAgentTools.listSeparator().text) })),
    });
    const detail = await this.#service.send(p.id, args.revision, actorOf(access));
    return {
      ...this.#digest(detail),
      ...approvalField(approval),
      next: 'By-hand accounts now wait for the owner to post them in the network\'s app and record the result in CucCut. Do not report them as published.',
    };
  }

  async #withdraw(args: Args<'publications_withdraw'>, principal: ToolPrincipal) {
    const { scope } = this.#deps;
    const access = scope.authorize(principal, true);
    const p = await this.#find(args.publication, access);
    const destination = p.destinations.find((d) => d.id === args.destination);
    const account = destination ? (this.#service.store.accounts().find((a) => a.id === destination.accountId)?.name ?? destination.accountId) : args.destination;
    const approval = await scope.confirm(access, {
      tool: 'publications_withdraw',
      ...confirmSummary(RcAgentTools.publicationsWithdrawSummary({ label: p.label, account })),
    });
    const detail = await this.#service.withdraw(p.id, args.revision, args.destination, actorOf(access));
    return { ...this.#digest(detail), ...approvalField(approval) };
  }

  async #archive(args: Args<'publications_archive'>, principal: ToolPrincipal) {
    const { scope } = this.#deps;
    const access = scope.authorize(principal, true);
    const p = await this.#find(args.publication, access);
    const approval = await scope.confirm(access, {
      tool: 'publications_archive',
      ...confirmSummary(RcAgentTools.publicationsArchiveSummary({ label: p.label })),
    });
    const detail = await this.#service.archive(p.id, args.revision, actorOf(access));
    return {
      ...this.#digest(detail),
      ...approvalField(approval),
      next: `publications_update with archived: false and revision ${detail.revision} restores it.`,
    };
  }

  async #exportCalendar(args: Args<'publications_export_calendar'>, principal: ToolPrincipal) {
    const { scope } = this.#deps;
    const access = scope.authorize(principal, true);
    const { archive, fileName } = this.#service.transfer.export(actorOf(access));
    const target = path.resolve(scope.fileBase(access), args.file ?? fileName);
    const approval = await scope.confirm(access, { tool: 'publications_export_calendar', targets: [target], summary: target });
    try {
      await fs.writeFile(target, `${JSON.stringify(archive, null, 2)}\n`, { flag: args.overwrite ? 'w' : 'wx', mode: 0o600 });
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'EEXIST') {
        throw new ToolError('FILE_EXISTS', `${target} already exists`, { next: 'Choose another file, or pass overwrite: true to replace it.' });
      }
      if (code === 'ENOENT') throw new ToolError('INVALID_PATH', `The directory of ${target} does not exist`);
      throw error;
    }
    return { path: target, publications: archive.publications.length, accounts: archive.accounts.length, ...approvalField(approval) };
  }

  async #importCalendar(args: Args<'publications_import_calendar'>, principal: ToolPrincipal) {
    const { scope } = this.#deps;
    const access = scope.authorize(principal, args.dryRun !== true);
    const file = path.resolve(scope.fileBase(access), args.file);
    let raw: unknown;
    try {
      raw = JSON.parse(await fs.readFile(file, 'utf8'));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new ToolError('FILE_NOT_FOUND', `${file} does not exist`);
      throw new ToolError('CALENDAR_INVALID', `${file} is not a JSON file`, { next: NEXT.CALENDAR_INVALID });
    }
    const actor = actorOf(access);
    const preview = this.#service.transfer.preview(raw, actor);
    if (args.dryRun) return { preview, next: 'Import it with publications_import_calendar without dryRun.' };
    const approval = await scope.confirm(access, {
      tool: 'publications_import_calendar',
      targets: [file],
      ...confirmSummary(RcAgentTools.publicationsImportSummary({ file, count: preview.added })),
    });
    const result = await this.#service.transfer.apply(raw, actor);
    return {
      added: result.added,
      preview: result.preview,
      ...approvalField(approval),
      ...(result.preview.reconnect ? { next: 'New accounts must be connected again by the owner in Publishing settings before sending.' } : {}),
    };
  }

  // ---- Helpers ----

  async #videoId(video: string, access: ToolAccess): Promise<Id> {
    const { scope } = this.#deps;
    if (!scope.videoIdOf) throw new ToolError('VIDEO_NOT_FOUND', `Video "${video}" not found`);
    return scope.videoIdOf(video, access);
  }

  async #visible(access: ToolAccess, videoIds: readonly Id[]): Promise<Set<Id>> {
    const unique = [...new Set(videoIds)];
    if (!unique.length) return new Set();
    return (await this.#deps.scope.visibleVideoIds?.(access, unique)) ?? new Set();
  }

  /** A publication whose video is in the caller's scope; others are answered like missing ones. */
  async #find(id: Id, access: ToolAccess): Promise<Publication> {
    let p: Publication | null;
    try {
      p = this.#service.publication(id);
    } catch {
      p = null;
    }
    if (!p || !(await this.#visible(access, [p.videoId])).has(p.videoId)) {
      throw new ToolError('PUBLICATION_NOT_FOUND', `Publication ${id} not found`, { next: NEXT.PUBLICATION_NOT_FOUND });
    }
    return p;
  }

  #digest(d: PublicationDetail) {
    return detailDigest(d, this.#service.store.accounts());
  }
}

function actorOf(access: ToolAccess): PublishingActor {
  const { principal } = access;
  return { kind: principal.kind === 'local' ? 'cli' : 'agent', name: principal.name, submitter: access.submitter };
}

function mergeCopy(base: PublicationCopy, patch: { title?: string | undefined; description?: string | undefined; hashtags?: string[] | undefined }): PublicationCopy {
  return {
    title: patch.title ?? base.title,
    description: patch.description ?? base.description,
    hashtags: patch.hashtags ? parseHashtags(patch.hashtags.join(' ')) : base.hashtags,
  };
}

function issueDigest(issue: PublicationIssue) {
  return {
    destinationId: issue.destinationId,
    field: issue.field,
    code: issue.code,
    message: formatRef(issue.message, issue.code),
  };
}

function rowDigest(row: PublicationRow, accounts: PublishingAccount[]) {
  return {
    publication: row.id,
    label: row.label,
    status: row.status,
    revision: row.revision,
    videoId: row.videoId,
    projectId: row.projectId,
    scheduledAt: row.scheduledAt,
    timezone: row.timezone,
    priority: row.priority,
    expiresAt: row.expiresAt,
    destinations: row.destinations.map((d) => ({
      destinationId: d.id,
      accountId: d.accountId,
      account: accounts.find((a) => a.id === d.accountId)?.name ?? null,
      format: d.format,
      state: d.state,
      at: d.at,
    })),
  };
}

/** What the agent reads about a publication: the record without frozen payloads and history, with each account's composed caption and its limit. */
export function detailDigest(d: PublicationDetail, accounts: PublishingAccount[]) {
  return {
    publication: d.id,
    revision: d.revision,
    label: d.label,
    status: d.status,
    archived: d.archived,
    video: { videoId: d.videoId, name: d.videoName, available: d.videoAvailable, newerEdit: d.newerEdit },
    projectId: d.projectId,
    copy: d.copy,
    scheduledAt: d.scheduledAt,
    timezone: d.timezone,
    priority: d.priority,
    expiresAt: d.expiresAt,
    export: d.export
      ? {
          exportId: d.export.id,
          width: d.export.width,
          height: d.export.height,
          durationSec: d.export.durationSec,
          fps: d.export.fps,
          codec: d.export.codec,
          videoRevision: d.export.videoRevision,
          jobId: d.export.jobId,
        }
      : null,
    approved: d.approved,
    // Not `approval`: that field of a tool result is the confirmation note (`approvalField`).
    exportApproval: d.approval,
    authorizedToSend: publicationAuthorized(d),
    renderAndPin: d.pinJob ? { jobId: d.pinJob.jobId, error: localizeText(d.pinJob.error, d.pinJob.errorRef) } : null,
    proposal: d.proposal ? { revision: d.proposal.revision, copy: d.proposal.copy, reason: d.proposal.reason } : null,
    destinations: d.destinations.map((dest) => {
      const account = accounts.find((a) => a.id === dest.accountId) ?? null;
      const copy = resolveCopy(d.copy, dest);
      const caption = composeCaption(copy);
      const network = account?.network ?? FORMAT_NETWORK[dest.format];
      return {
        destinationId: dest.id,
        accountId: dest.accountId,
        account: account?.name ?? null,
        network,
        format: dest.format,
        state: dest.state,
        scheduledAt: dest.scheduledAt,
        at: calendarInstant(d, dest),
        overrides: dest.overrides,
        options: dest.options,
        title: copy.title,
        caption,
        captionLength: codePointLength(caption),
        captionLimit: CAPTION_LIMITS[network],
        remoteUrl: dest.remoteUrl,
        confirmedAt: dest.confirmedAt,
        publishedAt: dest.publishedAt,
        error: localizeText(dest.error, dest.errorRef) ?? null,
      };
    }),
    issues: d.issues.map(issueDigest),
  };
}

function planDigest(plan: SlotPlan, timezone: string) {
  return {
    timezone,
    placements: plan.placements.map((item) => ({ publication: item.publicationId, at: item.at })),
    unavailable: plan.unavailable.map((item) => ({ publication: item.publicationId, reason: formatRef(item.reason, item.reason.key) })),
  };
}

/** Service refusals keep their code (`details.code`) and get a next step; the saved publication of a conflict is reduced to its revision. */
function toolErrorOf(error: unknown): unknown {
  if (!(error instanceof RpcError)) return error;
  const details = (error.details ?? {}) as Record<string, unknown>;
  if (typeof details.code !== 'string') return error;
  const { code, current, issues, ...rest } = details as { code: string; current?: Publication; issues?: PublicationIssue[] } & Record<string, unknown>;
  return new ToolError(code, error.message, {
    ...rest,
    ...(current && typeof current === 'object' && 'revision' in current ? { revision: current.revision } : {}),
    ...(Array.isArray(issues) ? { issues: issues.map(issueDigest) } : {}),
    ...(NEXT[code] ? { next: NEXT[code] } : {}),
  });
}
