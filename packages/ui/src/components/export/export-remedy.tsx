import type { ExportSettings, Id } from '@cuccut/protocol';
import { Button } from '@react-spectrum/s2';
import type { ExportProblem } from '../../model/export-rejection.ts';
import { useExportPlaces } from '../../state/export-store.ts';
import { EXPORT_COPY } from './export-copy.ts';
import { ProblemAlert, usePickDir } from './export-parts.tsx';

/**
 * The step the UI can take directly after a rejection or failure (architecture design §9.11 rejection codes, Runtime export-service.ts `details`):
 * - The output has content that cannot be rendered: resubmit with `onUnsupported: 'skip'` (one warning recorded per item);
 * - The portable bundle has assets that cannot be read: resubmit with `missingAssets: 'skip'` (the list honestly marks them as missing);
 * - The location cannot be written, a name conflicts, there is not enough space, or saving failed: export again to another folder;
 * - Several documents can be exported: pick one and export again.
 */
export function RemedyButtons({
  problem,
  settings,
  videoId,
  busy,
  onSubmit,
}: {
  problem: ExportProblem;
  settings: ExportSettings;
  videoId: Id;
  busy: boolean;
  onSubmit: (settings: ExportSettings, dir?: string | null) => void;
}) {
  const pickDir = usePickDir();
  const setDir = useExportPlaces((s) => s.setDir);
  const remedy = problem.remedy;
  if (!remedy) return null;
  switch (remedy.kind) {
    case 'skip-unsupported':
      return settings.kind === 'video' ? (
        <Button variant="secondary" size="S" isPending={busy} onPress={() => onSubmit({ ...settings, onUnsupported: 'skip' as const })}>
          {EXPORT_COPY.skipUnsupported}
        </Button>
      ) : null;
    case 'skip-missing-assets':
      return settings.kind === 'portable' ? (
        <Button variant="secondary" size="S" isPending={busy} onPress={() => onSubmit({ ...settings, missingAssets: 'skip' as const })}>
          {EXPORT_COPY.skipMissing}
        </Button>
      ) : null;
    case 'pick-dir':
      return (
        <Button
          variant="secondary"
          size="S"
          isPending={busy}
          onPress={async () => {
            const dir = await pickDir();
            if (!dir) return;
            setDir(videoId, dir);
            onSubmit(settings, dir);
          }}>
          {EXPORT_COPY.pickDirAndRetry}
        </Button>
      );
    case 'choose-document':
      if (settings.kind !== 'subtitles' && settings.kind !== 'transcript') return null;
      return (
        <>
          {remedy.candidates.slice(0, 4).map((c) => (
            <Button key={c.documentId} variant="secondary" size="S" isPending={busy} onPress={() => onSubmit({ ...settings, documentId: c.documentId })}>
              {EXPORT_COPY.useDocument(c.language ? `${c.name} · ${c.language}` : c.name)}
            </Button>
          ))}
        </>
      );
  }
}

/** Submission rejected: the reason plus a remedy button. */
export function RejectedAlert({
  problem,
  settings,
  videoId,
  busy,
  onSubmit,
}: {
  problem: ExportProblem | null;
  settings: ExportSettings | null;
  videoId: Id;
  busy: boolean;
  onSubmit: (settings: ExportSettings, dir?: string | null) => void;
}) {
  if (!problem) return null;
  return (
    <ProblemAlert
      problem={problem}
      actions={settings && problem.remedy ? <RemedyButtons problem={problem} settings={settings} videoId={videoId} busy={busy} onSubmit={onSubmit} /> : null}
    />
  );
}
