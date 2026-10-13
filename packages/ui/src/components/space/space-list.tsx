import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState, type ComponentType, type KeyboardEvent, type ReactNode } from 'react';
import type { SpaceEntry, SpaceEntryKind } from '@cuccut/protocol';
import {
  Archive as ArchiveIcon,
  Captions,
  FileText as FileTextIcon,
  Film,
  Image as ImageIcon,
  LayoutTemplate,
  Music,
  Palette,
  Presentation,
  Shapes as ShapesIcon,
  Star as StarIcon,
  Upload,
  Video as VideoIcon,
  type LucideIcon,
} from 'lucide-react';
import {
  ActionButton,
  ActionMenu,
  Cell,
  Column,
  MenuItem,
  MenuSection,
  Row,
  StatusLight,
  TableBody,
  TableHeader,
  TableView,
  Text,
} from '@react-spectrum/s2';
import Archive from '@react-spectrum/s2/icons/Archive';
import Chat from '@react-spectrum/s2/icons/Chat';
import Clock from '@react-spectrum/s2/icons/Clock';
import CloseCaptions from '@react-spectrum/s2/icons/CloseCaptions';
import ColorHarmony from '@react-spectrum/s2/icons/ColorHarmony';
import Delete from '@react-spectrum/s2/icons/Delete';
import DevicePhone from '@react-spectrum/s2/icons/DevicePhone';
import Edit from '@react-spectrum/s2/icons/Edit';
import ExportTo from '@react-spectrum/s2/icons/ExportTo';
import FileText from '@react-spectrum/s2/icons/FileText';
import Filmstrip from '@react-spectrum/s2/icons/Filmstrip';
import Folder from '@react-spectrum/s2/icons/Folder';
import Image from '@react-spectrum/s2/icons/Image';
import InfoCircle from '@react-spectrum/s2/icons/InfoCircle';
import Layers from '@react-spectrum/s2/icons/Layers';
import Layout from '@react-spectrum/s2/icons/Layout';
import MusicNote from '@react-spectrum/s2/icons/MusicNote';
import OpenIn from '@react-spectrum/s2/icons/OpenIn';
import Preview from '@react-spectrum/s2/icons/Preview';
import Redo from '@react-spectrum/s2/icons/Redo';
import Revert from '@react-spectrum/s2/icons/Revert';
import Send from '@react-spectrum/s2/icons/Send';
import Shapes from '@react-spectrum/s2/icons/Shapes';
import Star from '@react-spectrum/s2/icons/Star';
import StarFilled from '@react-spectrum/s2/icons/StarFilled';
import Template from '@react-spectrum/s2/icons/Template';
import Video from '@react-spectrum/s2/icons/Video';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { agoLabel } from '../../model/format.ts';
import { DESIGN } from '../../model/design-copy.ts';
import { DESIGN_SYSTEM } from '../../model/design-system-copy.ts';
import { SLIDES } from '../../model/slides-copy.ts';
import { continueBlock, entryJobId, entryMenuKey, isFailedPlaceholder, purgeBlock } from '../../model/space-actions.ts';
import {
  filesAttention,
  filesSummary,
  formatBytes,
  hitsText,
  KIND_LABEL,
  measureText,
  SPACE_STATUS,
  statusText,
  type SpaceRow,
} from '../../model/space.ts';
import type { SpaceTranscribeAction } from '../../model/tool-targets.ts';
import { useEntryThumbnail } from '../use-entry-thumbnail.ts';
import { PC } from '../publishing/publishing-copy.ts';
import { SPACE_COPY as COPY } from './space-copy.ts';

/**
 * The list area of Space (product design §4.3–§4.4; prototype space-list.jsx): the grid is CardView, the list is TableView (name, type, source,
 * duration or size, status, recent activity). Both are virtualized, with height given by the outer frame. This part only renders; actions are handed to the page.
 * Cards and the name column both show thumbnails first (§4.3), so the list row height uses the spacious density.
 * In “All” and “Videos”, one video takes only one row (model/space.ts `groupEntries`): its exported and generated files are gathered under the card's “N 个文件” and
 * the line below the name. When the video has no status of its own, the status speaks for whichever of its files most needs to be seen.
 */

