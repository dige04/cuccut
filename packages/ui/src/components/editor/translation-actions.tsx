import { useMemo, type RefObject } from 'react';
import type { Id } from '@cuccut/protocol';
import { ActionButton, ActionMenu, Menu, MenuItem, MenuSection, MenuTrigger, Text, ToastQueue, Tooltip, TooltipTrigger } from '@react-spectrum/s2';
import AIMark from '@react-spectrum/s2/icons/AIMark';
import Chat from '@react-spectrum/s2/icons/Chat';
import Checkmark from '@react-spectrum/s2/icons/Checkmark';
import Clock from '@react-spectrum/s2/icons/Clock';
import Copy from '@react-spectrum/s2/icons/Copy';
import Translate from '@react-spectrum/s2/icons/Translate';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { retranslatePrompt, TOOL_SKILL } from '../../model/ai-tools.ts';
import { currentConversation } from '../../model/ai-tools-handoff.ts';
import { gateGuide, homeGate } from '../../model/home-brief.ts';
import { translateModelOptions } from '../../model/tool-runs.ts';
import { findOption, initialModelKey, parseModelKey } from '../../model/tools-models.ts';
import { isStale, type PairRow, type PairStats } from '../../model/translation-doc.ts';
import { targetKey } from '../../model/workspace.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { useConnection } from '../../state/connection-store.ts';
import { useDirectory } from '../../state/directory-store.ts';
import { useModels } from '../../state/models-store.ts';
import { routeVideo, useShell } from '../../state/shell-store.ts';
import { useVideo } from '../../state/video-store.ts';
import { handToAgent } from './ai-tools-handoff.ts';
import { TRANSLATE_COPY as C } from './translate-copy.ts';

/**
 * Actions on the translation comparison list (product design §5.10 “per-sentence and stale translations”, prototype panel-translate.jsx stats bar and ⋯ menu): a stats bar row (sentence count and count to process on the left, an AI button on the right), a ⋯ menu per sentence, and two ways to re-translate: via the model API (Runtime's `translate` refreshes in place) and by handing off to the Agent (sent to this video's current session). A one-line note states the difference: which model is called directly and billed by usage, versus done in the current session using the Agent subscription. Web hosts have no entry points that call models or sessions, so they keep only stale markers and copy.
 */

const statbar = style({
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  flexShrink: 0,
  paddingStart: 12,
  paddingEnd: 8,
  paddingY: 4,
  minHeight: 32,
  borderTopWidth: 0,
  borderStartWidth: 0,
  borderEndWidth: 0,
  borderBottomWidth: 1,
  borderStyle: 'solid',
  borderColor: 'gray-200',
  font: 'ui-xs',
  color: 'gray-600',
});
const counts = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexGrow: 1,
  minWidth: 0,
  overflow: 'hidden',
  whiteSpace: 'nowrap',
});
const warn = style({ color: 'orange-1000', fontWeight: 'medium' });
const fresh = style({ color: 'green-1000' });

/**
 * Which text model direct re-translation uses: the same default as the translation settings page (the text-generation default; if that cannot be used, the first usable one; translation needs structured output).
 * When capabilities have not been read yet, or no model is usable, `ref` is null: the Runtime uses its default, or rejects with “没有配置” (not configured), and the issue card gives the place to go.
 */
export function useRetranslateModel(): { ref: { providerId: string; modelId: string } | null; name: string | null } {
  const view = useModels((s) => s.capabilities);
  return useMemo(() => {
    const options = view ? translateModelOptions(view) : [];
    const option = findOption(options, initialModelKey(options, null, view?.generateText.effective ?? null));
    const ref = option?.usable ? parseModelKey(option.key) : null;
    return { ref: ref ? { providerId: ref.providerId, modelId: ref.modelId } : null, name: option?.usable ? option.modelId : null };
  }, [view]);
}

/**
 * Re-translate by handing off to the Agent: sent to this video's current session (the one on the left of Home, or the one most recently started from this video's floating session in Space, provided it is in the same project or working directory as the video). If there is none, a new one is opened. The translation skill is attached, and the user stays in place rather than switching away (`stay`). If the Agent cannot be used, say so clearly and link to settings.
 */
