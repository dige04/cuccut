import { useEffect, useRef, useState } from 'react';
import type { LegacyImportPrompt, LegacyImportRun } from '@cuccut/protocol';
import { ActionButton, Button, ButtonGroup, Checkbox, Content, Dialog, DialogContainer, Footer, Heading, Text, ToastQueue } from '@react-spectrum/s2';
import Folder from '@react-spectrum/s2/icons/Folder';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { agoLabel } from '../../model/format.ts';
import { displayDirectory, legacyImportDecision, type LegacyImportChoice } from '../../model/legacy-import.ts';
import { finishToast, legacyTaskId, LR, runLive } from '../../model/legacy-import-run.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { useConnection } from '../../state/connection-store.ts';
import { useLegacyImport } from '../../state/legacy-import-store.ts';
import { useShell } from '../../state/shell-store.ts';
import { LI } from './legacy-import-copy.ts';
import { useOpenImported } from './legacy-import-task.tsx';

/*
 * The startup prompt to import legacy projects (design mockup legacy-import.jsx; architecture design §2.7): mounted at the shell root. When the Runtime finds legacy projects that are not yet imported and has no recorded decision, it raises a prompt on the `legacy-import` topic, and this asks once:
 * - Whether to import: "Import" has focus, so Enter imports directly; "Skip" and closing the dialog both mean not importing this time: no request is sent, it is not shown again this launch, and it is asked again next launch.
 * - Where to import: the default is the `CucCut` folder under the system Documents folder given by the Runtime; "Change…" hands off to the system folder picker.
 * - Don't remind again: a checkbox in the footer; when ticked with skip, it answers `never`, the Runtime records it, and no more imports are offered.
 * After clicking "Import", the import runs as a background round: progress and results come from the same topic (`run`), are written to legacy-import-store, and the task page, the strip at the top of Home and the rail read from it. When a round (or a retry) finishes, a toast appears here with a destination (see the reason, or go to Space to see the imported projects).
 * The web has no such prompt: a remote browser cannot pick a local directory, and the topic and methods are not on the Web service's allowlist.
 */

/** "Skip" was clicked in this launch (this UI process): even if the Runtime restarts and raises the prompt again, it does not show; it is asked again next launch. */
let skippedThisLaunch = false;

const lead = style({ margin: 0, font: 'body', color: 'gray-800' });
const list = style({
  listStyleType: 'none',
  marginTop: 12,
  marginBottom: 0,
  marginX: 0,
  paddingY: 4,
  paddingX: 0,
  maxHeight: 160,
  overflowY: 'auto',
  overscrollBehavior: 'contain',
  borderRadius: 'default',
  backgroundColor: 'gray-100',
});
const item = style({ display: 'flex', alignItems: 'baseline', gap: 12, paddingX: 12, paddingY: 4 });
const itemName = style({ flexGrow: 1, minWidth: 0, font: 'ui-sm', color: 'gray-900', truncate: true });
const itemWhen = style({ flexShrink: 0, font: 'ui-sm', color: 'gray-600' });
const dest = style({ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 4 });
const destLabel = style({ font: 'ui-sm', fontWeight: 'bold', color: 'gray-700' });
const pathRow = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  minHeight: 40,
  paddingStart: 12,
  paddingEnd: 4,
  borderWidth: 2,
  borderStyle: 'solid',
  borderColor: 'gray-200',
  borderRadius: 'default',
  color: 'gray-700',
  '--iconPrimary': { type: 'fill', value: 'currentColor' },
});
const pathText = style({ flexGrow: 1, minWidth: 0, font: 'code-xs', color: 'gray-900', truncate: true, userSelect: 'text' });
const note = style({ margin: 0, font: 'ui-sm', color: 'gray-600' });
const hint = style({ marginTop: 12, marginBottom: 0, font: 'ui-sm', color: 'gray-600' });

export function LegacyImportHost() {
  const runtime = useRuntime();
  const web = runtime.host.platform === 'web';
  const connected = useConnection((s) => s.state.status === 'connected');
  const prompt = useLegacyImport((s) => s.prompt);
  const [skipped, setSkipped] = useState(skippedThisLaunch);
  // Between a successful answer and the Runtime pushing "prompt gone", this prompt is not shown, so the user is not made to click again.
  const [answered, setAnswered] = useState<string | null>(null);
  const onRun = useRunToasts();

  useEffect(() => {
    if (web) return;
    return runtime.watchLegacyImport((state) => {
      useLegacyImport.getState().set(state);
      onRun.current(state.run);
    });
  }, [runtime, web, onRun]);

  if (web || !connected || !prompt || skipped || prompt.promptId === answered) return null;
  return (
    <LegacyImportDialog
      key={prompt.promptId}
      prompt={prompt}
      onSkip={() => {
        skippedThisLaunch = true;
        setSkipped(true);
      }}
      onAnswered={() => setAnswered(prompt.promptId)}
    />
  );
}

/**
 * Toast when a round (or one retry) of the import finishes. The UI records the projects this round showed as queued and imported: if the round covers the whole import, it reports overall; otherwise it reports only the ones retried.
 * Rounds that had already finished when the UI opened are not reported (the UI did not see them run).
 */
