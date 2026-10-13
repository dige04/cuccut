import { useEffect, useMemo } from 'react';
import { create } from 'zustand';
import type { ModelServiceCapability, PipelineInfo, ToolInputKind, ToolStatus } from '@cuccut/protocol';
import type { ToolId } from '../../model/tool-catalog.ts';
import { toolBlock } from '../../model/tools-gallery.ts';
import type { RuntimeSession } from '../../runtime/session.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { useModels } from '../../state/models-store.ts';
import { FORM_COPY } from './tools-copy.ts';

/**
 * Whether the tools can be used right now (`tools.list`) and which flows the Runtime has registered (`pipelines.list`). Shared by the catalog page and each tool page; read on mount, and again when the model capability view changes (a provider connected or disconnected, a model installed). Nothing is judged until the status arrives: the submit button stays disabled, and there is no fallback to hard-coded flow names.
 */

interface ToolStatusState {
  tools: ToolStatus[] | null;
  /** The save location from `tools.list`; null when not given (Web service). */
  saveDirectory: string | null;
  pipelines: PipelineInfo[] | null;
  error: string | null;
}

const useToolStatusStore = create<ToolStatusState>()(() => ({ tools: null, saveDirectory: null, pipelines: null, error: null }));

/** The same capability view is read only once (several components mounting at the same time do not send duplicate requests). */
let loadedFor: { session: RuntimeSession; view: unknown } | null = null;

function load(session: RuntimeSession, view: unknown): void {
  if (loadedFor && loadedFor.session === session && loadedFor.view === view) return;
  loadedFor = { session, view };
  void Promise.allSettled([session.listTools(), session.listPipelines()]).then(([tools, pipelines]) => {
    if (loadedFor?.session !== session || loadedFor.view !== view) return;
    useToolStatusStore.setState({
      tools: tools.status === 'fulfilled' ? tools.value.tools : useToolStatusStore.getState().tools,
      saveDirectory: tools.status === 'fulfilled' ? (tools.value.saveDirectory ?? null) : useToolStatusStore.getState().saveDirectory,
      // If the flow table cannot be read (e.g. web sessions do not expose it), do not judge by flow; only look at `tools.list`.
      pipelines: pipelines.status === 'fulfilled' ? pipelines.value : null,
      error: tools.status === 'rejected' ? (tools.reason instanceof Error ? tools.reason.message : String(tools.reason)) : null,
    });
  });
}

/**
 * When the tool's status changes but the capability view does not (e.g. the download tool was just installed and consented), re-read once: clears the “already read” mark so the next mount or call re-reads it. If a session is given, re-read immediately.
 */
export function invalidateToolStatus(session?: RuntimeSession): void {
  const view = loadedFor?.view;
  loadedFor = null;
  if (session) load(session, view);
}

export interface ToolStatusView {
  /** Whether `tools.list` has arrived. */
  ready: boolean;
  byId: ReadonlyMap<string, ToolStatus>;
  /**
   * Save location (architecture design §7.9): results of tools that produce no video land here; the Web service does not provide one (null), in which case the tool page has no save-location row and direct jobs do not carry `saveDir` either.
   */
  saveDirectory: string | null;
  pipelines: readonly PipelineInfo[] | null;
  /** The reason `tools.list` failed to read. */
  error: string | null;
}

export function useToolStatus(): ToolStatusView {
  const session = useRuntime();
  const view = useModels((s) => s.capabilities);
  const tools = useToolStatusStore((s) => s.tools);
  const pipelines = useToolStatusStore((s) => s.pipelines);
  const error = useToolStatusStore((s) => s.error);
  const saveDirectory = useToolStatusStore((s) => s.saveDirectory);
  useEffect(() => load(session, view), [session, view]);
  const byId = useMemo(() => new Map((tools ?? []).map((t) => [t.id, t])), [tools]);
  return { ready: tools !== null, byId, saveDirectory, pipelines, error };
}

/**
 * Why this tool cannot be run from this kind of input: the first reason from `tools.list` (with a remedy), or the flow that runs it is not in `pipelines.list`. null when usable; undefined while the status has not arrived.
 */
export function blockOf(
  status: ToolStatusView,
  id: ToolId,
  input?: ToolInputKind,
  requiredCapabilities: readonly ModelServiceCapability[] = [],
): string | null | undefined {
  if (!status.ready) return undefined;
  const one = status.byId.get(id);
  if (!one) return FORM_COPY.notInRuntime;
  return toolBlock(one, status.pipelines, input, true, requiredCapabilities);
}
