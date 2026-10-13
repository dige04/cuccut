import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_AGENT_MODE, RpcError, type AgentMode, type DriverInfo, type Id, type VideoRef } from '@cuccut/protocol';
import { ActionButton, Link, Picker, PickerItem, Radio, RadioGroup, Text, ToastQueue } from '@react-spectrum/s2';
import Code from '@react-spectrum/s2/icons/Code';
import InfoCircle from '@react-spectrum/s2/icons/InfoCircle';
import { iconStyle, style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { AGENT_PICKER, SKILL_COPY } from '../../copy.ts';
import { applyAgentChange, draftSelection, harnessLabel, type AgentChange, type AgentChoice } from '../../model/agent-choice.ts';
import { handoffHint, sessionOptions, TOOL_SKILL, toolDraftKey, type AgentToolId, type AiToolId, type SessionOption } from '../../model/ai-tools.ts';
import { currentConversation, messageCount } from '../../model/ai-tools-handoff.ts';
import { gateGuide, homeGate, type GateGuide } from '../../model/home-brief.ts';
import { targetKey } from '../../model/workspace.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { defaultDriver, useConnection } from '../../state/connection-store.ts';
import { useDirectory } from '../../state/directory-store.ts';
import type { AiToolRunner } from '../../state/ai-tool-runner-store.ts';
import { useSetting } from '../../state/settings-store.ts';
import { routeVideo, useShell } from '../../state/shell-store.ts';
import { useTimeline } from '../../state/timeline-store.ts';
import { useVideo } from '../../state/video-store.ts';
import { Composer } from '../composer.tsx';
import { ComposerToken, composerTokenList } from '../composer-token.tsx';
import { S } from '../shell-copy.ts';
import { useSkillsLoader } from '../use-skills.ts';
import { AgentGateLine } from './agent-gate-line.tsx';
import { contextItems, contextLine, directBlocked, directCta, directHint, type DirectContext } from './ai-tool-direct.ts';
import { attachAiToolSkill, detachAiToolSkill, restoreAiToolPrompt, setAiToolPrompt, useAiToolPrompts, useAiToolSkills } from './ai-tool-run.ts';
import { AI_TOOLS_COPY as C } from './ai-tools-copy.ts';
import { handToAgent, type Handoff } from './ai-tools-handoff.ts';

const row = style({ display: 'flex', alignItems: 'start', gap: 8 });
const rowLabel = style({ flexShrink: 0, width: 56, paddingTop: 4, font: 'ui-sm', color: 'gray-700' });
const rowBody = style({ display: 'flex', flexDirection: 'column', gap: 4, flexGrow: 1, minWidth: 0 });
const hint = style({ margin: 0, font: 'ui-xs', color: 'gray-600', lineHeight: '[1.5]' });
const field = style({ width: 'full' });
const box = style({ display: 'flex', flexDirection: 'column', marginTop: 16 });
const boxHead = style({ display: 'flex', alignItems: 'center', gap: 8, minHeight: 24, marginBottom: 4 });
const boxTitle = style({ flexGrow: 1, font: 'detail', fontWeight: 'bold', color: 'gray-700' });
const notice = style({ display: 'flex', alignItems: 'start', gap: '[6px]', marginTop: 8, font: 'ui-xs', color: 'gray-700', lineHeight: '[1.5]' });
const noticeIcon = iconStyle({ size: 'S' });

/** Everything needed when this video is handed to an Agent: which conversation it goes to, and which Agent · model · effort and access mode (shared by the 「用」 (Use) and 「会话」 (Conversation) rows of the parameters page and by the prompt box). */
export interface ToolHandoff {
  ref: VideoRef | null;
  /** The guidance shown when no Agent is available (the 「用」 row and the card at the top of the list page). */
  guide: GateGuide | null;
  options: SessionOption[];
  /** The selected item; null when the video is not in any project or conversation. */
  session: SessionOption | null;
  setSession(key: SessionOption['key']): void;
  driver: DriverInfo | null;
  driverId: DriverInfo['id'] | null;
  model: string | null;
  effort: string | null;
  lockedTo: DriverInfo['id'] | null;
  onAgentChange(change: AgentChange): void;
  accessMode: AgentMode;
  onAccessModeChange(mode: AgentMode): void;
  /** New conversation: the access mode and Agent · model · effort chosen on this page. */
  create: { accessMode?: AgentMode; driverId?: DriverInfo['id']; model?: string | null; effort?: string | null };
}

/**
 * The state of 「交给智能体」 (Hand to agent) on the parameters page (product design §5.10): 「会话」 (Conversation) defaults to a new conversation; when this video has conversations that have already spoken, an extra option 「接着」 (Continue) appears, stating how many messages there are;
 * for a new conversation, the Agent and access mode are this page's own choices (like the floating conversation's draft, but not persisted); when continuing one conversation, that conversation's settings apply, and changing them changes that conversation directly.
 */
export function useToolHandoff(): ToolHandoff {
  const runtime = useRuntime();
  const ref = useVideo((s) => s.video?.ref ?? null);
  const source = ref?.source ?? null;
  const drivers = useConnection((s) => s.drivers);
  const checking = useConnection((s) => s.checking);
  const guide = gateGuide(homeGate(drivers, checking));
  const conversations = useDirectory((s) => s.conversations);
  // 「当前」 (Current): the conversation on the left of Home, or the one most recently started by this video's floating conversation in Space.
  const current = useShell((s) => {
    if (s.route.tab === 'home') return s.route.conversationId;
    const shown = routeVideo(s.route);
    return s.route.tab === 'space' && shown ? (s.videoChats[targetKey(shown)] ?? null) : null;
  });
  const candidate = useMemo(() => currentConversation({ source, current, conversations }), [source, current, conversations]);
  const candidateId = candidate?.id ?? null;
  // Message counts are read from the conversation's timeline: watch it (reference-counted; shared with the conversation page when that is watching too).
  useEffect(() => (candidateId ? runtime.watchConversation(candidateId) : undefined), [runtime, candidateId]);
  const items = useTimeline((s) => (candidateId ? s.byConversationId[candidateId]?.items : undefined));
  const messages = items ? messageCount(items) : null;
  const locked = !!items?.some((i) => i.kind === 'task');
  const { options, fallback } = sessionOptions({
    // For a video not in any project: a new conversation shares a working directory with the conversation it sits in (architecture design §3.10), so that conversation must still exist.
    canCreate: !!source?.projectId || (!!source?.conversationId && conversations.some((c) => c.id === source.conversationId)),
    current: candidate ? { id: candidate.id, title: candidate.title, messages } : null,
  });
  const [picked, setPicked] = useState<SessionOption['key'] | null>(null);
  const session = options.find((o) => o.key === picked) ?? options.find((o) => o.key === fallback) ?? null;
  const onCurrent = session?.key === 'current' && candidate ? candidate : null;

  // New conversation: the choices made on this page; if none were made, follow the default in settings.
  const [choice, setChoice] = useState<AgentChoice | undefined>(undefined);
  const [mode, setMode] = useState<AgentMode | null>(null);
  const defaultMode = useSetting('agent.defaultAccessMode') ?? DEFAULT_AGENT_MODE;
  const fresh =
    choice?.driverId && checking.includes(choice.driverId)
      ? null
      : (drivers?.find((d) => d.id === choice?.driverId) ?? defaultDriver(drivers, checking));
  const freshSelection = draftSelection(fresh, choice);

  const driver = onCurrent ? (drivers?.find((d) => d.id === onCurrent.driverId) ?? null) : fresh;
  const update = (id: Id, patch: Parameters<typeof runtime.updateConversation>[1], failed: (message: string) => string) =>
    void runtime.updateConversation(id, patch).catch((error: Error) => {
      const message = error instanceof RpcError && error.code === 'conflict' ? AGENT_PICKER.locked : failed(error.message);
      ToastQueue.negative(message, { timeout: 5000 });
    });
  return {
    ref,
    guide,
    options,
    session,
    setSession: setPicked,
    driver,
    driverId: onCurrent ? onCurrent.driverId : (fresh?.id ?? choice?.driverId ?? null),
    model: onCurrent ? onCurrent.model : freshSelection.model,
    effort: onCurrent ? onCurrent.effort : freshSelection.effort,
    lockedTo: onCurrent && locked ? onCurrent.driverId : null,
    onAgentChange: (change) =>
      onCurrent ? update(onCurrent.id, change, S.conversationView.switchFailed) : setChoice((c) => applyAgentChange(c, fresh?.id ?? null, change)),
    accessMode: onCurrent ? (onCurrent.accessMode ?? defaultMode) : (mode ?? defaultMode),
    onAccessModeChange: (next) => (onCurrent ? update(onCurrent.id, { accessMode: next }, S.conversationView.accessModeFailed) : setMode(next)),
    create: {
      ...(mode ? { accessMode: mode } : {}),
      ...(choice?.driverId ? { driverId: choice.driverId } : {}),
      ...(choice && 'model' in choice ? { model: choice.model ?? null } : {}),
      ...(choice && 'effort' in choice ? { effort: choice.effort ?? null } : {}),
    },
  };
}

/**
 * The 「用」 (Use) row on the parameters page: hand to the Agent (showing 「家 · 模型」 (Agent family · model), the same as the chip on the prompt box's bottom bar), or call a model directly (showing which text model).
 * For a tool that cannot call a model directly, that item is greyed out with the reason below; when handing to an Agent with no usable Agent, a way to fix it is given.
 */
export function AgentUseRow({
  handoff,
  tool,
  runner = 'agent',
  onRunner,
  modelName = null,
}: {
  handoff: ToolHandoff;
  tool: AgentToolId;
  runner?: AiToolRunner;
  onRunner?(runner: AiToolRunner): void;
  modelName?: string | null;
}) {
  const blocked = directBlocked(tool);
  return (
    <div className={row}>
      <span className={rowLabel}>{C.who}</span>
      <div className={rowBody}>
        <RadioGroup aria-label={C.who} size="S" value={runner} onChange={(value) => onRunner?.(value as AiToolRunner)}>
          <Radio value="agent">
            {C.whoAgent} · {harnessLabel(handoff.driver, handoff.model)}
          </Radio>
          <Radio value="model" isDisabled={!!blocked || !onRunner}>
            {runner === 'model' && modelName ? `${C.whoModel} · ${modelName}` : C.whoModel}
          </Radio>
        </RadioGroup>
        {blocked ? <p className={hint}>{blocked}</p> : null}
        {runner === 'model' && tool === 'polish' ? <p className={hint}>{C.modelPolishNote}</p> : null}
        {runner === 'agent' && handoff.guide ? <AgentGateLine guide={handoff.guide} /> : null}
      </div>
    </div>
  );
}

/** The 「会话」 (Conversation) row: a new conversation (default) or continue this video's current conversation; each option has a sentence below it stating its cost. */
export function SessionRow({ handoff }: { handoff: ToolHandoff }) {
  if (!handoff.session) return null;
  return (
    <div className={row}>
      <span className={rowLabel}>{C.session}</span>
      <div className={rowBody}>
        <Picker
          aria-label={C.session}
          size="S"
          styles={field}
          selectedKey={handoff.session.key}
          onSelectionChange={(key) => key && handoff.setSession(key as SessionOption['key'])}>
          {handoff.options.map((o) => (
            <PickerItem key={o.key} id={o.key} textValue={o.label}>
              <Text slot="label">{o.label}</Text>
              <Text slot="description">{o.sub}</Text>
            </PickerItem>
          ))}
        </Picker>
      </div>
    </div>
  );
}

/** What the prompt box needs when calling a model directly (the tool page holds the model and the run; see ai-tools-agent-page.tsx). */
export interface DirectPrompt {
  context: Omit<DirectContext, 'attachments' | 'skills'>;
  model: { name: string | null; local: boolean; ready: boolean };
  /** The text-model picker on the right of the bottom bar. */
  picker: ReactNode;
  /** The gate under the box when the selected model cannot be used. */
  gate: ReactNode;
  /** When the model cannot be used and the main button is pressed: say what is missing and bring the gate into view; the button is not greyed out. */
  onNotReady(): void;
  onStart(prompt: string, attachments: Id[], skills: string[]): Promise<boolean>;
}

/**
 * The prompt box and main button on the parameters page (prototype tool-prompt.jsx, product design §5.10 paragraphs 3 and 4): pre-filled with a template (if it has not been edited, it follows the range and checkbox options; once edited, 「恢复默认」 (Restore default) appears), with this tool's built-in skill attached by default (marked 「这个工具的做法」 (this tool's method); if removed, a line under the box explains and offers to add it back),
 * 「+ › 使用 Skill」 (+ › Use Skill) attaches others (appended after, not duplicated if already attached; re-adding the built-in one is also appended, like prototype `addSkill`), and each can be removed individually;
 * the bottom bar holds the access mode and 「家 · 模型」 (Agent family · model) (the same as the 「用」 row). Pressing it hands off according to the 「会话」 (Conversation) row; attached skills are sent together in order (`conversations.send`'s `skills`), and `onDone` returns to the list. Tools given `onHandedOff` (finding cut points, refreshing stale translations) do not switch to the conversation; they draw their progress in place.
 * When 「用」 (Use) is set to call a model directly (`direct`): the bottom bar becomes the text-model picker; under the box, two lines say that the attached skills are used as the system prompt and what context is sent to the model; the main button states this tool's action,
 * and pressing it has the tool page submit the `ai-tool` flow, staying in place to show progress and results.
 */
export function AiToolPrompt({
  videoId,
  tool,
  template,
  handoff,
  isDisabled,
  onDone,
  onHandedOff,
  onSent,
  direct,
  target,
  hint,
}: {
  videoId: Id;
  tool: AiToolId;
  template: string;
  handoff: ToolHandoff;
  isDisabled?: boolean;
  onDone(): void;
  /** Stay on the page (`agentStaysOnPage`): after handing off, do not switch to the conversation or back to the list; the tool page draws the progress card. If the message was not actually sent (it was put into the conversation's input box), `onDone` is still called as usual. */
  onHandedOff?(handoff: Handoff): void;
  /** The message was really sent (not just put into the input box): cut into a short video, record this round, and switch to the result page when it finishes. Called before `onDone` / `onHandedOff`. */
  onSent?(handoff: Handoff): void;
  /** When 「用」 (Use) is set to call a model directly: the bottom bar becomes the text-model picker, and under the box two more lines appear (the skills as system prompt, and what is sent to the model); pressing it goes through the `ai-tool` flow. */
  direct?: DirectPrompt | null;
  /** Does not follow the 「会话」 (Conversation) row; always sent to a fixed place (for cutting a short video: always start a new one; if the video does not belong to a project, send it to the conversation it sits in). */
  target?: 'new' | { id: Id };
  /** The destination line under the main button; when not given, it follows the 「会话」 (Conversation) row. */
  hint?: string;
}) {
  const runtime = useRuntime();
  const draftKey = toolDraftKey(videoId, tool);
  // An edited prompt is not kept in component state: the run state, result and receipt pages replace this box, and so does going back to the list; it must survive 「完成」 (Done) or coming back (ai-tool-run.ts).
  const edited = useAiToolPrompts((s) => s.prompts[draftKey]);
  const builtin = TOOL_SKILL[tool] ?? null;
  // Same for attached skills: built-in skills that were removed, and skills attached later, must survive 「完成」 (Done) or coming back; if nothing was saved, it is this tool's default built-in skill.
  const defaultSkills = useMemo(() => (builtin ? [builtin] : []), [builtin]);
  const skillIds = useAiToolSkills((s) => s.skills[draftKey]) ?? defaultSkills;
  const attachSkill = (id: string) => attachAiToolSkill(draftKey, id, defaultSkills);
  const catalog = useSkillsLoader();
  const nameOf = (id: string) => catalog.skills.find((s) => s.id === id)?.name ?? id;
  const session = handoff.session;
  const text = edited ?? template;

  const tokens = skillIds.length ? (
    <div className={composerTokenList}>
      {skillIds.map((id) => (
        <ComposerToken
          key={id}
          icon={<Code />}
          label={SKILL_COPY.token(nameOf(id))}
          {...(id === builtin ? { note: C.skillNote } : {})}
          removeLabel={SKILL_COPY.remove(nameOf(id))}
          onRemove={() => detachAiToolSkill(draftKey, id, defaultSkills)}
        />
      ))}
    </div>
  ) : null;
  const noSkill = builtin && !skillIds.includes(builtin) ? (
    <p className={notice}>
      <InfoCircle styles={noticeIcon} />
      <span>
        {C.noSkill}{' '}
        <Link variant="secondary" onPress={() => attachSkill(builtin)}>
          {C.addSkillBack}
        </Link>
      </span>
    </p>
  ) : null;
  // Calling a model directly: when skills are attached, say how they are sent; then one line stating the context sent to the model (the attachment count comes from the input box).
  const skillsNotice =
    direct && skillIds.length ? (
      <p className={notice}>
        <InfoCircle styles={noticeIcon} />
        <span>{C.skillsAsSystem}</span>
      </p>
    ) : null;
  const contextNotice = direct
    ? ({ count, images }: { count: number; images: number }) => (
        <p className={notice}>
          <InfoCircle styles={noticeIcon} />
          <span>
            {contextLine(contextItems({ ...direct.context, attachments: count, skills: skillIds.map(nameOf) }))}
            {images ? C.contextImages(images) : ''}
          </span>
        </p>
      )
    : undefined;

  return (
    <div className={box}>
      <div className={boxHead}>
        <span className={boxTitle}>{direct ? C.modelPromptLabel : C.promptLabel}</span>
        {edited !== undefined ? (
          <ActionButton isQuiet size="XS" onPress={() => restoreAiToolPrompt(draftKey)}>
            {C.restoreDefault}
          </ActionButton>
        ) : null}
      </div>
      <Composer
        draftKey={draftKey}
        // Calling a model directly does not go through an Agent: do not gate sending on the Agent's state, and do not show an Agent picker.
        driverId={direct ? null : handoff.driverId}
        model={handoff.model}
        effort={handoff.effort}
        lockedTo={handoff.lockedTo}
        onAgentChange={handoff.onAgentChange}
        accessMode={handoff.accessMode}
        onAccessModeChange={handoff.onAccessModeChange}
        busy={false}
        placeholder={C.promptPlaceholder}
        mentionScope={{ projectId: handoff.ref?.source?.projectId ?? null, conversationId: handoff.ref?.source?.conversationId ?? null }}
        onSend={async () => false}
        tool={
          direct
            ? {
                text,
                onText: (next) => setAiToolPrompt(draftKey, next, template),
                tokens,
                onSkill: attachSkill,
                notice: (
                  <>
                    {noSkill}
                    {skillsNotice}
                    {direct.gate}
                  </>
                ),
                picker: direct.picker,
                context: contextNotice,
                cta: directCta(direct.context.tool),
                hint: directHint({ tool: direct.context.tool, model: direct.model.name, local: direct.model.local }),
                isDisabled: isDisabled || !handoff.ref,
                onStart: async (message, attachments) => {
                  if (!direct.model.ready) {
                    direct.onNotReady();
                    return false;
                  }
                  return direct.onStart(
                    message,
                    attachments.map((a) => a.id),
                    skillIds,
                  );
                },
              }
            : {
                text,
                onText: (next) => setAiToolPrompt(draftKey, next, template),
                tokens,
                onSkill: attachSkill,
                notice: noSkill,
                cta: C.cta,
                hint: hint ?? handoffHint(session?.key ?? 'new'),
                isDisabled: isDisabled || (!target && !session) || !!handoff.guide || !handoff.ref,
                onStart: (message, attachments) =>
                  handToAgent(runtime, {
                    video: handoff.ref,
                    session: target ?? (session?.key === 'current' && session.conversationId ? { id: session.conversationId } : 'new'),
                    text: message,
                    attachments,
                    skills: skillIds.map((id) => ({ id })),
                    create: handoff.create,
                    draftKey,
                    stay: !!onHandedOff,
                  }).then((result) => {
                    if (result && !result.drafted) onSent?.(result);
                    if (result && onHandedOff && !result.drafted) onHandedOff(result);
                    else if (result) onDone();
                    return !!result;
                  }),
              }
        }
      />
    </div>
  );
}
