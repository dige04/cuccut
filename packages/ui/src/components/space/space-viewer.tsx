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

/** 查看框里的动作（由页面接到 Runtime）。 */
export interface ViewerActions {
  onFavorite(entry: SpaceEntry): void;
  onReveal(entry: SpaceEntry): void;
  onContinue(entry: SpaceEntry): void;
  onOpenVideo(entry: SpaceEntry): void;
  /** 幻灯片（deck 目录）在功能区的幻灯片标签里打开（docs/design/slides §8.1）。 */
  onOpenSlides(entry: SpaceEntry): void;
  /** 设计稿（设计稿目录）在功能区的设计稿标签里打开（docs/design/canvas §8.1）。 */
  onOpenDesign(entry: SpaceEntry): void;
  /** 设计系统（设计系统目录）在功能区的设计系统标签里打开（docs/design/canvas §10）。 */
  onOpenDesignSystem(entry: SpaceEntry): void;
  onEdit(entry: SpaceEntry): void;
  /** 便携包打开成新视频。 */
  onOpenPackage(entry: SpaceEntry): void;
  onRename(entry: SpaceEntry): void;
  onRestore(entry: SpaceEntry): void;
  onPurge(entry: SpaceEntry): void;
  onClear(entry: SpaceEntry): void;
  onTask(jobId: Id): void;
  onConversation(conversationId: Id): void;
  /** 换成另一个条目的查看框：视频名下的文件，或文件所属的视频。 */
  onSwitch(entryId: Id): void;
  /** 按来源把 Space 筛成从这部视频切出的短视频（产品设计 §4.3、§5.10）。 */
  onShorts?(entry: SpaceEntry): void;
  onClose(): void;
}

/**
 * Space 的查看框（产品设计 §4.5–§4.6；原型 space-viewer.jsx）：预览、事实（来源、文件、时长或尺寸、状态、最近活动、来源会话、
 * 生成方式、工具与位置、版本），缺失、失败、来源已变时如实提示。动作是 在会话中继续 · 查看来源会话 · 在文件夹中显示 · 二次编辑 ·
 * 收藏 · 重命名 · 用工具处理… · 再做一次（工具做出来的）；
 * 回收站里的是恢复与彻底删除，失败的占位是清除与查看任务。做不了的按钮置灰，原因写在下面。
 * 一部视频在「全部」与「视频」里只有一行（§4.3）：它导出、生成的文件列在这部视频的查看框里，点一个换成那个文件；
 * 文件的查看框里「查看视频」换回来。切出的短视频各是一部视频，父视频的查看框里在文件之前一起列，点一支换成它的查看框；
 * 短视频的查看框里「查看来源视频」换回父视频。
 * 条目由外层传进来：S2 的 Dialog 会在几个 slot 里各渲染一遍 children，这里不放状态。
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
  /** 条目在磁盘上的绝对路径；不在来源目录里的产物没有。 */
  path: string | null;
  /** 产生它的会话（还在时）。 */
  conversation: { id: Id; title: string } | null;
  now: number;
  actions: ViewerActions;
  /** 与工具有关的几样（components/tools/use-entry-tools.ts）。 */
  tools?: EntryTools | null;
  /** 视频名下的文件（model/space.ts `filesOf`）。 */
  files?: readonly SpaceEntry[];
  /** 文件所属的视频（`hostVideoOf`）。 */
  host?: SpaceEntry | null;
  /** 从这部视频切出的短视频，新切的在前（model/shorts-result.ts `madeShorts`）。 */
  shorts?: readonly SpaceEntry[];
  /** 短视频的父视频（`parentVideoOf`）。 */
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
  // 幻灯片、设计稿与设计系统是一个目录，查看框里不预览，打开到各自的标签里看。
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
 * 这部视频切出的短视频（原型 MovieShorts，产品设计 §4.5）：一行一支，写在原片上的区间与时长，点开换成那一支的查看框。
 * 最多露出 `MADE_SHOWN` 支；「在列表中查看」把 Space 筛成这部视频切出的全部（§4.3）。
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

/** 视频名下的文件（原型 MovieFiles）：一行一个，点开换成那个文件的查看框。 */
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
