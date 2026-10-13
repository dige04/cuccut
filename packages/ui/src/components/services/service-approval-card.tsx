import { useState } from 'react';
import type { ApprovalGrantChoice, ServiceApproval } from '@cuccut/protocol';
import { Button, ToastQueue } from '@react-spectrum/s2';
import AlertTriangle from '@react-spectrum/s2/icons/AlertTriangle';
import { iconStyle, style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { approvalGrants, approvalSecondsLeft, grantLine, liveApprovals, mcpToolTitle } from '../../model/services-mcp.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { useConnection } from '../../state/connection-store.ts';
import { useServices } from '../../state/services-store.ts';
import { useTasks } from '../../state/tasks-store.ts';
import { useNow } from '../use-now.ts';
import { APPROVAL_CARD_COPY } from './services-copy.ts';
import { toastFailure } from './use-service-actions.ts';

/*
 * Service approval card (prototype designs/cuccut/app/page-services.jsx `.svc__ask`; architecture design §3.12, §4.8):
 * writes from external clients, tasks and generation under “Ask before changes” are confirmed here one by one; if nobody handles one within 50 seconds, it is rejected.
 * When data must be sent externally and no existing authorization covers it (§12.5, `grants` in the unified list of the `tasks` topic), approval is split into “Allow this once” and “Allow and remember”.
 * The prototype's “Details” shows full parameters. The Runtime's approval carries only a one-line summary (without the parameter body), so there is no “Details” and no “Copy full parameters”.
 */

const card = style({
  boxSizing: 'border-box',
  padding: 16,
  marginTop: 12,
  borderRadius: '[16px]',
  backgroundColor: 'orange-100',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'orange-400',
});
const head = style({ display: 'flex', alignItems: 'start', gap: 12 });
const icon = iconStyle({ size: 'M', color: 'notice' });
const txt = style({ display: 'flex', flexDirection: 'column', gap: 4, flexGrow: 1, minWidth: 0 });
const title = style({ font: 'title-sm', color: 'gray-900', overflowWrap: 'anywhere' });
const line = style({ font: 'ui-sm', color: 'gray-700', overflowWrap: 'anywhere' });
const callLine = style({ font: 'code-sm', color: 'gray-800', overflowWrap: 'anywhere' });
const small = style({ font: 'ui-xs', color: 'gray-600' });
const buttons = style({ display: 'flex', flexWrap: 'wrap', justifyContent: 'end', gap: 8, marginTop: 12 });

/** All pending approvals for one service that have not yet timed out, oldest first. */
export function ServiceApprovals({ serviceId }: { serviceId: ServiceApproval['serviceId'] }) {
  const approvals = useServices((s) => s.approvals);
  const now = useNow(1000, approvals.length > 0);
  const live = liveApprovals(approvals, serviceId, now);
  return (
    <>
      {/* Several requests can wait at once: only the first card's Allow is yellow (one yellow per view). */}
      {live.map((a, i) => (
        <ApprovalCard key={a.approvalId} approval={a} secondsLeft={approvalSecondsLeft(a, now)} primary={i === 0} />
      ))}
    </>
  );
}

function ApprovalCard({ approval, secondsLeft, primary }: { approval: ServiceApproval; secondsLeft: number; primary: boolean }) {
  const runtime = useRuntime();
  const connected = useConnection((s) => s.state.status === 'connected');
  const pending = useTasks((s) => s.approvals);
  const grants = approvalGrants(pending, approval.approvalId);
  const [busy, setBusy] = useState(false);
  const toolTitle = approval.serviceId === 'mcp' ? mcpToolTitle(approval.tool) : approval.tool;

  const respond = (decision: 'allow' | 'deny', grant?: ApprovalGrantChoice) => {
    setBusy(true);
    runtime
      .respondToPendingApproval(approval.approvalId, decision, grant)
      .then((status) => {
        if (status === 'already-resolved') ToastQueue.neutral(APPROVAL_CARD_COPY.already, { timeout: 4000 });
        else if (status === 'allowed') ToastQueue.positive(APPROVAL_CARD_COPY.allowed, { timeout: 3000 });
        else ToastQueue.neutral(APPROVAL_CARD_COPY.denied, { timeout: 3000 });
      })
      .catch(toastFailure)
      .finally(() => setBusy(false));
  };

  return (
    <section className={card} role="status" aria-label={APPROVAL_CARD_COPY.title(approval.clientName, toolTitle)}>
      <div className={head}>
        <AlertTriangle styles={icon} />
        <span className={txt}>
          <span className={title}>{APPROVAL_CARD_COPY.title(approval.clientName, toolTitle)}</span>
          <span className={line}>
            {approval.video ? APPROVAL_CARD_COPY.video(approval.video.name) : APPROVAL_CARD_COPY.noVideo}
            {approval.summary ? ` · ${approval.summary}` : ''}
          </span>
          <code className={callLine}>{approval.tool}</code>
          {grants.map((g, i) => (
            <span key={i} className={line}>
              {grantLine(g)}
            </span>
          ))}
          {grants.length ? <span className={small}>{APPROVAL_CARD_COPY.grantPersistNote}</span> : null}
          <span className={small}>{APPROVAL_CARD_COPY.left(secondsLeft)}</span>
        </span>
      </div>
      <div className={buttons}>
        <Button variant="secondary" size="S" isDisabled={!connected || busy} onPress={() => respond('deny')}>
          {APPROVAL_CARD_COPY.deny}
        </Button>
        {grants.length ? (
          <>
            <Button variant="secondary" size="S" isDisabled={!connected || busy} onPress={() => respond('allow', { persist: true })}>
              {APPROVAL_CARD_COPY.allowPersist}
            </Button>
            <Button variant={primary ? 'accent' : 'secondary'} size="S" isDisabled={!connected || busy} onPress={() => respond('allow', { persist: false })}>
              {APPROVAL_CARD_COPY.allowOnce}
            </Button>
          </>
        ) : (
          <Button variant={primary ? 'accent' : 'secondary'} size="S" isDisabled={!connected || busy} onPress={() => respond('allow')}>
            {APPROVAL_CARD_COPY.allow}
          </Button>
        )}
      </div>
    </section>
  );
}
