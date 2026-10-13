import { useEffect, useRef } from 'react';
import type { Id, JobRecord, TextModelInfo } from '@cuccut/protocol';
import { Button, Content, Heading, InlineAlert } from '@react-spectrum/s2';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { textModelLine } from '../../model/models-text.ts';
import { isVideoTool, type ToolId } from '../../model/tool-catalog.ts';
import type { Rerun } from '../../model/tool-rerun.ts';
import type { ToolModelOption } from '../../model/tools-models.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { useJobs } from '../../state/jobs-store.ts';
import { useShell } from '../../state/shell-store.ts';
import { ModelRow } from './tool-frame.tsx';
import { BarStatus } from './tool-parts.tsx';
import { FORM_COPY, FRAME_COPY, TRANSLATE_COPY } from './tools-copy.ts';
import { invalidateToolStatus } from './use-tool-status.ts';
import { useVideoTools, type ToolPreset } from './use-video-tools.ts';

/*
 * Form parts for the four video tool pages (design mockup tool-translate.jsx `TextModelField`, each page's header button, and the “will not overwrite” hint).
 */

export const lede = style({ margin: 0, font: 'ui-sm', color: 'gray-700' });

/** The first reason the action cannot be taken; null when there is none. `undefined` (the tool status has not arrived yet) counts as “reading”. */
export function firstWhy(block: string | null | undefined, ...reasons: (string | null | false | undefined)[]): string | null {
  if (block === undefined) return FORM_COPY.loading;
  if (block) return block;
  for (const r of reasons) if (r) return r;
  return null;
}

/**
 * Header: a one-line status (when it cannot be run, the first reason, turning orange) and the primary button. `yields`: another action on the page (a grant card's Agree) holds the view's one yellow for now, so the submit turns neutral.
 */
export function SubmitBar({
  why,
  label,
  busy,
  onPress,
  yields = false,
}: {
  why: string | null;
  label: string;
  busy: boolean;
  onPress: () => void;
  yields?: boolean;
}) {
  return (
    <>
      <BarStatus text={why ?? FORM_COPY.ready} bad={!!why} />
      <Button variant={yields ? 'secondary' : 'accent'} isDisabled={!!why} isPending={busy} onPress={onPress}>
        {label}
      </Button>
    </>
  );
}

/** The “will not overwrite” hint when writing into an existing video. */
export function DuplicateAlert({ title, body }: { title: string; body: string }) {
  return (
    <InlineAlert variant="informative">
      <Heading>{title}</Heading>
      <Content>{body}</Content>
    </InlineAlert>
  );
}

/** Text-model block (translate subtitles, translate first then dub): the unified “model” row, with online-service models; unusable ones are listed with the reason, and a “go to settings” link is given. */
export function TextModelField({
  options,
  option,
  onChange,
}: {
  options: readonly ToolModelOption<TextModelInfo>[];
  option: ToolModelOption<TextModelInfo> | null;
  onChange: (key: string) => void;
}) {
  const go = useShell((s) => s.go);
  return (
    <ModelRow
      title={TRANSLATE_COPY.model}
      noun={FRAME_COPY.textNoun}
      manage={TRANSLATE_COPY.manageModels}
      local={false}
      onSettings={() => go({ tab: 'models', category: 'llm', page: 'cloud' })}
      options={options}
      selected={option}
      onSelect={(o) => onChange(o.key)}
      factsOf={(o) => textModelLine(o.info)}
    />
  );
}

/** Space entries brought by “continue” or “process with tool…”: pre-selected when entering this tool (each page decides how to fill it); cleared once used. */
export function usePreset(tool: ToolId, apply: (entryId: Id, preset: ToolPreset) => void): void {
  const preset = useVideoTools((s) => s.preset);
  const setPreset = useVideoTools((s) => s.setPreset);
  useEffect(() => {
    if (!preset || preset.tool !== tool) return;
    apply(preset.entryId, preset);
    setPreset(null);
    // Used only once, when the brought video changes; `apply` is new on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, setPreset, tool]);
}

/**
 * A task brought by “do again / retry”: once the job appears in the `jobs` topic, it fills the form once and is then cleared (same as `usePreset`).
 */
export function useRerun(tool: ToolId, apply: (job: JobRecord) => void): void {
  const rerun = useVideoTools((s) => s.rerun);
  const setRerun = useVideoTools((s) => s.setRerun);
  const job = useJobs((s) => (rerun && rerun.tool === tool ? s.jobs.find((j) => j.jobId === rerun.jobId) : undefined));
  useEffect(() => {
    if (!rerun || rerun.tool !== tool || !job) return;
    apply(job);
    setRerun(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rerun, job, setRerun, tool]);
}

/** Going to a tool page via “do again / retry”: direct jobs and file transcodes fill the form with their parameters; video tools open this run. */
export function goRerun(rerun: Rerun, jobId: Id): void {
  const tools = useVideoTools.getState();
  if (rerun.mode === 'view' && isVideoTool(rerun.tool)) tools.setView(rerun.tool, jobId);
  else {
    if (isVideoTool(rerun.tool)) tools.setView(rerun.tool, null);
    tools.setRerun({ tool: rerun.tool, jobId });
  }
  useShell.getState().go({ tab: 'tools', tool: rerun.tool });
}

/** The video download tool has just become ready (installed and consented): the link-import status in `tools.list` changes with it, so re-read once. */
export function useRefreshWhenReady(ready: boolean): void {
  const runtime = useRuntime();
  const was = useRef(ready);
  useEffect(() => {
    if (ready && !was.current) invalidateToolStatus(runtime);
    was.current = ready;
  }, [ready, runtime]);
}
