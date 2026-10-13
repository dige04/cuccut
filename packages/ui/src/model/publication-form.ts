import {
  CAPTION_LIMITS,
  codePointLength,
  composeCaption,
  defaultPublishingFormat,
  DESTINATION_OPTION_DEFAULTS,
  FORMAT_NETWORK,
  intendedTime,
  isEditableDelivery,
  parseHashtags,
  resolveCopy,
  YOUTUBE_TITLE_LIMIT,
  type DeliveryState,
  type DestinationInput,
  type DestinationOptions,
  type Id,
  type Publication,
  type PublicationCopy,
  type PublicationDetail,
  type PublicationPatch,
  type PublishingAccount,
  type PublishingFormat,
  type PublishingNetwork,
  type PublishingUpdateParams,
} from '@cuccut/protocol';
import { PC } from '../components/publishing/publishing-copy.ts';
import { networkLabel } from './publishing-labels.ts';

/**
 * The publication dialog's draft (design `docs/cuccut/m2-publishing.md` §2.4, port of agentcut `publication-panel.tsx`). A pure reducer over the
 * saved publication: edits stay in the draft until Save; a change made elsewhere while the draft is dirty becomes a conflict that keeps the draft;
 * the review checkbox is bound to the revision and pinned export it was ticked for, so any save or new export clears it.
 *
 * Hashtags are edited as text (`#launch #shorts`) and parsed on save, so typing a space never loses a character.
 */

/** Shared text as typed. */
export interface DraftText {
  title: string;
  description: string;
  hashtags: string;
}

/** Destination overrides as typed; `null` inherits the shared text. */
export interface DraftOverrides {
  title: string | null;
  description: string | null;
  hashtags: string | null;
}

export interface DraftDestination {
  /** Saved destination; absent for an account added in this draft. */
  id?: Id;
  accountId: Id;
  format: PublishingFormat;
  overrides: DraftOverrides;
  options: DestinationOptions;
  scheduledAt: string | null;
  /** The saved delivery state (`not_sent` for a new one). Only `not_sent` and `failed` destinations can be edited. */
  state: DeliveryState;
}

export interface PublicationDraft {
  label: string;
  text: DraftText;
  scheduledAt: string | null;
  timezone: string;
  priority: number;
  expiresAt: string | null;
  destinations: DraftDestination[];
}

export interface FormState {
  saved: PublicationDetail | null;
  draft: PublicationDraft | null;
  /** The newer version saved elsewhere while this draft was dirty (`PUBLICATION_CONFLICT`); the draft is kept until Reload. */
  conflict: Publication | null;
  /** What the review checkbox was ticked for. */
  reviewed: { revision: number; exportId: Id | null } | null;
}

export type FormAction =
  /** Opens or reloads the saved publication: the draft is replaced and a conflict is cleared. */
  | { type: 'load'; publication: PublicationDetail }
  /** This form saved: the saved version becomes the draft. */
  | { type: 'saved'; publication: PublicationDetail }
  /** A newer version arrived from elsewhere (topic, another window, an agent): taken as is when the draft is clean, else a conflict. */
  | { type: 'external'; publication: PublicationDetail }
  | { type: 'edit'; patch: Partial<Omit<PublicationDraft, 'destinations' | 'text'>> & { text?: Partial<DraftText> } }
  | { type: 'toggleAccount'; account: PublishingAccount; on: boolean }
  | {
      type: 'setDestination';
      accountId: Id;
      patch: { format?: PublishingFormat; overrides?: Partial<DraftOverrides>; options?: Partial<DestinationOptions>; scheduledAt?: string | null };
    }
  | { type: 'resetDestinationText'; accountId: Id }
  | { type: 'discard' }
  /** Undo of Discard: the discarded draft comes back (kept only while the saved version is the one it was edited from). */
  | { type: 'restore'; draft: PublicationDraft; revision: number }
  /** A save was refused because the publication changed: keep the draft and hold the saved version. */
  | { type: 'conflict'; current: Publication }
  | { type: 'review'; checked: boolean };

export const EMPTY_FORM: FormState = { saved: null, draft: null, conflict: null, reviewed: null };

