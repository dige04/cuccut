import { useState, type Key } from 'react';
import { live, type Conversation, type SpaceEntry } from '@cuccut/protocol';
import {
  ActionButton,
  AlertDialog,
  DialogContainer,
  Menu,
  MenuItem,
  MenuSection,
  MenuTrigger,
  SubmenuTrigger,
  Header as MenuHeader,
  Heading as MenuHeading,
  Text,
  ToastQueue,
} from '@react-spectrum/s2';
import Add from '@react-spectrum/s2/icons/Add';
import Asset from '@react-spectrum/s2/icons/Asset';
import Delete from '@react-spectrum/s2/icons/Delete';
import Edit from '@react-spectrum/s2/icons/Edit';
import More from '@react-spectrum/s2/icons/More';
import MovieCamera from '@react-spectrum/s2/icons/MovieCamera';
import OpenIn from '@react-spectrum/s2/icons/OpenIn';
import PinOff from '@react-spectrum/s2/icons/PinOff';
import PinOn from '@react-spectrum/s2/icons/PinOn';
import Play from '@react-spectrum/s2/icons/Play';
import { S } from './shell-copy.ts';
import { untitled } from '../copy.ts';
import { formatBytes, isPlayable, KIND_LABEL, videoTargetOf } from '../model/space.ts';
import { useRuntime } from '../runtime/context.tsx';
import { useConnection } from '../state/connection-store.ts';
import { useProject } from '../state/directory-store.ts';
import { useShell } from '../state/shell-store.ts';
import { useSpace } from '../state/space-store.ts';
import { NameDialog } from './name-dialog.tsx';

/** The working / waiting-for-approval word (UI language), shared by the session header and the session tab's hint. */
export const STATUS_WORD: { readonly running: string; readonly waiting: string } = live(() => ({
  running: S.conversationHeader.running,
  waiting: S.conversationHeader.waiting,
}));

/**
 * The session's actions menu (⋯ at the right end of the session header): new session, open or create a video in
 * the session's folder, play its media, pin, rename, show in Space, reveal the folder, and delete. Rename and delete
 * open their dialogs from here.
 */
