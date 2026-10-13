import { DraftAttachmentPreview } from './media/draft-attachment-preview.tsx';
import { P as PLAYER_COPY } from './player/player-copy.ts';
import { IMAGE as IMAGE_COPY } from './image-preview-copy.ts';
import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type ComponentRef,
  type ComponentType,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import {
  ATTACHMENT_MIME_TYPES,
  MAX_ATTACHMENTS_PER_MESSAGE,
  localizeText,
  type AgentMode,
  type AttachmentRef,
  type DriverId,
  type SkillSendRef,
} from '@cuccut/protocol';
import {
  Attachment,
  AttachmentPreview,
  InsertTextMenuItem,
  PromptField,
  PromptFieldAttachmentList,
  PromptFieldToolbar,
  PromptTokenField,
  type PromptFieldAttachment,
  type PromptFieldValue,
} from '@react-spectrum/ai';
import {
  ActionButton,
  Button,
  Header,
  Heading,
  Menu,
  MenuItem,
  MenuSection,
  MenuTrigger,
  SubmenuTrigger,
  Text,
  ToastQueue,
} from '@react-spectrum/s2';
import Add from '@react-spectrum/s2/icons/Add';
import AudioWave from '@react-spectrum/s2/icons/AudioWave';
import ArrowUpSend from '@react-spectrum/s2/icons/ArrowUpSend';
import Close from '@react-spectrum/s2/icons/Close';
import CloseCaptions from '@react-spectrum/s2/icons/CloseCaptions';
import Code from '@react-spectrum/s2/icons/Code';
import Asset from '@react-spectrum/s2/icons/Asset';
import Edit from '@react-spectrum/s2/icons/Edit';
import Export from '@react-spectrum/s2/icons/Export';
import Attach from '@react-spectrum/s2/icons/Attach';
import FileText from '@react-spectrum/s2/icons/FileText';
import Folder from '@react-spectrum/s2/icons/Folder';
import Filmstrip from '@react-spectrum/s2/icons/Filmstrip';
import ImageIcon from '@react-spectrum/s2/icons/Image';
import ListBulleted from '@react-spectrum/s2/icons/ListBulleted';
import MagicWand from '@react-spectrum/s2/icons/MagicWand';
import Microphone from '@react-spectrum/s2/icons/Microphone';
import MovieCamera from '@react-spectrum/s2/icons/MovieCamera';
import Redo from '@react-spectrum/s2/icons/Redo';
import Refresh from '@react-spectrum/s2/icons/Refresh';
import Settings from '@react-spectrum/s2/icons/Settings';
import Star from '@react-spectrum/s2/icons/Star';
import StopProcessing from '@react-spectrum/s2/icons/StopProcessing';
import TextIcon from '@react-spectrum/s2/icons/Text';
import TranscriptIcon from '@react-spectrum/s2/icons/Transcript';
import Translate from '@react-spectrum/s2/icons/Translate';
import Tools from '@react-spectrum/s2/icons/Tools';
import Video from '@react-spectrum/s2/icons/Video';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { S } from './shell-copy.ts';
import { COMPOSER_COPY } from './composer-copy.ts';
import {
  AGENT_PICKER,
  ATTACHMENT_COPY,
  COMPOSER_MENU,
  QUEUE_COPY,
  DRIVER_STATE_REASON,
  HOME_COPY,
  MENTION_GROUPS,
  SKILL_COPY,
  SLASH_COMMANDS,
  accessModeToast,
  composerFoot,
  type SlashCommand,
} from '../copy.ts';
import type { AgentChange } from '../model/agent-choice.ts';
import { skillMenuItems } from '../model/agent-skills.ts';
import { admitFiles, admitImages, rejectionMessage } from '../model/composer-attachments.ts';
import {
  COMPLETION_TRIGGER,
  activeCompletion,
  applySlash,
  mentionCandidates,
  slashMatches,
  videoMentionCandidates,
  type MentionCandidate,
  type MentionScope,
} from '../model/composer-completions.ts';
import { useRuntime } from '../runtime/context.tsx';
import type { MessageFile } from '../host.ts';
import { useDraftFileList, useDraftFiles } from '../state/draft-files-store.ts';
import { useConnection } from '../state/connection-store.ts';
import { useDraftSkillIds, useDraftSkills } from '../state/draft-skills-store.ts';
import { imageEntry, uploadDraftImages, useDraftImageList, useDraftImages, type DraftImage } from '../state/draft-images-store.ts';
import { useShell } from '../state/shell-store.ts';
import { useSpace } from '../state/space-store.ts';
import { AccessPicker } from './access-picker.tsx';
import { AgentPicker } from './agent-picker.tsx';
import { ComposerToken, composerTokenList } from './composer-token.tsx';
import { AnnotationsToken, type AnnotationTokenItem } from './annotations-token.tsx';
import { useVideoMentions } from './use-editor-reference.ts';
import { useNarrow } from './use-narrow.ts';
import { focusPromptEnd, usePromptValue } from './use-prompt-value.ts';
import { useSkillsLoader } from './use-skills.ts';

const wrap = style({
  // PromptTokenField's placeholder is the input area's own :empty::before, which inherits the body text colour by default; app.css uses this variable to lower it to gray-500 (prototype spectrum.css).
  '--cc-prompt-placeholder': { type: 'color', value: 'gray-500' },
  flexShrink: 0,
  width: 'full',
  maxWidth: { default: '[760px]', isStart: 'none' },
  marginX: 'auto',
  paddingX: { default: 24, isCompact: 12, isStart: 0 },
  paddingBottom: { default: 16, isStart: 0 },
  boxSizing: 'border-box',
  // The project tray on the start page sits under the input box, so the input box must overlay it.
  position: { isStart: 'relative' },
  zIndex: { isStart: 1 },
});
/** On the start page, an outline is drawn around the input box when a file is dragged over it (prototype spectrum.css `.cc-ai-home.is-over`). */
const dropZone = style({
  borderRadius: 'xl',
  outlineStyle: { default: 'none', isOver: 'solid' },
  outlineWidth: 2,
  outlineOffset: 2,
  outlineColor: 'blue-900',
});
/** The input box's own toolbar (prototype .cc-ai-toolbar): +, access mode; on the right, Agent · model and the send / stop button. */
const toolbar = style({ display: 'flex', alignItems: 'center', gap: { default: 8, isCompact: 4 }, width: 'full', minWidth: 0 });
const tags = style({ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 });
const tag = style({
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  maxWidth: 'full',
  height: 24,
  paddingStart: 8,
  borderRadius: 'default',
  backgroundColor: 'gray-100',
  font: 'ui-xs',
  color: 'gray-800',
  boxSizing: 'border-box',
});
const tagText = style({ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 });
const spacer = style({ flexGrow: 1 });
const insertMenu = style({ width: 280, maxWidth: '[calc(100vw - 32px)]' });
const toolCta = style({ width: 'full', marginTop: 8 });
const toolHint = style({ margin: 0, marginTop: '[6px]', font: 'ui-xs', color: 'gray-600', lineHeight: '[1.5]' });
const foot = style({ font: 'ui-xs', color: { default: 'gray-500', isError: 'negative' }, paddingX: 4, paddingTop: 4, minHeight: 16 });