export function hashtagsText(tags: readonly string[]): string {
  return tags.map((tag) => `#${tag}`).join(' ');
}

/** The draft of a saved publication. */
export function draftOf(p: Publication): PublicationDraft {
  return {
    label: p.label,
    text: { title: p.copy.title, description: p.copy.description, hashtags: hashtagsText(p.copy.hashtags) },
    scheduledAt: p.scheduledAt,
    timezone: p.timezone,
    priority: p.priority,
    expiresAt: p.expiresAt,
    destinations: p.destinations.map((d) => ({
      id: d.id,
      accountId: d.accountId,
      format: d.format,
      overrides: {
        title: d.overrides.title,
        description: d.overrides.description,
        hashtags: d.overrides.hashtags === null ? null : hashtagsText(d.overrides.hashtags),
      },
      options: { ...d.options, tags: [...d.options.tags] },
      scheduledAt: d.scheduledAt,
      state: d.state,
    })),
  };
}

/** Some destination was handed over: the shared text, label and times are frozen (the Runtime refuses changes with `PUBLICATION_LOCKED`). */
export function publicationLocked(p: Pick<Publication, 'destinations'> | null): boolean {
  return !!p?.destinations.some((d) => !isEditableDelivery(d.state));
}

function copyOf(text: DraftText): PublicationCopy {
  return { title: text.title, description: text.description, hashtags: parseHashtags(text.hashtags) };
}

