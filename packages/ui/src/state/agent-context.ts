import { getLocale, type EditorContext, type Id } from '@cuccut/protocol';
import { targetKey } from '../model/workspace.ts';
import { useEditor } from './editor-store.ts';
import { routeVideo, useShell, type Route } from './shell-store.ts';
import { useVideo, type OpenVideo } from './video-store.ts';

/**
 * Editor context sent to the agent (product design §3.2.3 reference tags, §6.7 context understanding): the open video, its version,
 * the selected clip and the playhead. It is attached only when the video belongs to the session's source directory, since the agent can only read and write videos there.
 */

/** The session's source: the project it belongs to, or the session itself if it does not belong to a project. */
export interface ContextScope {
  conversationId: Id | null;
  projectId: Id | null;
}

const MAX_SELECTION = 200;

/**
 * The open video is the one at this position (the current-video tab in Home, or the video opened from Space). Switching sessions or tabs does not close the video
 * (the feature-area tab still references it), but videos open in other sessions are not attached to messages sent here.
 */
function routeKey(route: Route): string | null {
  const target = routeVideo(route);
  return target ? targetKey(target) : null;
}

function inScope(video: OpenVideo | null, scope: ContextScope, shown: string | null): video is OpenVideo & { ref: NonNullable<OpenVideo['ref']> } {
  const source = video?.ref?.source;
  if (!source || shown === null || targetKey(video.target) !== shown) return false;
  return scope.projectId
    ? source.projectId === scope.projectId
    : scope.conversationId !== null && source.conversationId === scope.conversationId;
}

/** Taken once at send time: the version, selection and playhead are as of that moment. Also carries the UI language, which the skill uses to decide the output language. */
export function captureEditorContext(scope: ContextScope): EditorContext | null {
  const video = useVideo.getState().video;
  if (!inScope(video, scope, routeKey(useShell.getState().route)) || !video.state || !video.videoId) return null;
  const editor = useEditor.getState();
  const snapshot = video.state.video;
  const items = new Set(snapshot.sequences[snapshot.rootSequenceId]?.items.map((item) => item.id) ?? []);
  const selection = editor.videoId === video.videoId ? editor.selection.filter((id) => items.has(id)).slice(0, MAX_SELECTION) : [];
  return {
    videoId: video.videoId,
    videoName: snapshot.name.slice(0, 200),
    videoPath: video.ref.relPath,
    revision: snapshot.revision,
    selection,
    playheadSeconds: editor.videoId === video.videoId ? Math.round(editor.playhead * 1000) / 1000 : 0,
    uiLanguage: getLocale(),
  };
}

/** Content shown in the reference tag above the input box. The playhead is not included, so the whole session does not redraw during playback. */
export function useContextTag(scope: ContextScope): { videoId: Id; videoName: string; selected: number } | null {
  const shown = useShell((s) => routeKey(s.route));
  const videoId = useVideo((s) => (inScope(s.video, scope, shown) && s.video.state ? s.video.videoId : null));
  const videoName = useVideo((s) => s.video?.state?.video.name ?? '');
  const selected = useEditor((s) => (s.videoId === videoId ? s.selection.length : 0));
  return videoId ? { videoId, videoName, selected } : null;
}
