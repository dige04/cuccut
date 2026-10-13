import { useEffect, useMemo, useState, type ComponentType } from 'react';
import type { FileTarget, Id, ProjectFileEntry, ProjectFilesList } from '@cuccut/protocol';
import {
  Breadcrumb,
  Breadcrumbs,
  Button,
  Content,
  Heading,
  IllustratedMessage,
  ListView,
  ListViewItem,
  SearchField,
  Text,
} from '@react-spectrum/s2';
import FileIcon from '@react-spectrum/s2/icons/File';
import Folder from '@react-spectrum/s2/icons/Folder';
import FolderOpen from '@react-spectrum/s2/illustrations/linear/FolderOpen';
import NoSearchResults from '@react-spectrum/s2/illustrations/linear/NoSearchResults';
import ErrorIllustration from '@react-spectrum/s2/illustrations/linear/Error';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { PROJECT_FILES_COPY as COPY } from '../../copy.ts';
import { breadcrumbs, entryAction, entryFolder, entryMeta, projectFileTarget } from '../../model/project-files.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { useConversationMeta, useProject } from '../../state/directory-store.ts';
import { useNow } from '../use-now.ts';
import { KIND_ICON } from '../space/space-list.tsx';

/** How long the search box must stay idle before searching. */
const SEARCH_DEBOUNCE_MS = 200;

