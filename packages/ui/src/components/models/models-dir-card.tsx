import { useCallback, useEffect, useRef, useState } from 'react';
import type { ModelsDirInfo, ModelsDirInspection, ModelsDirMode } from '@cuccut/protocol';
import {
  Button,
  ButtonGroup,
  Content,
  Dialog,
  DialogContainer,
  Heading,
  InlineAlert,
  ProgressBar,
  ProgressCircle,
  Radio,
  RadioGroup,
  Text,
  ToastQueue,
} from '@react-spectrum/s2';
import AlertTriangle from '@react-spectrum/s2/icons/AlertTriangle';
import Folder from '@react-spectrum/s2/icons/Folder';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { revealLabel } from '../../copy.ts';
import { problemText, rpcProblem } from '../../model/models-install.ts';
import {
  MODELS_DIR_COPY as COPY,
  appliedText,
  changePlan,
  dirBlocker,
  dirHealth,
  dirStats,
  moveProgressView,
  pickedMode,
  shortenDir,
  type ChangePlan,
} from '../../model/models-dir.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { useJobs } from '../../state/jobs-store.ts';
import { useModels } from '../../state/models-store.ts';
import { useSetting } from '../../state/settings-store.ts';
import { useShell } from '../../state/shell-store.ts';
import { Chips } from './model-parts.tsx';
import { PANEL } from '../settings/settings-ui.tsx';

/*
 * Settings › Local models › Model directory (architecture design §6.3; design mock settings-models-dir.jsx / .css `.mdir`). Shared by the top of each category's local models page:
 * the current directory and its usage, change / show in folder / restore default, the change confirmation box, and move progress. Not shown in the browser (the Web allowlist does not include these methods).
 */