/** Icon for slash commands (prototype data.js `agent.slash`). */
const SLASH_ICON: Record<SlashCommand['icon'], ComponentType> = {
  translate: Translate,
  sparkle: MagicWand,
  list: ListBulleted,
  captions: CloseCaptions,
  mic: Microphone,
  export: Export,
  redo: Redo,
  refresh: Refresh,
  wave: AudioWave,
  transcript: TranscriptIcon,
  text: TextIcon,
  star: Star,
  edit: Edit,
  image: ImageIcon,
};

const IMAGE_TYPES = [...ATTACHMENT_MIME_TYPES];

/** A group of unsent annotations above the composer (slides, design, or design system): they can be removed one by one or all at once. */
export interface ComposerAnnotations {
  items: readonly AnnotationTokenItem[];
  onRemove(id: string): void;
  onClear(): void;
}

export interface ComposerProps {
  /** Draft key: the session ID, or the draft key used for a new session. */
  draftKey: string;
  /** Which Agent this message is handed to: the one on the session, or the choice on the new-session draft, or else the default one. */
  driverId: DriverId | null;
  /** null = the Agent's default model. */
  model: string | null;
  /** null = the model's own default reasoning effort. */
  effort: string | null;
  /** Once the session has had a task, the Agent is fixed to this one. */
  lockedTo: DriverId | null;
  onAgentChange(change: AgentChange): void;
  /** Access mode (architecture design §3.12): an existing session uses the one on the session, and a new session uses the choice on the draft. It can be switched at any time and takes effect in the next turn. */
  accessMode: AgentMode;
  onAccessModeChange(mode: AgentMode): void;
  busy: boolean;
  /** Can still be sent while busy: it is queued until the current turn ends (session page). */
  queueWhileBusy?: boolean;
  stopping?: boolean;
  placeholder: string;
  autoFocus?: boolean;
  /** Scope of @ candidates: the project the session is in, or its own working directory. */
  mentionScope: MentionScope;
  /**   /**
   * Send. Images have already finished uploading; `skills` are the ones picked from “+ › 使用 Skill” (Use Skill), in the order they were attached (empty when none).
   * Returns false if it was not sent, and keeps the draft (including the picked skills).
   */
  onSend(text: string, attachments: AttachmentRef[], skills: SkillSendRef[]): Promise<boolean>;
  /**   /**
   * Preparation before sending (for example, having the open slides editor finish saving), run before the input box is cleared: while waiting, the text and attachments stay in the box, and the send button shows that it is in progress.
   * Returns false to skip sending; the draft is left as it is (the caller shows the message).
   */
  beforeSend?(): Promise<boolean>;
  onStop?(): void;
  /** Reference tag above the input box (product design §3.2.3): the editor state handed to the agent along with this message. Can be removed. */
  reference?: { label: string; description: string; onRemove(): void } | null;
  /**   /**
   * Above the input box: items attached from Space with “在会话中继续” (continue in session) that have not been sent yet (architecture design §5.7); they are handed to the agent with the next message.
   * The Runtime can only remove them all together (`conversations.update` with `pendingReferences: null`), so there is only one remove button.
   */
  spaceReferences?: { items: { id: string; label: string; description: string }[]; onClear(): void } | null;
  /**   /**
   * Above the input box: slide annotations added to the conversation from the slides tab that have not been sent yet (docs/design/slides §8.2), “幻灯片标注 · N 条” (slide annotations · N items).
   * When there are annotations, it can be sent even with an empty body (`onSend` receives an empty body, and the caller adds a sentence).
   */
  slideAnnotations?: ComposerAnnotations | null;
  /** Above the input box: design annotations added to the conversation from the design tab that have not been sent yet (docs/design/canvas §8.2), “设计稿标注 · N 条” (design annotations · N items); otherwise the same as `slideAnnotations`. */
  designAnnotations?: ComposerAnnotations | null;
  /** Above the input box: design system annotations added to the conversation from the design system tab that have not been sent yet (docs/design/canvas §10.6), “设计系统标注 · N 条” (design system annotations · N items); otherwise the same as `slideAnnotations`. */
  designSystemAnnotations?: ComposerAnnotations | null;
  /** Above the input box: messages queued to be sent. */
  queue?: ReactNode;
  /** Passed only for the new-session start page (prototype new-agent.jsx `AgentHero`); not passed inside a session, where the input area stays as it is. */
  start?: ComposerStart;
  /** Passed only for the prompt box on the AI tool parameters page (prototype tool-prompt.jsx); the body is held by the tool page and does not go into the session draft. */
  tool?: ComposerTool;
  /**
   * Send is neutral instead of yellow: the composer shares the view with the video editor, whose Export is the view's
   * one tinted action (docs/cuccut/AGENTCUT-DESIGN.md, "Render is the primary action").
   */
  quietSend?: boolean;
}

/**
 * Prompt box on the AI tool parameters page (product design §5.10, paragraphs 3 and 4 of the parameters page): the same input box. The body is the prompt held by the tool page (it is the template until edited, and it changes with the scope and checked options); there is no `/` (already inside a tool page), while `@` and attachments work as before; “+ › 使用 Skill” (Use Skill) attaches to the tool page's skill list.
 * There is no send button in the toolbar: the main button sits below the box, full width, with its action named, and one more line below it explains where pressing it leads. Enter inserts a newline and does not send.
 */
