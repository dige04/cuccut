import { useState } from 'react';
import type { Id, SpaceEntry, SpaceOpenForEditResult, SpaceReference } from '@cuccut/protocol';
import {
  AlertDialog,
  Button,
  ButtonGroup,
  Content,
  Dialog,
  DialogContainer,
  Heading,
  Picker,
  PickerItem,
  Text,
  ToastQueue,
} from '@react-spectrum/s2';
import Import from '@react-spectrum/s2/icons/Import';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { importSummary, REFERENCE_KIND_LABEL } from '../../model/space-actions.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { NameDialog } from '../name-dialog.tsx';
import { SPACE_COPY as COPY } from './space-copy.ts';

const body = style({ display: 'flex', flexDirection: 'column', gap: 12 });
const para = style({ margin: 0 });
const items = style({ margin: 0, paddingStart: 20, display: 'flex', flexDirection: 'column', gap: 4 });
const refKind = style({ fontWeight: 'bold' });
const hint = style({ font: 'ui-sm', color: 'gray-600', margin: 0 });

/** Maximum number of generated or exported items listed at once; the rest are written as “etc.”. */
const RELATED_SHOWN = 8;

export type SourceVideoResult = Extract<SpaceOpenForEditResult, { mode: 'source-video' }>;

/** Dialog on the Space page; only one is open at a time. State lives in the page, because S2's Dialog renders its children several times across slots. */
export type SpaceDialogState =
  | { kind: 'rename'; entry: SpaceEntry }
  | { kind: 'purge'; entry: SpaceEntry }
  | { kind: 'blocked'; entry: SpaceEntry; references: SpaceReference[] }
  /** `shorts`: number of child videos derived from this one; they are not deleted with the parent video. */
  | { kind: 'trash-video'; entry: SpaceEntry; related: SpaceEntry[]; shorts: number }
  | { kind: 'source-changed'; entry: SpaceEntry; result: SourceVideoResult & { target: { entryId: Id } } }
  | { kind: 'import' };

export function SpaceDialogs({
  dialog,
  projects,
  defaultProjectId,
  onClose,
  onRename,
  onPurge,
  onTrashVideo,
  onOpenSource,
}: {
  dialog: SpaceDialogState | null;
  /** Projects that items can be imported into (those not archived). */
  projects: readonly { id: Id; name: string; path: string }[];
  defaultProjectId: Id | null;
  onClose: () => void;
  onRename: (entry: SpaceEntry, name: string | null) => Promise<void>;
  onPurge: (entry: SpaceEntry) => void;
  onTrashVideo: (entry: SpaceEntry) => void;
  onOpenSource: (target: { entryId: Id }) => void;
}) {
  if (dialog?.kind === 'rename') {
    const { entry } = dialog;
    return (
      <NameDialog
        title={COPY.renameTitle}
        label={COPY.renameLabel}
        initial={entry.name}
        placeholder={entry.fileName}
        description={COPY.renameHint(entry.fileName)}
        submitLabel={COPY.save}
        allowEmpty
        onClose={onClose}
        onSubmit={async (name) => {
          await onRename(entry, name === '' || name === entry.fileName ? null : name);
          onClose();
        }}
      />
    );
  }
  if (dialog?.kind === 'import') {
    return <ImportDialog projects={projects} defaultProjectId={defaultProjectId} onClose={onClose} />;
  }
  return (
    <DialogContainer onDismiss={onClose}>
      {dialog?.kind === 'purge' ? (
        <AlertDialog
          variant="destructive"
          title={COPY.purgeTitle}
          primaryActionLabel={COPY.purgeConfirm}
          cancelLabel={COPY.cancel}
          onPrimaryAction={() => onPurge(dialog.entry)}>
          {dialog.entry.kind === 'video' ? COPY.purgeVideoBody(dialog.entry.name) : COPY.purgeBody(dialog.entry.name)}
        </AlertDialog>
      ) : dialog?.kind === 'blocked' ? (
        <AlertDialog variant="warning" title={COPY.blockedTitle} primaryActionLabel={COPY.gotIt}>
          <div className={body}>
            <p className={para}>{COPY.blockedBody(dialog.entry.name)}</p>
            <ul className={items}>
              {dialog.references.map((ref, index) => (
                <li key={`${ref.kind}:${ref.videoId ?? ''}:${ref.assetId ?? ''}:${ref.jobId ?? ''}:${index}`}>
                  <span className={refKind}>{REFERENCE_KIND_LABEL[ref.kind]}</span> {ref.detail}
                </li>
              ))}
            </ul>
          </div>
        </AlertDialog>
      ) : dialog?.kind === 'trash-video' ? (
        <AlertDialog
          variant="destructive"
          title={COPY.trashVideoTitle}
          primaryActionLabel={COPY.trashVideoConfirm}
          cancelLabel={COPY.cancel}
          onPrimaryAction={() => onTrashVideo(dialog.entry)}>
          <div className={body}>
            <p className={para}>{COPY.trashVideoBody}</p>
            {dialog.related.length ? (
              <>
                <p className={para}>{COPY.trashVideoRelated(dialog.related.length)}</p>
                <ul className={items}>
                  {dialog.related.slice(0, RELATED_SHOWN).map((entry) => (
                    <li key={entry.id}>{entry.name}</li>
                  ))}
                  {dialog.related.length > RELATED_SHOWN ? <li>{COPY.relatedMore(dialog.related.length)}</li> : null}
                </ul>
              </>
            ) : null}
            {dialog.shorts ? <p className={para}>{COPY.trashVideoShorts(dialog.shorts)}</p> : null}
          </div>
        </AlertDialog>
      ) : dialog?.kind === 'source-changed' ? (
        <AlertDialog
          variant="confirmation"
          title={COPY.changedDialogTitle}
          primaryActionLabel={COPY.changedOpenCurrent}
          secondaryActionLabel={COPY.changedFromFrozen}
          isSecondaryActionDisabled
          cancelLabel={COPY.cancel}
          onPrimaryAction={() => onOpenSource(dialog.result.target)}>
          <div className={body}>
            <p className={para}>{COPY.changedDialogBody(dialog.result.frozenRevision, dialog.result.currentRevision)}</p>
            <p className={hint}>{COPY.changedFromFrozenReason}</p>
          </div>
        </AlertDialog>
      ) : null}
    </DialogContainer>
  );
}

