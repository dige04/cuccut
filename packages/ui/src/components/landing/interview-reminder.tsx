import { useState } from 'react';
import { ToastQueue } from '@react-spectrum/s2';
import { Sparkles } from 'lucide-react';
import { RouteLink } from '../../cc/components/page-chrome.tsx';
import { Button, buttonVariants } from '../../cc/ui/button.tsx';
import { showsReminder } from '../../model/profile.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { dismissReminder } from '../../runtime/profile-commands.ts';
import { useProfile } from '../../state/profile-store.ts';
import { WELCOME } from '../../state/shell-store.ts';
import { PROFILE_COPY } from '../profile/profile-copy.ts';
import { errorText, useProfileLock } from '../profile/profile-parts.tsx';

const C = () => PROFILE_COPY.reminder;

/**
 * What is left of the interview on the home page (docs/cuccut/m2-profile-rules.md §2.4, agentcut `onboarding-reminder.tsx`): one line, not a form,
 * while the agent knows nothing about the user. The page is for making a video; the interview has its own screen. "Not now" only silences this
 * line: Settings › You and the agent still offer it. First launch is never sent to `/welcome` on its own; this line is the way in.
 */
export function InterviewReminder() {
  const runtime = useRuntime();
  const shown = useProfile((s) => showsReminder(s.snapshot));
  // A browser can't save the answers, and a profile from a newer CucCut can't be changed: no point offering the interview there.
  const lock = useProfileLock();
  const [hidden, setHidden] = useState(false);
  if (!shown || hidden || lock) return null;

  const dismiss = () => {
    // Gone at once; if the Runtime did not take it, the line comes back and says why.
    setHidden(true);
    dismissReminder(runtime).catch((error: unknown) => {
      setHidden(false);
      ToastQueue.negative(C().dismissFailed(errorText(error)), { timeout: 5000 });
    });
  };

  return (
    <p data-cc className="m-0 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
      <Sparkles aria-hidden className="size-3.5 shrink-0 text-primary" />
      <span>{C().text}</span>
      <RouteLink route={WELCOME} className={buttonVariants({ variant: 'link', size: 'sm', className: 'h-auto px-0' })}>
        {C().link}
      </RouteLink>
      <Button type="button" variant="ghost" size="xs" onClick={dismiss}>
        {C().dismiss}
      </Button>
    </p>
  );
}