export interface ComposerTool {
  /** The text in the box: `defaultText` until it is edited. */
  text: string;
  /** Whether the user has edited the body. */
  onText(text: string): void;
  /** Above the body: the attached skills (drawn by the tool page itself, marking which one is this tool's approach). */
  tokens: ReactNode;
  /** One picked from “+ › 使用 Skill” (Use Skill): appended after the attached ones; skills already attached are not repeated. */
  onSkill(id: string): void;
  /** The note line between the box and the main button (the line shown when no skill is attached). */
  notice?: ReactNode;
  /**
 * When calling the model directly, the right side of the bottom bar is replaced with a text model picker (prototype tool-prompt.jsx `ToolModelPick`), and the access mode and Agent picker are not shown;
 * not passed when handing off to an Agent.
 */
  picker?: ReactNode;
  /** The line after the note and before the main button, written according to the attachments already in the box (`count` in total, of which `images` are images) (when calling the model directly, “发给模型的” (sent to the model)). */
  context?(attachments: { count: number; images: number }): ReactNode;
  /** The main button's label and the line below it explaining where it leads. */
  cta: string;
  hint: string;
  /** The main button cannot be pressed (the video is not open yet, no checked options are selected…). */
  isDisabled?: boolean;
  /** Pressing the main button: images have already finished uploading. Returns false if it was not handed off, and the attachments stay. */
  onStart(text: string, attachments: AttachmentRef[]): Promise<boolean>;
}

/** Start page input box: template tokens and assets, the “+” menu (files and folders, Use Skill, recent videos) and drag-and-drop; when the body is empty, whether it can be sent is decided by the attachments. */
export interface ComposerStart {
  /** Above the body: picked skills, the selected template, and local assets handed to the Agent (the start page draws the skill tags itself, lined up in one row with the templates). */
  tokens: ReactNode;
  /** Whether any Agent is usable; when none is, the access mode and Agent picker are hidden, and a guidance card replaces the area below the start page. */
  ready: boolean;
  /** Can be sent with an empty body if images or assets are attached (selecting only a template does not count). */
  canSendEmpty(imageCount: number): boolean;
  /** Local file and directory paths obtained from the unified picker or drag-and-drop. */
  onPaths(paths: readonly string[]): void;
  /**   /**
   * Fill-in items (template package spec §5.5): each increment returns focus to the input box and selects the next placeholder token after the cursor (searching from the start when it reaches the end).
   * The start page increments it when “填下一处” (fill next) is clicked after a prompt with placeholders is inserted; 0 = not yet requested.
   */
  selectSlot?: number;
  /** “+ › 最近的视频” (recent videos): pick one, and this session targets that existing video. This item does not appear when there are no videos to list. */
  recent: { items: readonly { id: string; label: string; description: string }[]; onPick(id: string): void };
}

/**
 * Input area (product design §3.2.3, prototype agent-thread.jsx `Composer`): S2 AI's PromptField handles the body, attached images, completion, sending and stopping;
 * the toolbar has “+” (files and folders, Use Skill, slash commands), access mode, and Agent · model · reasoning effort.
 * Enter sends, Shift+Enter inserts a newline; during IME composition, Enter only commits the text and does not send (TokenField commits only on insertParagraph).
 */
