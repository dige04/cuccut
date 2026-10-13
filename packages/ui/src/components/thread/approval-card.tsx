import { memo, useState } from 'react';
import type { ApprovalDecision, TimelineItem } from '@cuccut/protocol';
import { ActionButton, Button, Disclosure, DisclosurePanel, DisclosureTitle, Text, ToastQueue } from '@react-spectrum/s2';
import Lock from '@react-spectrum/s2/icons/Lock';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { APPROVAL_COPY } from '../../copy.ts';
import { shortenPath } from '../../model/format.ts';
import { approvalDecidedLabel, approvalSummary } from '../../model/thread.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { CopyButton } from './copy-button.tsx';

type Approval = Extract<TimelineItem, { kind: 'approval' }>;

/** The pending-decision card (prototype ui.css `.aperm` :2805-2814): orange background, thin border; title, monospace command, reason, and three answers. */
const card = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  paddingX: 16,
  paddingY: 12,
  borderRadius: '[20px]',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'orange-300',
  backgroundColor: 'orange-100',
});
const head = style({ display: 'flex', alignItems: 'center', gap: 8, font: 'ui', fontWeight: 'bold', color: 'orange-1000' });
const subject = style({
  margin: 0,
  paddingX: 8,
  paddingY: '[6px]',
  borderRadius: 'sm',
  backgroundColor: 'gray-25',
  font: 'code-xs',
  color: 'gray-900',
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
  userSelect: 'text',
});
const why = style({ margin: 0, font: 'ui-sm', color: 'gray-700', overflowWrap: 'anywhere' });
const answers = style({ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 });
/** An approval that has been decided collapses into a single-line quiet Disclosure (prototype `BCDisclosure`, agent-thread.jsx:167-169). */
const decided = style({ alignSelf: 'stretch' });
const decidedTitle = style({ display: 'flex', alignItems: 'center', gap: 4, font: 'ui-sm', color: 'gray-600' });
const decidedBody = style({ display: 'flex', flexDirection: 'column', gap: 8 });
const sectionHead = style({ display: 'flex', alignItems: 'center', justifyContent: 'space-between', font: 'ui-xs', color: 'gray-600' });

/**
 * The answer clicked in this window: used until the `decision` arrives on the timeline (and for earlier records that lack this field). After the decision, that line reads “no more asking about <rule> from now on” (see `approvalDecidedLabel`).
 */
const chosenHere = new Map<string, ApprovalDecision>();

/**
 * Approval card (product design §7.2, prototype agent-thread.jsx `PermissionMsg` :151-191): when the access mode requires asking first for an action, the agent stops and asks.
 * Three answers: 允许 (Allow) / 总是允许 <规则> (Always allow <rule>; not shown when there is no rule) / 拒绝 (Deny). After a decision, the card stays in the thread and collapses into a single expandable record line; expanding it shows the copyable input summary and the reason. The prototype's ToolSetup in the pending state (changing model and scope on the spot) has no backend data, so it is not implemented.
 */
export const ApprovalCard = memo(function ApprovalCard({ item, conversationId }: { item: Approval; conversationId: string }) {
  const runtime = useRuntime();
  const [pending, setPending] = useState<ApprovalDecision | null>(null);
  const { title, kind, subject: text, copyText } = approvalSummary(item.request, item.risk);
  const reason = item.request.reason;
  const rule = item.request.rule;

  if (item.status !== 'pending') {
    return (
      <Disclosure size="S" isQuiet styles={decided}>
        <DisclosureTitle>
          <span className={decidedTitle}>
            <Lock />
            {approvalDecidedLabel(item, chosenHere.get(item.approvalId))} · {kind}
          </span>
        </DisclosureTitle>
        <DisclosurePanel>
          <div className={decidedBody}>
            <div className={sectionHead}>
              <span>{APPROVAL_COPY.input}</span>
              <CopyButton text={copyText} label={APPROVAL_COPY.copyInput} />
            </div>
            <pre className={subject} tabIndex={0}>
              {text}
            </pre>
            {reason ? <p className={why}>{reason}</p> : null}
          </div>
        </DisclosurePanel>
      </Disclosure>
    );
  }

  const answer = async (decision: ApprovalDecision) => {
    setPending(decision);
    chosenHere.set(item.approvalId, decision);
    try {
      await runtime.respondToApproval(conversationId, item.approvalId, decision);
    } catch (error) {
      chosenHere.delete(item.approvalId);
      ToastQueue.negative(APPROVAL_COPY.failed((error as Error).message), { timeout: 5000 });
      setPending(null);
    }
  };
  const cwd = item.request.kind === 'command' ? item.request.cwd : null;

  return (
    <div className={card} role="group" aria-label={title}>
      <div className={head}>
        <Lock />
        <span>{title}</span>
      </div>
      <pre className={subject}>{text}</pre>
      {cwd ? <p className={why}>{APPROVAL_COPY.inDir(shortenPath(cwd))}</p> : null}
      {reason ? <p className={why}>{reason}</p> : null}
      <div className={answers}>
        <Button size="S" variant="accent" isPending={pending === 'accept'} isDisabled={pending !== null} onPress={() => answer('accept')}>
          {APPROVAL_COPY.allow}
        </Button>
        {rule ? (
          <Button
            size="S"
            variant="secondary"
            isPending={pending === 'accept-always'}
            isDisabled={pending !== null}
            onPress={() => answer('accept-always')}>
            {APPROVAL_COPY.allowAlways(rule)}
          </Button>
        ) : null}
        <ActionButton size="S" isQuiet isDisabled={pending !== null} onPress={() => answer('decline')}>
          <Text>{APPROVAL_COPY.decline}</Text>
        </ActionButton>
      </div>
    </div>
  );
});