export function useAgentRetranslate(videoId: Id): (prompt: { language: string; scope?: { time: string | null; text: string } | null; count?: number }) => void {
  const runtime = useRuntime();
  const ref = useVideo((s) => s.video?.ref ?? null);
  const drivers = useConnection((s) => s.drivers);
  const checking = useConnection((s) => s.checking);
  const conversations = useDirectory((s) => s.conversations);
  const go = useShell((s) => s.go);
  const current = useShell((s) => {
    if (s.route.tab === 'home') return s.route.conversationId;
    const shown = routeVideo(s.route);
    return s.route.tab === 'space' && shown ? (s.videoChats[targetKey(shown)] ?? null) : null;
  });
  return (o) => {
    const guide = gateGuide(homeGate(drivers, checking));
    if (guide) {
      ToastQueue.neutral(guide.title, { timeout: 5000 });
      go({ tab: 'settings', section: 'agent' });
      return;
    }
    // Only accept the session in front of the user (do not fall back to the most recent session in the project): if it is not the current session, start a new one, so as not to send into an old session the user is not watching.
    const here = currentConversation({ source: ref?.source ?? null, current, conversations: conversations.filter((c) => c.id === current) });
    const skill = TOOL_SKILL.stale;
    void handToAgent(runtime, {
      video: ref,
      session: here ? { id: here.id } : 'new',
      text: retranslatePrompt({ title: ref?.name ?? null, ...o }),
      attachments: [],
      skills: skill ? [{ id: skill }] : [],
      draftKey: `retranslate:${videoId}`,
      stay: true,
    });
  };
}

export interface StatbarProps {
  stats: PairStats;
  /** Number of sentences whose whole frame has been cut (counted only when this transcript is used on the timeline). */
  cut: number;
  /** Number of sentences to re-translate: the stale ones and those with no translation yet. */
  todo: number;
  /** Re-translation in progress: sentence count (null when started elsewhere without naming sentences); undefined when not re-translating. */
  refreshing: number | null | undefined;
  /** Web host: count only; prompts to re-translate in the Agent or in the app. */
  web: boolean;
  editable: boolean;
  modelName: string | null;
  onDirect(): void;
  onAgent(): void;
  onCut(): void;
  onTranslateTool(): void;
}

/** Stats bar (prototype `.statbar--one`): fits in one row. On the left, sentence count and counts (full wording in the tooltip); on the right, one AI button that gathers all actions that call a model or session. */
export function TranslationStatbar(p: StatbarProps) {
  const { stats, cut, todo } = p;
  const ai = !p.web && p.editable;
  const busy = p.refreshing !== undefined;
  return (
    <div className={statbar}>
      <span className={counts} title={p.editable ? C.editHint : undefined}>
        {busy ? (
          <span className={warn} role="status">
            {C.refreshing(p.refreshing ?? null)}
          </span>
        ) : (
          <>
            <span className="cc-tabular">{C.stats(stats.sentences)}</span>
            {stats.untranslated ? (
              <span className={warn} title={C.untranslated(stats.untranslated)}>
                {C.untranslatedShort(stats.untranslated)}
              </span>
            ) : null}
            {stats.stale ? (
              <span className={warn} title={p.web ? `${C.stale(stats.stale)} · ${C.webHint}` : C.stale(stats.stale)}>
                {C.staleShort(stats.stale)}
              </span>
            ) : null}
            {cut ? (
              <span className={warn} title={C.cut(cut)}>
                {C.cutShort(cut)}
              </span>
            ) : null}
            {stats.gone ? (
              <span className={warn} title={C.gone(stats.gone)}>
                {C.goneShort(stats.gone)}
              </span>
            ) : null}
            {todo + cut + stats.gone ? null : <span className={fresh}>{C.allFresh}</span>}
          </>
        )}
      </span>
      {ai ? (
        <TooltipTrigger>
          <MenuTrigger align="end">
            <ActionButton isQuiet size="S" aria-label={C.aiMenu}>
              <AIMark />
            </ActionButton>
            <Menu
              disabledKeys={busy ? ['direct'] : []}
              onAction={(key) => {
                if (key === 'direct') p.onDirect();
                else if (key === 'agent') p.onAgent();
                else if (key === 'cut') p.onCut();
                else if (key === 'tool') p.onTranslateTool();
              }}>
              {todo || cut ? (
                <MenuSection>
                  {todo ? (
                    <MenuItem id="direct" textValue={C.directAll(todo)}>
                      <AIMark />
                      <Text slot="label">{C.directAll(todo)}</Text>
                      <Text slot="description">{C.viaModel(p.modelName)}</Text>
                    </MenuItem>
                  ) : null}
                  {todo ? (
                    <MenuItem id="agent" textValue={C.agentAll(todo)}>
                      <Chat />
                      <Text slot="label">{C.agentAll(todo)}</Text>
                      <Text slot="description">{C.viaAgent}</Text>
                    </MenuItem>
                  ) : null}
                  {cut ? (
                    <MenuItem id="cut" textValue={C.handleCut(cut)}>
                      <Clock />
                      <Text slot="label">{C.handleCut(cut)}</Text>
                      <Text slot="description">{C.handleCutSub}</Text>
                    </MenuItem>
                  ) : null}
                </MenuSection>
              ) : null}
              <MenuSection>
                <MenuItem id="tool" textValue={C.translateTool}>
                  <Translate />
                  <Text slot="label">{C.translateTool}</Text>
                  <Text slot="description">{C.translateToolSub}</Text>
                </MenuItem>
              </MenuSection>
            </Menu>
          </MenuTrigger>
          <Tooltip>{busy ? C.refreshing(p.refreshing ?? null) : C.aiMenu}</Tooltip>
        </TooltipTrigger>
      ) : null}
    </div>
  );
}