function useRunToasts() {
  const go = useShell((s) => s.go);
  const openImported = useOpenImported();
  const seen = useRef<{ runId: string; live: boolean; batch: Set<string> } | null>(null);
  const handler = useRef<(run: LegacyImportRun | null) => void>(() => {});
  handler.current = (run) => {
    if (!run) {
      seen.current = null;
      return;
    }
    const before = seen.current?.runId === run.runId ? seen.current : null;
    const live = runLive(run);
    // First seen already running (the UI was reopened after the import had started): counted as the whole import; a retry queued after it finished starts from empty.
    const batch = before?.live
      ? before.batch
      : new Set<string>(before ? [] : run.items.filter((it) => it.state !== 'skipped').map((it) => it.path));
    for (const item of run.items) if (item.state === 'queued' || item.state === 'importing') batch.add(item.path);
    seen.current = { runId: run.runId, live, batch };
    if (!before?.live || live) return;
    const t = finishToast(run, batch);
    const show = t.tone === 'positive' ? ToastQueue.positive : ToastQueue.neutral;
    show(t.text, {
      actionLabel: t.action === 'result' ? LR.viewReasons : LR.viewInSpace,
      shouldCloseOnAction: true,
      onAction: () => (t.action === 'result' ? go({ tab: 'tasks', taskId: legacyTaskId(run.runId) }) : openImported(run)),
    });
  };
  return handler;
}

function LegacyImportDialog({ prompt, onSkip, onAnswered }: { prompt: LegacyImportPrompt; onSkip(): void; onAnswered(): void }) {
  const runtime = useRuntime();
  const go = useShell((s) => s.go);
  const platform = runtime.host.platform;
  // State lives outside the dialog: S2's Dialog renders children in several slots; each open starts from the defaults.
  const [directory, setDirectory] = useState(prompt.defaultDirectory);
  const [never, setNever] = useState(false);
  const [busy, setBusy] = useState(false);
  const count = prompt.projects.length;
  const shown = displayDirectory(directory, platform);

  const answer = async (choice: LegacyImportChoice) => {
    if (busy) return;
    const decision = legacyImportDecision(choice, never);
    if (decision === null) {
      onSkip();
      ToastQueue.neutral(LI.skipped);
      return;
    }
    setBusy(true);
    try {
      await runtime.answerLegacyImport(
        decision === 'import' ? { promptId: prompt.promptId, decision, directory } : { promptId: prompt.promptId, decision },
      );
      onAnswered();
      if (decision === 'import') {
        // The ID for this round is taken when the button is clicked: when the answer succeeds, the Runtime may not yet have pushed this round.
        ToastQueue.info(LI.importing(count), {
          actionLabel: LR.viewProgress,
          shouldCloseOnAction: true,
          onAction: () => {
            const run = useLegacyImport.getState().run;
            go(run ? { tab: 'tasks', taskId: legacyTaskId(run.runId) } : { tab: 'tasks' });
          },
        });
      } else ToastQueue.neutral(LI.neverDone);
    } catch (error) {
      // If the folder cannot be created or written to, or the prompt is already gone: stay in the dialog and try another folder.
      ToastQueue.negative(LI.failed(error instanceof Error ? error.message : String(error)));
      setBusy(false);
    }
  };

  const pick = async () => {
    const picked = await runtime.host.pickDirectory({ title: LI.pickTitle });
    if (picked) setDirectory(picked);
  };

  return (
    <DialogContainer onDismiss={() => void answer('skip')}>
      <Dialog size="M">
        <Heading slot="title">{LI.title}</Heading>
        <Content>
          <p className={lead}>{LI.lead(count)}</p>
          <ul className={list} aria-label={LI.found}>
            {prompt.projects.map((p) => (
              <li key={p.path} className={item} title={p.path}>
                <span className={itemName}>{p.title}</span>
                {p.editedAt ? <span className={itemWhen}>{agoLabel(p.editedAt)}</span> : null}
              </li>
            ))}
          </ul>
          <div className={dest}>
            <span className={destLabel}>{LI.destination}</span>
            <div className={pathRow}>
              <Folder aria-hidden />
              <span className={pathText} title={directory}>
                {shown}
              </span>
              {directory !== prompt.defaultDirectory ? (
                <ActionButton isQuiet size="S" isDisabled={busy} onPress={() => setDirectory(prompt.defaultDirectory)}>
                  <Text>{LI.resetDefault}</Text>
                </ActionButton>
              ) : null}
              <ActionButton isQuiet size="S" isDisabled={busy} onPress={() => void pick()}>
                <Text>{LI.change}</Text>
              </ActionButton>
            </div>
            <p className={note}>{LI.destinationNote}</p>
          </div>
          <p className={hint}>{LI.hint}</p>
        </Content>
        <Footer>
          <Checkbox isSelected={never} onChange={setNever} isDisabled={busy}>
            {LI.never}
          </Checkbox>
        </Footer>
        <ButtonGroup>
          <Button variant="secondary" isDisabled={busy} onPress={() => void answer('skip')}>
            {LI.skip}
          </Button>
          <Button variant="accent" autoFocus isPending={busy} onPress={() => void answer('import')}>
            {LI.import}
          </Button>
        </ButtonGroup>
      </Dialog>
    </DialogContainer>
  );
}