export type EntryAction =
  | 'open'
  | 'view'
  | 'info'
  | 'continue'
  | 'transcribe'
  | 'favorite'
  | 'rename'
  | 'reveal'
  | 'task'
  | 'trash'
  | 'restore'
  | 'purge'
  | 'clear'
  /** Opens the video's publication, preparing one when it has none (design m2-publishing §6.3). */
  | 'publish'
  /** Filters, by source, to the shorts cut from this video (the “N 支短视频” on cards and rows). */
  | 'shorts';

export const KIND_ICON: Record<SpaceEntryKind, ComponentType> = {
  video: Filmstrip,
  export: ExportTo,
  'video-file': Video,
  image: Image,
  audio: MusicNote,
  subtitle: CloseCaptions,
  document: FileText,
  slides: Layout,
  design: Shapes,
  'design-system': ColorHarmony,
  package: Archive,
  template: Template,
};

/** Lucide icons for each kind (page rail, filter pills and card meta lines; the S2 set above stays for menus and lists). */
export const KIND_LUCIDE: Record<SpaceEntryKind, LucideIcon> = {
  video: Film,
  export: Upload,
  'video-file': VideoIcon,
  image: ImageIcon,
  audio: Music,
  subtitle: Captions,
  document: FileTextIcon,
  slides: Presentation,
  design: ShapesIcon,
  'design-system': Palette,
  package: ArchiveIcon,
  template: LayoutTemplate,
};

