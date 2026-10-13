import { useEffect, useState } from 'react';
import type { ModelInstallPlan, ModelLicense } from '@cuccut/protocol';
import { Button, ButtonGroup, Content, Dialog, DialogContainer, Heading, ProgressCircle, ToastQueue } from '@react-spectrum/s2';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { CHECK_LABEL } from '../../model/model-check-copy.ts';
import { installPlanView, problemText, rpcProblem } from '../../model/models-install.ts';
import { licenseBrief, nonCommercial } from '../../model/models-tts-local.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { confirmInstall, planInstall, type InstallMode } from './local-model-actions.ts';
import { LOCAL_INSTALL_COPY as COPY } from './local-models-copy.ts';
import { TTS_LOCAL_COPY as TTS } from './tts-local-copy.ts';

const stack = style({ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 });
const waiting = style({ display: 'flex', alignItems: 'center', gap: 8, font: 'ui-sm', color: 'gray-700' });
const lead = style({ margin: 0, font: 'body', fontWeight: 'bold', color: 'gray-900' });
const text = style({ margin: 0, font: 'ui-sm', color: 'gray-800', overflowWrap: 'anywhere' });
const note = style({ margin: 0, font: 'ui-xs', color: 'gray-600', overflowWrap: 'anywhere', userSelect: 'text' });
const problem = style({ margin: 0, font: 'ui-sm', color: 'negative-900', overflowWrap: 'anywhere' });
const lines = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  margin: 0,
  padding: 12,
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'gray-200',
  borderRadius: 'lg',
  backgroundColor: 'layer-1',
});
const line = style({ display: 'flex', justifyContent: 'space-between', gap: 12, font: 'ui-xs', color: 'gray-800' });
const lineLabel = style({ overflowWrap: 'anywhere', minWidth: 0 });
const lineValue = style({ flexShrink: 0, color: 'gray-600' });
const licenseBox = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  padding: 12,
  borderRadius: 'lg',
  backgroundColor: 'notice-subtle',
  color: 'gray-900',
});
const licenseHead = style({ margin: 0, font: 'ui-sm', fontWeight: 'bold' });

type Phase =
  | { kind: 'planning' }
  | { kind: 'plan'; plan: ModelInstallPlan; replanned: boolean }
  | { kind: 'failed'; message: string };

/**
 * Confirmation for download / complete / repair (the two steps of architecture design §6.3): when opened, only the plan is fetched (nothing downloaded). It shows how much will be downloaded, how much will resume, how much disk space is left, and where it comes from. On confirm, `confirmBytes` is passed back unchanged. If the size has changed, a new plan replaces the old one and the question is asked again, without closing the dialog. If disk space is clearly insufficient, confirmation is not allowed.
 * Models not licensed for commercial use (design mock panel-tts-local.jsx `withModelLicense`) state the license before download, and the confirm button reads “我知道了，下载”(I understand, download). Complete and repair do not ask again (weights are already present, design mock settings-local.jsx). Complete downloads only the missing components, and first says that what is installed is left alone.
 * Repair (design mock settings-local.jsx, repair confirmation) states that after repair it will automatically check again; when all files are intact, it shows “重新检查”(Re-check).
 * State is kept in the outer layer of the Dialog: S2's Dialog renders its children once in each of several slots.
 */
