import { useMemo } from 'react';
import { legacyTaskRow } from '../../model/legacy-import-run.ts';
import { taskRows, type OpenVideoFacts, type TaskRow, type TaskRowsOptions } from '../../model/task-list.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { useDirectory } from '../../state/directory-store.ts';
import { useJobs } from '../../state/jobs-store.ts';
import { useLegacyImport } from '../../state/legacy-import-store.ts';
import { useTasks } from '../../state/tasks-store.ts';
import { useVideo } from '../../state/video-store.ts';

/** A few fields for the task table, taken from the video open in the editor: its name, its project, and the asset name. */
export function useOpenVideoFacts(): OpenVideoFacts | null {
  const videoId = useVideo((s) => s.video?.videoId ?? null);
  const name = useVideo((s) => s.video?.state?.video.name ?? s.video?.ref?.name ?? null);
  const projectId = useVideo((s) => s.video?.ref?.source.projectId ?? null);
  const assets = useVideo((s) => s.video?.state?.video.assets);
  return useMemo(
    () => (videoId && name ? { videoId, name, projectId, assets: assets ?? {} } : null),
    [videoId, name, projectId, assets],
  );
}

/**
 * The unified background task table: agent tasks and Jobs, with the newer ones first. Shared by the tasks page, the sidebar and the task pill.
 * The round that imports legacy projects at this launch (desktop only) is also one row, placed by the time it started.
 */
export function useTaskRows(options: TaskRowsOptions = {}): { rows: TaskRow[]; ready: boolean } {
  const fold = options.fold ?? true;
  const platform = useRuntime().host.platform;
  const legacyRun = useLegacyImport((s) => s.run);
  const tasks = useTasks((s) => s.tasks);
  const jobs = useJobs((s) => s.jobs);
  const tasksReady = useTasks((s) => s.ready);
  const jobsReady = useJobs((s) => s.ready);
  const projects = useDirectory((s) => s.projects);
  const conversations = useDirectory((s) => s.conversations);
  const video = useOpenVideoFacts();
  const rows = useMemo(() => {
    const list = taskRows(tasks, jobs, { projects, conversations, video }, { fold });
    if (!legacyRun) return list;
    return [...list, legacyTaskRow(legacyRun, platform)].sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
  }, [tasks, jobs, projects, conversations, video, fold, legacyRun, platform]);
  return { rows, ready: tasksReady && jobsReady };
}
