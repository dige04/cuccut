import type { ExportSettings } from '@cuccut/protocol';
import { Button } from '@react-spectrum/s2';
import { EXPORT_COPY } from './export-copy.ts';
import { Actions, Note } from './export-parts.tsx';
import { RejectedAlert } from './export-remedy.tsx';
import type { ExportEnv, ExportSubmit } from './use-export-submit.ts';

/**
 * Footer of each page (design mockup export.jsx `.xacts`): the reason the last submission was rejected and its remedy, a one-line note when the video is not up to date, the cancel and export buttons.
 * When `settings` is null, this page cannot export right now (nothing ticked, range empty, ...): the export button is disabled, and each page writes the reason above.
 */
export function SubmitFoot({
  env,
  submitter,
  settings,
  label,
  onClose,
  onSubmit,
}: {
  env: ExportEnv;
  submitter: ExportSubmit;
  settings: ExportSettings | null;
  label: string;
  onClose: () => void;
  /** The export button has another submit mode (the audio page's "one per kind" submits several at once); when not given, `settings` is submitted. */
  onSubmit?: () => void;
}) {
  return (
    <>
      <RejectedAlert problem={submitter.problem} settings={submitter.rejected} videoId={env.videoId} busy={submitter.busy} onSubmit={(s, dir) => void submitter.submit(s, dir)} />
      {!env.ready ? <Note warn>{EXPORT_COPY.notOpen}</Note> : null}
      <Actions>
        <Button variant="secondary" fillStyle="outline" onPress={onClose}>
          {EXPORT_COPY.cancel}
        </Button>
        <Button
          variant="accent"
          isPending={submitter.busy}
          isDisabled={!env.ready || !settings}
          onPress={() => settings && (onSubmit ? onSubmit() : void submitter.submit(settings))}>
          {label}
        </Button>
      </Actions>
    </>
  );
}
