import { HardDrive } from 'lucide-react';
import { CHROME_COPY } from '../cc/components/chrome-copy.ts';
import { NavBar, PageScroll } from '../cc/components/page-chrome.tsx';
import { StartPage } from './start-page.tsx';

/**
 * The landing page (agentcut home): the navigation capsule, the composer that starts a new session, then what you
 * worked on recently. A session or project opens the session layout instead (HomePage).
 */
export function HomeLanding() {
  return (
    <PageScroll>
      <NavBar />
      <section className="flex min-h-[28rem] flex-col">
        <StartPage projectId={null} />
      </section>
      <footer data-cc className="mt-4 flex items-center gap-2 text-xs leading-relaxed text-muted-foreground">
        <HardDrive aria-hidden className="size-3.5 shrink-0" />
        {CHROME_COPY.stayLocal}
      </footer>
    </PageScroll>
  );
}
