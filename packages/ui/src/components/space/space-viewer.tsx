import { intlLocale, type Id, type SpaceEntry } from '@cuccut/protocol';
import {
  ActionButton,
  Badge,
  Button,
  ButtonGroup,
  Content,
  Dialog,
  DialogContainer,
  Footer,
  Header,
  Heading,
  InlineAlert,
  StatusLight,
  Text,
} from '@react-spectrum/s2';
import Chat from '@react-spectrum/s2/icons/Chat';
import Clock from '@react-spectrum/s2/icons/Clock';
import Edit from '@react-spectrum/s2/icons/Edit';
import Filmstrip from '@react-spectrum/s2/icons/Filmstrip';
import Folder from '@react-spectrum/s2/icons/Folder';
import Star from '@react-spectrum/s2/icons/Star';
import StarFilled from '@react-spectrum/s2/icons/StarFilled';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { Button as RACButton } from 'react-aria-components';
import { agoLabel, formatClock } from '../../model/format.ts';
import { targetKey } from '../../model/media.ts';
import {
  continueBlock,
  EDIT_LABEL,
  editBlock,
  editRoute,
  entryJobId,
  isFailedPlaceholder,
  packageBlock,
  purgeBlock,
} from '../../model/space-actions.ts';
import { DESIGN } from '../../model/design-copy.ts';
import { DESIGN_SYSTEM } from '../../model/design-system-copy.ts';
import { SLIDES } from '../../model/slides-copy.ts';
import { MADE_SHOWN } from '../../model/shorts-result.ts';
import { formatBytes, isPlayable, KIND_LABEL, measureText, SPACE_STATUS, statusText } from '../../model/space.ts';
import { FilePreview } from '../file-preview.tsx';
import type { EntryTools } from '../tools/use-entry-tools.ts';
import { SPACE_COPY as COPY } from './space-copy.ts';
import { EntryThumb } from './space-list.tsx';
import { ToolActions, ToolFacts } from './space-viewer-tools.tsx';