/** What a sentence's ⋯ menu can do (TranslationList supplies the latest version on every render; cards call it via ref). */
export interface UnitMenuActions {
  direct(row: PairRow): void;
  agent(row: PairRow): void;
  mark(row: PairRow, on: boolean): void;
}

/**
 * A sentence's ⋯ menu (prototype `moreFor`): re-translate this sentence via the model API, hand this sentence to the Agent to re-translate (desktop only), mark it as stale or clear the stale mark, copy the translation. If the original sentence is gone, only copy is offered; in read-only mode, only copy.
 */
export function UnitMenu({
  row,
  index,
  text,
  ai,
  editable,
  busy,
  modelName,
  actions,
}: {
  row: PairRow;
  index: number;
  text: string;
  /** Desktop: can call models and sessions. */
  ai: boolean;
  /** This row is editable: the video is editable and the original sentence still exists. */
  editable: boolean;
  /** This translation is being re-translated: do not send another request. */
  busy: boolean;
  modelName: string | null;
  actions: RefObject<UnitMenuActions>;
}) {
  const stale = isStale(row.state);
  const disabled = [...(busy ? ['direct'] : []), ...(text ? [] : ['copy'])];
  return (
    <ActionMenu
      aria-label={C.unitMenu(index + 1)}
      isQuiet
      size="XS"
      align="end"
      disabledKeys={disabled}
      onAction={(key) => {
        if (key === 'direct') actions.current.direct(row);
        else if (key === 'agent') actions.current.agent(row);
        else if (key === 'mark') actions.current.mark(row, !stale);
        else if (key === 'copy') void navigator.clipboard.writeText(text).then(() => ToastQueue.positive(C.copied, { timeout: 3000 }));
      }}>
      {editable && ai ? (
        <MenuItem id="direct" textValue={C.directOne}>
          <AIMark />
          <Text slot="label">{C.directOne}</Text>
          <Text slot="description">{C.viaModel(modelName)}</Text>
        </MenuItem>
      ) : null}
      {editable && ai ? (
        <MenuItem id="agent" textValue={C.agentOne}>
          <Chat />
          <Text slot="label">{C.agentOne}</Text>
          <Text slot="description">{C.viaAgent}</Text>
        </MenuItem>
      ) : null}
      {editable && row.unit ? (
        <MenuItem id="mark" textValue={stale ? C.clearStale : C.markStale}>
          {stale ? <Checkmark /> : <Clock />}
          <Text slot="label">{stale ? C.clearStale : C.markStale}</Text>
        </MenuItem>
      ) : null}
      <MenuItem id="copy" textValue={C.copyTranslation}>
        <Copy />
        <Text slot="label">{C.copyTranslation}</Text>
      </MenuItem>
    </ActionMenu>
  );
}
