import { useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from 'react';
import type { FileTarget, Id, SpaceEntry, SpaceEntryKind } from '@cuccut/protocol';
import {
  ActionButton,
  Content,
  Heading,
  InlineAlert,
  Menu,
  MenuItem,
  MenuSection,
  MenuTrigger,
  Header as MenuHeader,
  Heading as MenuHeading,
  Picker,
  PickerItem,
  ProgressCircle,
  SegmentedControl,
  SegmentedControlItem,
  SubmenuTrigger,
  Text,
  ToastQueue,
  Button,
  Tooltip,
  TooltipTrigger,
} from '@react-spectrum/s2';
import Add from '@react-spectrum/s2/icons/Add';
import Archive from '@react-spectrum/s2/icons/Archive';
import FileAdd from '@react-spectrum/s2/icons/FileAdd';
import Filmstrip from '@react-spectrum/s2/icons/Filmstrip';
import Import from '@react-spectrum/s2/icons/Import';
import Refresh from '@react-spectrum/s2/icons/Refresh';
import ViewGrid from '@react-spectrum/s2/icons/ViewGrid';
import ViewList from '@react-spectrum/s2/icons/ViewList';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { FolderClosed, HardDrive, LayoutGrid, Search, Star as StarIcon, Trash2, X } from 'lucide-react';
import { cn } from 'cn';
import { BackHeader, PageRail, RailPage, SectionHeader, type RailGroup } from '../../cc/components/page-chrome.tsx';
import { CHROME_COPY } from '../../cc/components/chrome-copy.ts';
import { SessionSlot, SessionSlotsProvider } from '../../cc/components/session-slots.tsx';
import { Button as CcButton, buttonVariants } from '../../cc/ui/button.tsx';
import { Input } from '../../cc/ui/input.tsx';
import { untitled } from '../../copy.ts';
import { mediaKindOf } from '../../model/new-flow.ts';
import { madeShorts } from '../../model/shorts-result.ts';
import {
  editBlock,
  entryConversationId,
  entryJobId,
  isFailedPlaceholder,
  packageScope,
  placeKindOf,
  relatedEntries,
  videoIdOf,
  videoNameOf,
} from '../../model/space-actions.ts';
import {
  countByCategory,
  derivedCount,
  derivedFrom,
  entryPath,
  entryProjectId,
  filesOf,
  hostVideoOf,
  parentVideoOf,
  videoTargetOf,
  projectOptions,
  SPACE_CATEGORIES,
  SPACE_SORTS,
  SPACE_STATUS_FILTERS,
  sourceLabel,
  videoNamesOf,
  viewEntries,
  visibleCategories,
  type SpaceCategory,
  type SpaceSort,
  type SpaceStatusFilter,
} from '../../model/space.ts';
import type { EditorKind } from '../../model/workspace.ts';
import { useRuntime } from '../../runtime/context.tsx';
import type { RuntimeSession } from '../../runtime/session.ts';
import { useConnection } from '../../state/connection-store.ts';
import { useDirectory, useProject } from '../../state/directory-store.ts';
import { useShell } from '../../state/shell-store.ts';
import { useSpace } from '../../state/space-store.ts';
import { useVideo } from '../../state/video-store.ts';
import { takeSpaceFocus, useSpaceFocus } from '../../state/space-focus-store.ts';
import { EditorWorkspace } from '../editor/editor-workspace.tsx';
import { VideoQuickChat } from '../editor/video-quick-chat.tsx';
import { createBlankVideo } from '../start/blank-video.ts';
import { openHome } from '../start/open-home.ts';
import { useNow } from '../use-now.ts';
import { SpaceVideoInfo } from '../video-info-dialog.tsx';
import { SPACE_COPY as COPY } from './space-copy.ts';
import { SpaceDialogs, type SpaceDialogState } from './space-dialogs.tsx';
import { KIND_LUCIDE, SpaceGrid, SpaceTable, type EntryAction } from './space-list.tsx';
import { LIBRARY_COPY } from './library-copy.ts';
import { SpaceSearchHits } from './space-search-hits.tsx';
import { useEntryTools } from '../tools/use-entry-tools.ts';
import { useTranscribedEntries } from '../tools/use-candidates.ts';
import { useVideoTools } from '../tools/use-video-tools.ts';
import { failedTranscribeJob, spaceTranscribeAction, transcribeState, type SpaceTranscribeAction } from '../../model/tool-targets.ts';
import { useJobs } from '../../state/jobs-store.ts';
import { SpaceViewer, type ViewerActions } from './space-viewer.tsx';

const picker = style({ width: 150, maxWidth: 'full' });

/** Categories that are marks a person put on items rather than kinds of item. */
const isMine = (category: SpaceCategory) => category === 'favorite' || category === 'trash';

/**
 * Space, presented as the Library (agentcut library view in the workspace shell): every video, asset and output in
 * every project. The files stay in their own folders; Space only adds marks such as favorites and Trash. A glass back
 * header, a rail of places (everything, favorites, Trash, each project) and the gallery; a video opened from here
 * fills the page under its own header.
 */
export function SpacePage({
  category,
  projectId,
  video,
  from = null,
}: {
  category: SpaceCategory;
  projectId: Id | null;
  video: FileTarget | null;
  /** Only the videos derived from this one (`viewEntries`' `from`). */
  from?: Id | null;
}) {
  if (video) return <SpaceVideo video={video} category={category} projectId={projectId} from={from} />;
  return (
    <RailPage
      fill
      header={
        <BackHeader
          title={CHROME_COPY.library}
          aside={
            <>
              <HardDrive aria-hidden className="size-3.5 shrink-0" />
              <span className="truncate">{CHROME_COPY.stayLocal}</span>
            </>
          }
        />
      }
      rail={<SpaceRail category={category} projectId={projectId} />}>
      <SpaceMain category={category} projectId={projectId} from={from} />
    </RailPage>
  );
}

/** Items in a project ('none': in no project); null counts everything. */
function inProject(entries: readonly SpaceEntry[], projectId: Id | null): readonly SpaceEntry[] {
  if (projectId === null) return entries;
  return entries.filter((entry) => {
    const owner = entryProjectId(entry);
    return projectId === 'none' ? owner === null : owner === projectId;
  });
}

/**
 * The Library's rail (agentcut workspace rail): everything, the two marks (favorites, Trash), then one row per project
 * that has items, each with how many it holds. Kinds are the filter pills above the gallery.
 */
function SpaceRail({ category, projectId }: { category: SpaceCategory; projectId: Id | null }) {
  const entries = useSpace((s) => s.entries);
  const projects = useDirectory((s) => s.projects);
  const counts = useMemo(() => countByCategory(entries), [entries]);
  const options = useMemo(() => projectOptions(entries, projects), [entries, projects]);
  const perProject = useMemo(() => new Map(options.map((o) => [o.key, countByCategory(inProject(entries, o.key)).all])), [entries, options]);
  const mine = isMine(category);
  const groups: RailGroup[] = [
    {
      key: 'all',
      entries: [
        {
          key: 'all',
          label: LIBRARY_COPY.allItems,
          summary: LIBRARY_COPY.items(counts.all),
          Icon: LayoutGrid,
          route: { tab: 'space', category: 'all', projectId: null },
          current: !mine && projectId === null,
        },
      ],
    },
    {
      key: 'mine',
      label: COPY.mineHeader,
      entries: (['favorite', 'trash'] as const).map((key) => ({
        key,
        label: SPACE_CATEGORIES.find((c) => c.key === key)?.label ?? key,
        summary: LIBRARY_COPY.items(counts[key]),
        Icon: key === 'favorite' ? StarIcon : Trash2,
        route: { tab: 'space', category: key, projectId },
        current: category === key,
      })),
    },
  ];
  if (options.length) {
    groups.push({
      key: 'projects',
      label: LIBRARY_COPY.projects,
      entries: options.map((o) => ({
        key: o.key,
        label: o.label,
        summary: LIBRARY_COPY.items(perProject.get(o.key) ?? 0),
        Icon: FolderClosed,
        route: { tab: 'space', category: mine ? 'all' : category, projectId: o.key },
        current: !mine && projectId === o.key,
      })),
    });
  }
  return <PageRail label={COPY.sidebarLabel} groups={groups} footer={COPY.sidebarNote} className="cc-scroll md:-mr-2 md:min-h-0 md:overflow-y-auto md:pr-2 md:[&>div]:static" />;
}

/** 动作失败时的一句话（Runtime 的拒绝原因原样带上）。 */
const failed = (what: string) => (error: Error) => ToastQueue.negative(COPY.failed(what, error.message), { timeout: 6000 });

/**
 * 把便携包打开成新视频并进编辑器（架构设计 §5.8）：包里带着全部素材，解开要一会儿，先挂一条进行中的提示。
 * 校验不过时 Runtime 拒绝、不留下视频目录，原样报给用户。成功时返回 true。
 */
async function openPackageAs(runtime: RuntimeSession, scope: { projectId: Id } | { conversationId: Id }, path: string): Promise<boolean> {
  const name = videoNameOf(path);
  const close = ToastQueue.neutral(COPY.packageOpening(name));
  try {
    const target = await runtime.importPackage(scope, path);
    close();
    useShell.getState().openVideo(target);
    ToastQueue.positive(COPY.packageOpened(name), { timeout: 4000 });
    return true;
  } catch (error) {
    close();
    failed(COPY.openPackage)(error as Error);
    return false;
  }
}

function SpaceMain({ category, projectId, from }: { category: SpaceCategory; projectId: Id | null; from: Id | null }) {
  const runtime = useRuntime();
  const { ready, scanning, entries, issues } = useSpace();
  const projects = useDirectory((s) => s.projects);
  const conversations = useDirectory((s) => s.conversations);
  const connected = useConnection((s) => s.state.status === 'connected');
  const view = useShell((s) => s.spaceView);
  const sort = useShell((s) => s.spaceSort);
  const { replace, go, setSpaceView, setSpaceSort, openVideo } = useShell.getState();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<SpaceStatusFilter>('any');
  const [viewingId, setViewingId] = useState<Id | null>(null);
  const [infoId, setInfoId] = useState<Id | null>(null);
  const [dialog, setDialog] = useState<SpaceDialogState | null>(null);
  const [rebuilding, setRebuilding] = useState(false);
  // 从工具结果、任务详情的「在 Space 中查看」来：条目到了就打开它的查看器。
  const focus = useSpaceFocus((s) => s.focus);
  useEffect(() => {
    const id = takeSpaceFocus((id) => entries.some((e) => e.id === id));
    if (id) setViewingId(id);
  }, [focus, entries]);
  const now = useNow(60_000);
  const searchInput = useRef<HTMLInputElement>(null);

  const dirs = { projects, conversations };
  const rows = useMemo(
    () => viewEntries(entries, { category, projectId, search: query, sort, status, from }),
    [entries, category, projectId, query, sort, status, from],
  );
  // 父视频卡片 / 行上的「N 支短视频」。
  const shorts = useMemo(() => {
    const counts = new Map<Id, number>();
    for (const entry of entries) {
      const parent = entry.user.trashedAt ? null : derivedFrom(entry);
      if (parent) counts.set(parent, (counts.get(parent) ?? 0) + 1);
    }
    return counts;
  }, [entries]);
  const showShorts = (entry: SpaceEntry) => {
    const videoId = videoIdOf(entry);
    if (!videoId) return;
    setViewingId(null);
    go({ tab: 'space', category: 'all', projectId: null, from: videoId });
  };
  const options = useMemo(() => projectOptions(entries, projects), [entries, projects]);
  const videoNames = useMemo(() => videoNamesOf(entries), [entries]);
  const importable = useMemo(() => projects.filter((p) => !p.archived), [projects]);
  const label = SPACE_CATEGORIES.find((c) => c.key === category)?.label ?? COPY.all;
  const viewing = viewingId ? (entries.find((e) => e.id === viewingId) ?? null) : null;
  const info = infoId ? (entries.find((e) => e.id === infoId) ?? null) : null;
  // 视频的查看框列出名下的文件，文件的查看框能回到所属的视频（§4.3）：从哪个分类、哪里打开都一样，所以按全部条目算。
  const viewingFiles = useMemo(() => (viewing?.kind === 'video' ? filesOf(entries, viewing.id) : []), [entries, viewing]);
  const viewingHost = useMemo(() => (viewing ? hostVideoOf(entries, viewing) : null), [entries, viewing]);
  // 视频的查看框列出它切出的短视频，短视频的查看框能回到父视频（§4.5）。
  const viewingShorts = useMemo(() => {
    const videoId = viewing?.kind === 'video' ? videoIdOf(viewing) : null;
    return videoId ? madeShorts(entries, videoId) : [];
  }, [entries, viewing]);
  const viewingParent = useMemo(() => (viewing ? parentVideoOf(entries, viewing) : null), [entries, viewing]);
  const viewingTools = useEntryTools(viewing);
  const viewingConversationId = viewing ? entryConversationId(viewing) : null;
  const viewingConversation = viewingConversationId ? conversations.find((c) => c.id === viewingConversationId) : undefined;
  const filtered = query.trim() !== '' || projectId !== null || status !== 'any' || !!from;
  const fromName = from ? (videoNames.get(from) ?? untitled()) : null;
  // 内容命中只在视频与「全部」里找（架构设计 §5.11：内容索引只建在视频上）。
  const searchContent = query.trim() !== '' && (category === 'all' || category === 'video');

  const sourceOf = (entry: SpaceEntry) => sourceLabel(entry, dirs, untitled(), videoNames);
  const canReveal = (entry: SpaceEntry) => entryPath(entry, dirs) !== null;

  const reveal = (entry: SpaceEntry) => {
    const path = entryPath(entry, dirs);
    if (path) void runtime.host.revealPath(path);
    else ToastQueue.neutral(COPY.revealUnavailable, { timeout: 4000 });
  };

  const setTrashed = (entry: SpaceEntry, trashed: boolean) => runtime.updateSpaceEntry(entry.id, { trashed });

  // 带「撤销」的提示不会自己消失（S2 有动作的 Toast 不计时）；条目从回收站恢复后收起它，免得留一个过时的撤销。
  const undoToasts = useRef(new Map<Id, () => void>());
  const closeUndo = (id: Id) => {
    undoToasts.current.get(id)?.();
    undoToasts.current.delete(id);
  };

  const trashNow = (entry: SpaceEntry) =>
    setTrashed(entry, true)
      .then(() => {
        closeUndo(entry.id);
        const close = ToastQueue.neutral(COPY.trashed(entry.name), {
          timeout: 5000,
          actionLabel: COPY.undo,
          onAction: () => void setTrashed(entry, false).catch(failed(COPY.undo)),
          onClose: () => undoToasts.current.delete(entry.id),
          shouldCloseOnAction: true,
        });
        undoToasts.current.set(entry.id, close);
      })
      .catch(failed(COPY.trash));

  /** 删除视频（产品设计 §4.9）：由它导出、生成的条目不随视频删除；有这样的条目时先列出来确认。 */
  const trash = (entry: SpaceEntry) => {
    const videoId = entry.kind === 'video' ? videoIdOf(entry) : null;
    const related = videoId ? relatedEntries(entries, videoId) : [];
    const kids = videoId ? derivedCount(entries, videoId) : 0;
    if (related.length || kids) {
      setViewingId(null);
      setDialog({ kind: 'trash-video', entry, related, shorts: kids });
    } else void trashNow(entry);
  };

  const restore = (entry: SpaceEntry) =>
    setTrashed(entry, false)
      .then(() => {
        closeUndo(entry.id);
        ToastQueue.positive(COPY.restored(entry.name), { timeout: 4000 });
      })
      .catch(failed(COPY.restore));

  /** 彻底删除与清除失败的占位（架构设计 §5.5）：仍被引用时 Runtime 什么也不删，列出谁在用。 */
  const purgeNow = (entry: SpaceEntry) => {
    const clearing = isFailedPlaceholder(entry);
    runtime
      .purgeSpaceEntry(entry.id)
      .then((result) => {
        if (result.status === 'blocked') {
          setViewingId(null);
          setDialog({ kind: 'blocked', entry, references: result.references });
          return;
        }
        setViewingId((id) => (id === entry.id ? null : id));
        closeUndo(entry.id);
        ToastQueue.positive(clearing ? COPY.cleared(entry.name) : COPY.purged(entry.name), { timeout: 4000 });
      })
      .catch(failed(clearing ? COPY.clear : COPY.purge));
  };

  /**
   * 在会话中继续（架构设计 §5.7）：Runtime 只建会话（或回到条目原来的会话）并附上引用，不启动任务；
   * 引用随用户下一次发送一起交给智能体。
   */
  const continueIn = (entry: SpaceEntry) => {
    runtime
      .continueSpaceEntry(entry.id)
      .then(({ conversation, created }) => {
        setViewingId(null);
        go({ tab: 'home', conversationId: conversation.id, projectId: null });
        ToastQueue.positive(COPY.continued(created, entry.name, conversation.title || untitled()), { timeout: 6000 });
      })
      .catch(failed(COPY.continue));
  };

  /** 打开 `space.openForEdit` 给的视频条目：Space 里有它时按来源目录打开（与列表一致），否则按条目 id。 */
  const openEntry = (target: { entryId: Id }) => {
    const known = entries.find((e) => e.id === target.entryId);
    setViewingId(null);
    openVideo(known && known.kind === 'video' ? videoTargetOf(known) : target);
  };

  /**
   * 二次编辑（产品设计 §4.6；架构设计 §5.7「从成片回到视频」）：去哪里由 `space.openForEdit` 回答。
   * 回到来源视频：来源已经改过时先说明差异；以它为素材新建视频：新建空视频再导入这个文件放上主序列。
   */
  const edit = async (entry: SpaceEntry) => {
    let result;
    try {
      result = await runtime.openSpaceEntryForEdit(entry.id);
    } catch (error) {
      failed(COPY.openForEdit)(error as Error);
      return;
    }
    if (result.mode === 'video') return openEntry(result.target);
    if (result.mode === 'source-video') {
      const target = result.target;
      if (!target) return void ToastQueue.neutral(COPY.sourceGone, { timeout: 5000 });
      if (result.changed) {
        setViewingId(null);
        setDialog({ kind: 'source-changed', entry, result: { ...result, target } });
        return;
      }
      return openEntry(target);
    }
    const path = entryPath(entry, dirs);
    const conversationId = entry.source.conversationId;
    const scope = result.projectId ? { projectId: result.projectId } : conversationId ? { conversationId } : null;
    if (!path || !scope) {
      ToastQueue.neutral(editBlock(entry, null) ?? COPY.sourceGone, { timeout: 5000 });
      return;
    }
    // 视频与音频（有项目时）到那个项目的起始页，挂成交给 Agent 的素材，在输入框里说怎么处理（原型 space-viewer.jsx `newProject({entry: 'media', file})`）。
    if (result.projectId && mediaKindOf(path) !== 'other') {
      setViewingId(null);
      openHome(result.projectId, { materials: [path] });
      return;
    }
    const name = videoNameOf(path);
    try {
      const { target, importError } = await runtime.createVideoFromFile(scope, path, placeKindOf(entry.fileName) ?? 'video', name);
      setViewingId(null);
      openVideo(target);
      if (importError) ToastQueue.negative(COPY.createdEmpty(importError), { timeout: 8000 });
      else ToastQueue.positive(COPY.createdFromFile(name), { timeout: 4000 });
    } catch (error) {
      failed(COPY.newVideo)(error as Error);
    }
  };

  const rename = async (entry: SpaceEntry, name: string | null) => {
    await runtime.renameSpaceEntry(entry.id, name);
    ToastQueue.positive(COPY.renamed, { timeout: 3000 });
  };

  // 视频条目的转录动作（§4.4）：有没有文稿读候选，转录中 / 排队 / 上次失败从 `jobs` 推。
  const transcribed = useTranscribedEntries();
  const jobs = useJobs((s) => s.jobs);
  const transcribeAction = (entry: SpaceEntry): SpaceTranscribeAction | null => {
    if (entry.kind !== 'video' || entry.user.trashedAt || entry.status === 'generating' || entry.status === 'failed') return null;
    return spaceTranscribeAction(transcribeState(videoIdOf(entry), jobs), transcribed(entry.id), entry.status === 'missing');
  };
  /** 进转录工具页、预选这部视频；「重试转录…」带上失败的那次（预填参数、说明原因）。 */
  const openTranscribe = (entry: SpaceEntry) => {
    const failedJob = transcribeAction(entry) === 'retry' ? failedTranscribeJob(videoIdOf(entry), jobs) : null;
    const tools = useVideoTools.getState();
    tools.setPreset({ tool: 'transcribe', entryId: entry.id, ...(failedJob ? { retryJobId: failedJob.jobId } : {}) });
    tools.setView('transcribe', null);
    go({ tab: 'tools', tool: 'transcribe' });
  };

  /**
   * 幻灯片、设计稿与设计系统在做它的那条会话（项目里的在项目起始页）的功能区里开各自的标签
   * （docs/design/slides §8.1、docs/design/canvas §8.1、§10）。`videoTargetOf` 只是按来源目录与相对路径给定位，这几种目录同样适用。
   */
  const openEditorTab = (kind: EditorKind, entry: SpaceEntry) => {
    const { projectId, conversationId } = entry.source;
    if (!projectId && !conversationId) return;
    setViewingId(null);
    useShell.getState().openPane({ kind, target: videoTargetOf(entry) }, { conversationId, projectId });
  };
  const openSlides = (entry: SpaceEntry) => openEditorTab('slides', entry);
  const openDesign = (entry: SpaceEntry) => openEditorTab('design', entry);
  const openDesignSystem = (entry: SpaceEntry) => openEditorTab('design-system', entry);

  const onAction = (action: EntryAction, entry: SpaceEntry) => {
    if (action === 'open') {
      if (entry.kind === 'slides') openSlides(entry);
      else if (entry.kind === 'design') openDesign(entry);
      else if (entry.kind === 'design-system') openDesignSystem(entry);
      else openVideo(videoTargetOf(entry));
    } else if (action === 'transcribe') openTranscribe(entry);
    else if (action === 'view') setViewingId(entry.id);
    else if (action === 'info') setInfoId(entry.id);
    else if (action === 'continue') continueIn(entry);
    else if (action === 'favorite') runtime.updateSpaceEntry(entry.id, { favorite: !entry.user.favorite }).catch(failed(COPY.favorite));
    else if (action === 'rename') setDialog({ kind: 'rename', entry });
    else if (action === 'reveal') reveal(entry);
    else if (action === 'task') {
      const jobId = entryJobId(entry);
      if (jobId) go({ tab: 'tasks', taskId: jobId });
    } else if (action === 'trash') trash(entry);
    else if (action === 'restore') void restore(entry);
    else if (action === 'purge') setDialog({ kind: 'purge', entry });
    else if (action === 'clear') purgeNow(entry);
    else if (action === 'shorts') showShorts(entry);
  };

  const viewerActions: ViewerActions = {
    onFavorite: (entry) => onAction('favorite', entry),
    onReveal: reveal,
    onContinue: continueIn,
    onOpenVideo: (entry) => {
      setViewingId(null);
      openVideo(videoTargetOf(entry));
    },
    onOpenSlides: openSlides,
    onOpenDesign: openDesign,
    onOpenDesignSystem: openDesignSystem,
    onEdit: (entry) => void edit(entry),
    onOpenPackage: (entry) => {
      const path = entryPath(entry, dirs);
      const scope = packageScope(entry);
      if (!path || !scope) return;
      void openPackageAs(runtime, scope, path).then((ok) => ok && setViewingId(null));
    },
    onRename: (entry) => {
      setViewingId(null);
      setDialog({ kind: 'rename', entry });
    },
    onRestore: (entry) => void restore(entry),
    onPurge: (entry) => {
      setViewingId(null);
      setDialog({ kind: 'purge', entry });
    },
    onClear: purgeNow,
    onTask: (jobId) => go({ tab: 'tasks', taskId: jobId }),
    onConversation: (conversationId) => go({ tab: 'home', conversationId, projectId: null }),
    onSwitch: (entryId) => setViewingId(entryId),
    onShorts: showShorts,
    onClose: () => setViewingId(null),
  };

  const rebuild = () => {
    setRebuilding(true);
    runtime
      .rebuildSpaceIndex()
      .then((result) => ToastQueue.positive(COPY.rebuilt(result.entries, result.pendingVideos), { timeout: 5000 }))
      .catch(failed(COPY.rebuild))
      .finally(() => setRebuilding(false));
  };

  const clearSearch = () => {
    setQuery('');
    searchInput.current?.focus();
  };

  const empty = () =>
    filtered ? (
      <Empty
        title={COPY.emptyFiltered}
        action={
          query.trim() ? (
            <CcButton variant="outline" onClick={clearSearch}>
              {LIBRARY_COPY.clearSearch}
            </CcButton>
          ) : undefined
        }>
        {query.trim() ? LIBRARY_COPY.noMatchBody : COPY.emptyFilteredBody}
      </Empty>
    ) : (
      <Empty
        title={
          category === 'trash'
            ? COPY.emptyTrash
            : category === 'favorite'
              ? COPY.emptyFavorite
              : category === 'all'
                ? COPY.emptyAll
                : COPY.emptyCategory(label)
        }>
        {category === 'trash' ? COPY.emptyTrashBody : COPY.emptyBody}
      </Empty>
    );

  const busy = scanning || rebuilding;
  const mine = isMine(category);
  const projectName = projectId ? (options.find((o) => o.key === projectId)?.label ?? projects.find((p) => p.id === projectId)?.name ?? untitled()) : null;
  // The page is about a place: a mark (favorites, Trash), a project, or everything.
  const heading = mine ? label : (projectName ?? LIBRARY_COPY.allItems);
  // Counted kind filters, over the project in view (agentcut counted tabs).
  const kindCounts = useMemo(() => countByCategory(inProject(entries, projectId)), [entries, projectId]);
  const kinds = visibleCategories(kindCounts).filter((c) => c.group === 'kinds');
  const needle = query.trim();
  // The blurb says what this place is; marks (favorites, Trash) hold existing items, so "New" belongs elsewhere.
  const blurb = category === 'trash' ? LIBRARY_COPY.blurbTrash : category === 'favorite' ? LIBRARY_COPY.blurbFavorite : projectName ? LIBRARY_COPY.blurbProject : LIBRARY_COPY.blurb;

  return (
    // Not `data-cc` (it holds Spectrum controls), so the box model is set here: `min-h-full` plus padding must not overflow.
    <div className="box-border flex min-h-full flex-col gap-6 px-1 pt-1 pb-6">
      <SectionHeader title={heading} blurb={blurb} actions={mine ? undefined : <NewMenu projectId={projectId} onImport={() => setDialog({ kind: 'import' })} />} />

      <div data-cc className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {mine ? (
            projectName ? (
              <span className="inline-flex h-8 items-center gap-1 rounded-full border border-white/10 bg-white/5 pr-1 pl-3 text-sm text-foreground/85">
                {LIBRARY_COPY.inProject(projectName)}
                <button
                  type="button"
                  aria-label={LIBRARY_COPY.clearProject}
                  onClick={() => replace({ tab: 'space', category, projectId: null })}
                  className={buttonVariants({ variant: 'ghost', size: 'icon-xs' })}>
                  <X aria-hidden />
                </button>
              </span>
            ) : null
          ) : (
            <div role="group" aria-label={LIBRARY_COPY.kindFilter} className="flex min-w-0 flex-wrap items-center gap-1.5">
              {kinds.map((c) => {
                const Icon = c.key === 'all' ? LayoutGrid : KIND_LUCIDE[c.key as SpaceEntryKind];
                const on = category === c.key;
                return (
                  <button
                    key={c.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => replace({ tab: 'space', category: c.key, projectId, ...(from ? { from } : {}) })}
                    className={cn(
                      'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm font-medium whitespace-nowrap transition-[background-color,color,border-color] duration-150 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none',
                      on
                        ? 'border-white/10 bg-white/12 text-foreground shadow-(--control-highlight)'
                        : 'border-transparent text-muted-foreground hover:bg-white/5 hover:text-foreground',
                    )}>
                    {Icon ? <Icon aria-hidden className={cn('size-3.5', on && 'text-primary')} /> : null}
                    {c.label}
                    <span className="text-xs text-muted-foreground tabular-nums">{kindCounts[c.key]}</span>
                  </button>
                );
              })}
            </div>
          )}
          {/* The search always sits at the end of the row (agentcut), wrapping under the kind pills when they need the room. */}
          <div className="relative ms-auto w-full sm:w-96">
            <Search aria-hidden className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchInput}
              type="search"
              aria-label={COPY.searchLabel}
              placeholder={COPY.searchPlaceholder}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape' && query) {
                  event.preventDefault();
                  clearSearch();
                }
              }}
              className="ps-9 pe-10 [&::-webkit-search-cancel-button]:hidden"
            />
            {query ? (
              <button
                type="button"
                aria-label={LIBRARY_COPY.clearSearch}
                onClick={clearSearch}
                className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }), 'absolute end-1 top-1/2 -translate-y-1/2')}>
                <X aria-hidden />
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="-mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p data-cc role="status" className="text-xs text-muted-foreground">
          {ready ? (needle ? LIBRARY_COPY.matching(rows.length, needle) : LIBRARY_COPY.items(rows.length)) : null}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Picker
            aria-label={COPY.statusPicker}
            size="S"
            styles={picker}
            menuWidth={180}
            value={status}
            onChange={(key) => key && setStatus(key as SpaceStatusFilter)}>
            {SPACE_STATUS_FILTERS.map((s) => (
              <PickerItem key={s.key} id={s.key} textValue={s.label}>
                {s.label}
              </PickerItem>
            ))}
          </Picker>
          <Picker
            aria-label={COPY.sortPicker}
            size="S"
            styles={picker}
            menuWidth={180}
            value={sort}
            onChange={(key) => key && setSpaceSort(key as SpaceSort)}>
            {SPACE_SORTS.map((s) => (
              <PickerItem key={s.key} id={s.key} textValue={s.label}>
                {s.label}
              </PickerItem>
            ))}
          </Picker>
          <MenuTrigger>
            <TooltipTrigger>
              <ActionButton aria-label={COPY.refreshMenu} isQuiet size="S" isDisabled={!connected || busy}>
                {busy ? <ProgressCircle isIndeterminate size="S" aria-label={scanning ? COPY.scanning : COPY.rebuild} /> : <Refresh />}
              </ActionButton>
              <Tooltip>{scanning ? COPY.scanning : rebuilding ? COPY.rebuild : COPY.refreshMenu}</Tooltip>
            </TooltipTrigger>
            <Menu
              aria-label={COPY.refreshMenu}
              onAction={(key) => {
                if (key === 'rescan') void runtime.rescanSpace().catch(failed(COPY.rescan));
                else if (key === 'rebuild') rebuild();
              }}>
              <MenuItem id="rescan" textValue={COPY.rescan}>
                <Text slot="label">{COPY.rescan}</Text>
                <Text slot="description">{COPY.rescanHint}</Text>
              </MenuItem>
              <MenuItem id="rebuild" textValue={COPY.rebuild}>
                <Text slot="label">{COPY.rebuild}</Text>
                <Text slot="description">{COPY.rebuildHint}</Text>
              </MenuItem>
            </Menu>
          </MenuTrigger>
          <SegmentedControl aria-label={COPY.viewPicker} selectedKey={view} onSelectionChange={(key) => setSpaceView(key as 'grid' | 'list')}>
            <SegmentedControlItem id="grid" aria-label={COPY.viewGrid}>
              <ViewGrid />
            </SegmentedControlItem>
            <SegmentedControlItem id="list" aria-label={COPY.viewList}>
              <ViewList />
            </SegmentedControlItem>
          </SegmentedControl>
        </div>
      </div>

      {fromName ? (
        <div data-cc className="-mt-2 flex">
          <span className="inline-flex h-8 items-center gap-1 rounded-full border border-white/10 bg-white/5 pr-1 pl-3 text-sm text-foreground/85">
            {COPY.shortsFilter(fromName)}
            <button
              type="button"
              aria-label={COPY.shortsFilterClear}
              onClick={() => replace({ tab: 'space', category, projectId })}
              className={buttonVariants({ variant: 'ghost', size: 'icon-xs' })}>
              <X aria-hidden />
            </button>
          </span>
        </div>
      ) : null}

      {issues.length ? (
        <InlineAlert variant="notice">
          <Heading>{COPY.issuesTitle(issues.length)}</Heading>
          <Content>
            {issues.map((issue) => (
              <div key={issue.sourceKey}>
                {issue.kind === 'truncated' ? COPY.issueTruncated(issue.detail) : COPY.issueUnreadable(issue.detail)}
              </div>
            ))}
          </Content>
        </InlineAlert>
      ) : null}

      {searchContent && connected ? (
        <div className="box-border rounded-3xl bg-card px-5 py-4 ring-1 ring-foreground/10">
          <SpaceSearchHits query={query} projectId={projectId} entries={entries} />
        </div>
      ) : null}

      {!ready ? (
        <Empty title={COPY.preparing}>{COPY.preparingBody}</Empty>
      ) : view === 'list' ? (
        // The table scrolls on its own (virtualised); it takes the rest of the column, at least a screenful of rows.
        <div className="box-border flex min-h-[420px] flex-1 flex-col overflow-hidden rounded-3xl bg-card p-2 ring-1 ring-foreground/10">
          <SpaceTable
            entries={rows}
            now={now}
            sourceOf={sourceOf}
            canReveal={canReveal}
            onAction={onAction}
            transcribeAction={transcribeAction}
            empty={empty}
            shorts={shorts}
          />
        </div>
      ) : (
        <SpaceGrid
          entries={rows}
          now={now}
          sourceOf={sourceOf}
          canReveal={canReveal}
          onAction={onAction}
          transcribeAction={transcribeAction}
          empty={empty}
          shorts={shorts}
        />
      )}

      <p data-cc className="max-w-prose px-1 text-xs text-muted-foreground">
        {LIBRARY_COPY.openHint}
      </p>

      <SpaceViewer
        entry={viewing}
        source={viewing ? sourceOf(viewing) : ''}
        path={viewing ? entryPath(viewing, dirs) : null}
        conversation={viewingConversation ? { id: viewingConversation.id, title: viewingConversation.title || untitled() } : null}
        now={now}
        actions={viewerActions}
        tools={viewingTools}
        files={viewingFiles}
        host={viewingHost}
        shorts={viewingShorts}
        parent={viewingParent}
      />
      <SpaceDialogs
        dialog={dialog}
        projects={importable}
        defaultProjectId={projectId}
        onClose={() => setDialog(null)}
        onRename={rename}
        onPurge={purgeNow}
        onTrashVideo={(entry) => void trashNow(entry)}
        onOpenSource={openEntry}
      />
      {info ? <SpaceVideoInfo entry={info} dirs={dirs} onClose={() => setInfoId(null)} /> : null}
    </div>
  );
}