/**
 * Import media (prototype SpaceImport, product design §4.8): choose a project → choose files. Each file is registered as the project's media via `space.import`;
 * files outside the project are copied into the project's `imports/`. They are not placed into any video (importing and placing on the timeline are separate, §5.9).
 * The selected project sits in the outer layer of the dialog (Dialog renders children several times).
 */
function ImportDialog({
  projects,
  defaultProjectId,
  onClose,
}: {
  projects: readonly { id: Id; name: string; path: string }[];
  defaultProjectId: Id | null;
  onClose: () => void;
}) {
  const runtime = useRuntime();
  const [target, setTarget] = useState<Id | null>(
    defaultProjectId && projects.some((p) => p.id === defaultProjectId) ? defaultProjectId : (projects[0]?.id ?? null),
  );
  const [busy, setBusy] = useState(false);
  const project = projects.find((p) => p.id === target) ?? null;

  const pick = async () => {
    if (!project || busy) return;
    const paths = await runtime.host.pickMediaFiles();
    if (!paths.length) return;
    setBusy(true);
    const results: ({ ok: true; copied: boolean } | { ok: false; error: string })[] = [];
    for (const path of paths) {
      try {
        const { copied } = await runtime.importToSpace(project.id, path);
        results.push({ ok: true, copied });
      } catch (error) {
        results.push({ ok: false, error: (error as Error).message });
      }
    }
    setBusy(false);
    const summary = importSummary(results);
    const text = COPY.importSummaryIn(summary.text, project.name);
    if (summary.tone === 'positive') ToastQueue.positive(text, { timeout: 5000 });
    else if (summary.tone === 'negative') ToastQueue.negative(text, { timeout: 6000 });
    else ToastQueue.neutral(text, { timeout: 6000 });
    if (results.some((r) => r.ok)) onClose();
  };

  return (
    <DialogContainer onDismiss={onClose}>
      <Dialog size="S">
        {({ close }) => (
          <>
            <Heading slot="title">{COPY.importTitle}</Heading>
            <Content>
              <div className={body}>
                {projects.length ? (
                  <Picker
                    label={COPY.importProject}
                    value={target}
                    onChange={(key) => key !== null && setTarget(String(key))}>
                    {projects.map((p) => (
                      <PickerItem key={p.id} id={p.id} textValue={p.name}>
                        {p.name}
                      </PickerItem>
                    ))}
                  </Picker>
                ) : null}
                <p className={hint}>{projects.length ? COPY.importHint : COPY.importNoProject}</p>
              </div>
            </Content>
            <ButtonGroup>
              <Button variant="secondary" onPress={close}>
                {COPY.cancel}
              </Button>
              <Button variant="accent" isDisabled={!project} isPending={busy} onPress={() => void pick()}>
                <Import />
                <Text>{COPY.importPick}</Text>
              </Button>
            </ButtonGroup>
          </>
        )}
      </Dialog>
    </DialogContainer>
  );
}
