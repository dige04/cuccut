import { HardDrive } from 'lucide-react';
import { CHROME_COPY } from '../cc/components/chrome-copy.ts';
import { NavBar, PageScroll } from '../cc/components/page-chrome.tsx';
import { RecentList } from './landing/recent-list.tsx';
import { StartPage } from './start-page.tsx';

/**
 * The landing page (agentcut home, `projects-view.tsx`): the navigation capsule, the two ways in (create a video /
 * clip a long video) with the quick start and templates under them, then what you worked on recently. A session or
 * project opens the session layout instead (HomePage).
 */
export function HomeLanding() {
  return (
    // box-border: PageScroll's column is not under data-cc, so without it max-w-6xl + px would overflow narrow windows.
    <PageScroll className="box-border gap-12">
      <NavBar />
      <StartPage projectId={null} layout="page" />
      <RecentList />
      <footer data-cc className="flex items-center gap-2 text-xs leading-relaxed text-muted-foreground">
        <HardDrive aria-hidden className="size-3.5 shrink-0" />
        {CHROME_COPY.stayLocal}
      </footer>
    </PageScroll>
  );
}
