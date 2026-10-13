import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { DEFAULT_AGENT_MODE, type AttachmentRef, type Id, type SkillSendRef } from '@cuccut/protocol';
import { ActionButton, ToastQueue, Tooltip, TooltipTrigger } from '@react-spectrum/s2';
import Comment from '@react-spectrum/s2/icons/Comment';
import Minimize from '@react-spectrum/s2/icons/Minimize';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { Button as RACButton } from 'react-aria-components';
import { applyAgentChange, draftSelection } from '../../model/agent-choice.ts';
import { sendFailureMessage } from '../../model/agent-skills.ts';
import { gateGuide, homeGate } from '../../model/home-brief.ts';
import { sessionStatus } from '../../model/sidebar.ts';
import { targetKey } from '../../model/workspace.ts';
import { setDefaultAccessMode } from '../../runtime/agent-commands.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { defaultDriver, useConnection } from '../../state/connection-store.ts';
import { useConversationMeta } from '../../state/directory-store.ts';
import { useDraftImages } from '../../state/draft-images-store.ts';
import { useDraftSkills } from '../../state/draft-skills-store.ts';
import { hostPanelTab, useEditor } from '../../state/editor-store.ts';
import { useSetting } from '../../state/settings-store.ts';
import { routeVideo, useShell } from '../../state/shell-store.ts';
import { useVideo } from '../../state/video-store.ts';
import { Composer } from '../composer.tsx';
import { useEditorReference } from '../use-editor-reference.ts';
import { AgentGateLine } from './agent-gate-line.tsx';
import { QUICK_CHAT_COPY as COPY } from './quick-chat-copy.ts';