/** Deep equality of plain JSON values, independent of key order. */
function sameValue(a: unknown, b: unknown): boolean {
  return canonical(a) === canonical(b);
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .filter((key) => (value as Record<string, unknown>)[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'undefined';
}

function destinationInput(d: DraftDestination): DestinationInput {
  return {
    ...(d.id ? { id: d.id } : {}),
    accountId: d.accountId,
    format: d.format,
    overrides: {
      title: d.overrides.title,
      description: d.overrides.description,
      hashtags: d.overrides.hashtags === null ? null : parseHashtags(d.overrides.hashtags),
    },
    options: d.options,
    scheduledAt: d.scheduledAt,
  };
}

/** The destination list as `publishing.update` takes it. Destinations already handed over go exactly as saved. */
function destinationInputs(destinations: readonly DraftDestination[], saved: Publication): DestinationInput[] {
  return destinations.map((d) => {
    const original = d.id ? saved.destinations.find((item) => item.id === d.id) : undefined;
    if (!original || isEditableDelivery(original.state)) return destinationInput(d);
    return {
      id: original.id,
      accountId: original.accountId,
      format: original.format,
      overrides: original.overrides,
      options: original.options,
      scheduledAt: original.scheduledAt,
    };
  });
}

/**
 * The `publishing.update` call that saves the draft, or null when nothing changed. Only changed publication fields go in the patch (a handed-over
 * publication refuses any change to them), and destinations already handed over are sent exactly as saved.
 */
export function toUpdateParams(state: FormState): PublishingUpdateParams | null {
  const { saved, draft } = state;
  if (!saved || !draft) return null;
  const base = draftOf(saved);
  const patch: PublicationPatch = {};
  if (draft.label.trim() !== base.label) patch.label = draft.label.trim();
  const copy = copyOf(draft.text);
  if (!sameValue(copy, saved.copy)) patch.copy = copy;
  if (draft.scheduledAt !== base.scheduledAt) patch.scheduledAt = draft.scheduledAt;
  if (draft.timezone !== base.timezone) patch.timezone = draft.timezone;
  if (draft.priority !== base.priority) patch.priority = draft.priority;
  if (draft.expiresAt !== base.expiresAt) patch.expiresAt = draft.expiresAt;
  const inputs = destinationInputs(draft.destinations, saved);
  const destinationsChanged = !sameValue(inputs, destinationInputs(base.destinations, saved));
  if (!Object.keys(patch).length && !destinationsChanged) return null;
  return {
    publicationId: saved.id,
    revision: saved.revision,
    patch,
    ...(destinationsChanged ? { destinations: inputs } : {}),
  };
}

/** The draft differs from the saved publication. */
export function isDirty(state: FormState): boolean {
  return toUpdateParams(state) !== null;
}

/** The review checkbox counts only for the revision and pinned export it was ticked for, and only while nothing is unsaved. */
export function isReviewed(state: FormState): boolean {
  const { saved, reviewed } = state;
  return !!saved && !!reviewed && reviewed.revision === saved.revision && reviewed.exportId === saved.exportId && !isDirty(state);
}

function updateDestination(draft: PublicationDraft, accountId: Id, change: (d: DraftDestination) => DraftDestination): PublicationDraft {
  return { ...draft, destinations: draft.destinations.map((d) => (d.accountId === accountId && isEditableDelivery(d.state) ? change(d) : d)) };
}

export function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'load':
    case 'saved':
      return {
        saved: action.publication,
        draft: draftOf(action.publication),
        conflict: null,
        reviewed:
          state.reviewed && state.reviewed.revision === action.publication.revision && state.reviewed.exportId === action.publication.exportId
            ? state.reviewed
            : null,
      };
    case 'external': {
      if (state.saved && action.publication.revision <= state.saved.revision) return state;
      if (!isDirty(state)) return formReducer(state, { type: 'load', publication: action.publication });
      return { ...state, conflict: action.publication };
    }
    case 'conflict':
      return { ...state, conflict: action.current };
    case 'discard':
      return state.saved ? { ...state, draft: draftOf(state.saved) } : state;
    case 'restore':
      return state.saved && state.saved.revision === action.revision ? { ...state, draft: action.draft } : state;
    case 'review':
      return { ...state, reviewed: action.checked && state.saved ? { revision: state.saved.revision, exportId: state.saved.exportId } : null };
    default:
      break;
  }
  const { draft } = state;
  if (!draft) return state;
  const locked = publicationLocked(state.saved);
  switch (action.type) {
    case 'edit': {
      if (locked) return state;
      const { text, ...rest } = action.patch;
      return { ...state, draft: { ...draft, ...rest, text: text ? { ...draft.text, ...text } : draft.text } };
    }
    case 'toggleAccount': {
      const existing = draft.destinations.find((d) => d.accountId === action.account.id);
      if (action.on) {
        if (existing) return state;
        const saved = state.saved?.destinations.find((d) => d.accountId === action.account.id);
        const restored = saved ? draftOf({ ...state.saved!, destinations: [saved] }).destinations[0]! : null;
        const added: DraftDestination = restored ?? {
          accountId: action.account.id,
          format: defaultPublishingFormat(action.account.network),
          overrides: { title: null, description: null, hashtags: null },
          options: { ...DESTINATION_OPTION_DEFAULTS, tags: [] },
          scheduledAt: null,
          state: 'not_sent',
        };
        return { ...state, draft: { ...draft, destinations: [...draft.destinations, added] } };
      }
      if (!existing || !isEditableDelivery(existing.state)) return state;
      return { ...state, draft: { ...draft, destinations: draft.destinations.filter((d) => d !== existing) } };
    }
    case 'setDestination':
      return {
        ...state,
        draft: updateDestination(draft, action.accountId, (d) => ({
          ...d,
          ...(action.patch.format ? { format: action.patch.format } : {}),
          ...(action.patch.scheduledAt !== undefined ? { scheduledAt: action.patch.scheduledAt } : {}),
          overrides: { ...d.overrides, ...action.patch.overrides },
          options: { ...d.options, ...action.patch.options },
        })),
      };
    case 'resetDestinationText':
      return {
        ...state,
        draft: updateDestination(draft, action.accountId, (d) => ({ ...d, overrides: { title: null, description: null, hashtags: null } })),
      };
  }
}

// ---- Derived ----

export type PrimaryAction = 'schedule' | 'sendNow' | 'send';

/** Destinations this send would hand over (not yet sent, or failed and sent again). */
export function sendableDestinations(p: Pick<Publication, 'destinations'>): Publication['destinations'] {
  return p.destinations.filter((d) => isEditableDelivery(d.state));
}

