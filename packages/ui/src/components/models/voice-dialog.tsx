import { useEffect, useState } from 'react';
import type { LibraryEntrySummary } from '@cuccut/protocol';
import {
  Button,
  ButtonGroup,
  Checkbox,
  Content,
  Dialog,
  DialogContainer,
  Form,
  Heading,
  Picker,
  PickerItem,
  ProgressCircle,
  TextArea,
  TextField,
  ToastQueue,
} from '@react-spectrum/s2';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import {
  formForFile,
  formFromEntry,
  formValid,
  rpcErrorText,
  validateVoiceForm,
  voiceLanguageOptions,
  voiceConsentStatement,
  VOICE_NAME_MAX,
  VOICE_TRANSCRIPT_MAX,
  type VoiceEntry,
  type VoiceForm,
} from '../../model/voices-library.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { createVoice, loadVoice, saveVoice } from './voice-actions.ts';
import { MY_VOICES_COPY as COPY } from './voices-copy.ts';

const waiting = style({ display: 'flex', alignItems: 'center', gap: 8, font: 'ui-sm', color: 'gray-700' });
const note = style({ margin: 0, font: 'ui-xs', color: 'gray-600', overflowWrap: 'anywhere', userSelect: 'text' });
const notice = style({ margin: 0, font: 'ui-sm', color: 'orange-1000', overflowWrap: 'anywhere' });
const problem = style({ margin: 0, font: 'ui-sm', color: 'negative-900', overflowWrap: 'anywhere' });

export type VoiceDialogMode = { kind: 'create'; path: string } | { kind: 'edit'; voice: LibraryEntrySummary };

function fileName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

/**
 * Create (from an audio file) or edit a voice: name, language, transcript and self-declaration. When editing, the full entry is read first, and saving carries the version number; if it was changed elsewhere, the latest content is swapped in with a note, and nothing is overwritten automatically. State is kept in the outer layer of the Dialog (S2's Dialog renders its children several times).
 */
export function VoiceDialog({
  mode,
  onClose,
  onCreated,
}: {
  mode: VoiceDialogMode;
  onClose: () => void;
  /** After creating and saving: the side that takes it back (the return from “克隆新音色…”(Clone new voice…)) needs to know which voice it is. */
  onCreated?: (voiceId: string) => void;
}) {
  const runtime = useRuntime();
  const [entry, setEntry] = useState<VoiceEntry | null>(null);
  const [form, setForm] = useState<VoiceForm | null>(mode.kind === 'create' ? formForFile(mode.path) : null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const editId = mode.kind === 'edit' ? mode.voice.id : null;

  useEffect(() => {
    if (!editId) return;
    let live = true;
    loadVoice(runtime, editId).then(
      (loaded) => {
        if (!live) return;
        setEntry(loaded);
        setForm(formFromEntry(loaded));
      },
      (error: unknown) => live && setLoadError(rpcErrorText(error)),
    );
    return () => {
      live = false;
    };
  }, [runtime, editId]);

  const patch = (next: Partial<VoiceForm>) => {
    setTouched(true);
    setForm((f) => (f ? { ...f, ...next } : f));
  };
  const errors = form ? validateVoiceForm(form) : null;
  const canSave = !!form && formValid(form) && !busy && (mode.kind === 'create' || !!entry);

  const submit = async (close: () => void) => {
    if (!form || !canSave) return;
    setBusy(true);
    setFailure(null);
    try {
      if (mode.kind === 'create') {
        const created = await createVoice(runtime, form, mode.path);
        ToastQueue.positive(COPY.saved(created.content.name), { timeout: 4000 });
        onCreated?.(created.id);
        close();
      } else if (entry) {
        const outcome = await saveVoice(runtime, form, entry);
        if (outcome.kind === 'saved') {
          ToastQueue.neutral(outcome.changed ? COPY.updated(outcome.entry.content.name) : COPY.unchanged, { timeout: 3000 });
          close();
        } else {
          setEntry(outcome.entry);
          setForm(formFromEntry(outcome.entry));
          setTouched(false);
          setConflict(outcome.message);
        }
      }
    } catch (error) {
      setFailure(rpcErrorText(error));
    } finally {
      setBusy(false);
    }
  };

  const languages = voiceLanguageOptions(form?.language ?? '');
  return (
    <DialogContainer onDismiss={onClose}>
      <Dialog size="M">
        {({ close }) => (
          <>
            <Heading slot="title">{mode.kind === 'create' ? COPY.createTitle : COPY.editTitle(mode.voice.name)}</Heading>
            <Content>
              {loadError ? <p className={problem}>{COPY.loadFailed(loadError)}</p> : null}
              {!form && !loadError ? (
                <div className={waiting}>
                  <ProgressCircle size="S" isIndeterminate aria-label={COPY.loading} />
                  <span>{COPY.loading}</span>
                </div>
              ) : null}
              {form ? (
                <Form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void submit(close);
                  }}>
                  {mode.kind === 'create' ? <p className={note}>{COPY.referenceFile(fileName(mode.path))}</p> : null}
                  {conflict ? <p className={notice}>{conflict}</p> : null}
                  <TextField
                    label={COPY.name}
                    value={form.name}
                    onChange={(name) => patch({ name })}
                    isRequired
                    autoFocus
                    maxLength={VOICE_NAME_MAX}
                    isInvalid={touched && !!errors?.name}
                    errorMessage={errors?.name ?? undefined}
                  />
                  <Picker
                    label={COPY.language}
                    description={COPY.languageHint}
                    items={languages}
                    selectedKey={form.language}
                    onSelectionChange={(key) => key !== null && patch({ language: String(key) })}>
                    {(l) => <PickerItem id={l.key}>{l.label}</PickerItem>}
                  </Picker>
                  <TextArea
                    label={COPY.transcript}
                    description={COPY.transcriptHint}
                    value={form.transcript}
                    onChange={(transcript) => patch({ transcript })}
                    maxLength={VOICE_TRANSCRIPT_MAX}
                    isInvalid={!!errors?.transcript}
                    errorMessage={errors?.transcript ?? undefined}
                  />
                  <Checkbox isSelected={form.consent} onChange={(consent) => patch({ consent })}>
                    {voiceConsentStatement()}
                  </Checkbox>
                  <p className={note}>{COPY.consentHint}</p>
                  {failure ? <p className={problem}>{failure}</p> : null}
                </Form>
              ) : null}
            </Content>
            <ButtonGroup>
              <Button variant="secondary" onPress={close}>
                {COPY.cancel}
              </Button>
              <Button variant="accent" isPending={busy} isDisabled={!canSave} onPress={() => void submit(close)}>
                {mode.kind === 'create' ? COPY.save : COPY.saveEdit}
              </Button>
            </ButtonGroup>
          </>
        )}
      </Dialog>
    </DialogContainer>
  );
}