const thumb = style({
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 'full',
  aspectRatio: 'video',
  backgroundColor: 'gray-100',
  color: 'gray-600',
  overflow: 'hidden',
});
/** Thumbnail in a list row (prototype sp-prev--small): spacious row height 48; the thumbnail takes the control height 32, 16:9, leaving 8 above and below. */
const thumbSmall = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  height: 32,
  aspectRatio: 'video',
  borderRadius: 'sm',
  backgroundColor: 'gray-100',
  color: { default: 'gray-600', isMissing: 'gray-400' },
  overflow: 'hidden',
});
const thumbImage = style({ width: 'full', height: 'full', objectFit: { default: 'cover', isContain: 'contain' }, display: 'block' });
/** Documents and subtitles: the body text summary is printed on a sheet of paper (prototype sp-prev--document); list rows keep only the paper and the type icon. */
const docBack = style({
  position: 'relative',
  width: 'full',
  aspectRatio: 'video',
  boxSizing: 'border-box',
  paddingTop: 16,
  paddingX: 20,
  backgroundColor: 'gray-75',
  overflow: 'hidden',
});
const docBackSmall = style({
  flexShrink: 0,
  height: 32,
  aspectRatio: 'video',
  boxSizing: 'border-box',
  paddingTop: 4,
  paddingX: '[6px]',
  borderRadius: 'sm',
  backgroundColor: 'gray-75',
  overflow: 'hidden',
});
const docPaper = style({
  height: 'full',
  boxSizing: 'border-box',
  padding: 16,
  borderTopRadius: 'default',
  backgroundColor: 'gray-25',
  boxShadow: 'elevated',
  overflow: 'hidden',
});
const docPaperSmall = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: 'full',
  backgroundColor: 'gray-25',
  color: 'gray-600',
});
const docText = style({
  font: 'ui-sm',
  lineHeight: 'body',
  color: 'gray-700',
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
  margin: 0,
});
const docType = style({
  position: 'absolute',
  insetEnd: 8,
  bottom: 8,
  paddingX: 8,
  paddingY: 4,
  borderRadius: 'sm',
  backgroundColor: 'gray-25',
  font: 'ui-sm',
  color: 'gray-700',
});
const missingFlag = style({
  position: 'absolute',
  insetStart: 8,
  bottom: 8,
  paddingX: '[6px]',
  paddingY: 2,
  borderRadius: 'sm',
  backgroundColor: 'red-900',
  font: 'ui-xs',
  color: 'gray-25',
});
const muted = style({ font: 'ui-sm', color: 'gray-600' });
const nameCell = style({ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 });
const nameText = style({ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
const nameBody = style({ display: 'flex', flexDirection: 'column', minWidth: 0 });
const nameSub = style({ font: 'ui-xs', color: 'gray-600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
/** Card footer: status on the left, “N files” pushed to the right (prototype sp-files). */
const filesButton = style({ marginStart: 'auto' });
const visuallyHidden = style({
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clipPath: '[inset(50%)]',
  whiteSpace: 'nowrap',
});
const favMark = style({ display: 'flex', color: 'yellow-800', flexShrink: 0 });

/**
 * Preview block (prototype ItemPreview): the picture fills the block; documents and subtitles are body-text summaries on paper; items without a picture show a type icon, and missing files add “File not found”.
 * `small` is the tier in the list's name column: the name sits right beside it, so the whole block is hidden from screen readers; documents keep only the paper and type icon; for missing files, only the gray background shows, and the text is announced via aria-label.
 */
export function EntryThumb({ entry, small, contain = false }: { entry: SpaceEntry; small?: boolean; contain?: boolean }) {
  const thumbnail = useEntryThumbnail(entry);
  const missing = entry.status === 'missing';
  const Icon = KIND_ICON[entry.kind];
  // The type icon in the list tier is the workflow icon and uses the global 16px; grid cards show the type preview and keep S2's native canvas (product design §2.1).
  const icons = small ? undefined : 'own';
  if (thumbnail?.kind === 'image') {
    return (
      <div className={small ? thumbSmall({}) : thumb} aria-hidden={small || undefined}>
        <img className={thumbImage({ isContain: contain })} src={thumbnail.url} alt="" decoding="async" />
      </div>
    );
  }
  if (thumbnail?.kind === 'text') {
    return small ? (
      <div className={docBackSmall} data-cc-icons={icons} aria-hidden>
        <div className={docPaperSmall}>
          <Icon />
        </div>
      </div>
    ) : (
      <div className={docBack}>
        <div className={docPaper} aria-hidden>
          <p className={docText}>{thumbnail.excerpt}</p>
        </div>
        <span className={docType}>{KIND_LABEL[entry.kind]}</span>
      </div>
    );
  }
  if (small) {
    const a11y = missing ? { role: 'img', 'aria-label': COPY.missingFile } : { 'aria-hidden': true };
    return (
      <div className={thumbSmall({ isMissing: missing })} data-cc-icons={icons} {...a11y}>
        <Icon />
      </div>
    );
  }
  return (
    <div className={thumb} data-cc-icons={icons}>
      <Icon />
      {missing ? <span className={missingFlag}>{COPY.missingFile}</span> : null}
    </div>
  );
}

/** Recent activity: for a video with files, takes the most recent time between itself and its files. */
const activityOf = (row: SpaceRow) => row.activityAt ?? row.lastActivityAt;

/**
 * Status: light + text (prototype ItemStatus). When the video has no status of its own, look at its files (`filesAttention`); if neither has one, the list shows a dash,
 * and the card shows recent activity (`quiet`).
 */
function EntryStatus({ entry, now, quiet }: { entry: SpaceRow; now: number; quiet?: boolean }) {
  const text = statusText(entry);
  const files = entry.status ? null : filesAttention(entry);
  if (files) {
    return (
      <StatusLight size="S" variant={SPACE_STATUS[files.status].tone}>
        {files.text}
      </StatusLight>
    );
  }
  if (!entry.status || !text) return <span className={muted}>{quiet ? agoLabel(activityOf(entry), now) : COPY.noValue}</span>;
  return (
    <StatusLight size="S" variant={SPACE_STATUS[entry.status].tone}>
      {text}
    </StatusLight>
  );
}

/** “N files” on a card: clicking opens this video's viewer, with the files listed one by one inside (prototype FilesButton). */
function FilesButton({ row, onAction }: { row: SpaceRow; onAction: (action: EntryAction, entry: SpaceEntry) => void }) {
  const n = row.files?.length ?? 0;
  if (!n) return null;
  return (
    <ActionButton size="S" isQuiet styles={filesButton} aria-label={COPY.filesButtonLabel(n, filesSummary(row))} onPress={() => onAction('view', row)}>
      <Layers />
      <Text>{COPY.filesButton(n)}</Text>
    </ActionButton>
  );
}

/** “N shorts” on a parent video card (product design §5.10): click to filter by source to show them. */
function ShortsButton({ row, count, onAction }: { row: SpaceRow; count: number; onAction: (action: EntryAction, entry: SpaceEntry) => void }) {
  if (!count) return null;
  return (
    <ActionButton size="S" isQuiet aria-label={COPY.shortsView} onPress={() => onAction('shorts', row)}>
      <DevicePhone />
      <Text>{COPY.shortsCount(count)}</Text>
    </ActionButton>
  );
}

/**
 * The item ⋯ menu (prototype itemMenu, shared by cards and rows): for a video, “Open video”, “View info, the viewer”, and
 * “Video details…, the details dialog from the prototype project card menu, the same dialog as the ⓘ in the editor top bar”; for others, “View”; in the trash, restore and delete permanently;
 * a failed generation placeholder can only be cleared. Items that cannot be done are greyed out (the reason is written in the viewer).
 */
/**
 * “Transcribe… / Re-transcribe… / Retry transcription…” for video items (product design §4.4, prototype space-list.jsx `transcribeItem`): opens the transcription tool page with this video preselected.
 * Retry comes first (before Open video); the other two follow View info.
 */
function transcribeItem(action: SpaceTranscribeAction) {
  const label = COPY.transcribe[action];
  return (
    <MenuItem id="transcribe" textValue={label.replace('…', '')}>
      <Redo />
      <Text>{label}</Text>
    </MenuItem>
  );
}

function entryMenu(
  entry: SpaceRow,
  canReveal: boolean,
  onAction: (action: EntryAction, entry: SpaceEntry) => void,
  transcribe: SpaceTranscribeAction | null,
) {
  const trashed = entry.user.trashedAt !== null;
  const failed = isFailedPlaceholder(entry);
  const jobId = entryJobId(entry);
  const isVideo = entry.kind === 'video' && !trashed;
  const isSlides = entry.kind === 'slides' && !trashed;
  const isDesign = entry.kind === 'design' && !trashed;
  const isDesignSystem = entry.kind === 'design-system' && !trashed;
  const openLabel = isVideo ? COPY.openVideo : isDesign ? DESIGN.open : isDesignSystem ? DESIGN_SYSTEM.open : SLIDES.open;
  const viewLabel = isVideo ? (entry.files?.length ? COPY.viewInfoFiles : COPY.viewInfo) : COPY.view;
  const disabled: EntryAction[] = [];
  if (!canReveal) disabled.push('reveal');
  if (continueBlock(entry)) disabled.push('continue');
  if (trashed && purgeBlock(entry)) disabled.push('purge');
  return (
    <ActionMenu
      aria-label={COPY.entryActions(entry.name)}
      isQuiet
      size="S"
      disabledKeys={disabled}
      onAction={(key) => onAction(key as EntryAction, entry)}>
      <MenuSection>
        {isVideo && transcribe === 'retry' ? transcribeItem(transcribe) : null}
        {isVideo || isSlides || isDesign || isDesignSystem ? (
          <MenuItem id="open" textValue={openLabel}>
            <OpenIn />
            <Text>{openLabel}</Text>
          </MenuItem>
        ) : null}
        <MenuItem id="view" textValue={viewLabel}>
          <Preview />
          <Text>{viewLabel}</Text>
        </MenuItem>
        {isVideo ? (
          <MenuItem id="info" textValue={COPY.info}>
            <InfoCircle />
            <Text>{COPY.info}</Text>
          </MenuItem>
        ) : null}
        {isVideo && transcribe && transcribe !== 'retry' ? transcribeItem(transcribe) : null}
        {isVideo && !failed && entry.status !== 'generating' ? (
          <MenuItem id="publish" textValue={PC.entry.prepare}>
            <Send />
            <Text>{PC.entry.prepare}</Text>
          </MenuItem>
        ) : null}
        {trashed ? null : (
          <MenuItem id="continue" textValue={COPY.continue}>
            <Chat />
            <Text>{COPY.continue}</Text>
          </MenuItem>
        )}
      </MenuSection>
      <MenuSection>
        <MenuItem id="favorite" textValue={entry.user.favorite ? COPY.unfavorite : COPY.favorite}>
          {entry.user.favorite ? <StarFilled /> : <Star />}
          <Text>{entry.user.favorite ? COPY.unfavorite : COPY.favorite}</Text>
        </MenuItem>
        {failed ? null : (
          <MenuItem id="rename" textValue={COPY.rename}>
            <Edit />
            <Text>{COPY.rename}</Text>
          </MenuItem>
        )}
        <MenuItem id="reveal" textValue={COPY.reveal}>
          <Folder />
          <Text>{COPY.reveal}</Text>
        </MenuItem>
        {jobId ? (
          <MenuItem id="task" textValue={COPY.viewTask}>
            <Clock />
            <Text>{COPY.viewTask}</Text>
          </MenuItem>
        ) : null}
      </MenuSection>
      <MenuSection>
        {trashed ? (
          <>
            <MenuItem id="restore" textValue={COPY.restore}>
              <Revert />
              <Text>{COPY.restore}</Text>
            </MenuItem>
            <MenuItem id="purge" textValue={COPY.purge}>
              <Delete />
              <Text>{COPY.purge}</Text>
            </MenuItem>
          </>
        ) : failed ? (
          <MenuItem id="clear" textValue={COPY.clear}>
            <Delete />
            <Text>{COPY.clear}</Text>
          </MenuItem>
        ) : (
          <MenuItem id="trash" textValue={COPY.trash}>
            <Delete />
            <Text>{COPY.trash}</Text>
          </MenuItem>
        )}
      </MenuSection>
    </ActionMenu>
  );
}

/** Card description and the “duration or size” column: shows duration and size when media info exists, otherwise file size. */
function measureOf(entry: SpaceEntry): string {
  return measureText(entry) ?? (entry.size > 0 ? formatBytes(entry.size) : '');
}

/** Default action for rows and cards: videos open in the editor; slides, design drafts and design systems open in the feature area; everything else opens the viewer (prototype onAction). */
const primaryAction = (entry: SpaceEntry): EntryAction =>
  (entry.kind === 'video' || entry.kind === 'slides' || entry.kind === 'design' || entry.kind === 'design-system') && !entry.user.trashedAt
    ? 'open'
    : 'view';

interface ListProps {
  entries: SpaceRow[];
  now: number;
  sourceOf: (entry: SpaceEntry) => string;
  /** Whether the item has a path on disk that can be shown in the file manager. */
  canReveal: (entry: SpaceEntry) => boolean;
  onAction: (action: EntryAction, entry: SpaceEntry) => void;
  /** Which transcription action to offer in a video item's menu; null when not given (transcribing, source file missing, or transcript status not yet known). */
  transcribeAction: (entry: SpaceEntry) => SpaceTranscribeAction | null;
  empty: () => ReactNode;
  /** Number of child videos derived from this parent video (`derivedCount`, by videoId); not shown when not given. */
  shorts?: ReadonlyMap<string, number>;
}

const listStyles = style({ flexGrow: 1, minHeight: 0 });

/**
 * The collection's `dependencies` and the stable menu callbacks: CardView / TableBody cache each item's render by item object. Late-arriving candidates, `jobs`, the save location,
 * the source column and `now` are not passed in via `entries`, so the dependency key has to invalidate the cache (`entryMenuKey`, which changes only when content changes). A cached menu callback can also go stale,
 * so the menu takes a function whose identity never changes and forwards calls to the latest `onAction`.
 */
function useListDeps({ entries, now, canReveal, onAction, transcribeAction, shorts }: ListProps, sourceOf?: ListProps['sourceOf']) {
  const latest = useRef(onAction);
  useLayoutEffect(() => {
    latest.current = onAction;
  });
  const act = useCallback((action: EntryAction, entry: SpaceEntry) => latest.current(action, entry), []);
  return { act, dependencies: [entryMenuKey(entries, canReveal, transcribeAction, sourceOf), now, shorts] };
}

/**
 * The gallery (agentcut library cards): a solid 24px card per entry — the whole thumbnail, up to two lines of name, what
 * it is and where it lives — with its status, files, shorts and menu along the bottom. The name is the card's one
 * button (its hit area covers the card) and runs the entry's default action; the controls below sit above it.
 */
export function SpaceGrid(props: ListProps) {
  const { entries, now, sourceOf, canReveal, transcribeAction, empty, shorts } = props;
  const { act } = useListDeps(props);
  // Cards render a page at a time and the next page joins when the end of the grid scrolls near, so a library of
  // thousands does not mount (and fetch a thumbnail for) every item at once.
  const [limit, setLimit] = useState(GRID_PAGE);
  const sentinel = useRef<HTMLLIElement>(null);
  const more = entries.length > limit;
  useEffect(() => {
    const node = sentinel.current;
    if (!more || !node || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((seen) => {
      if (seen.some((s) => s.isIntersecting)) setLimit((n) => n + GRID_PAGE);
    }, { rootMargin: '800px 0px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [more, limit]);
  if (!entries.length) return <>{empty()}</>;
  return (
    <ul
      data-cc
      aria-label={COPY.entriesLabel}
      onKeyDown={moveBetweenCards}
      className="grid grid-cols-1 gap-4 min-[520px]:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {entries.slice(0, limit).map((entry) => (
        <GridCard
          key={entry.id}
          entry={entry}
          now={now}
          source={sourceOf(entry)}
          shorts={shortsOf(shorts, entry)}
          canReveal={canReveal(entry)}
          transcribe={transcribeAction(entry)}
          onAction={act}
        />
      ))}
      {more ? <li ref={sentinel} aria-hidden className="col-span-full h-px" /> : null}
    </ul>
  );
}

/** How many cards the gallery adds at a time. */
const GRID_PAGE = 60;

/**
 * Arrow keys move between the cards' open buttons (row by row with up and down, by the grid's current column count);
 * Tab still walks each card's controls.
 */
function moveBetweenCards(event: KeyboardEvent<HTMLUListElement>) {
  const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 0, ArrowUp: 0, Home: 0, End: 0 }[event.key];
  if (step === undefined || event.altKey || event.ctrlKey || event.metaKey) return;
  const target = event.target as HTMLElement;
  if (!target.matches('[data-card-open]')) return;
  const cards = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[data-card-open]'));
  const index = cards.indexOf(target);
  if (index < 0) return;
  const columns = Math.max(1, getComputedStyle(event.currentTarget).gridTemplateColumns.split(' ').filter(Boolean).length);
  const rtl = getComputedStyle(event.currentTarget).direction === 'rtl';
  let next = index;
  if (event.key === 'Home') next = 0;
  else if (event.key === 'End') next = cards.length - 1;
  else if (event.key === 'ArrowDown') next = index + columns;
  else if (event.key === 'ArrowUp') next = index - columns;
  else next = index + (rtl ? -step : step);
  if (next < 0 || next >= cards.length || next === index) return;
  event.preventDefault();
  cards[next]!.focus();
  cards[next]!.scrollIntoView({ block: 'nearest' });
}

const GridCard = memo(function GridCard({
  entry,
  now,
  source,
  shorts,
  canReveal,
  transcribe,
  onAction,
}: {
  entry: SpaceRow;
  now: number;
  source: string;
  shorts: number;
  canReveal: boolean;
  transcribe: SpaceTranscribeAction | null;
  /** Stable (`useListDeps`), so a card only re-renders when its own entry, line or status changes. */
  onAction: (action: EntryAction, entry: SpaceEntry) => void;
}) {
  const Icon = KIND_LUCIDE[entry.kind];
  // Paper-like previews (documents, subtitles, decks) carry their own kind label in the corner; their size goes in the line.
  const paper = entry.kind === 'subtitle' || entry.kind === 'document' || entry.kind === 'slides' || entry.kind === 'design';
  const measure = paper ? '' : measureOf(entry);
  const line = hitsText(entry) ?? [KIND_LABEL[entry.kind], paper ? measureOf(entry) : null, source].filter(Boolean).join(' · ');
  return (
    <li className="group/card relative flex min-w-0 flex-col overflow-hidden rounded-3xl bg-card ring-1 ring-foreground/10 transition-[background-color,box-shadow] duration-150 hover:bg-secondary hover:ring-foreground/25 motion-reduce:transition-none">
      <div className="relative aspect-video w-full overflow-hidden bg-black/30">
        <EntryThumb entry={entry} contain />
        {entry.user.favorite ? (
          <span className="absolute top-3 left-3 flex size-7 items-center justify-center rounded-full bg-black/70 text-white" role="img" aria-label={COPY.favorited}>
            <StarIcon aria-hidden className="size-3.5 fill-current" />
          </span>
        ) : null}
        {measure ? (
          <span className="absolute right-3 bottom-3 rounded-full bg-black/80 px-2.5 py-1 text-xs text-white tabular-nums">{measure}</span>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-col gap-1.5 px-4 pt-3.5">
        <button
          type="button"
          data-card-open=""
          onClick={() => onAction(primaryAction(entry), entry)}
          title={entry.name}
          className="line-clamp-2 min-h-10 cursor-pointer text-start text-sm leading-5 font-medium text-foreground outline-none wrap-anywhere after:absolute after:inset-0 after:rounded-3xl focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-ring">
          {entry.name}
        </button>
        <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <Icon aria-hidden className="size-3.5 shrink-0" />
          <span className="truncate" title={line}>
            {line}
          </span>
        </span>
      </div>
      <div className="relative z-10 mt-auto flex min-h-11 items-center gap-1 px-3 pt-1.5 pb-2.5">
        <span className="flex min-w-0 flex-1 items-center px-1">
          <EntryStatus entry={entry} now={now} quiet />
        </span>
        <ShortsButton row={entry} count={shorts} onAction={onAction} />
        <FilesButton row={entry} onAction={onAction} />
        {entryMenu(entry, canReveal, onAction, transcribe)}
      </div>
    </li>
  );
});

/** Number of child videos derived from a video item. */
function shortsOf(shorts: ListProps['shorts'], entry: SpaceEntry): number {
  return shorts && entry.ref && 'videoId' in entry.ref ? (shorts.get(entry.ref.videoId) ?? 0) : 0;
}

/** Table columns; column names are looked up in the current language at render time (`columnName`). */
const COLUMNS = [
  { id: 'name', isRowHeader: true, minWidth: 280 }, // Thumbnails are about 40 wider than the old type icon; the name keeps at least its original width
  { id: 'kind', width: 88 },
  { id: 'source', minWidth: 180 },
  { id: 'size', width: 168 },
  { id: 'status', width: 144 },
  { id: 'activity', width: 112 },
  { id: 'menu', width: 64, hideHeader: true },
] as const;
type ColumnId = (typeof COLUMNS)[number]['id'];

function columnName(id: ColumnId): string {
  if (id === 'name') return COPY.columnName;
  if (id === 'kind') return COPY.columnKind;
  if (id === 'source') return COPY.columnSource;
  if (id === 'size') return COPY.columnMeasure;
  if (id === 'status') return COPY.columnStatus;
  if (id === 'activity') return COPY.columnActivity;
  return COPY.columnMenu;
}

export function SpaceTable(props: ListProps) {
  const { entries, now, sourceOf, canReveal, onAction, transcribeAction, empty, shorts } = props;
  const { act, dependencies } = useListDeps(props, sourceOf);
  const cell = (entry: SpaceRow, column: ColumnId): ReactNode => {
    if (column === 'name') {
      // Video with files: below the name, the line reads “N files · finished cut 2 · subtitles 1”; when a search matches only through a file, it shows which file was found
      const n = entry.files?.length ?? 0;
      const kids = shortsOf(shorts, entry);
      const sub =
        hitsText(entry) ?? ([n ? COPY.filesLine(n, filesSummary(entry)) : null, kids ? COPY.shortsCount(kids) : null].filter(Boolean).join(' · ') || null);
      return (
        <span className={nameCell}>
          <EntryThumb entry={entry} small />
          <span className={nameBody}>
            <span className={nameText}>{entry.name}</span>
            {sub ? <span className={nameSub}>{sub}</span> : null}
          </span>
          {entry.user.favorite ? (
            <span className={favMark} aria-label={COPY.favorited}>
              <StarFilled />
            </span>
          ) : null}
        </span>
      );
    }
    if (column === 'kind') return KIND_LABEL[entry.kind];
    if (column === 'source') return sourceOf(entry);
    if (column === 'size') return measureOf(entry) || <span className={muted}>{COPY.noValue}</span>;
    if (column === 'status') return <EntryStatus entry={entry} now={now} />;
    if (column === 'activity') return agoLabel(activityOf(entry), now);
    return entryMenu(entry, canReveal(entry), act, transcribeAction(entry));
  };
  return (
    <TableView
      aria-label={COPY.entriesLabel}
      overflowMode="truncate"
      density="spacious"
      styles={listStyles}
      onAction={(key) => {
        const entry = entries.find((e) => e.id === key);
        if (entry) onAction(primaryAction(entry), entry);
      }}>
      <TableHeader columns={COLUMNS}>
        {(column) => (
          <Column
            id={column.id}
            isRowHeader={'isRowHeader' in column}
            width={'width' in column ? column.width : undefined}
            minWidth={'minWidth' in column ? column.minWidth : undefined}>
            {'hideHeader' in column ? <span className={visuallyHidden}>{columnName(column.id)}</span> : columnName(column.id)}
          </Column>
        )}
      </TableHeader>
      <TableBody items={entries} dependencies={dependencies} renderEmptyState={empty}>
        {(entry) => (
          <Row id={entry.id} columns={COLUMNS}>
            {(column) => <Cell>{cell(entry, column.id)}</Cell>}
          </Row>
        )}
      </TableBody>
    </TableView>
  );
}