export function SessionMenu({ conversation }: { conversation: Conversation }) {
  const runtime = useRuntime();
  const project = useProject(conversation.projectId);
  const go = useShell((s) => s.go);
  const [dialog, setDialog] = useState<'rename' | 'delete' | null>(null);
  const title = conversation.title || untitled();

  const onAction = (key: Key) => {
    if (key === 'new') go({ tab: 'home', conversationId: null, projectId: conversation.projectId });
    else if (key === 'rename') setDialog('rename');
    else if (key === 'delete') setDialog('delete');
    else if (key === 'pin')
      runtime
        .updateConversation(conversation.id, { pinned: !conversation.pinned })
        .catch((error: Error) => ToastQueue.negative(error.message, { timeout: 5000 }));
    else if (key === 'space' && project) go({ tab: 'space', category: 'all', projectId: project.id });
    else if (key === 'reveal') void runtime.host.revealPath(project?.path ?? conversation.cwd);
  };

  return (
    <span className="inline-flex" data-workspace-head>
      <MenuTrigger>
        <ActionButton isQuiet aria-label={S.conversationHeader.actions}>
          <More />
        </ActionButton>
        <Menu aria-label={S.conversationHeader.actions} onAction={onAction}>
          <MenuSection>
            <MenuItem id="new" textValue={project ? S.common.newSessionInProject : S.common.newSession}>
              <Add />
              <Text slot="label">{project ? S.common.newSessionInProject : S.common.newSession}</Text>
            </MenuItem>
            <VideoSubmenu conversation={conversation} />
            <MediaSubmenu conversation={conversation} />
          </MenuSection>
          <MenuSection>
            <MenuItem id="pin" textValue={conversation.pinned ? S.common.unpin : S.common.pin}>
              {conversation.pinned ? <PinOff /> : <PinOn />}
              <Text slot="label">{conversation.pinned ? S.common.unpin : S.common.pin}</Text>
            </MenuItem>
            <MenuItem id="rename" textValue={S.common.rename}>
              <Edit />
              <Text slot="label">{S.common.renameEllipsis}</Text>
            </MenuItem>
            {project ? (
              <MenuItem id="space" textValue={S.conversationHeader.viewInSpace(project.name)}>
                <Asset />
                <Text slot="label">{S.conversationHeader.viewInSpace(project.name)}</Text>
              </MenuItem>
            ) : null}
            <MenuItem id="reveal" textValue={project ? S.conversationHeader.revealProject : S.conversationHeader.revealWorkdir}>
              <OpenIn />
              <Text slot="label">{project ? S.conversationHeader.revealProject : S.conversationHeader.revealWorkdir}</Text>
            </MenuItem>
          </MenuSection>
          <MenuSection>
            <MenuItem id="delete" textValue={S.conversationHeader.deleteSession}>
              <Delete />
              <Text slot="label">{S.conversationHeader.deleteSessionEllipsis}</Text>
            </MenuItem>
          </MenuSection>
        </Menu>
      </MenuTrigger>
      <DialogContainer onDismiss={() => setDialog(null)}>
        {dialog === 'delete' ? (
          <AlertDialog
            variant="destructive"
            title={S.conversationHeader.deleteTitle}
            primaryActionLabel={S.conversationHeader.deleteConfirm}
            cancelLabel={S.common.cancel}
            onPrimaryAction={async () => {
              try {
                await runtime.deleteConversation(conversation.id);
                go({ tab: 'home', conversationId: null, projectId: conversation.projectId });
              } catch (error) {
                ToastQueue.negative(S.conversationHeader.deleteFailed((error as Error).message), { timeout: 5000 });
              }
            }}>
            {S.conversationHeader.deleteBody}
          </AlertDialog>
        ) : null}
      </DialogContainer>
      {dialog === 'rename' ? (
        <NameDialog
          title={S.conversationHeader.renameTitle}
          label={S.common.name}
          initial={title}
          submitLabel={S.common.save}
          onClose={() => setDialog(null)}
          onSubmit={async (next) => {
            await runtime.updateConversation(conversation.id, { title: next });
            setDialog(null);
          }}
        />
      ) : null}
    </span>
  );
}

/** The entries in this conversation's source directory: a project conversation uses the project directory; a conversation outside any project uses its own working directory. */
function useSourceEntries(conversation: Conversation, accept: (entry: SpaceEntry) => boolean) {
  const all = useSpace((s) => s.entries);
  return all
    .filter(
      (e) =>
        (conversation.projectId ? e.source.projectId === conversation.projectId : e.source.conversationId === conversation.id) &&
        e.user.trashedAt === null &&
        accept(e),
    )
    .sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
}

/**
 * Opens a file from the session's source folder as a tab in the session layout's centre. The tab is keyed by the
 * entry's source (a project session by its project), so it is the same tab Space opens.
 */
function usePlayInPane() {
  const openPane = useShell((s) => s.openPane);
  return (entry: SpaceEntry) => openPane({ kind: 'file', target: videoTargetOf(entry) });
}

/**
 * Opens a video from the session's source folder, or creates one (product design §2.3: a session can open its
 * project's videos). The video opens in the editor in the centre of the session layout, with the conversation in the
 * right column. A session outside any project creates the video in its working directory.
 */
