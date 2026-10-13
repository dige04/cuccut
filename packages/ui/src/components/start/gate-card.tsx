import { useState } from 'react';
import { Button, ToastQueue } from '@react-spectrum/s2';
import { TriangleAlert } from 'lucide-react';
import { HOME_COPY } from '../../copy.ts';
import type { GateGuide } from '../../model/home-brief.ts';
import { configureAgent } from '../../runtime/agent-commands.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { useShell } from '../../state/shell-store.ts';

/** The action on the guidance: if the Agent is installed but only disabled, enable it directly (once written back to the Agent list, the guidance disappears by itself); otherwise go to Settings › Agent. */
export function useGateFix(guide: GateGuide): { busy: boolean; fix(): Promise<void> } {
  const runtime = useRuntime();
  const go = useShell((s) => s.go);
  const [busy, setBusy] = useState(false);
  const fix = async () => {
    if (!guide.enable) {
      go({ tab: 'settings', section: 'agent' });
      return;
    }
    setBusy(true);
    try {
      await configureAgent(runtime, guide.enable.id, { enabled: true });
    } catch (error) {
      ToastQueue.negative(HOME_COPY.enableFailed((error as Error).message), { timeout: 5000 });
    } finally {
      setBusy(false);
    }
  };
  return { busy, fix };
}

/**
 * Guidance card below the start page when the Agent is unusable (prototype new-options.jsx `GateCard`): a solid card in agentcut's style, with the one
 * action that fixes it (the send button is disabled meanwhile, so this is the view's primary action).
 */
export function GateCard({ guide }: { guide: GateGuide }) {
  const { busy, fix } = useGateFix(guide);
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-3xl bg-card px-4 py-3 ring-1 ring-accent/30 sm:flex-nowrap" role="status">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent" aria-hidden>
        <TriangleAlert className="size-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm font-semibold text-foreground">{guide.title}</span>
        <p className="m-0 text-sm text-muted-foreground">{guide.body}</p>
      </div>
      <Button variant="accent" size="S" isPending={busy} onPress={() => void fix()}>
        {guide.action}
      </Button>
    </div>
  );
}