/**
 * The primary button: "Schedule publication" when every destination to send has a time, "Send now" when none has, "Send" when mixed (agentcut
 * `publication-panel.tsx`). Read from the saved publication, since only the saved version is sent.
 */
export function primaryAction(p: Pick<Publication, 'scheduledAt' | 'destinations'>): PrimaryAction {
  const sendable = sendableDestinations(p);
  const timed = sendable.filter((d) => intendedTime(p, d) !== null).length;
  if (sendable.length && timed === sendable.length) return 'schedule';
  if (timed === 0) return 'sendNow';
  return 'send';
}

export function primaryLabel(action: PrimaryAction): string {
  return PC.form[action];
}

/**
 * Why the primary send (or "Approve for agent delivery") is not available, or null when it is. Checked in the order the owner fixes them, so the
 * reason names the next step.
 */
export function sendBlock(state: FormState, context: { busy?: boolean; owner?: boolean } = {}): string | null {
  const { saved } = state;
  if (!saved) return PC.form.loading;
  if (context.busy) return PC.form.busy;
  if (context.owner === false) return PC.form.webOnly;
  if (isDirty(state)) return PC.form.needsSave;
  if (!saved.destinations.length) return PC.form.needsAccounts;
  if (!sendableDestinations(saved).length) return PC.form.allSent;
  if (!saved.exportId || !saved.approved) return PC.form.needsExport;
  if (saved.issues.length) return PC.form.hasIssues;
  if (!isReviewed(state)) return PC.form.needsReview;
  return null;
}

/** One tab of the text area: shared text, one per destination, delivery. */
export interface FormTab {
  key: string;
  label: string;
  accountId?: Id;
  network?: PublishingNetwork;
}

/** Tabs: "Shared text", one per destination (named by network, or by account when two destinations share a network), "Delivery". */
export function formTabs(draft: PublicationDraft, accounts: readonly PublishingAccount[]): FormTab[] {
  const networks = draft.destinations.map((d) => FORMAT_NETWORK[d.format]);
  const tabs: FormTab[] = [{ key: 'shared', label: PC.form.sharedText }];
  draft.destinations.forEach((d, i) => {
    const network = networks[i]!;
    const shared = networks.filter((n) => n === network).length > 1;
    const account = accounts.find((a) => a.id === d.accountId);
    tabs.push({
      key: `destination:${d.accountId}`,
      label: shared && account ? account.name : networkLabel(network),
      accountId: d.accountId,
      network,
    });
  });
  tabs.push({ key: 'delivery', label: PC.form.delivery });
  return tabs;
}

export interface CaptionPreview {
  title: string;
  caption: string;
  count: number;
  limit: number;
  over: boolean;
  /** YouTube title length and limit (null for other networks). */
  titleCount: number | null;
  titleLimit: number | null;
  titleOver: boolean;
}

/** The text a destination would send, composed as the Runtime composes it, with its counts (code points) and the network's limits. */
export function captionPreview(draft: PublicationDraft, accountId: Id): CaptionPreview | null {
  const d = draft.destinations.find((item) => item.accountId === accountId);
  if (!d) return null;
  const network = FORMAT_NETWORK[d.format];
  const copy = resolveCopy(copyOf(draft.text), {
    overrides: {
      title: d.overrides.title,
      description: d.overrides.description,
      hashtags: d.overrides.hashtags === null ? null : parseHashtags(d.overrides.hashtags),
    },
  });
  const caption = composeCaption(copy);
  const count = codePointLength(caption);
  const limit = CAPTION_LIMITS[network];
  const titleCount = network === 'youtube' ? codePointLength(copy.title) : null;
  return {
    title: copy.title,
    caption,
    count,
    limit,
    over: count > limit,
    titleCount,
    titleLimit: network === 'youtube' ? YOUTUBE_TITLE_LIMIT : null,
    titleOver: titleCount !== null && titleCount > YOUTUBE_TITLE_LIMIT,
  };
}

/** Whether a destination's text differs from the shared text (shows "Reset to shared text"). */
export function hasOwnText(d: Pick<DraftDestination, 'overrides'>): boolean {
  return d.overrides.title !== null || d.overrides.description !== null || d.overrides.hashtags !== null;
}