function VideoSubmenu({ conversation }: { conversation: Conversation }) {
  const runtime = useRuntime();
  const ready = useSpace((s) => s.ready);
  const connected = useConnection((s) => s.state.status === 'connected');
  const openVideo = useShell((s) => s.openVideo);
  const videos = useSourceEntries(conversation, (e) => e.kind === 'video');
  const where = conversation.projectId ? 'project' : 'workdir';

  const onAction = (key: Key) => {
    if (key === 'new-video') {
      const scope = conversation.projectId ? { projectId: conversation.projectId } : { conversationId: conversation.id };
      runtime.videos
        .create(scope)
        .then((target) => openVideo(target))
        .catch((error: Error) => ToastQueue.negative(S.conversationHeader.newVideoFailed(error.message), { timeout: 5000 }));
      return;
    }
    const entry = videos.find((e) => e.id === key);
    if (entry) openVideo(videoTargetOf(entry));
  };

  return (
    <SubmenuTrigger>
      <MenuItem id="videos" textValue={S.conversationHeader.openVideo}>
        <MovieCamera />
        <Text slot="label">{S.conversationHeader.openVideo}</Text>
      </MenuItem>
      <Menu
        aria-label={S.conversationHeader.videosIn(where)}
        disabledKeys={[...(videos.length ? [] : ['no-video']), ...(connected ? [] : ['new-video'])]}
        onAction={onAction}>
        <MenuSection>
          <MenuHeader>
            <MenuHeading>{S.conversationHeader.videosIn(where)}</MenuHeading>
          </MenuHeader>
          {videos.length ? (
            videos.map((entry) => (
              <MenuItem key={entry.id} id={entry.id} textValue={entry.name}>
                <Text slot="label">{entry.name}</Text>
                <Text slot="description">{entry.relPath}</Text>
              </MenuItem>
            ))
          ) : (
            <MenuItem id="no-video" textValue={S.conversationHeader.none}>
              <Text slot="label">{ready ? S.conversationHeader.noVideosIn(where) : S.conversationHeader.scanning}</Text>
            </MenuItem>
          )}
        </MenuSection>
        <MenuSection>
          <MenuItem id="new-video" textValue={S.conversationHeader.newVideo}>
            <Add />
            <Text slot="label">{S.conversationHeader.newVideo}</Text>
          </MenuItem>
        </MenuSection>
      </Menu>
    </SubmenuTrigger>
  );
}

/** Play a video file or audio from the source directory in the feature area (product design §3.3 「用户手动打开」 (opened manually by the user)): opens as a file tab. */
function MediaSubmenu({ conversation }: { conversation: Conversation }) {
  const ready = useSpace((s) => s.ready);
  const play = usePlayInPane();
  const media = useSourceEntries(conversation, (e) => isPlayable(e.fileName)).slice(0, 30);
  const where = conversation.projectId ? 'project' : 'workdir';

  return (
    <SubmenuTrigger>
      <MenuItem id="media" textValue={S.conversationHeader.playMedia}>
        <Play />
        <Text slot="label">{S.conversationHeader.playMedia}</Text>
      </MenuItem>
      <Menu
        aria-label={S.conversationHeader.mediaIn(where)}
        disabledKeys={media.length ? [] : ['no-media']}
        onAction={(key) => {
          const entry = media.find((e) => e.id === key);
          if (entry) play(entry);
        }}>
        <MenuSection>
          <MenuHeader>
            <MenuHeading>{S.conversationHeader.mediaIn(where)}</MenuHeading>
          </MenuHeader>
          {media.length ? (
            media.map((entry) => (
              <MenuItem key={entry.id} id={entry.id} textValue={entry.name}>
                <Text slot="label">{entry.name}</Text>
                <Text slot="description">
                  {entry.relPath === entry.fileName ? KIND_LABEL[entry.kind] : entry.relPath} · {formatBytes(entry.size)}
                </Text>
              </MenuItem>
            ))
          ) : (
            <MenuItem id="no-media" textValue={S.conversationHeader.none}>
              <Text slot="label">{ready ? S.conversationHeader.noMediaIn(where) : S.conversationHeader.scanning}</Text>
            </MenuItem>
          )}
        </MenuSection>
      </Menu>
    </SubmenuTrigger>
  );
}
