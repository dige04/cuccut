import { useId, useState, type FormEvent } from 'react';
import type { ReviewSeverity } from '@cuccut/protocol';
import { CircleAlert, Loader2, Undo2 } from 'lucide-react';
import { Button } from '../../cc/ui/button.tsx';
import { Card, CardContent } from '../../cc/ui/card.tsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../cc/ui/select.tsx';
import { Textarea } from '../../cc/ui/textarea.tsx';
import { SEVERITY_ORDER, severityChange, type ReviewFinding } from '../../model/review.ts';
import type { ReviewBusy } from '../../state/review-store.ts';
import { REVIEW_COPY as C } from './review-copy.ts';

/**
 * One finding in the review dialog (docs/cuccut/m2-review-gate.md §2.1, agentcut's review-panel `Group`): a 24px card
 * with the severity mark, what was found, what it was held to and the fix. An open finding can be let stand (an inline
 * recessed reason; Save waits for text and says so) or given another severity (raising saves at once, lowering asks
 * why first). A finding let stand keeps its place with the reason beside it, and can be held to the standard again.
 */

const MARK: Record<ReviewSeverity, string> = {
  critical: 'text-destructive',
  suggestion: 'text-orange-400',
  nitpick: 'text-muted-foreground',
};

export interface FindingActions {
  onWaive(reason: string): void;
  onUnwaive(): void;
  /** `null` gives back the standard's severity; `reason` is given when lowering below it. */
  onSeverity(severity: ReviewSeverity | null, reason?: string): void;
}

export function ReviewFindingCard({
  finding,
  standard,
  busy,
  locked,
  actions,
}: {
  finding: ReviewFinding;
  /** The severity the standard gives it (what lowering is measured against); the finding's own when unknown. */
  standard: ReviewSeverity | undefined;
  busy: ReviewBusy | null;
  /** Why decisions cannot be made now; null when they can. */
  locked: string | null;
  actions: FindingActions;
}) {
  const [form, setForm] = useState<{ kind: 'waive' } | { kind: 'lower'; severity: ReviewSeverity } | null>(null);
  const [reason, setReason] = useState('');
  const fieldId = useId();
  const hintId = useId();
  const disabled = busy !== null || locked !== null;
  const asked = standard ?? finding.lowered?.from ?? finding.severity;
  const saving = busy === `waive:${finding.id}` || busy === `severity:${finding.id}`;

  const open = (next: typeof form) => {
    setForm(next);
    setReason('');
  };
  const pick = (value: unknown) => {
    if (typeof value !== 'string' || !(SEVERITY_ORDER as readonly string[]).includes(value)) return;
    const change = severityChange(asked, finding.severity, value as ReviewSeverity);
    if (change.kind === 'none') return;
    if (change.kind === 'lower') return open({ kind: 'lower', severity: change.severity });
    open(null);
    actions.onSeverity(change.kind === 'restore' ? null : change.severity);
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const text = reason.trim();
    if (!text || !form) return;
    if (form.kind === 'waive') actions.onWaive(text);
    else actions.onSeverity(form.severity, text);
    open(null);
  };

  const label = form?.kind === 'lower' ? C.lowerReason(C.severityLower[form.severity]) : C.reasonLabel;
  const items = SEVERITY_ORDER.map((s) => ({ value: s, label: C.severity[s] }));

  return (
    <li>
      <Card size="sm" className="gap-2">
        <CardContent className="flex flex-col gap-2">
          <div className="flex items-start gap-2">
            <CircleAlert aria-hidden className={`mt-0.5 size-4 shrink-0 ${MARK[finding.severity]}`} />
            <span className="sr-only">{C.severity[finding.severity]}</span>
            <div className="flex min-w-0 flex-col gap-1">
              <p className="leading-snug text-foreground">{finding.said}</p>
              <p className="text-xs text-muted-foreground">{finding.detail}</p>
              {finding.fix ? <p className="text-xs leading-relaxed text-foreground/90">{finding.fix}</p> : null}
              {finding.lowered ? (
                <p className="text-xs text-muted-foreground">{C.lowered(C.severityLower[finding.lowered.from], finding.lowered.reason)}</p>
              ) : null}
              {finding.waived ? (
                <p className="text-xs text-muted-foreground">
                  {C.letStandBy(finding.waived.reason, finding.waived.by === 'agent' ? C.who.agent : C.who.user)}
                </p>
              ) : null}
            </div>
          </div>

          {finding.waived ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" size="xs" disabled={disabled} title={locked ?? undefined} onClick={actions.onUnwaive}>
                {busy === `unwaive:${finding.id}` ? <Loader2 aria-hidden className="motion-safe:animate-spin" /> : <Undo2 aria-hidden />}
                {C.holdAgain}
              </Button>
            </div>
          ) : form === null ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" size="xs" disabled={disabled} title={locked ?? undefined} onClick={() => open({ kind: 'waive' })}>
                {C.letStand}
              </Button>
              <Select items={items} value={finding.severity} onValueChange={pick} disabled={disabled}>
                <SelectTrigger size="sm" className="w-auto text-xs" aria-label={C.worth(finding.id)} title={locked ?? undefined}>
                  {busy === `severity:${finding.id}` ? <Loader2 aria-hidden className="motion-safe:animate-spin" /> : null}
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {items.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <form className="flex flex-col gap-2" onSubmit={submit}>
              <label htmlFor={fieldId} className="text-xs text-muted-foreground">
                {label}
              </label>
              <Textarea
                id={fieldId}
                autoFocus
                rows={2}
                value={reason}
                placeholder={form.kind === 'waive' ? C.reasonPlaceholder : undefined}
                aria-describedby={reason.trim() ? undefined : hintId}
                onChange={(event) => setReason(event.target.value)}
                className="min-h-14 text-sm"
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button type="submit" variant="secondary" size="sm" disabled={!reason.trim() || saving}>
                  {saving ? <Loader2 aria-hidden className="motion-safe:animate-spin" /> : null}
                  {C.save}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => open(null)}>
                  {C.cancel}
                </Button>
                {reason.trim() ? null : (
                  <span id={hintId} className="text-xs text-muted-foreground">
                    {C.reasonNeeded}
                  </span>
                )}
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </li>
  );
}