export function Composer(props: ComposerProps) {
  const { draftKey, driverId, model, effort, lockedTo, onAgentChange, accessMode, onAccessModeChange } = props;
  const { busy, queueWhileBusy, stopping, placeholder, autoFocus, mentionScope, onSend, beforeSend, onStop, reference, queue, start, tool, quietSend } = props;
  const spaceReferences = props.spaceReferences?.items.length ? props.spaceReferences : null;
  const slideAnnotations = props.slideAnnotations?.items.length ? props.slideAnnotations : null;
  const designAnnotations = props.designAnnotations?.items.length ? props.designAnnotations : null;
  const designSystemAnnotations = props.designSystemAnnotations?.items.length ? props.designSystemAnnotations : null;
  const runtime = useRuntime();
  const shellDraft = useShell((s) => s.drafts[draftKey] ?? '');
  const setShellDraft = useShell((s) => s.setDraft);
  // The tool page's prompt box: the body is held by the tool page and is not written to the session draft.
  const draft = tool ? tool.text : shellDraft;
  const setDraft = (key: string, text: string) => (tool ? tool.onText(text) : setShellDraft(key, text));
  const connected = useConnection((s) => s.state.status === 'connected');
  const drivers = useConnection((s) => s.drivers);
  // When no probe result is found for this Agent, always show “正在检测” (detecting): usually it is in `checking` (the first probe has not finished);
  // in rare cases it is in neither the results nor `checking` (this version of the Runtime does not register it), and it is also treated as detecting, with no separate state.
  // When there is a result but it is unusable (including an old “没登录” (not signed in) from the disk cache), it stays blocked as before; the background refresh after the Runtime starts will push a correction.
  const driver = drivers?.find((d) => d.id === driverId) ?? null;
  const entries = useSpace((s) => s.entries);
  const videoMentions = useVideoMentions(mentionScope);
  const images = useDraftImageList(draftKey);
  const files = useDraftFileList(draftKey);
  const [picking, setPicking] = useState(false);
  // The ones picked from “+ › 使用 Skill” (Use Skill) (stored by draft key, in attached order, without duplicates), and the skill list (fetched on attach and on reconnect).
  const skillIds = useDraftSkillIds(draftKey);
  const skills = useSkillsLoader();
  const skillName = (id: string) => skills.skills.find((s) => s.id === id)?.name ?? id;
  const [sending, setSending] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [prompt, setPrompt, selectSlot] = usePromptValue(draft, (text) => setDraft(draftKey, text));
  const ref = useRef<ComponentRef<typeof PromptField>>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const filePicker = useRef<HTMLInputElement>(null);
  const [previewAttachment, setPreviewAttachment] = useState<DraftImage | null>(null);
  useEffect(() => setPreviewAttachment(null), [draftKey]);
  // Keeps the 520px content breakpoint for normal padding (the start page has no padding); measures the outer frame, so that 24 / 12px padding does not make the threshold width flip back and forth.
  const compact = useNarrow(wrapRef, start ? 520 : 520 + 24 * 2, 'border-box');
  useEffect(() => {
    if (autoFocus) focusPromptEnd(ref.current?.UNSAFE_getDOMNode());
    // Focuses only once, when mounted, the same as native autoFocus.
  }, []);
  // Selects the next fill-in item (prototype ui.jsx PromptField's `selectSlot`): TokenField only writes a programmatically set selection back to the DOM while focused, so it focuses first and waits briefly before selecting.
  // After blur and refocus, TokenField resets the cursor to the end based on the DOM, so where to search from is recorded before focusing (the selected token, or the fragment the cursor is in).
  const slotTick = start?.selectSlot ?? 0;
  useEffect(() => {
    if (!slotTick) return undefined;
    const from = prompt.selectedRange.end.index;
    ref.current?.UNSAFE_getDOMNode()?.querySelector<HTMLElement>('[role="textbox"]')?.focus();
    const id = window.setTimeout(() => selectSlot(from), 60);
    return () => window.clearTimeout(id);
    // Only follows the count; the starting point takes the value from this render, and the selection is computed from the latest value in state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotTick]);

  const imagesOk = (driver?.capabilities.images ?? false) && runtime.host.supportsImageAttachments !== false;
  const driverReady = driver?.state === 'ready';
  const blocked = !connected
    ? S.composer.disconnected
    : driver && !driverReady
      ? S.composer.driverUnavailable(
          driver.name,
          localizeText(driver.detail, driver.detailRef) ?? DRIVER_STATE_REASON[driver.state as Exclude<typeof driver.state, 'ready'>],
        )
      : driver && images.some((i) => IMAGE_TYPES.includes(i.file.type as (typeof IMAGE_TYPES)[number])) && !imagesOk
        ? runtime.host.supportsImageAttachments === false
          ? COMPOSER_MENU.webFilesUnsupported
          : COMPOSER_MENU.imagesUnsupported(driver.name)
        : null;
  const uploading = images.some((image) => image.progress !== null);
  const hasText = draft.trim().length > 0;
  // Start page: when the body is empty, it can still be sent if images or assets are attached (selecting only a template is not enough).
  const hasContent =
    hasText ||
    !!files.length ||
    !!images.length ||
    !!slideAnnotations ||
    !!designAnnotations ||
    !!designSystemAnnotations ||
    (!!start && start.canSendEmpty(images.length));
  const ready = (!busy || !!queueWhileBusy) && !sending && !picking && !uploading && !blocked && !tool?.isDisabled;
  const canSend = ready && hasContent;
  // agentcut keeps Send at full tint while the prompt is only empty: pressing it then puts the caret in the field
  // instead of greying the view's one primary action out with no reason given.
  const waitsForText = ready && !hasContent;
  const [over, setOver] = useState(false);
  const dragDepth = useRef(0);

  const refocus = () =>
    // When the “+” menu closes, focus first returns to the button (the popover animation takes about 400ms, the same as InsertMenuButton), and then the cursor is put back at the end of the body.
    window.setTimeout(() => focusPromptEnd(ref.current?.UNSAFE_getDOMNode()), 400);

  const admit = (incoming: Pick<DraftImage, 'id' | 'file' | 'url'>[]) => {
    if (!incoming.length) return;
    const count = useDraftImages.getState().images[draftKey]?.length ?? 0;
    const { accepted, rejected } = (runtime.host.supportsFileAttachments ? admitFiles : admitImages)(
      count,
      incoming.map((entry) => ({ entry, type: entry.file.type, size: entry.file.size })),
    );
    const kept = new Set(accepted.map((a) => a.entry.id));
    for (const entry of incoming) if (!kept.has(entry.id)) URL.revokeObjectURL(entry.url);
    if (rejected)
      ToastQueue.negative(
        runtime.host.supportsFileAttachments
          ? rejected === 'size'
            ? PLAYER_COPY.tooLarge
            : HOME_COPY.materialsFull(MAX_ATTACHMENTS_PER_MESSAGE, incoming.length - accepted.length)
          : rejectionMessage(rejected),
        { timeout: 5000 },
      );
    useDraftImages.getState().add(
      draftKey,
      accepted.map((a) => a.entry),
    );
    setUploadError(null);
  };

  // PromptField handles paste and drag-and-drop itself (it accepts only the formats in acceptedAttachmentTypes) and removal via × on thumbnails; here we only validate and revoke preview URLs.
  const onAttachmentsChange = (next: PromptFieldAttachment[]) => {
    const nextIds = new Set(next.map((a) => a.id));
    const currentIds = new Set(images.map((i) => i.id));
    for (const image of images) if (!nextIds.has(image.id)) useDraftImages.getState().remove(draftKey, image.id);
    admit(next.filter((a) => !currentIds.has(a.id)).map((a) => ({ id: a.id, file: a.file, url: a.image })));
  };

  // Unified entry point: images use the upload channel; local files and directories are handed to the Agent as removable references.
  const addLocalFiles = (incoming: readonly MessageFile[]) => {
    if (start) start.onPaths(incoming.map((file) => file.path));
    else {
      const rejected = useDraftFiles.getState().add(draftKey, incoming);
      if (rejected) ToastQueue.neutral(HOME_COPY.materialsFull(MAX_ATTACHMENTS_PER_MESSAGE, rejected), { timeout: 5000 });
    }
  };
  const takeFiles = (incoming: File[]) => {
    if (!incoming.length) return;
    const asImage = (file: File) => imagesOk && IMAGE_TYPES.includes(file.type as (typeof IMAGE_TYPES)[number]);
    admit(incoming.filter(asImage).map(imageEntry));
    const rest = incoming.filter((file) => !asImage(file));
    if (!rest.length) return;
    if (runtime.host.supportsFileAttachments) {
      admit(rest.map(imageEntry));
      return;
    }
    if (!runtime.host.pickMessageFiles) {
      ToastQueue.neutral(
        runtime.host.supportsImageAttachments === false || imagesOk
          ? COMPOSER_MENU.webFilesUnsupported
          : driver
            ? COMPOSER_MENU.imagesUnsupported(driver.name)
            : AGENT_PICKER.detecting,
        { timeout: 5000 },
      );
      return;
    }
    const paths = rest.map((file) => runtime.host.pathForFile(file));
    if (paths.some((path) => !path)) ToastQueue.negative(HOME_COPY.notLocalFile, { timeout: 5000 });
    addLocalFiles(paths.filter(Boolean).map((path) => ({ path, kind: 'file' })));
  };
  const pickLocalFiles = async () => {
    if (picking) return;
    if (!runtime.host.pickMessageFiles) {
      filePicker.current?.click();
      return;
    }
    setPicking(true);
    try {
      const selected = await runtime.host.pickMessageFiles({
        title: COMPOSER_MENU.filesAndFolders,
        filesLabel: COMPOSER_MENU.files,
        foldersLabel: COMPOSER_MENU.folders,
        cancelLabel: QUEUE_COPY.cancel,
        images: imagesOk,
      });
      admit(
        selected.flatMap((entry) =>
          entry.image
            ? [
                imageEntry(
                  new File([new Uint8Array(entry.image.bytes)], entry.path.split(/[\\/]/).pop() || entry.path, {
                    type: entry.image.mimeType,
                  }),
                ),
              ]
            : [],
        ),
      );
      addLocalFiles(selected.filter((entry) => !entry.image));
    } catch (error) {
      ToastQueue.negative(COMPOSER_MENU.pickFailed((error as Error).message), { timeout: 5000 });
    } finally {
      setPicking(false);
      refocus();
    }
  };
  const carriesFiles = (event: DragEvent) => [...event.dataTransfer.types].includes('Files');
  const dropProps = {
    onDragEnterCapture: (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      event.stopPropagation();
      dragDepth.current++;
      setOver(true);
    },
    onDragOverCapture: (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = 'copy';
    },
    // Moving into a child element also fires dragleave: count the enter/leave depth, and only remove the outline once everything has left.
    onDragLeaveCapture: (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      event.stopPropagation();
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (!dragDepth.current) setOver(false);
    },
    onDropCapture: (event: DragEvent) => {
      if (!carriesFiles(event)) return;
      event.preventDefault();
      event.stopPropagation();
      dragDepth.current = 0;
      setOver(false);
      takeFiles([...event.dataTransfer.files]);
    },
    // Only intercepts pastes that carry files; pasted text still goes into the body as usual.
    onPasteCapture: (event: ClipboardEvent) => {
      const files = [...event.clipboardData.files];
      if (!files.length) return;
      event.preventDefault();
      event.stopPropagation();
      takeFiles(files);
    },
  };

  const send = async () => {
    if (!canSend) return;
    const originalText = draft.trim();
    const sentFiles = files.map((file) => file.path);
    const text = sentFiles.length
      ? [originalText, COMPOSER_MENU.filesMessage(sentFiles)].filter(Boolean).join('\n\n')
      : originalText || (!start && images.length ? COMPOSER_MENU.filesMessage(images.map((image) => image.file.name)) : '');
    setSending(true);
    setUploadError(null);
    let attachments: AttachmentRef[];
    try {
      attachments = images.length
        ? await uploadDraftImages(draftKey, (file, onProgress) => runtime.uploadAttachment(file, onProgress))
        : [];
    } catch (error) {
      // If the upload failed, the text and images are all kept, the failed image is marked red, and a footnote gives the reason; pressing send again re-uploads only those that did not go up.
      setUploadError(ATTACHMENT_COPY.uploadFailed((error as Error).message));
      setSending(false);
      return;
    }
    if (tool) {
      // Tool page: the body stays in the box (after it is handed off, the tool page returns to the list), and attachments are cleared only after handoff.
      try {
        if (await tool.onStart(text, attachments)) {
          useDraftImages.getState().clear(draftKey);
          useDraftFiles.getState().sent(draftKey, sentFiles);
        }
      } finally {
        setSending(false);
      }
      return;
    }
    if (beforeSend && !(await beforeSend().catch(() => false))) {
      setSending(false);
      return;
    }
    setDraft(draftKey, '');
    const picked = skillIds;
    try {
      const ok = await onSend(text, attachments, picked.map((id) => ({ id })));
      if (ok) {
        useDraftImages.getState().clear(draftKey);
        useDraftFiles.getState().sent(draftKey, sentFiles);
        // Once sent, the skills that were sent are removed along with it (any attached during this time are kept).
        for (const id of picked) useDraftSkills.getState().remove(draftKey, id);
      } else setDraft(draftKey, originalText);
    } finally {
      setSending(false);
      focusPromptEnd(ref.current?.UNSAFE_getDOMNode());
    }
  };

  const changeAccessMode = (mode: AgentMode) => {
    onAccessModeChange(mode);
    // Switching levels while a task is running: this turn still uses the level from when it was sent (prototype model-agent.js `modeToast`).
    if (busy) {
      const show = mode === 'fullAccess' ? ToastQueue.info : ToastQueue.neutral;
      show(accessModeToast(mode), { timeout: 5000 });
    }
  };

  const renderCompletions = (filterValue: string) => {
    const before = prompt.slice({ index: 0, offset: 0 }, prompt.caretPosition).toString();
    const active = activeCompletion(before);
    if (!active || active.raw !== filterValue) return null;
    if (active.kind === 'slash') {
      // No `/` on the tool page: you are already inside a tool.
      if (tool) return null;
      const matches = slashMatches(active.query);
      return matches.length ? matches.map((command) => <SlashItem key={command.cmd} command={command} insert />) : null;
    }
    const candidates = mentionCandidates(entries, mentionScope, active.query);
    // Chapters and speakers in the open video are listed first as a group (design model-agent.js `mentionItems`: this video first, then the others).
    const fromVideo = videoMentions ? videoMentionCandidates(videoMentions, active.query) : [];
    if (!candidates.length && !fromVideo.length) {
      return active.query
        ? null
        : [
            <MenuItem key="none" id="none" isDisabled textValue={COMPOSER_MENU.noMentionCandidates}>
              <Text slot="label">{COMPOSER_MENU.noMentionCandidates}</Text>
            </MenuItem>,
          ];
    }
    const item = (candidate: MentionCandidate) => (
      <InsertTextMenuItem key={candidate.id} id={candidate.id} text={candidate.insert} textValue={candidate.label}>
        <Text slot="label">{candidate.label}</Text>
        <Text slot="description">{candidate.description}</Text>
      </InsertTextMenuItem>
    );
    if (!fromVideo.length) return candidates.map(item);
    const group = (key: string, title: string, list: MentionCandidate[]) => (
      <MenuSection key={key} id={key}>
        <Header>
          <Heading>{title}</Heading>
        </Header>
        {list.map(item)}
      </MenuSection>
    );
    return [
      group('video', MENTION_GROUPS.video, fromVideo),
      ...(candidates.length ? [group('files', MENTION_GROUPS.files, candidates)] : []),
    ];
  };

  // agentcut's PromptComposer: Send is the one yellow capsule of the view (neutral beside the video editor, whose Export
  // is the primary); while a run is going, a neutral Stop sits before it, and Send stays only when a message can be
  // queued. Narrow composers keep the icons and drop the words.
  const stopLabel = stopping ? S.composer.stopping : S.composer.stop;
  // While a run is going the message waits its turn: agentcut names that button "Queue".
  const sendLabel = busy ? COMPOSER_COPY.queue : S.composer.send;
  const submit = (
    <>
      {busy ? (
        <Button
          variant="secondary"
          size="M"
          UNSAFE_className="cc-composer-send"
          isDisabled={!onStop || !connected || !!stopping}
          aria-label={stopLabel}
          onPress={() => onStop?.()}>
          <StopProcessing />
          {compact ? null : <Text>{stopLabel}</Text>}
        </Button>
      ) : null}
      {!busy || queueWhileBusy ? (
        <Button
          variant={quietSend ? 'secondary' : 'accent'}
          size="M"
          UNSAFE_className="cc-composer-send"
          isDisabled={!canSend && !waitsForText}
          aria-label={sendLabel}
          onPress={() => (waitsForText ? focusPromptEnd(ref.current?.UNSAFE_getDOMNode()) : void send())}>
          {busy ? <ListBulleted /> : <ArrowUpSend />}
          {compact ? null : <Text>{sendLabel}</Text>}
        </Button>
      ) : null}
    </>
  );

  const attachments: PromptFieldAttachment[] = images.map((image) => ({ id: image.id, file: image.file, image: image.url }));
  const byId = new Map(images.map((image) => [image.id, image]));
  const footText =
    blocked ??
    uploadError ??
    (driver ? composerFoot(driver.name, localizeText(driver.account, driver.accountRef) ?? null, accessMode) : AGENT_PICKER.detecting);
  // When narrow, the explanatory footnote is dropped (prototype compact), but the reason that blocks sending still shows.
  // The start page design has no footnote: only upload failures and reasons that block sending remain; when no Agent is usable, a guidance card sits below, so it is not repeated.
  // The tool page's prompt box has no footnote either (prototype tool-prompt.jsx): key hints do not apply (Enter inserts a newline, no `/`), and the destination is written below the main button.
  const showFoot = start
    ? !!uploadError || (!!blocked && start.ready)
    : tool
      ? !!uploadError || !!blocked
      : !(compact && !blocked && !uploadError);
  const showPickers = !start || start.ready;
  const accessPicker = <AccessPicker value={accessMode} compact={compact} onChange={changeAccessMode} />;

  // “+ › 使用 Skill ▸” (Use Skill) (prototype composer-insert-menu.jsx): all skills, enabled ones first; at the end, “管理 Skills…” (Manage Skills…) goes to settings.
  // When not yet fetched, failed to fetch, or there are none at all, there is only one line of explanation and “管理 Skills…” (Manage Skills…).
  const skillItems = skillMenuItems(skills.skills);
  const skillNote = !skills.loaded ? (skills.status === 'failed' ? SKILL_COPY.loadFailed : SKILL_COPY.loading) : SKILL_COPY.none;
  const skillMenu = (
    <SubmenuTrigger>
      <MenuItem id="skill" textValue={SKILL_COPY.use}>
        <MagicWand />
        <Text slot="label">{SKILL_COPY.use}</Text>
      </MenuItem>
      <Menu
        aria-label={SKILL_COPY.use}
        size="M"
        styles={insertMenu}
        onAction={(key) => {
          const id = String(key);
          if (id === 'manage') {
            useShell.getState().go({ tab: 'settings', section: 'skills' });
            return;
          }
          if (!id.startsWith('skill:')) return;
          if (tool) tool.onSkill(id.slice('skill:'.length));
          else useDraftSkills.getState().add(draftKey, id.slice('skill:'.length));
          refocus();
        }}
      >
        <MenuSection aria-label={SKILL_COPY.use}>
          {skillItems.length ? (
            skillItems.map((item) => (
              <MenuItem key={item.id} id={`skill:${item.id}`} textValue={item.name}>
                <Code />
                <Text slot="label">{item.name}</Text>
                {item.description ? <Text slot="description">{item.description}</Text> : null}
              </MenuItem>
            ))
          ) : (
            <MenuItem id="none" isDisabled textValue={skillNote}>
              <Text slot="label">{skillNote}</Text>
            </MenuItem>
          )}
        </MenuSection>
        <MenuSection aria-label={SKILL_COPY.manage}>
          <MenuItem id="manage" textValue={SKILL_COPY.manage}>
            <Settings />
            <Text slot="label">{SKILL_COPY.manage}</Text>
          </MenuItem>
        </MenuSection>
      </Menu>
    </SubmenuTrigger>
  );
  // When the “+” is opened, the skill list is re-fetched as well: skills just added or removed in another window also show up (the old list still shows as usual).
  const onInsertOpen = (open: boolean) => {
    if (open && connected) skills.retry();
  };

  // product-design §3.2.3: the two input areas share the same first attachment item; existing content continues to be referenced through @ completion.
  const insert = (
    <MenuTrigger align="start" direction="top" onOpenChange={onInsertOpen}>
      <ActionButton size="S" UNSAFE_className="cc-composer-attach" aria-label={COMPOSER_MENU.attachSection}>
        <Add />
      </ActionButton>
      <Menu
        aria-label={COMPOSER_MENU.attachSection}
        size="M"
        styles={insertMenu}
        onAction={(key) => {
          if (key === 'files') void pickLocalFiles();
        }}
      >
        <MenuSection aria-label={COMPOSER_MENU.attachSection}>
          <Header>{COMPOSER_MENU.attachSection}</Header>
          <MenuItem
            id="files"
            textValue={COMPOSER_MENU.filesAndFolders}
            isDisabled={picking || (!runtime.host.pickMessageFiles && runtime.host.supportsImageAttachments === false)}
          >
            <Attach />
            <Text slot="label">{COMPOSER_MENU.filesAndFolders}</Text>
            {!runtime.host.pickMessageFiles && runtime.host.supportsImageAttachments === false ? (
              <Text slot="description">{COMPOSER_MENU.webFilesUnsupported}</Text>
            ) : null}
          </MenuItem>
          {skillMenu}
          {start?.recent.items.length ? (
            <SubmenuTrigger>
              <MenuItem id="recent" textValue={HOME_COPY.recentVideos}>
                <Filmstrip />
                <Text slot="label">{HOME_COPY.recentVideos}</Text>
              </MenuItem>
              <Menu aria-label={HOME_COPY.recentVideos} size="M" styles={insertMenu} onAction={(key) => start.recent.onPick(String(key))}>
                {start.recent.items.map((item) => (
                  <MenuItem key={item.id} id={item.id} textValue={item.label}>
                    <Video />
                    <Text slot="label">{item.label}</Text>
                    <Text slot="description">{item.description}</Text>
                  </MenuItem>
                ))}
              </Menu>
            </SubmenuTrigger>
          ) : null}
        </MenuSection>
        {!start && !tool ? (
          <MenuSection aria-label={COMPOSER_MENU.slash}>
            <SubmenuTrigger>
              <MenuItem id="slash" textValue={COMPOSER_MENU.slash}>
                <Tools />
                <Text slot="label">{COMPOSER_MENU.slash}</Text>
              </MenuItem>
              <Menu
                aria-label={COMPOSER_MENU.slash}
                size="M"
                styles={insertMenu}
                onAction={(key) => {
                  setDraft(draftKey, applySlash(draft, String(key)));
                  refocus();
                }}
              >
                {SLASH_COMMANDS.map((command) => (
                  <SlashItem key={command.cmd} command={command} />
                ))}
              </Menu>
            </SubmenuTrigger>
          </MenuSection>
        ) : null}
      </Menu>
    </MenuTrigger>
  );

  return (
    <div ref={wrapRef} className={wrap({ isCompact: compact, isStart: !!start || !!tool })}>
      {queue}
      <input
        ref={filePicker}
        type="file"
        hidden
        multiple
        onChange={(event) => {
          const files = [...(event.currentTarget.files ?? [])];
          event.currentTarget.value = '';
          takeFiles(files);
          refocus();
        }}
      />
      <div
        data-composer={draftKey}
        data-composer-start={start ? '' : undefined}
        className={start || tool ? dropZone({ isOver: over }) : undefined}
        {...dropProps}
        onKeyDownCapture={tool ? (event) => toolEnter(event, prompt, setPrompt) : undefined}
      >
        <PromptField
          ref={ref}
          size="S"
          variant="subtle"
          value={prompt}
          onChange={setPrompt}
          attachments={attachments}
          onAttachmentsChange={onAttachmentsChange}
          acceptedAttachmentTypes={runtime.host.supportsFileAttachments ? ['*/*'] : imagesOk ? IMAGE_TYPES : undefined}
          onSubmit={() => void send()}
          isGenerating={busy}
          onStop={onStop}
          aiDisclaimer={<></>}
        >
          {start?.tokens}
          {tool?.tokens}
          {!!files.length && (
            <div className={composerTokenList}>
              {files.map((file) => (
                <ComposerToken
                  key={file.path}
                  icon={file.kind === 'directory' ? <Folder /> : <FileText />}
                  label={file.path.split(/[\\/]/).filter(Boolean).pop() || file.path}
                  title={file.path}
                  onOpen={() => {
                    if (file.kind === 'directory') {
                      void runtime.host.revealPath(file.path);
                      return;
                    }
                    const target = mentionScope.projectId
                      ? { projectId: mentionScope.projectId, path: file.path }
                      : mentionScope.conversationId
                        ? { conversationId: mentionScope.conversationId, path: file.path }
                        : null;
                    const external = () =>
                      runtime.host.openFile?.(file.path).then((error) => {
                        if (error) ToastQueue.negative(error);
                        else if (error === null) void runtime.host.revealPath(file.path);
                      });
                    if (!target) {
                      void external();
                      return;
                    }
                    void runtime
                      .resolveMedia(target)
                      .then(() => useShell.getState().openPane({ kind: 'file', target }))
                      .catch(() => void external());
                  }}
                  removeLabel={HOME_COPY.removeMaterial(file.path)}
                  onRemove={() => useDraftFiles.getState().remove(draftKey, file.path)}
                />
              ))}
            </div>
          )}
          {/* Skills picked on the session input box (the start page's are kept in start.tokens, in one row with the templates). */}
          {!start && !tool && skillIds.length ? (
            <div className={composerTokenList}>
              {skillIds.map((id) => (
                <ComposerToken
                  key={id}
                  icon={<Code />}
                  label={SKILL_COPY.token(skillName(id))}
                  removeLabel={SKILL_COPY.remove(skillName(id))}
                  onRemove={() => useDraftSkills.getState().remove(draftKey, id)}
                />
              ))}
            </div>
          ) : null}
          {reference || spaceReferences || slideAnnotations || designAnnotations || designSystemAnnotations ? (
            <div className={tags}>
              {reference ? (
                <span className={tag} title={reference.description}>
                  <MovieCamera />
                  <span className={tagText}>{reference.label}</span>
                  <ActionButton isQuiet size="XS" aria-label={S.composer.dropEditorState} onPress={reference.onRemove}>
                    <Close />
                  </ActionButton>
                </span>
              ) : null}
              {spaceReferences ? (
                <span className={tag} role="group" aria-label={S.composer.spaceEntries}>
                  <Asset />
                  {spaceReferences.items.map((item, index) => (
                    <span key={item.id} className={tagText} title={item.description}>
                      {index ? S.separator : ''}
                      {item.label}
                    </span>
                  ))}
                  <ActionButton isQuiet size="XS" aria-label={S.composer.dropSpaceEntries} onPress={spaceReferences.onClear}>
                    <Close />
                  </ActionButton>
                </span>
              ) : null}
              {slideAnnotations ? (
                <AnnotationsToken kind="slides" items={slideAnnotations.items} onRemove={slideAnnotations.onRemove} onClear={slideAnnotations.onClear} />
              ) : null}
              {designAnnotations ? (
                <AnnotationsToken kind="design" items={designAnnotations.items} onRemove={designAnnotations.onRemove} onClear={designAnnotations.onClear} />
              ) : null}
              {designSystemAnnotations ? (
                <AnnotationsToken
                  kind="design-system"
                  items={designSystemAnnotations.items}
                  onRemove={designSystemAnnotations.onRemove}
                  onClear={designSystemAnnotations.onClear}
                />
              ) : null}
            </div>
          ) : null}
          <div
            onClickCapture={(event) => {
              const target = event.target as HTMLElement;
              if (!target.closest('button'))
                target.closest('[role="row"]')?.querySelector<HTMLButtonElement>('.cc-composer-attachment-open')?.click();
            }}
            onKeyDownCapture={(event) => {
              const target = event.target as HTMLElement,
                button =
                  target.getAttribute('role') === 'row' ? target.querySelector<HTMLButtonElement>('.cc-composer-attachment-open') : null;
              if (event.key === 'Enter' && button) {
                event.preventDefault();
                event.stopPropagation();
                button.click();
              }
            }}
          >
            <PromptFieldAttachmentList dependencies={[images]}>
              {(attachment) => {
                const image = byId.get(attachment.id);
                return (
                  <Attachment
                    textValue={attachment.file.name}
                    aria-label={image?.error ?? attachment.file.name}
                    uploadProgress={image?.progress ?? undefined}
                    isInvalid={!!image?.error}
                  >
                    <ActionButton
                      slot={null}
                      isQuiet
                      aria-label={`${IMAGE_COPY.openAttachment}: ${attachment.file.name}`}
                      onPress={() => {
                        if (image) setPreviewAttachment(image);
                      }}
                      UNSAFE_className="cc-composer-attachment-open"
                    >
                      <AttachmentPreview
                        mimeType={attachment.file.type}
                        src={attachment.file.type.startsWith('image/') ? attachment.image : undefined}
                        alt={attachment.file.name}
                      />
                      {!attachment.file.type.startsWith('image/') && <span>{attachment.file.name}</span>}
                    </ActionButton>
                  </Attachment>
                );
              }}
            </PromptFieldAttachmentList>
          </div>
          <div role="group" aria-label={S.composer.message}>
            <PromptTokenField
              placeholder={placeholder}
              completionTrigger={COMPLETION_TRIGGER}
              renderCompletions={renderCompletions}
              menuWidth={320}
            />
          </div>
          <PromptFieldToolbar>
            <div className={toolbar({ isCompact: compact })}>
              {insert}
              {start || tool?.picker ? null : accessPicker}
              <span className={spacer} />
              {/* On the start page, following the design, the access mode sits on the right, next to the Agent picker; when no Agent is usable, both are hidden. */}
              {start && showPickers ? accessPicker : null}
              {tool?.picker ? tool.picker : null}
              {showPickers && !tool?.picker ? (
                <AgentPicker
                  drivers={drivers}
                  driverId={driverId}
                  model={model}
                  effort={effort}
                  lockedTo={lockedTo}
                  compact={compact}
                  onChange={onAgentChange}
                />
              ) : null}
              {tool ? null : submit}
            </div>
          </PromptFieldToolbar>
        </PromptField>
        {previewAttachment && (
          <DraftAttachmentPreview
            key={previewAttachment.id}
            entry={previewAttachment}
            entries={images}
            draftKey={draftKey}
            conversationId={mentionScope.conversationId}
            onClose={() => setPreviewAttachment(null)}
          />
        )}
      </div>
      {showFoot ? (
        <div className={foot({ isError: !blocked && !!uploadError })} role={uploadError ? 'alert' : undefined}>
          {footText}
        </div>
      ) : null}
      {tool ? (
        <>
          {tool.notice}
          {tool.context?.({ count: images.length, images: images.filter((i) => i.file.type.startsWith('image/')).length })}
          {/* The tool page sits in the editor's side panel, beside Export (the view's one tinted action): neutral. */}
          <Button variant="secondary" styles={toolCta} isDisabled={!canSend} isPending={sending} onPress={() => void send()}>
            {tool.cta}
          </Button>
          <p className={toolHint}>{tool.hint}</p>
        </>
      ) : null}
    </div>
  );
}

/**
 * In the prompt box, Enter inserts a newline and does not send (the main button sits below the box). PromptField always treats Enter as submit, so this intercepts it before PromptField;
 * when the completion popover is open (choosing a candidate), during IME composition, or with a modifier key, it is still passed to PromptField as usual.
 */
function toolEnter(event: KeyboardEvent<HTMLDivElement>, value: PromptFieldValue, setValue: (value: PromptFieldValue) => void) {
  const target = event.target as HTMLElement;
  if (event.key !== 'Enter' || event.shiftKey || event.altKey || event.metaKey || event.ctrlKey || event.nativeEvent.isComposing) return;
  if (target.getAttribute('role') !== 'textbox' || target.getAttribute('aria-expanded') === 'true') return;
  event.preventDefault();
  event.stopPropagation();
  const { start, end } = value.selectedRange;
  setValue(value.replaceRange(start, end, '\n'));
}

/** One slash-command line: icon, `/命令 · 标签` (/command · label), and a one-line subtitle. `insert`: used in the completion popover; selecting it replaces the /token being typed. */
function SlashItem({ command, insert }: { command: SlashCommand; insert?: boolean }) {
  const Icon = SLASH_ICON[command.icon];
  const content = (
    <>
      <Icon />
      <Text slot="label">{`${command.label} · ${command.cmd}`}</Text>
      <Text slot="description">{command.sub}</Text>
    </>
  );
  return insert ? (
    <InsertTextMenuItem id={command.cmd} text={command.cmd} textValue={command.cmd}>
      {content}
    </InsertTextMenuItem>
  ) : (
    <MenuItem id={command.cmd} textValue={command.cmd}>
      {content}
    </MenuItem>
  );
}
