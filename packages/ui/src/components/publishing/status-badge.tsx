import type { DeliveryState, PublicationStatus } from '@cuccut/protocol';
import { cn } from 'cn';
import { deliveryLabel, statusLabel, type DeliveryContext, type PublishingLabel, type PublishingTone } from '../../model/publishing-labels.ts';

const TONE: Record<PublishingTone, string> = {
  quiet: 'text-muted-foreground',
  ready: 'text-foreground',
  // The one tinted tone: what needs the owner stands out, everything else stays neutral.
  attention: 'text-primary',
};

/** A state as an icon plus a word, never colour alone (design §2). Capsule, like the other chips. */
export function LabelBadge({ label, className }: { label: PublishingLabel; className?: string }) {
  const { Icon } = label;
  return (
    <span
      data-slot="publishing-badge"
      data-tone={label.tone}
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-full bg-foreground/5 px-2 py-1 text-[11px] leading-tight font-medium',
        TONE[label.tone],
        className,
      )}
    >
      <Icon aria-hidden strokeWidth={1.75} className={cn('size-3.5 shrink-0', label.spin && 'motion-safe:animate-spin')} />
      <span className="truncate">{label.label}</span>
    </span>
  );
}

/** A publication's status. */
export function PublicationStatusBadge({ status, className }: { status: PublicationStatus; className?: string }) {
  return <LabelBadge label={statusLabel(status)} className={className} />;
}

/** One destination's delivery state, worded for its route ("Waiting for you" when it is posted by hand). */
export function DeliveryBadge({ state, className, ...context }: { state: DeliveryState; className?: string } & DeliveryContext) {
  return <LabelBadge label={deliveryLabel(state, context)} className={className} />;
}
