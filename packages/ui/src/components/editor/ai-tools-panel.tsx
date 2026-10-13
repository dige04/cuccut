import { useEffect, useMemo } from 'react';
import type { DocumentRecord, Id, Sequence } from '@cuccut/protocol';
import { ToastQueue } from '@react-spectrum/s2';
import { aiTool, type AgentToolId } from '../../model/ai-tools.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { useDirectory } from '../../state/directory-store.ts';
import { useShell } from '../../state/shell-store.ts';
import { useVideo } from '../../state/video-store.ts';
import { useBindAiToolRun } from './ai-tool-direct-view.tsx';
import { AiAgentToolPage } from './ai-tools-agent-page.tsx';
import { AI_TOOLS_COPY as C } from './ai-tools-copy.ts';
import { AiToolsList } from './ai-tools-list.tsx';
import { closeAiTool, syncAiToolAgentRuns, useAiToolsNav } from './ai-tools-nav.ts';
import { AiToolSoon } from './ai-tools-soon.tsx';
import { ShortsToolPage } from './ai-tools-shorts-page.tsx';
import { ShortsResultPage } from './ai-tools-shorts-result.tsx';
import { latestShortsRun, useShortsRuns } from './shorts-runs.ts';
import { readDerivation } from '../../model/shorts-result.ts';
import { DubFlow } from './dub-flow.tsx';
import { SpeakerFlow } from './speaker-flow.tsx';
import { TranslateFlow } from './translate-flow.tsx';
import { bindTranslate, type TranslateDeps } from './translate-run.ts';
import { EDITOR_COPY as E } from './editor-copy.ts';

const translateToast: TranslateDeps['toast'] = (kind, message, undo) =>
  ToastQueue[kind](
    message,
    undo
      ? {
          timeout: 5000,
          actionLabel: E.undo,
          onAction: undo,
          shouldCloseOnAction: true,
        }
      : { timeout: 5000 },
  );

/**
 * AI tools tab (prototype panel-aitools.jsx `AiToolsPanel`, product design §5.10): with no tool page open, it shows the list page (`AiToolsList`); clicking a row, or an entry from another panel carrying a range (`openAiTool`), opens that tool page, and “Back” returns to the list.
 * Translate subtitles is hosted by the translation settings page (after submitting, it switches to the subtitle page to see progress and receipts); translate and dub is hosted by the dubbing page (after starting, it stays in place to see progress and receipts); identify speakers is hosted by its four-state page (settings, running, confirmation and receipt all in place, `SpeakerFlow`); cut into a short video is hosted by its own parameters page (`ShortsToolPage`) and result page (`ShortsResultPage`); everything else goes to the Agent (`AiAgentToolPage`).
 * The web host does not have this tab (see `hostPanelTab` in editor-store).
 */
export function AiToolsPanel({ sequence, documents }: { sequence: Sequence; documents: Record<Id, DocumentRecord> }) {
  const runtime = useRuntime();
  useEffect(() => bindTranslate({ runtime, toast: translateToast }), [runtime]);
  // Direct model tasks must also be wrapped up on the list page (the status on the list, and the result when returning to the tool page).
  useBindAiToolRun();
  // Before the restart, finding cut points and refreshing stale translations were handed to the Agent: if their conversation is still running, reattach; once done, the progress card is no longer drawn.
  const ready = useDirectory((s) => s.ready);
  const conversations = useDirectory((s) => s.conversations);
  const queues = useShell((s) => s.queues);
  useEffect(() => syncAiToolAgentRuns({ ready, conversations, queued: (id) => !!queues[id]?.length }), [ready, conversations, queues]);
  const videoId = useVideo((s) => s.video?.videoId ?? null);
  const page = useAiToolsNav((s) => (videoId ? (s.pages[videoId] ?? null) : null));
  const derivation = useMemo(() => readDerivation(documents), [documents]);
  const hasRun = useShortsRuns((s) => (videoId ? !!latestShortsRun(s.runs, videoId) : false));
  // Going to a tool page (generate soundtrack) has no page of its own: if navigation state still refers to it (old state), clear it and go back to the list.
  const toolPage = !!page && aiTool(page.tool).tier === 'tool';
  useEffect(() => {
    if (videoId && toolPage) closeAiTool(videoId);
  }, [videoId, toolPage]);
  if (!videoId) return null;
  if (!page) return <AiToolsList videoId={videoId} sequence={sequence} documents={documents} />;

  const back = () => closeAiTool(videoId);
  const tool = aiTool(page.tool);
  if (tool.id === 'translate') {
    // Progress, questions and receipts are on the subtitle page: after submitting, switch there.
    return (
      <TranslateFlow
        videoId={videoId}
        documents={documents}
        backLabel={C.back}
        onBack={back}
        onStarted={() => closeAiTool(videoId, 'subtitle')}
      />
    );
  }
  // Dubbing progress, mid-run authorization prompts, retry on failure, and receipts are all on the dubbing page: stay in place after starting.
  if (tool.id === 'dub') return <DubFlow videoId={videoId} documents={documents} onBack={back} />;
  // Speaker identification results go to the confirmation page first and leave a receipt after applying: all on this page.
  if (tool.id === 'speakers') return <SpeakerFlow videoId={videoId} sequence={sequence} documents={documents} onBack={back} />;
  if (tool.tier === 'soon') return <AiToolSoon tool={tool} onBack={back} />;
  if (tool.tier === 'tool') return <AiToolsList videoId={videoId} sequence={sequence} documents={documents} />;
  // Cut into a short video: only handed to the Agent, always starts a new conversation, with its own parameters page (no “Use” and “Conversation” rows). If it was handed off before (or the one open is a cut-out clip), entering shows the result page first; the “Back” on the result page leads to the parameters page (prototype panel-aitools-shorts.jsx `ShortsCutPanel`).
  if (tool.id === 'shortscut') {
    const host = page.host ?? derivation?.parentVideoId ?? videoId;
    if (page.phase === 'result' || (page.phase !== 'setup' && (hasRun || !!derivation)))
      return <ShortsResultPage videoId={videoId} host={host} />;
    const skipDone = !!page.preset?.skipDone;
    return (
      <ShortsToolPage
        key={skipDone ? 'more' : 'setup'}
        videoId={videoId}
        sequence={sequence}
        documents={documents}
        skipDone={skipDone}
        onBack={back}
      />
    );
  }
  return (
    <AiAgentToolPage
      key={tool.id}
      videoId={videoId}
      tool={tool.id as AgentToolId}
      preset={page.preset}
      sequence={sequence}
      documents={documents}
      onBack={back}
    />
  );
}