/** A place with nothing in it (agentcut `Empty`): what it is, and the one way forward when there is one. */
function Empty({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div data-cc className="flex flex-col items-start gap-2 rounded-3xl bg-card px-5 py-8 ring-1 ring-foreground/10">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="max-w-prose text-sm text-muted-foreground">{children}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/**
 * A video opened from the Library (agentcut editor): a glass header whose arrow goes back to the gallery, the editor,
 * and a right column with the quick chat card on top and the selection inspector under it. The open pane puts its
 * actions (undo, saved, Export) into the header's `header-actions` slot and its inspector into the `inspector` slot.
 */
function SpaceVideo({ video, category, projectId, from }: { video: FileTarget; category: SpaceCategory; projectId: Id | null; from: Id | null }) {
  const go = useShell((s) => s.go);
  const name = useVideo((s) => s.video?.state?.video.name ?? s.video?.ref?.name ?? null);
  return (
    <SessionSlotsProvider>
      <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pt-4 pb-4">
        <BackHeader
          sticky={false}
          title={name ?? CHROME_COPY.library}
          subtitle={name ? CHROME_COPY.library : undefined}
          backLabel={LIBRARY_COPY.backToLibrary}
          onBack={() => go({ tab: 'space', category, projectId, ...(from ? { from } : {}) })}
          actions={<SessionSlot name="header-actions" className="flex items-center gap-1.5" />}
        />
        <div className="flex min-h-0 flex-1 gap-3">
          <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
            <EditorWorkspace />
          </div>
          <div className="relative flex min-h-0 w-[300px] shrink-0 flex-col gap-3 xl:w-[340px]">
            {/*
              The quick chat is a solid card at the top of the column instead of floating over the timeline. Its own
              styles place it absolutely over the editor, so the card's box is reset here; minimised, its round button
              sits in the column's bottom corner.
            */}
            <div
              className={cn(
                'contents',
                '[&>aside]:static! [&>aside]:w-full! [&>aside]:max-w-none! [&>aside]:shrink-0 [&>aside]:rounded-3xl! [&>aside]:bg-card! [&>aside]:shadow-none! [&>aside]:ring-1 [&>aside]:ring-foreground/10',
                '[&>div]:end-0! [&>div]:bottom-0!',
              )}>
              {/* A different video is a new quick chat; an unsent draft does not follow it. */}
              <VideoQuickChat key={JSON.stringify(video)} />
            </div>
            <SessionSlot name="inspector" className="cc-scroll flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto empty:hidden" />
          </div>
        </div>
      </div>
    </SessionSlotsProvider>
  );
}

/**
 * 「新建」（产品设计 §4 用户修订；原型 page-space.jsx 的新建菜单）：
 * - 新建空视频：不转录、不排队，立即可用；
 * - 从文件新建视频：新建空视频，导入选的文件放上主序列，再进编辑器（不自动转录：转录是另一个要排队的任务）；
 * - 从便携包新建视频：选一个 .cuccut，在项目里建成新视频（`videos.importPackage`，只在桌面端）；
 * - 导入素材：登记为项目的素材，不放进任何视频（导入框里选项目）。
 * 视频是项目目录下的一个子目录：筛了项目时直接建在那里，否则先选项目。
 */
function NewMenu({ projectId, onImport }: { projectId: Id | null; onImport: () => void }) {
  const runtime = useRuntime();
  const projects = useDirectory((s) => s.projects);
  const connected = useConnection((s) => s.state.status === 'connected');
  const open = useProject(projectId);
  const owner = open && !open.archived ? open : undefined;
  // 空视频直接建（16:9）并打开（原型 page-space.jsx `newProject({entry: 'blank', dir})`）；视频、音频文件到那个项目的起始页挂成素材，
  // 在输入框里说怎么处理（加字幕、音频转视频、翻译…）。图片照旧直接建视频放上时间线。
  const createBlank = (projectId: Id) => createBlankVideo(runtime, projectId, '16:9');
  const createFromFile = async (projectId: Id) => {
    const [path] = await runtime.host.pickMediaFiles();
    if (!path) return;
    const kind = placeKindOf(path);
    if (!kind) return void ToastQueue.neutral(COPY.pickNotMedia, { timeout: 4000 });
    if (kind !== 'image' && mediaKindOf(path) !== 'other') return openHome(projectId, { materials: [path] });
    const name = videoNameOf(path);
    try {
      const { target, importError } = await runtime.createVideoFromFile({ projectId }, path, kind, name);
      useShell.getState().openVideo(target);
      if (importError) ToastQueue.negative(COPY.createdEmpty(importError), { timeout: 8000 });
      else ToastQueue.positive(COPY.createdFromFile(name), { timeout: 4000 });
    } catch (error) {
      failed(COPY.newVideo)(error as Error);
    }
  };
  // 别处导出的便携包：桌面端用系统的打开对话框选 .cuccut（网页宿主没有，菜单里不列）。
  const pickFiles = runtime.host.pickFiles;
  const createFromPackage = async (projectId: Id) => {
    if (!pickFiles) return;
    const [path] = await pickFiles({
      title: COPY.pickPackageTitle,
      buttonLabel: COPY.pickPackageButton,
      filters: [{ name: COPY.pickPackageFilter, extensions: ['cuccut'] }],
    });
    if (path) await openPackageAs(runtime, { projectId }, path);
  };
  const choices = projects.filter((p) => !p.archived).sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt));

  /** 没筛项目时，「新建空视频」「从文件新建视频」「从便携包新建视频」各带一个选项目的子菜单。 */
  const projectMenu = (id: 'blank' | 'file' | 'package', Icon: ComponentType, label: string, hint: string, run: (projectId: Id) => unknown) =>
    owner ? (
      <MenuItem id={id} textValue={label}>
        <Icon />
        <Text slot="label">{label}</Text>
        <Text slot="description">{COPY.createIn(owner.name, hint)}</Text>
      </MenuItem>
    ) : (
      <SubmenuTrigger>
        <MenuItem id={id} textValue={label}>
          <Icon />
          <Text slot="label">{label}</Text>
          <Text slot="description">{hint}</Text>
        </MenuItem>
        <Menu
          aria-label={COPY.whichProjectFor(label)}
          disabledKeys={choices.length ? [] : ['none']}
          onAction={(key) => key !== 'none' && void run(String(key))}>
          <MenuSection>
            <MenuHeader>
              <MenuHeading>{COPY.whichProject}</MenuHeading>
            </MenuHeader>
            {choices.length ? (
              choices.map((p) => (
                <MenuItem key={p.id} id={p.id} textValue={p.name}>
                  <Text slot="label">{p.name}</Text>
                </MenuItem>
              ))
            ) : (
              <MenuItem id="none" textValue={COPY.noProject}>
                <Text slot="label">{COPY.noProject}</Text>
              </MenuItem>
            )}
          </MenuSection>
        </Menu>
      </SubmenuTrigger>
    );

  return (
    <MenuTrigger>
      <Button variant="accent" size="M" isDisabled={!connected}>
        <Add />
        <Text>{COPY.newLabel}</Text>
      </Button>
      <Menu
        aria-label={COPY.newLabel}
        onAction={(key) => {
          if (key === 'import') onImport();
          else if (owner && key === 'blank') void createBlank(owner.id);
          else if (owner && key === 'file') void createFromFile(owner.id);
          else if (owner && key === 'package') void createFromPackage(owner.id);
        }}>
        <MenuSection>
          {projectMenu('blank', Filmstrip, COPY.newBlank, COPY.newBlankHint, createBlank)}
          {projectMenu('file', FileAdd, COPY.newFromFile, COPY.newFromFileHint, createFromFile)}
          {pickFiles ? projectMenu('package', Archive, COPY.newFromPackage, COPY.newFromPackageHint, createFromPackage) : null}
        </MenuSection>
        <MenuSection>
          <MenuItem id="import" textValue={COPY.importAssets}>
            <Import />
            <Text slot="label">{COPY.importAssets}</Text>
            <Text slot="description">{COPY.importAssetsHint}</Text>
          </MenuItem>
        </MenuSection>
      </Menu>
    </MenuTrigger>
  );
}