export function InstallDialog({
  bundleId,
  name = bundleId,
  license = null,
  licenseUse = TTS.licenseUse,
  mode,
  note,
  onClose,
  onStarted,
  onRecheck,
}: {
  bundleId: string;
  /** Name used in the title and prompts; defaults to the model package ID. */
  name?: string;
  license?: ModelLicense | null;
  /** The sentence “用它做出的东西也只能……”(things made with it may only be…) used when the model is not licensed for commercial use; defaults to the speech synthesis wording. */
  licenseUse?: string;
  mode: InstallMode;
  /** Replaces the default sentence when completing (when a model is completed by borrowing a shared component from the shared components row, state that only what is missing gets downloaded). */
  note?: string;
  onClose: () => void;
  /** A task was submitted (for repair, the row records it and checks again automatically when it finishes; when given, the “开始下载”(Start download) prompt is not shown again). */
  onStarted?: (jobId: string) => void;
  /** For repair when the files are all intact: shows “重新检查”(Re-check). */
  onRecheck?: () => void;
}) {
  const runtime = useRuntime();
  const [phase, setPhase] = useState<Phase>({ kind: 'planning' });
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    planInstall(runtime, mode, bundleId).then(
      (result) => live && setPhase({ kind: 'plan', plan: result.plan, replanned: false }),
      (error: unknown) => live && setPhase({ kind: 'failed', message: problemText(rpcProblem(error)) }),
    );
    return () => {
      live = false;
    };
  }, [runtime, mode, bundleId]);

  const plan = phase.kind === 'plan' ? phase.plan : null;
  const view = plan ? installPlanView(plan) : null;
  const canConfirm = !!view && !view.upToDate && !view.noSpace && !busy;

  const submit = async (close: () => void) => {
    if (!plan || !canConfirm) return;
    setBusy(true);
    setFailure(null);
    try {
      const outcome = await confirmInstall(runtime, mode, plan);
      if (outcome.kind === 'started') {
        if (onStarted) onStarted(outcome.jobId);
        else ToastQueue.neutral(COPY.started(name), { timeout: 4000 });
        close();
      } else setPhase({ kind: 'plan', plan: outcome.plan, replanned: outcome.kind === 'replan' });
    } catch (error) {
      setFailure(problemText(rpcProblem(error)));
    } finally {
      setBusy(false);
    }
  };

  const size = view?.amount ?? '';
  const restricted = mode === 'install' ? nonCommercial(license) : null;
  return (
    <DialogContainer onDismiss={onClose}>
      <Dialog size="M">
        {({ close }) => (
          <>
            <Heading slot="title">
              {mode === 'repair' ? COPY.repairTitle(name) : mode === 'complete' ? COPY.completeTitle(name) : COPY.installTitle(name)}
            </Heading>
            <Content>
              <div className={stack}>
                {phase.kind === 'planning' ? (
                  <div className={waiting}>
                    <ProgressCircle size="S" isIndeterminate aria-label={COPY.planning} />
                    <span>{mode === 'repair' ? COPY.verifying : COPY.planning}</span>
                  </div>
                ) : null}
                {phase.kind === 'failed' ? (
                  <>
                    <p className={lead}>{COPY.planFailed}</p>
                    <p className={problem}>{phase.message}</p>
                  </>
                ) : null}
                {view ? (
                  view.upToDate ? (
                    <p className={text}>{mode === 'repair' ? COPY.repairUpToDate : COPY.upToDate}</p>
                  ) : (
                    <>
                      {phase.kind === 'plan' && phase.replanned ? <p className={problem}>{COPY.replanned}</p> : null}
                      {mode === 'complete' ? <p className={text}>{note ?? COPY.completeNote}</p> : null}
                      <p className={lead}>{view.size}</p>
                      {view.resumed ? <p className={text}>{view.resumed}</p> : null}
                      {view.space ? <p className={text}>{view.space}</p> : null}
                      {view.noSpace ? <p className={problem}>{view.noSpace}</p> : null}
                      <ul className={lines} aria-label={COPY.details}>
                        {view.lines.map((l) => (
                          <li key={l.key} className={line}>
                            <span className={lineLabel}>{l.label}</span>
                            <span className={lineValue}>{l.value}</span>
                          </li>
                        ))}
                      </ul>
                      <p className={note}>{COPY.source(view.source)}</p>
                      {mode === 'repair' ? <p className={text}>{COPY.repairThenCheck}</p> : null}
                      {restricted ? (
                        <div className={licenseBox} role="note" aria-label={TTS.licenseTitle}>
                          <p className={licenseHead}>
                            {TTS.licenseTitle} · {name}
                          </p>
                          <p className={text}>{licenseBrief(restricted)}</p>
                          <p className={note}>{restricted.url}</p>
                          <p className={text}>{licenseUse}</p>
                        </div>
                      ) : null}
                    </>
                  )
                ) : null}
                {failure ? <p className={problem}>{failure}</p> : null}
              </div>
            </Content>
            <ButtonGroup>
              <Button variant="secondary" onPress={close}>
                {view && !view.upToDate ? COPY.cancel : COPY.close}
              </Button>
              {view?.upToDate && mode === 'repair' && onRecheck ? (
                <Button
                  variant="accent"
                  onPress={() => {
                    close();
                    onRecheck();
                  }}>
                  {CHECK_LABEL.recheck}
                </Button>
              ) : null}
              {view && !view.upToDate ? (
                <Button variant="accent" isPending={busy} isDisabled={!canConfirm} onPress={() => void submit(close)}>
                  {mode === 'repair' ? COPY.confirmRepair : restricted ? TTS.licenseConfirm(size) : COPY.confirmInstall(size)}
                </Button>
              ) : null}
            </ButtonGroup>
          </>
        )}
      </Dialog>
    </DialogContainer>
  );
}
