import { useEffect, useState } from 'react';
import type { ExportSettings, RenderedTextOutput, TextExportSettings } from '@cuccut/protocol';
import { explainExportError, type ExportProblem } from '../../model/export-rejection.ts';
import { useRuntime } from '../../runtime/context.tsx';
import type { ExportEnv } from './use-export-submit.ts';

/** After a settings change, wait this long before rendering again: clicking several toggles in a row renders only the last one. */
const DEBOUNCE_MS = 150;

export interface RenderedText {
  /** The body text matching the current settings; null when it is not rendered yet, was rejected, or there are no settings. */
  output: RenderedTextOutput | null;
  /** The last rendered body (kept while new settings are still coming back, so the preview does not flicker). */
  shown: RenderedTextOutput | null;
  loading: boolean;
  problem: ExportProblem | null;
}

/**
 * Gets the subtitle or transcript body text according to the export settings (`exports.renderText`, writes no file): byte-identical to the file exported with the same settings.
 * Re-renders when the settings, the sequence or a document version changes; late stale results are dropped. `documentIds` are the documents the body is taken from; their versions are the basis for re-rendering.
 */
export function useRenderedText(env: ExportEnv, settings: ExportSettings | null, documentIds: readonly string[]): RenderedText {
  const runtime = useRuntime();
  const versions = documentIds.map((id) => env.documents[id]?.currentRevision ?? '').join(',');
  const key = settings && env.ready ? JSON.stringify([env.videoId, settings, env.sequence.revision, versions]) : null;
  const [state, setState] = useState<{ key: string | null; output: RenderedTextOutput | null; problem: ExportProblem | null }>({
    key: null,
    output: null,
    problem: null,
  });
  const [shown, setShown] = useState<RenderedTextOutput | null>(null);

  useEffect(() => {
    if (!key || !settings) return;
    let live = true;
    const timer = setTimeout(() => {
      runtime.renderTextExport({ videoId: env.videoId, settings: settings as TextExportSettings }).then(
        (result) => {
          if (!live) return;
          const output = result.outputs[0] ?? null;
          setState({ key, output, problem: null });
          setShown(output);
        },
        (error: unknown) => {
          if (!live) return;
          setState({
            key,
            output: null,
            problem: explainExportError(error, { kind: settings.kind, stage: 'rejected', documents: env.documents }),
          });
          setShown(null);
        },
      );
    }, DEBOUNCE_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
    // `key` already contains the settings and versions; `settings` and `env.documents` are new objects on every render, so they are not in the dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runtime, key]);

  const fresh = key !== null && state.key === key;
  return {
    output: fresh ? state.output : null,
    shown: key ? (fresh ? state.output : shown) : null,
    loading: key !== null && !fresh,
    problem: fresh ? state.problem : null,
  };
}
