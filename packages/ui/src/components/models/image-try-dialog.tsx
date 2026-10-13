import { useState } from 'react';
import type { ImageModelInfo } from '@cuccut/protocol';
import {
  ActionButton,
  Badge,
  Button,
  ButtonGroup,
  Content,
  Dialog,
  DialogContainer,
  Heading,
  Text,
  TextArea,
  ToastQueue,
} from '@react-spectrum/s2';
import CopyIcon from '@react-spectrum/s2/icons/Copy';
import DownloadIcon from '@react-spectrum/s2/icons/Download';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import {
  noticeAfterTry,
  tryFailureKind,
  tryFailureView,
  type TryAction,
  type TryFailureInput,
  type TryNoteView,
} from '../../model/model-check.ts';
import { TRY_SUBJECT_IMAGE } from '../../model/model-check-copy.ts';
import { IMAGE_TRY_STEPS, imageTryRequest, outputFacts, probeFromJob } from '../../model/models-probe.ts';
import { IMAGE_SAMPLES, imageFileName } from '../../model/tools-image.ts';
import { codePoints } from '../../model/tools-models.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { useJobs } from '../../state/jobs-store.ts';
import { RECORD_COPY } from '../tools/tools-copy.ts';
import { copyText, useArtifactUrl, useDownloadArtifact } from '../tools/use-tool-records.ts';
import { ModelTryNote } from './model-check-line.tsx';
import { IMAGE_LOCAL_COPY as COPY, quoted } from './models-copy.ts';

