import type { PublishingNetwork } from '@cuccut/protocol';
import { cn } from 'cn';
import { NETWORK_ICON, networkLabel } from '../../model/publishing-labels.ts';

/**
 * A network's mark: a generic lucide glyph (`SquarePlay` YouTube, `Camera` Instagram, `Music2` TikTok), never a brand logo (design §2). Decorative by
 * default; pass `labelled` where the icon stands alone, so it reads as the network's name.
 */
export function NetworkIcon({ network, className, labelled = false }: { network: PublishingNetwork; className?: string; labelled?: boolean }) {
  const Icon = NETWORK_ICON[network];
  return (
    <Icon
      className={cn('size-4 shrink-0', className)}
      strokeWidth={1.5}
      {...(labelled ? { role: 'img', 'aria-label': networkLabel(network) } : { 'aria-hidden': true })}
    />
  );
}