const card = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  marginBottom: 20,
  paddingX: 20,
  paddingY: 16,
  minWidth: 0,
});
const head = style({ display: 'flex', alignItems: 'center', gap: 8 });
const title = style({ margin: 0, font: 'ui', fontWeight: 'medium', color: 'gray-900' });
const pathRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  minWidth: 0,
  font: 'code-sm',
  color: 'gray-900',
  '--iconPrimary': { type: 'fill', value: 'gray-700' },
});
const pathText = style({ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', userSelect: 'text' });
const stats = style({ font: 'ui-sm', color: 'gray-700' });
const moving = style({ display: 'flex', flexDirection: 'column', gap: 4 });
const acts = style({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 4 });
const note = style({
  display: 'flex',
  alignItems: 'start',
  gap: '[6px]',
  margin: 0,
  font: 'ui-xs',
  overflowWrap: 'anywhere',
  color: { default: 'gray-700', tone: { warn: 'orange-900', bad: 'negative-900' } },
  '--iconPrimary': { type: 'fill', value: 'currentColor' },
});
const noteText = style({ minWidth: 0, flexGrow: 1 });
const noteIcon = style({ display: 'flex', flexShrink: 0, marginTop: 2 });

const dialogBody = style({ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 });
const dialogText = style({ margin: 0, font: 'ui-sm', color: 'gray-800', overflowWrap: 'anywhere' });
const dialogPath = style({ font: 'code-sm', overflowWrap: 'anywhere', userSelect: 'text' });
const waiting = style({ display: 'flex', alignItems: 'center', gap: 8, font: 'ui-sm', color: 'gray-700' });
const problem = style({ margin: 0, font: 'ui-sm', color: 'negative-900', overflowWrap: 'anywhere' });

/** Model directory card. Returns null in the browser. */
export function ModelsDirCard() {
  const runtime = useRuntime();
  const web = runtime.host.platform === 'web';
  const jobs = useJobs((s) => s.jobs);
  const bundles = useModels((s) => s.bundles);
  const setting = useSetting('models.dir');
  const go = useShell((s) => s.go);
  const [info, setInfo] = useState<ModelsDirInfo | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ target: string | null } | null>(null);
  const [picking, setPicking] = useState(false);
  const seq = useRef(0);

  const refresh = useCallback(() => {
    if (web) return;
    const mine = ++seq.current;
    runtime.getModelsDir().then(
      (next) => {
        if (mine !== seq.current) return;
        setInfo(next);
        setFailed(null);
      },
      (error: unknown) => mine === seq.current && setFailed(problemText(rpcProblem(error))),
    );
  }, [runtime, web]);

  // Re-read when the setting changes (another window, changed by the CLI) and when model package state changes (installed, deleted, directory changed).
  useEffect(() => refresh(), [refresh, setting, bundles]);

  const moveJob = info?.moveJobId ? jobs.find((j) => j.jobId === info.moveJobId) : undefined;
  const moveEnded = !!moveJob && !['queued', 'running'].includes(moveJob.state);
  useEffect(() => {
    if (moveEnded) refresh();
  }, [moveEnded, refresh]);

  if (web) return null;
  if (!info) {
    return (
      <section className={`${card} ${PANEL}`} aria-label={COPY.title}>
        <h2 className={title}>{COPY.title}</h2>
        <p className={note({})} role="status">
          {failed ?? COPY.loading}
        </p>
      </section>
    );
  }

  const locked = info.source === 'env';
  const busyMove = !!info.moveJobId && !moveEnded;
  const block = locked || busyMove ? null : dirBlocker(jobs, bundles);
  const health = dirHealth(info);
  const progress = busyMove ? moveProgressView(moveJob, info.moveTo) : null;
  const off = !!block || busyMove || picking;

  const pick = async () => {
    setPicking(true);
    try {
      const next = await runtime.host.pickDirectory();
      if (next) setDialog({ target: next });
    } catch (error) {
      ToastQueue.negative(COPY.pickFailed((error as Error).message), { timeout: 5000 });
    } finally {
      setPicking(false);
    }
  };

  return (
    <section className={`${card} ${PANEL}`} aria-label={COPY.title}>
      <div className={head}>
        <h2 className={title}>{COPY.title}</h2>
        {info.source === 'default' ? <Chips chips={[{ label: COPY.defaultChip, tone: 'neutral' }]} /> : null}
        {locked ? <Chips chips={[{ label: COPY.envChip, tone: 'notice' }]} /> : null}
      </div>
      <div className={pathRow} title={info.path}>
        <Folder />
        <span className={pathText}>{shortenDir(info.path, 48)}</span>
      </div>
      {progress ? (
        <div className={moving} role="status">
          <ProgressBar
            size="S"
            label={COPY.movingLabel}
            isIndeterminate={progress.percent === null}
            value={progress.percent ?? undefined}
          />
          <span className={note({})}>
            {progress.label} {COPY.stayOpen}
          </span>
        </div>
      ) : (
        <div className={stats}>{dirStats(info)}</div>
      )}
      {health ? (
        <p className={note({ tone: 'bad' })} role="status">
          <span className={noteIcon}>
            <AlertTriangle />
          </span>
          <span className={noteText}>{health}</span>
        </p>
      ) : null}
      <div className={acts}>
        {locked ? null : (
          <Button variant="secondary" size="S" isDisabled={off} isPending={picking} onPress={() => void pick()}>
            {COPY.change}
          </Button>
        )}
        <Button variant="secondary" size="S" isDisabled={busyMove || !info.exists} onPress={() => void runtime.host.revealPath(info.path)}>
          <Folder />
          <Text>{revealLabel()}</Text>
        </Button>
        {info.source === 'setting' ? (
          <Button variant="secondary" fillStyle="outline" size="S" isDisabled={off} onPress={() => setDialog({ target: null })}>
            {COPY.restore}
          </Button>
        ) : null}
      </div>
      {locked ? <p className={note({})}>{COPY.envNote}</p> : null}
      {block ? (
        <p className={note({ tone: 'warn' })} role="status">
          <span className={noteIcon}>
            <AlertTriangle />
          </span>
          <span className={noteText}>
            {COPY.blockedPrefix}
            {block.text}
          </span>
          {block.hasTasks ? (
            <Button variant="secondary" fillStyle="outline" size="S" onPress={() => go({ tab: 'tasks' })}>
              {COPY.viewTasks}
            </Button>
          ) : null}
        </p>
      ) : null}
      <p className={note({})}>{COPY.shareHint}</p>
      {dialog ? (
        <ChangeDialog
          target={dialog.target}
          defaultPath={info.defaultPath}
          onClose={() => setDialog(null)}
          onApplied={(next) => {
            setInfo(next);
            refresh();
          }}
        />
      ) : null}
    </section>
  );
}

type Phase =
  { kind: 'checking' } | { kind: 'ready'; inspection: ModelsDirInspection; plan: ChangePlan } | { kind: 'failed'; message: string };

/**
 * Change confirmation box: first inspects the chosen folder read-only (`models.inspectDir`), and says how many models are already in it and how much disk space is available. When the current directory has models, it offers a choice between “Move it there” and “Only switch location”. If the Runtime rejects it, the reason stays in the box. A `target` of null means restoring the default location.
 */
function ChangeDialog({
  target,
  defaultPath,
  onClose,
  onApplied,
}: {
  target: string | null;
  defaultPath: string;
  onClose: () => void;
  onApplied: (info: ModelsDirInfo) => void;
}) {
  const runtime = useRuntime();
  const [phase, setPhase] = useState<Phase>({ kind: 'checking' });
  const [mode, setMode] = useState<ModelsDirMode>('move');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    runtime.inspectModelsDir(target).then(
      (inspection) => live && setPhase({ kind: 'ready', inspection, plan: changePlan(inspection) }),
      (error: unknown) => live && setPhase({ kind: 'failed', message: problemText(rpcProblem(error)) }),
    );
    return () => {
      live = false;
    };
  }, [runtime, target]);

  const plan = phase.kind === 'ready' ? phase.plan : null;
  const ready = !!plan && (plan.kind === 'direct' || plan.kind === 'choose');
  const picked = plan ? pickedMode(plan, mode) : 'switch';
  const shown = target ?? defaultPath;

  const submit = async (close: () => void) => {
    if (!plan || !ready || phase.kind !== 'ready') return;
    setBusy(true);
    setFailure(null);
    try {
      const result = await runtime.setModelsDir(target, picked);
      ToastQueue.positive(appliedText(picked, shown, phase.inspection.current.bytes > 0, result.jobId !== null), { timeout: 4000 });
      onApplied(result.dir);
      close();
    } catch (error) {
      setFailure(problemText(rpcProblem(error)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <DialogContainer onDismiss={onClose}>
      <Dialog size="M">
        {({ close }) => (
          <>
            <Heading slot="title">{target === null ? COPY.restoreTitle : COPY.changeTitle}</Heading>
            <Content>
              <div className={dialogBody}>
                <p className={dialogText}>
                  {target === null ? `${COPY.restoreLead} ` : null}
                  <span className={dialogPath} title={shown}>
                    {shortenDir(shown, 60)}
                  </span>
                </p>
                {phase.kind === 'checking' ? (
                  <div className={waiting}>
                    <ProgressCircle size="S" isIndeterminate aria-label={COPY.checking} />
                    <span>{COPY.checking}</span>
                  </div>
                ) : null}
                {phase.kind === 'failed' ? <p className={problem}>{phase.message}</p> : null}
                {plan?.kind === 'error' ? (
                  <InlineAlert variant="negative">
                    <Heading>{plan.title}</Heading>
                    <Content>{plan.text}</Content>
                  </InlineAlert>
                ) : null}
                {plan?.kind === 'same' ? <p className={dialogText}>{COPY.same}</p> : null}
                {plan?.kind === 'direct' || plan?.kind === 'choose' ? (
                  <p className={dialogText} role="status">
                    {plan.found}
                  </p>
                ) : null}
                {plan?.kind === 'choose' ? (
                  <RadioGroup label={COPY.howTo} value={picked} onChange={(v) => setMode(v as ModelsDirMode)}>
                    <Radio value="move" isDisabled={plan.move.disabled} description={plan.move.description}>
                      {COPY.moveOption}
                    </Radio>
                    <Radio value="switch" description={plan.switchDescription}>
                      {COPY.switchOption}
                    </Radio>
                  </RadioGroup>
                ) : null}
                {failure ? <p className={problem}>{failure}</p> : null}
              </div>
            </Content>
            <ButtonGroup>
              <Button variant="secondary" onPress={close}>
                {COPY.cancel}
              </Button>
              <Button variant="accent" isPending={busy} isDisabled={!ready || busy} onPress={() => void submit(close)}>
                {picked === 'move' && plan?.kind === 'choose' ? COPY.confirmMove : COPY.confirmSwitch}
              </Button>
            </ButtonGroup>
          </>
        )}
      </Dialog>
    </DialogContainer>
  );
}
