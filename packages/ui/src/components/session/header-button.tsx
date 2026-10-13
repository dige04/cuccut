import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from 'cn';
import { buttonVariants } from '../../cc/ui/button.tsx';

/**
 * An icon button in the session header (agentcut's ghost icon capsule). It sits inside glass, so it uses fills
 * rather than more glass; a control that is on (`active`) wears a white fill and the control highlight. The label is
 * both the accessible name and the hover hint. `active` is visual only: toggles here flip their label ("Show …" /
 * "Hide …"), so they do not also announce a pressed state; pass ARIA state through the usual attributes when needed.
 */
export const HeaderButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }
>(function HeaderButton({ label, active, className, children, ...rest }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        buttonVariants({ variant: 'ghost', size: 'icon-sm' }),
        'text-foreground/80 hover:text-foreground',
        active && 'bg-white/10 text-foreground shadow-(--control-highlight)',
        className,
      )}
      {...rest}>
      {children}
    </button>
  );
});