const facts = style({
  display: 'grid',
  gridTemplateColumns: ['auto', '1fr'],
  columnGap: 16,
  rowGap: 4,
  marginTop: 16,
  marginBottom: 0,
  font: 'ui-sm',
});
const term = style({ color: 'gray-600' });
const value = style({ margin: 0, overflowWrap: 'anywhere', userSelect: 'text' });
const footerRow = style({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4 });
const headerRow = style({ display: 'flex', alignItems: 'center', gap: 8 });
const alerts = style({ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 });
const hint = style({ font: 'ui-sm', color: 'gray-600', marginTop: 12, marginBottom: 0 });
const filesSection = style({ display: 'flex', flexDirection: 'column', gap: 8 });
const filesHead = style({ display: 'flex', alignItems: 'baseline', gap: 8, margin: 0, font: 'ui', fontWeight: 'bold', color: 'gray-900' });
const filesBar = style({ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 });
const filesCount = style({ fontWeight: 'normal', color: 'gray-600' });
const fileList = style({ display: 'flex', flexDirection: 'column', gap: 2, margin: 0, padding: 0, listStyleType: 'none' });
const fileRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  width: 'full',
  paddingX: 8,
  paddingY: 4,
  borderWidth: 0,
  borderRadius: 'default',
  textAlign: 'start',
  backgroundColor: { default: 'transparent', isHovered: 'gray-100', isFocusVisible: 'gray-100' },
  outlineStyle: { default: 'none', isFocusVisible: 'solid' },
  outlineColor: 'focus-ring',
  outlineWidth: 2,
  cursor: 'default',
});
const fileBody = style({ display: 'flex', flexDirection: 'column', flexGrow: 1, minWidth: 0 });
const fileName = style({ font: 'ui', color: 'gray-900', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
const fileMeta = style({ font: 'ui-xs', color: 'gray-600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
const filesHint = style({ font: 'ui-sm', color: 'gray-600', margin: 0 });

/** Actions in the viewer (wired to the Runtime by the page). */
export interface ViewerActions {
  onFavorite(entry: SpaceEntry): void;
  onReveal(entry: SpaceEntry): void;
  onContinue(entry: SpaceEntry): void;
  onOpenVideo(entry: SpaceEntry): void;
  /** A slide deck (deck directory) opens in the slides tab of the feature area (docs/design/slides §8.1). */
  onOpenSlides(entry: SpaceEntry): void;
  /** A design draft (design draft directory) opens in the design draft tab of the feature area (docs/design/canvas §8.1). */
  onOpenDesign(entry: SpaceEntry): void;
  /** A design system (design system directory) opens in the design system tab of the feature area (docs/design/canvas §10). */
  onOpenDesignSystem(entry: SpaceEntry): void;
  onEdit(entry: SpaceEntry): void;
  /** Open a portable package as a new video. */
  onOpenPackage(entry: SpaceEntry): void;
  onRename(entry: SpaceEntry): void;
  onRestore(entry: SpaceEntry): void;
  onPurge(entry: SpaceEntry): void;
  onClear(entry: SpaceEntry): void;
  onTask(jobId: Id): void;
  onConversation(conversationId: Id): void;
  /** Swap to another item's viewer: a file under a video, or the video a file belongs to. */
  onSwitch(entryId: Id): void;
  /** Filter Space by source so that only the shorts cut from this video are shown (product design §4.3, §5.10). */
  onShorts?(entry: SpaceEntry): void;
  onClose(): void;
}

/**
 * The Space viewer (product design §4.5–§4.6; prototype space-viewer.jsx): preview, facts (source, files, duration or size, status, recent activity, source session,
 * generation method, tool and location, version), with honest notices when files are missing, failed, or the source has changed. Actions are: continue in session · view source session · show in folder · second-pass edit ·
 * favorite · rename · process with tool… · do again (for tool-made items); the trash holds restore and delete permanently, and a failed placeholder holds clear and view task. Buttons that cannot be used are greyed out, with the reason written below.
 * In “All” and “Videos”, a video takes only one row (§4.3): the files it exported or generated are listed in this video's viewer, and clicking one swaps to that file; in a file's viewer, “View video” swaps back.
 * The shorts cut from a video are each a video of their own; the parent video's viewer lists them before the files, and clicking one swaps to that short's viewer; in a short's viewer, “View source video” swaps back to the parent.
 * Items are passed in from the outer layer: S2's Dialog renders children in several slots, so no state is kept here.
 */
export function SpaceViewer({
  entry,
  source,
  path,
  conversation,
  now,
  actions,
  tools = null,
  files = [],
  host = null,
  shorts = [],
  parent = null,
}: {
  entry: SpaceEntry | null;
  source: string;
  /** Absolute path of the item on disk; outputs outside the source directory have none. */
  path: string | null;
  /** The session that produced it (while it still exists). */
  conversation: { id: Id; title: string } | null;
  now: number;
  actions: ViewerActions;
  /** Tool-related parts (components/tools/use-entry-tools.ts). */
  tools?: EntryTools | null;
  /** Files under the video (model/space.ts `filesOf`). */
  files?: readonly SpaceEntry[];
  /** The video a file belongs to (`hostVideoOf`). */
  host?: SpaceEntry | null;
  /** Shorts cut from this video, newest first (model/shorts-result.ts `madeShorts`). */
  shorts?: readonly SpaceEntry[];
  /** A short's parent video (`parentVideoOf`). */
  parent?: SpaceEntry | null;
}) {
  return (
    <DialogContainer onDismiss={actions.onClose}>
      {entry ? (
        <Dialog size={isPlayable(entry.fileName) && entry.kind !== 'video' ? 'XL' : 'L'}>
          <ViewerBody
            entry={entry}
            source={source}
            path={path}
            conversation={conversation}
            now={now}
            actions={actions}
            tools={tools}
            files={files}
            host={host}
            shorts={shorts}
            parent={parent}
          />
        </Dialog>
      ) : null}
    </DialogContainer>
  );
}

function ViewerBody({
  entry,
  source,
  path,
  conversation,
  now,
  actions,
  tools,
  files,
  host,
  shorts,
  parent,
}: {
  entry: SpaceEntry;
  source: string;
  path: string | null;
  conversation: { id: Id; title: string } | null;
  now: number;
  actions: ViewerActions;
  tools: EntryTools | null;
  files: readonly SpaceEntry[];
  host: SpaceEntry | null;
  shorts: readonly SpaceEntry[];
  parent: SpaceEntry | null;
}) {
  const trashed = entry.user.trashedAt !== null;
  const failed = isFailedPlaceholder(entry);
  const isVideo = entry.kind === 'video';
  const isSlides = entry.kind === 'slides';
  const isDesign = entry.kind === 'design';
  const isDesignSystem = entry.kind === 'design-system';
  const jobId = entryJobId(entry);
  const route = editRoute(entry);
  const blockedEdit = isVideo ? null : editBlock(entry, path);
  const isPackage = entry.kind === 'package';
  const blockedPackage = isPackage ? packageBlock(entry, path) : null;
  const blockedContinue = continueBlock(entry);
  const blockedPurge = trashed ? purgeBlock(entry) : null;
  const measure = measureText(entry);
  const status = statusText(entry);
  // Slides, design drafts and design systems are one directory; the viewer does not preview them, and they open in their own tabs.
  const hasFile = !isVideo && !isSlides && !isDesign && !isDesignSystem && entry.status !== 'generating' && entry.status !== 'failed' && entry.status !== 'missing';
  const origin = entry.origin;
  const generated = origin?.capability
    ? [COPY.capability[origin.capability] ?? origin.capability, origin.provider ? `${origin.provider.providerId} · ${origin.provider.modelId}` : null]
        .filter(Boolean)
        .join(' · ')
    : null;
  const reason = entry.statusDetail?.reason;

  return (
    <>
      <Heading slot="title">{entry.name}</Heading>
      <Header>
        <span className={headerRow}>
          <Badge variant="neutral" size="S">
            {KIND_LABEL[entry.kind]}
          </Badge>
          {entry.status && status ? (
            <StatusLight size="S" variant={SPACE_STATUS[entry.status].tone}>
              {status}
            </StatusLight>
          ) : null}
        </span>
      </Header>
      <Content>
        {hasFile ? <FilePreview key={entry.id} target={{ entryId: entry.id }} fileName={entry.fileName}
          playback={{ layout: 'row', memoryKey: entry.source.projectId ? targetKey({ projectId: entry.source.projectId, path: entry.relPath }) : undefined }} /> : null}
        {isVideo && shorts.length ? (
          <VideoShorts shorts={shorts} onSwitch={actions.onSwitch} onList={actions.onShorts ? () => actions.onShorts?.(entry) : null} />
        ) : null}
        {isVideo && files.length ? <VideoFiles files={files} onSwitch={actions.onSwitch} /> : null}
        <dl className={facts}>
          <dt className={term}>{COPY.factSource}</dt>
          <dd className={value}>{source}</dd>
          <dt className={term}>{isVideo ? COPY.factFolder : COPY.factFile}</dt>
          <dd className={value}>{path ?? entry.relPath}</dd>
          {measure ? (
            <>
              <dt className={term}>{COPY.factMeasure}</dt>
              <dd className={value}>{measure}</dd>
            </>
          ) : null}
          {entry.size > 0 ? (
            <>
              <dt className={term}>{COPY.factSize}</dt>
              <dd className={value}>{formatBytes(entry.size)}</dd>
            </>
          ) : null}
          <dt className={term}>{COPY.factActivity}</dt>
          <dd className={value}>
            {COPY.activityAt(agoLabel(entry.lastActivityAt, now), new Date(entry.lastActivityAt).toLocaleString(intlLocale()))}
          </dd>
          {conversation ? (
            <>
              <dt className={term}>{COPY.factConversation}</dt>
              <dd className={value}>{conversation.title}</dd>
            </>
          ) : null}
          <ToolFacts tools={tools} term={term} value={value} />
          {generated ? (
            <>
              <dt className={term}>{COPY.factGenerated}</dt>
              <dd className={value}>{generated}</dd>
            </>
          ) : null}
          {origin?.videoRevision ? (
            <>
              <dt className={term}>{COPY.factVersion}</dt>
              <dd className={value}>{COPY.version(origin.videoRevision, entry.statusDetail?.currentRevision ?? null)}</dd>
            </>
          ) : null}
          {reason && entry.status !== 'missing' && entry.status !== 'failed' ? (
            <>
              <dt className={term}>{COPY.factNote}</dt>
              <dd className={value}>{reason}</dd>
            </>
          ) : null}
        </dl>
        {entry.status === 'missing' || entry.status === 'failed' || entry.status === 'source-changed' ? (
          <div className={alerts}>
            {entry.status === 'missing' ? (
              <InlineAlert variant="negative">
                <Heading>{COPY.missingTitle}</Heading>
                <Content>{reason ? COPY.withReason(reason, COPY.missingBody) : COPY.missingBody}</Content>
              </InlineAlert>
            ) : entry.status === 'failed' ? (
              <InlineAlert variant="negative">
                <Heading>{COPY.failedTitle}</Heading>
                <Content>{reason ? COPY.withReason(reason, COPY.failedBody) : COPY.failedBody}</Content>
              </InlineAlert>
            ) : (
              <InlineAlert variant="notice">
                <Heading>{COPY.changedTitle}</Heading>
                <Content>{COPY.changedBody}</Content>
              </InlineAlert>
            )}
          </div>
        ) : null}
        {!trashed && !failed && !isVideo && route && blockedEdit ? <p className={hint}>{COPY.editBlocked(blockedEdit)}</p> : null}
        {!trashed && !failed && blockedPackage ? <p className={hint}>{COPY.packageBlocked(blockedPackage)}</p> : null}
        {blockedPurge ? <p className={hint}>{blockedPurge}</p> : null}
      </Content>
      <Footer>
        <span className={footerRow}>
          <ActionButton isQuiet onPress={() => actions.onFavorite(entry)}>
            {entry.user.favorite ? <StarFilled /> : <Star />}
            <Text>{entry.user.favorite ? COPY.unfavorite : COPY.favorite}</Text>
          </ActionButton>
          <ActionButton isQuiet isDisabled={!path} onPress={() => actions.onReveal(entry)}>
            <Folder />
            <Text>{COPY.reveal}</Text>
          </ActionButton>
          {failed ? null : (
            <ActionButton isQuiet onPress={() => actions.onRename(entry)}>
              <Edit />
              <Text>{COPY.rename}</Text>
            </ActionButton>
          )}
          {conversation ? (
            <ActionButton isQuiet onPress={() => actions.onConversation(conversation.id)}>
              <Chat />
              <Text>{COPY.viewConversation}</Text>
            </ActionButton>
          ) : null}
          {jobId && !failed ? (
            <ActionButton isQuiet onPress={() => actions.onTask(jobId)}>
              <Clock />
              <Text>{COPY.viewTask}</Text>
            </ActionButton>
          ) : null}
          {host ? (
            <ActionButton isQuiet onPress={() => actions.onSwitch(host.id)}>
              <Filmstrip />
              <Text>{COPY.viewVideo}</Text>
            </ActionButton>
          ) : null}
          {parent ? (
            <ActionButton isQuiet onPress={() => actions.onSwitch(parent.id)}>
              <Filmstrip />
              <Text>{COPY.viewSourceVideo}</Text>
            </ActionButton>
          ) : null}
          {trashed ? null : <ToolActions entry={entry} tools={tools} onClose={actions.onClose} />}
        </span>
      </Footer>
      <ButtonGroup>
        <Button variant="secondary" onPress={actions.onClose}>
          {COPY.close}
        </Button>
        {trashed ? (
          <>
            <Button variant="secondary" isDisabled={!!blockedPurge} onPress={() => actions.onPurge(entry)}>
              {COPY.purge}
            </Button>
            <Button variant="accent" onPress={() => actions.onRestore(entry)}>
              {COPY.restore}
            </Button>
          </>
        ) : failed ? (
          <>
            <Button variant="secondary" onPress={() => actions.onClear(entry)}>
              {COPY.clear}
            </Button>
            {jobId ? (
              <Button variant="accent" onPress={() => actions.onTask(jobId)}>
                {COPY.viewTask}
              </Button>
            ) : null}
          </>
        ) : isVideo || isSlides || isDesign || isDesignSystem ? (
          <>
            <Button variant="secondary" isDisabled={!!blockedContinue} onPress={() => actions.onContinue(entry)}>
              {COPY.continue}
            </Button>
            {isVideo ? (
              <Button variant="accent" onPress={() => actions.onOpenVideo(entry)}>
                {COPY.openVideo}
              </Button>
            ) : isDesign ? (
              <Button variant="accent" isDisabled={entry.status === 'missing'} onPress={() => actions.onOpenDesign(entry)}>
                {DESIGN.open}
              </Button>
            ) : isDesignSystem ? (
              <Button variant="accent" isDisabled={entry.status === 'missing'} onPress={() => actions.onOpenDesignSystem(entry)}>
                {DESIGN_SYSTEM.open}
              </Button>
            ) : (
              <Button variant="accent" isDisabled={entry.status === 'missing'} onPress={() => actions.onOpenSlides(entry)}>
                {SLIDES.open}
              </Button>
            )}
          </>
        ) : (
          <>
            {route ? (
              <Button variant="secondary" isDisabled={!!blockedEdit} onPress={() => actions.onEdit(entry)}>
                {entry.status === 'source-changed' && route === 'source-video' ? COPY.reexport : EDIT_LABEL[route]}
              </Button>
            ) : null}
            {isPackage ? (
              <Button variant="secondary" isDisabled={!!blockedPackage} onPress={() => actions.onOpenPackage(entry)}>
                {COPY.openPackage}
              </Button>
            ) : null}
            <Button variant="accent" isDisabled={!!blockedContinue} onPress={() => actions.onContinue(entry)}>
              {COPY.continue}
            </Button>
          </>
        )}
      </ButtonGroup>
    </>
  );
}

/**
 * The shorts cut from this video (prototype MovieShorts, product design §4.5): one row per short, showing its range on the original and its duration; clicking one swaps to that short's viewer.
 * At most `MADE_SHOWN` are shown; “View in list” filters Space to all the shorts cut from this video (§4.3).
 */
function VideoShorts({ shorts, onSwitch, onList }: { shorts: readonly SpaceEntry[]; onSwitch: (entryId: Id) => void; onList: (() => void) | null }) {
  const shown = shorts.slice(0, MADE_SHOWN);
  return (
    <section className={filesSection} aria-label={COPY.shortsTitle}>
      <div className={filesBar}>
        <h3 className={filesHead}>
          {COPY.shortsTitle}
          <span className={filesCount}>{shorts.length}</span>
        </h3>
        {onList ? (
          <ActionButton size="S" isQuiet onPress={onList}>
            {COPY.shortsInList}
          </ActionButton>
        ) : null}
      </div>
      <ul className={fileList}>
        {shown.map((short) => {
          const status = statusText(short);
          const range = short.origin?.range;
          const span = range ? COPY.shortsSpan(formatClock(range.start), formatClock(range.end)) : null;
          const length = short.media?.durationSec ? formatClock(short.media.durationSec) : null;
          return (
            <li key={short.id}>
              <RACButton className={(s) => fileRow(s)} onPress={() => onSwitch(short.id)}>
                <EntryThumb entry={short} small />
                <span className={fileBody}>
                  <span className={fileName}>{short.name}</span>
                  <span className={fileMeta}>{[span, length].filter(Boolean).join(' · ') || KIND_LABEL[short.kind]}</span>
                </span>
                {short.status && status ? (
                  <StatusLight size="S" variant={SPACE_STATUS[short.status].tone}>
                    {status}
                  </StatusLight>
                ) : null}
              </RACButton>
            </li>
          );
        })}
      </ul>
      {shorts.length > shown.length ? <p className={filesHint}>{COPY.shortsMore(shorts.length - shown.length)}</p> : null}
    </section>
  );
}

/** Files under the video (prototype MovieFiles): one row per file; clicking one swaps to that file's viewer. */
function VideoFiles({ files, onSwitch }: { files: readonly SpaceEntry[]; onSwitch: (entryId: Id) => void }) {
  return (
    <section className={filesSection} aria-label={COPY.filesListLabel}>
      <h3 className={filesHead}>
        {COPY.filesTitle}
        <span className={filesCount}>{files.length}</span>
      </h3>
      <ul className={fileList}>
        {files.map((file) => {
          const status = statusText(file);
          const measure = measureText(file) ?? (file.size > 0 ? formatBytes(file.size) : null);
          return (
            <li key={file.id}>
              <RACButton className={(s) => fileRow(s)} onPress={() => onSwitch(file.id)}>
                <EntryThumb entry={file} small />
                <span className={fileBody}>
                  <span className={fileName}>{file.name}</span>
                  <span className={fileMeta}>{[KIND_LABEL[file.kind], measure].filter(Boolean).join(' · ')}</span>
                </span>
                {file.status && status ? (
                  <StatusLight size="S" variant={SPACE_STATUS[file.status].tone}>
                    {status}
                  </StatusLight>
                ) : null}
              </RACButton>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