const stack = style({ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 });
const head = style({ display: 'flex', alignItems: 'center', gap: 8 });
const title = style({ font: 'title-sm', color: 'gray-900' });
const modelId = style({ font: 'code-sm', color: 'gray-700', overflowWrap: 'anywhere', userSelect: 'text' });
const sample = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: 12,
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'gray-200',
  borderRadius: 'lg',
  backgroundColor: 'layer-1',
});
const sampleTitle = style({ font: 'ui', fontWeight: 'bold', color: 'gray-900' });
const promptField = style({ width: 'full' });
const sampleFoot = style({ display: 'flex', alignItems: 'center', gap: 8 });
const chars = style({ flexGrow: 1, font: 'ui-xs', color: { default: 'gray-600', isOver: 'orange-1000' } });
const note = style({ margin: 0, font: 'ui-sm', color: 'gray-600' });
const result = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: 12,
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'gray-200',
  borderRadius: 'lg',
});
const resultTitle = style({ font: 'ui', fontWeight: 'bold', color: { default: 'gray-900', isFailed: 'red-900' } });
const resultRow = style({ display: 'flex', gap: 12, alignItems: 'start', minWidth: 0 });
const picture = style({ display: 'block', width: 160, height: 160, flexShrink: 0, borderRadius: 'default', objectFit: 'contain' });
const resultMeta = style({ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 });
const resultText = style({ margin: 0, font: 'ui-sm', color: 'gray-800', overflowWrap: 'anywhere', userSelect: 'text' });
const resultPrompt = style({ font: 'ui-xs', color: 'gray-700', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
const resultActions = style({ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 });

/**
 * The “试画”(trial draw) on the local image generation model row (design mock image-gen.jsx `ImageProbeDialog`, local branch; settings-local.jsx `imgProbe`): the prompt can be edited, and submitting sends one real `models.generateImage` (`provider: 'local'`, 512 × 512, 8 steps, one image). Progress and results are read from the `jobs` topic; the result can be viewed and downloaded, and the prompt can be copied. A trial draw is not a check: if the model's last check did not pass, the dialog opens by saying so (`notice`; not repeated once an image has been produced after that check). Its own failures use the check wording (what is wrong · what to do · buttons). “检查模型 / 修复… / 重新检查”(Check model / Repair… / Re-check) are handed back to the row (`onCheck`). Closing the dialog does not cancel the task.
 */
export function ImageTryDialog({
  bundleId,
  name,
  chip,
  model,
  notice,
  canCheck,
  onCheck,
  onClose,
}: {
  bundleId: string;
  name: string;
  /** Small label next to the name: backend (MLX). */
  chip: string;
  model: ImageModelInfo;
  notice: TryNoteView | null;
  canCheck: boolean;
  onCheck: (k: 'repair' | 'recheck' | 'check') => void;
  onClose: () => void;
}) {
  const runtime = useRuntime();
  const jobs = useJobs((s) => s.jobs);
  const download = useDownloadArtifact();
  const [prompt, setPrompt] = useState<string>(IMAGE_SAMPLES[0]);
  const [run, setRun] = useState<{ jobId: string; prompt: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // The submission that did not reach the Runtime (the submit was rejected).
  const [issue, setIssue] = useState<Omit<TryFailureInput, 'canCheck' | 'subject'> | null>(null);

  const job = run ? jobs.find((j) => j.jobId === run.jobId) : undefined;
  const state = run ? probeFromJob(run.jobId, job) : null;
  const running = submitting || state?.status === 'running';
  const output = state?.status === 'done' ? state.output : null;
  const media = useArtifactUrl(output?.artifactId ?? null);
  const shownNotice = noticeAfterTry(notice, output ? (job?.endedAt ?? job?.updatedAt) : null);
  const failure: Omit<TryFailureInput, 'canCheck' | 'subject'> | null =
    issue ??
    (state?.status === 'failed' ? { kind: tryFailureKind(job?.error?.code ?? null, job?.error?.details), message: state.message } : null);
  const failureView = failure && !running ? tryFailureView({ ...failure, canCheck, subject: TRY_SUBJECT_IMAGE }) : null;
  const trimmed = prompt.trim();
  const count = codePoints(trimmed);
  const over = count > model.maxPromptChars;

  const submit = async () => {
    if (running || !trimmed || over) return;
    setIssue(null);
    setSubmitting(true);
    try {
      const jobId = await runtime.generateImage(imageTryRequest(bundleId, trimmed));
      setRun({ jobId, prompt: trimmed });
    } catch (error) {
      const details = (error as { details?: unknown } | null)?.details;
      const code = (details as { code?: unknown } | undefined)?.code;
      setRun(null);
      setIssue({
        kind: tryFailureKind(typeof code === 'string' ? code : null, details),
        message: (error as Error).message,
        notStarted: true,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const onNote = (k: TryAction['k']) => {
    if (k === 'retry') void submit();
    else if (k === 'repair' || k === 'recheck' || k === 'check') {
      onClose();
      onCheck(k);
    }
  };

  const fileName = output ? imageFileName(COPY.tryFileName(bundleId.replace(/[^\w.-]+/g, '-')), output.mediaType) : null;
  const heading =
    state === null && !issue
      ? COPY.tryReady
      : running
        ? COPY.tryRunning(IMAGE_TRY_STEPS)
        : state?.status === 'done'
          ? COPY.tryDone(state.seconds)
          : COPY.tryFailed;

  return (
    <DialogContainer onDismiss={onClose}>
      <Dialog size="M">
        {({ close }) => (
          <>
            <Heading slot="title">{COPY.tryTitle(name)}</Heading>
            <Content>
              <div className={stack}>
                <ModelTryNote view={shownNotice} onAction={onNote} />
                <div>
                  <div className={head}>
                    <span className={title}>{name}</span>
                    <Badge variant="neutral" size="S" fillStyle="subtle">
                      {chip}
                    </Badge>
                  </div>
                  <div className={modelId}>{bundleId}</div>
                </div>
                <div className={sample}>
                  <span className={sampleTitle}>{COPY.tryPromptTitle}</span>
                  <TextArea
                    aria-label={COPY.tryPromptLabel}
                    placeholder={COPY.tryPlaceholder}
                    value={prompt}
                    onChange={setPrompt}
                    isDisabled={running}
                    styles={promptField}
                  />
                  <div className={sampleFoot}>
                    <span className={chars({ isOver: over })}>{COPY.tryChars(count, model.maxPromptChars)}</span>
                    <ActionButton
                      isQuiet
                      size="S"
                      isDisabled={running}
                      onPress={() => setPrompt(prompt === IMAGE_SAMPLES[0] ? IMAGE_SAMPLES[1] : IMAGE_SAMPLES[0])}>
                      {COPY.trySample}
                    </ActionButton>
                  </div>
                  <p className={note}>{COPY.tryFacts(IMAGE_TRY_STEPS)}</p>
                </div>
                <p className={note}>{COPY.tryNote}</p>
                <div className={result} role="status" aria-live="polite" aria-label={COPY.tryResult}>
                  <span className={resultTitle({ isFailed: !!failureView })}>{heading}</span>
                  {failureView ? <ModelTryNote view={failureView} onAction={onNote} /> : null}
                  {output && run ? (
                    <div className={resultRow}>
                      {media?.status === 'ready' ? <img className={picture} src={media.url} alt={COPY.tryImageAlt} /> : null}
                      <div className={resultMeta}>
                        {media?.status === 'failed' ? <p className={resultText}>{COPY.tryOpenFailed(media.message)}</p> : null}
                        <span className={note}>{outputFacts(output)}</span>
                        <span className={resultPrompt}>{quoted(run.prompt)}</span>
                        <span className={note}>{COPY.tryWhere}</span>
                        <div className={resultActions}>
                          <Button
                            variant="secondary"
                            size="S"
                            onPress={() => {
                              if (!fileName) return;
                              download(output.artifactId, fileName).catch((e: Error) =>
                                ToastQueue.negative(RECORD_COPY.downloadFailed(e.message), { timeout: 6000 }),
                              );
                            }}>
                            <DownloadIcon />
                            <Text>{COPY.tryDownload}</Text>
                          </Button>
                          <ActionButton isQuiet size="S" onPress={() => copyText(run.prompt)}>
                            <CopyIcon />
                            <Text>{COPY.tryCopy}</Text>
                          </ActionButton>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </Content>
            <ButtonGroup>
              <Button variant="secondary" onPress={close}>
                {running ? COPY.tryStopWaiting : COPY.tryClose}
              </Button>
              <Button variant="accent" isDisabled={running || !trimmed || over} isPending={running} onPress={() => void submit()}>
                {running ? COPY.tryBusy : state === null && !issue ? COPY.tryStart : COPY.tryAgain}
              </Button>
            </ButtonGroup>
          </>
        )}
      </Dialog>
    </DialogContainer>
  );
}