const root = style({ display: 'flex', flexDirection: 'column', flexGrow: 1, minWidth: 0, minHeight: 0 });
const bar = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  paddingX: 16,
  paddingY: 12,
  minHeight: 56,
  boxSizing: 'border-box',
  flexShrink: 0,
  borderBottomWidth: 2,
  borderTopWidth: 0,
  borderStartWidth: 0,
  borderEndWidth: 0,
  borderStyle: 'solid',
  borderColor: 'gray-100',
  '--iconPrimary': { type: 'fill', value: 'currentColor' },
});
const barTitle = style({ font: 'title-sm', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
const searchBox = style({ paddingX: 16, paddingTop: 16, paddingBottom: 8, flexShrink: 0 });
const searchField = style({ width: 'full' });
const crumbs = style({ paddingX: 16, flexShrink: 0 });
const note = style({ font: 'ui-xs', color: 'gray-600', paddingX: 16, paddingBottom: 8, flexShrink: 0 });
const list = style({ flexGrow: 1, minHeight: 0, marginX: 16, marginBottom: 16 });
const centered = style({ display: 'flex', flexGrow: 1, alignItems: 'center', justifyContent: 'center', minHeight: 0, padding: 24 });

type Load = { status: 'loading' } | { status: 'ready'; result: ProjectFilesList } | { status: 'error'; message: string };

export interface ProjectFilesProps {
  /** Which conversation's files to show: if it belongs to a project, list the project directory; otherwise list the conversation's working directory. */
  conversationId: Id;
  /** On file click: hand out `{ conversationId, path }` (usable directly for `media.resolve`, FilePreview and the player) and the entry itself. */
  onOpenFile?: (target: FileTarget, entry: ProjectFileEntry) => void;
  /** On click of a video directory (one containing `video.db`). When not provided, video directories open as ordinary folders. */
  onOpenVideo?: (target: FileTarget, entry: ProjectFileEntry) => void;
  /** On click of a slides directory (one containing `deck.json`). When not provided, it opens as an ordinary folder. */
  onOpenSlides?: (target: FileTarget, entry: ProjectFileEntry) => void;
  /** On click of a design canvas directory (one containing `canvas.json`). When not provided, it opens as an ordinary folder. */
  onOpenDesign?: (target: FileTarget, entry: ProjectFileEntry) => void;
  /** On click of a design system directory (one containing `design-system.json`). When not provided, it opens as an ordinary folder. */
  onOpenDesignSystem?: (target: FileTarget, entry: ProjectFileEntry) => void;
}

/**
 * The “Project files” tab in the workspace area (product design §3.3, prototype home-workspace.jsx `WorkspaceFiles`):
 * files in the project directory the conversation belongs to, browsed level by level. The search box looks up files by name across the whole project (`projects.files.list`).
 * Read-only: opening a file is handed to the caller (single-file tab, video, slides, design canvas or design system). With no backend, it shows real empty states and errors rather than made-up data.
 */
export function ProjectFiles({ conversationId, onOpenFile, onOpenVideo, onOpenSlides, onOpenDesign, onOpenDesignSystem }: ProjectFilesProps) {
  const runtime = useRuntime();
  const conversation = useConversationMeta(conversationId);
  const project = useProject(conversation?.projectId ?? null);
  const now = useNow(60_000);
  const [dir, setDir] = useState('');
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const rootLabel = project?.name ?? COPY.scratchRoot;
  const searching = query.length > 0;

  // When the conversation changes, or the conversation gets bound to a project (the working directory changes; architecture design §3.10), return to the root and clear the search.
  const projectId = conversation?.projectId ?? null;
  useEffect(() => {
    setDir('');
    setInput('');
    setQuery('');
  }, [conversationId, projectId]);

  useEffect(() => {
    const text = input.trim();
    if (text === query) return;
    const timer = setTimeout(() => setQuery(text), text ? SEARCH_DEBOUNCE_MS : 0);
    return () => clearTimeout(timer);
  }, [input, query]);

  useEffect(() => {
    // A late, stale response must not overwrite a newer one: each request only accepts the response for its own round.
    let current = true;
    setLoad({ status: 'loading' });
    runtime
      .listProjectFiles(searching ? { conversationId, query } : { conversationId, ...(dir ? { dir } : {}) })
      .then((result) => current && setLoad({ status: 'ready', result }))
      .catch((error: Error) => current && setLoad({ status: 'error', message: error.message }));
    return () => {
      current = false;
    };
  }, [runtime, conversationId, projectId, dir, query, searching, attempt]);

  const entries = load.status === 'ready' ? load.result.entries : [];
  const byPath = useMemo(() => new Map(entries.map((e) => [e.path, e])), [entries]);

  const open = (entry: ProjectFileEntry) => {
    const action = entryAction(entry);
    const target = projectFileTarget(conversationId, entry);
    if (action === 'video' && onOpenVideo) onOpenVideo(target, entry);
    else if (action === 'slides' && onOpenSlides) onOpenSlides(target, entry);
    else if (action === 'design' && onOpenDesign) onOpenDesign(target, entry);
    else if (action === 'design-system' && onOpenDesignSystem) onOpenDesignSystem(target, entry);
    else if (action === 'file') onOpenFile?.(target, entry);
    else {
      setInput('');
      setQuery('');
      setDir(entry.path);
    }
  };

  return (
    <section className={root} aria-label={COPY.region}>
      <header className={bar}>
        <Folder />
        <span className={barTitle} title={load.status === 'ready' ? load.result.root : undefined}>
          {rootLabel}
        </span>
      </header>
      <div className={searchBox}>
        <SearchField
          aria-label={COPY.searchLabel}
          placeholder={COPY.searchPlaceholder}
          value={input}
          onChange={setInput}
          styles={searchField}
        />
      </div>
      {!searching && dir ? (
        <div className={crumbs}>
          <Breadcrumbs aria-label={COPY.breadcrumbs} size="M" onAction={(key) => setDir(String(key))}>
            {breadcrumbs(dir, rootLabel).map((crumb) => (
              <Breadcrumb key={crumb.dir || '.'} id={crumb.dir}>
                {crumb.label}
              </Breadcrumb>
            ))}
          </Breadcrumbs>
        </div>
      ) : null}
      {load.status === 'ready' && load.result.truncated ? (
        <p className={note} role="status">
          {searching ? COPY.truncatedSearch : COPY.truncatedList(entries.length)}
        </p>
      ) : null}
      {load.status === 'error' ? (
        <div className={centered}>
          <IllustratedMessage>
            <ErrorIllustration />
            <Heading>{COPY.failed}</Heading>
            <Content>{load.message}</Content>
            <Button variant="secondary" onPress={() => setAttempt((n) => n + 1)}>
              {COPY.retry}
            </Button>
          </IllustratedMessage>
        </div>
      ) : (
        <ListView
          aria-label={searching ? COPY.resultsLabel : COPY.listLabel(dir || rootLabel)}
          isQuiet
          selectionMode="none"
          styles={list}
          loadingState={load.status === 'loading' ? 'loading' : 'idle'}
          onAction={(key) => {
            const entry = byPath.get(String(key));
            if (entry) open(entry);
          }}
          renderEmptyState={() => (
            <IllustratedMessage size="S">
              {searching ? <NoSearchResults /> : <FolderOpen />}
              <Heading>{searching ? COPY.noMatch : COPY.emptyFolder}</Heading>
              {searching ? <Content>{COPY.noMatchHint}</Content> : null}
            </IllustratedMessage>
          )}>
          {entries.map((entry) => {
            const Icon = (entry.kind ? KIND_ICON[entry.kind] : entry.isDir ? Folder : FileIcon) as ComponentType<{ slot?: string }>;
            const folder = searching ? entryFolder(entry.path) || COPY.inRoot : '';
            return (
              <ListViewItem key={entry.path} id={entry.path} textValue={entry.name} hasChildItems={
                  entryAction(entry) === 'enter' ||
                  (entry.kind === 'video' && !onOpenVideo) ||
                  (entry.kind === 'slides' && !onOpenSlides) ||
                  (entry.kind === 'design' && !onOpenDesign) ||
                  (entry.kind === 'design-system' && !onOpenDesignSystem)
                }>
                <Icon slot="icon" />
                <Text>{entry.name}</Text>
                <Text slot="description">{folder ? `${entryMeta(entry, now)} · ${folder}` : entryMeta(entry, now)}</Text>
              </ListViewItem>
            );
          })}
        </ListView>
      )}
    </section>
  );
}