// The expanded card yields to the vertical toolbar on the right (a 48px-wide column plus 24px of spacing). The minimized round icon stays at the bottom right as before, below the toolbar.
const dock = style({ position: 'absolute', insetEnd: { default: 24, isOpen: '[72px]' }, bottom: 24, zIndex: 20 });
const trigger = style({
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  size: 48,
  padding: 0,
  borderWidth: 0,
  borderRadius: 'full',
  // The panel floating over the editor uses the elevated background: in dark mode it is one step brighter than the panel, so it does not blur into the panel behind it (gray-25 is the same color as the panel in dark mode).
  '--s2-container-bg': { type: 'backgroundColor', value: { default: 'elevated', isHovered: 'gray-100', isPressed: 'gray-200' } },
  backgroundColor: '--s2-container-bg',
  boxShadow: 'elevated',
  color: 'gray-800',
  cursor: 'default',
  outlineStyle: { default: 'none', isFocusVisible: 'solid' },
  outlineColor: 'focus-ring',
  outlineWidth: 2,
  outlineOffset: 2,
  '--iconPrimary': { type: 'fill', value: 'currentColor' },
});
/** The dot at the top right of the icon when minimized. Its color follows the status light of session rows in the Home sidebar (model/sidebar.ts `sessionStatus`): running blue, awaiting approval orange, failed red, completed and unread green. */
const dot = style({
  position: 'absolute',
  top: 2,
  insetEnd: 2,
  size: 8,
  borderRadius: 'full',
  borderWidth: 2,
  borderStyle: 'solid',
  // Outline the icon's background color, so the dot is separated from the icon.
  borderColor: '[var(--s2-container-bg)]',
  backgroundColor: { status: { running: 'accent', waiting: 'notice', failed: 'negative', unread: 'positive' } },
});
const panel = style({
  display: 'flex',
  flexDirection: 'column',
  boxSizing: 'border-box',
  width: 400,
  maxWidth: '[calc(100% - 96px)]',
  borderRadius: '[16px]',
  backgroundColor: 'elevated',
  boxShadow: 'elevated',
  overflow: 'hidden',
});
const head = style({ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, paddingStart: 16, paddingEnd: 8, paddingTop: 8 });
const title = style({ flexGrow: 1, minWidth: 0, font: 'title-sm', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
// The input box has 12px of padding on the left and right, and 4px of space above it, between it and the title. Below, it sits right against the toolbar, keeping only the input's own small space (product design §5.1 “composer footer bar”).
const body = style({ paddingTop: 4, marginBottom: -8 });
const gate = style({ paddingX: 16, paddingBottom: 12 });

/** The floating session's draft is kept per video: switching to another video means a different input box, and an unsent draft does not carry over. */
function draftKeyOf(videoKey: string | null): string {
  return `video-chat:${videoKey ?? ''}`;
}

/**
 * The floating session in the bottom-right of a video opened in Space (product design §2.2, §5.1). By default it expands into an input box for a new session and does not steal focus from the editor. Once minimized, it shrinks to an icon (remembered locally), and a dot on the icon hints that the most recently started session here is working, awaiting approval, or completed and unread. The input box is the same as the Home start page's (`Composer`): access mode on the left, Agent · model · reasoning effort on the right. The meaning of the choices is also the same: they are recorded per this video's draft, passed to the new session on send, and the chosen access mode is remembered as the default.
 *
 * Sending switches to that session on Home. Its first message is this prompt, and the editor's current state travels with it. In the session, a video card for this video appears, and clicking “Open editor” comes back (`video-cards.ts` `openingVideo`). No empty session is created before sending. Each send creates a new session, and returning to Space still starts from an empty input box. The session belongs to the video's project. If the video is not in a project (it sits in the working directory of a session with no project), the new session also has no project and shares that session's working directory (`folderOf`, architecture design §3.10), and it is shown under “Recent”.
 */
export function VideoQuickChat() {
  const runtime = useRuntime();
  const source = useVideo((s) => s.video?.ref?.source ?? null);
  const projectId = source?.projectId ?? null;
  const owner = projectId ? null : (source?.conversationId ?? null);
  // The session the video came from shares its working directory only if it still exists in the directory. If it has been deleted, create an ordinary session with no project.
  const ownerKnown = !!useConversationMeta(owner);
  const key = useShell((s) => {
    const target = routeVideo(s.route);
    return target ? targetKey(target) : null;
  });
  const draftKey = draftKeyOf(key);
  // The dot on the icon looks at the session most recently started from here. If that session was deleted (not found in the directory), the dot does not light up.
  const started = useShell((s) => (key ? (s.videoChats[key] ?? null) : null));
  const watched = useConversationMeta(started);
  const prefMin = useShell((s) => s.videoChatMin);
  // While the tools page (`aitools`) is open, the expanded card covers the “Hand off to Agent” at the bottom of the page. During this time it shows as minimized, but the preference stored locally is not changed. When the user clicks the icon to open it, it expands this time (`peek`). When the tools page closes, it resets to the preferred state. Opening and minimizing on the tools page touch only `peek`, never the preference.
  // The web host has no AI tools tab: a remembered `aitools` falls back to the transcript there, and does not count as open.
  const web = runtime.host.platform === 'web';
  const toolsOpen = useEditor((s) => hostPanelTab(s.panelTab, web) === 'aitools');
  const [peek, setPeek] = useState(false);
  const min = toolsOpen ? !peek : prefMin;
  const drivers = useConnection((s) => s.drivers);
  const checking = useConnection((s) => s.checking);
  const guide = gateGuide(homeGate(drivers, checking));
  // The access mode and Agent · model · effort for a new session: whatever was chosen on this video's draft, otherwise the default in settings (same as the start page).
  const draftMode = useShell((s) => s.draftAccessModes[draftKey]);
  const defaultMode = useSetting('agent.defaultAccessMode');
  const choice = useShell((s) => s.draftAgents[draftKey]);
  // If the Agent chosen on the draft still shows “Detecting” on the first probe, do not fall back to the default one. On send, the draft's choice is still used.
  const driver =
    choice?.driverId && checking.includes(choice.driverId)
      ? null
      : (drivers?.find((d) => d.id === choice?.driverId) ?? defaultDriver(drivers, checking));
  const { model, effort } = draftSelection(driver, choice);
  // Reference tags and the editor state captured on send are matched by the video's own source (its project, or the no-project session it sits in), not by the new session, which does not exist before sending.
  const editor = useEditorReference({ conversationId: owner, projectId });
  // By default, expanding does not steal focus from the editor. Only when the user opens it themselves is the cursor placed in the input (focus once when Composer mounts).
  const [opened, setOpened] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!toolsOpen) setPeek(false);
  }, [toolsOpen]);

  const minimize = () => {
    setPeek(false);
    if (!toolsOpen) useShell.getState().setVideoChatMin(true);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  /** Create a new session (a video in a project belongs to that project; otherwise it belongs to none), switch to it, then send the first message (same as the start page's `onSend`). */
  const startConversation = async (text: string, attachments: AttachmentRef[], skills: SkillSendRef[], videoKey: string) => {
    // The editor state is captured before leaving Space. Reference tags only recognize the video currently on screen.
    const context = await editor.capture();
    let conversationId: Id | null = null;
    try {
      // Pass only what was chosen on the draft. Anything not chosen is supplied by the Runtime according to preferences. A chosen access mode is also recorded as the default for new sessions.
      const conversation = await runtime.createConversation(projectId, {
        ...(owner && ownerKnown ? { folderOf: owner } : {}),
        ...(draftMode ? { accessMode: draftMode } : {}),
        ...(choice?.driverId ? { driverId: choice.driverId } : {}),
        ...(choice && 'model' in choice ? { model: choice.model ?? null } : {}),
        ...(choice && 'effort' in choice ? { effort: choice.effort ?? null } : {}),
      });
      conversationId = conversation.id;
      if (draftMode && draftMode !== defaultMode) void setDefaultAccessMode(runtime, draftMode).catch(() => {});
      const shell = useShell.getState();
      shell.setDraftAccessMode(draftKey, null);
      shell.setDraftAgent(draftKey, null);
      shell.setVideoChat(videoKey, conversation.id);
      // The editor does not follow: “Open editor” on the video card opens it again.
      shell.go({ tab: 'home', conversationId: conversation.id, projectId: null });
      await runtime.send(
        conversation.id,
        text,
        context,
        attachments.map((a) => a.id),
        undefined,
        skills,
      );
      editor.reset();
      return true;
    } catch (error) {
      ToastQueue.negative(sendFailureMessage(error), { timeout: 5000 });
      // Once the session is built and the user has been switched to it, the message, images and picked skill go back into that session's input box, so the user's input is not lost.
      if (conversationId) {
        useShell.getState().setDraft(conversationId, text);
        useDraftImages.getState().move(draftKey, conversationId);
        useDraftSkills.getState().move(draftKey, conversationId);
        return true;
      }
      // If the session fails to build, the original text goes back into the input box and the user stays in the editor.
      return false;
    }
  };

  // Pressing Esc in the input collapses it. When the completion popup is open, Esc closes the popup first.
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    if (event.key !== 'Escape' || event.defaultPrevented || target.getAttribute('role') !== 'textbox') return;
    if (target.getAttribute('aria-expanded') === 'true') return;
    event.preventDefault();
    minimize();
  };

  if (min) {
    const status = watched ? sessionStatus(watched) : null;
    return (
      <div className={dock({ isOpen: false })}>
        <TooltipTrigger>
          <RACButton
            ref={triggerRef}
            className={(state) => trigger(state)}
            aria-label={COPY.expand}
            onPress={() => {
              setOpened(true);
              if (toolsOpen) setPeek(true);
              else useShell.getState().setVideoChatMin(false);
            }}>
            <Comment />
            {status ? <span className={dot({ status })} /> : null}
          </RACButton>
          <Tooltip>{COPY.expand}</Tooltip>
        </TooltipTrigger>
      </div>
    );
  }

  return (
    <aside className={`${dock({ isOpen: true })} ${panel}`} aria-label={COPY.label} onKeyDown={onKeyDown}>
      <div className={head}>
        <span className={title}>{COPY.fresh}</span>
        <TooltipTrigger>
          <ActionButton isQuiet size="S" aria-label={COPY.minimize} onPress={minimize}>
            <Minimize />
          </ActionButton>
          <Tooltip>{COPY.minimize}</Tooltip>
        </TooltipTrigger>
      </div>
      <div className={body}>
        <Composer
          draftKey={draftKey}
          driverId={driver?.id ?? null}
          model={model}
          effort={effort}
          lockedTo={null}
          onAgentChange={(change) => useShell.getState().setDraftAgent(draftKey, applyAgentChange(choice, driver?.id ?? null, change))}
          accessMode={draftMode ?? defaultMode ?? DEFAULT_AGENT_MODE}
          onAccessModeChange={(accessMode) => useShell.getState().setDraftAccessMode(draftKey, accessMode)}
          busy={false}
          quietSend
          placeholder={COPY.placeholder}
          autoFocus={opened}
          reference={editor.reference}
          mentionScope={{ projectId, conversationId: null }}
          onSend={async (text, attachments, skills) => {
            // If the video is not loaded yet (so its project is unknown), do not send. The text stays in the input.
            if (!source || !key) return false;
            return startConversation(text, attachments, skills, key);
          }}
        />
      </div>
      {guide ? (
        <div className={gate}>
          <AgentGateLine guide={guide} />
        </div>
      ) : null}
    </aside>
  );
}
