import { useRef, useState } from 'react';
import type { AssetRecord, DocumentRecord, ExportSettings, Id, Sequence } from '@cuccut/protocol';
import { ToastQueue } from '@react-spectrum/s2';
import { tabOfKind, type ExportTab } from '../../model/export-job.ts';
import { explainExportError, type ExportProblem } from '../../model/export-rejection.ts';
import { defaultFileNames, exportTargetDir } from '../../model/export-settings.ts';
import { pickExportDestination } from '../../model/export-destination.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { useExportPlaces } from '../../state/export-store.ts';
import { EXPORT_COPY } from './export-copy.ts';

/** Video facts the export panel's pages read (the video open in the editor). */
export interface ExportEnv {
  videoId: Id;
  videoName: string;
  sequence: Sequence;
  documents: Record<Id, DocumentRecord>;
  assets: Record<Id, AssetRecord>;
  /** Editor playhead (seconds): used by the range's "Use current" and for the segment ticked by default. */
  playhead: number;
  selection: readonly Id[];
  /** Caught up and able to submit (cannot export while opening or disconnected). */
  ready: boolean;
  /** When no location is chosen, export here: the folder of the original video (`exportSourceDir`); null on web, or when the source is inside the video's folder, which leaves it to the Runtime default. */
  sourceDir: string | null;
}

export interface ExportSubmit {
  busy: boolean;
  /** The reason the last submission was rejected; null if it was not rejected. */
  problem: ExportProblem | null;
  /** The settings that were rejected: remedies (skip, change location, pick a document) are applied to these and then resubmitted. */
  rejected: ExportSettings | null;
  submit(settings: ExportSettings, dir?: string | null): Promise<void>;
  /** How many files to export at once (the audio page's "one per kind"): submitted one by one, and the panel watches the first. */
  submitEach(parts: readonly ExportPart[], dir?: string | null): Promise<void>;
  dismiss(): void;
}

/** One of several: the settings, plus an optional fixed filename (when only one file is produced). */
export interface ExportPart {
  settings: ExportSettings;
  fileName?: string | null;
}

/**
 * On desktop, the save destination is confirmed first; cancelling creates no job. Web uses the Runtime's destination.
 * Submits one export (`exports.create`, architecture design §9.11): when accepted, it is one Job, handed to the panel to watch its progress.
 * When rejected, no job is created, and the Runtime's rejection code is turned into a one-sentence title, an itemized list and the remedy available. No retries, no fabricated results.
 */
export function useExportSubmit(env: ExportEnv, onStarted: (jobId: Id, tab: ExportTab) => void): ExportSubmit {
  const runtime = useRuntime();
  const savedDir = useExportPlaces((s) => s.dirs[env.videoId] ?? null);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [problem, setProblem] = useState<ExportProblem | null>(null);
  const [rejected, setRejected] = useState<ExportSettings | null>(null);
  // If the first of several is rejected (no job created yet): when the remedy (change location) resubmits the rejected one, the remaining ones are resubmitted together with it.
  const [batch, setBatch] = useState<{ rejected: ExportSettings; parts: readonly ExportPart[] } | null>(null);
  const placeFor = (settings: ExportSettings, dir: string | null | undefined) => exportTargetDir(settings.kind, dir, savedDir, env.sourceDir);
  const namesFor = (settings: ExportSettings) => defaultFileNames(env.videoName, settings, env.documents, env.sequence);
  const pickDestination = async (names: readonly string[], target: string | null) => {
    try {
      return await pickExportDestination(runtime.host, names, target, EXPORT_COPY);
    } catch (error) {
      ToastQueue.negative(EXPORT_COPY.pickFailed(error instanceof Error ? error.message : String(error)), { timeout: 5000 });
      return null;
    }
  };

  const submit = async (settings: ExportSettings, dir?: string | null) => {
    if (batch && settings === batch.rejected) return submitEach(batch.parts, dir);
    if (pending.current) return;
    pending.current = true;
    setBatch(null);
    const target = placeFor(settings, dir);
    setBusy(true);
    setProblem(null);
    try {
      const destination = await pickDestination(namesFor(settings), target);
      if (!destination) return;
      const jobId = await runtime.createExport({ videoId: env.videoId, settings, destination });
      setRejected(null);
      onStarted(jobId, tabOfKind(settings.kind));
    } catch (error) {
      setRejected(settings);
      setProblem(explainExportError(error, { kind: settings.kind, stage: 'rejected', documents: env.documents }));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  /**
   * Submits each one (`exports.create`, each is one job). If all were submitted: the panel watches the first, the rest are in the jobs, and one notice says so.
   * If the first is rejected: as with a single export, explain and offer the remedy on the page; when the remedy is applied, the remaining ones are resubmitted together. If some were submitted before a rejection: the panel is already watching the first, so a notice states clearly that the later ones were not exported.
   */
  const submitEach = async (parts: readonly ExportPart[], dir?: string | null) => {
    if (!parts.length || pending.current) return;
    pending.current = true;
    setBusy(true);
    setProblem(null);
    setBatch(null);
    const started: Id[] = [];
    try {
      const names = parts.flatMap((part) => part.fileName ? [part.fileName] : namesFor(part.settings));
      const picked = await pickDestination(names, placeFor(parts[0]!.settings, dir));
      if (!picked) return;
      for (const [index, part] of parts.entries()) {
        const destination = { ...(part.fileName ? { fileName: part.fileName } : {}), ...picked };
        try {
          started.push(
            await runtime.createExport({ videoId: env.videoId, settings: part.settings, ...(Object.keys(destination).length ? { destination } : {}) }),
          );
        } catch (error) {
          const explained = explainExportError(error, { kind: part.settings.kind, stage: 'rejected', documents: env.documents });
          if (!started.length) {
            setRejected(part.settings);
            setProblem(explained);
            setBatch({ rejected: part.settings, parts: parts.slice(index) });
          } else {
            ToastQueue.negative(EXPORT_COPY.eachPartial(started.length, parts.length - started.length, explained.title), { timeout: 10000 });
          }
          break;
        }
      }
      if (started.length) {
        setRejected(null);
        if (started.length === parts.length && parts.length > 1) ToastQueue.neutral(EXPORT_COPY.eachStarted(parts.length), { timeout: 6000 });
        onStarted(started[0]!, tabOfKind(parts[0]!.settings.kind));
      }
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  return {
    busy,
    problem,
    rejected,
    submit,
    submitEach,
    dismiss: () => {
      setProblem(null);
      setRejected(null);
      setBatch(null);
    },
  };
}
