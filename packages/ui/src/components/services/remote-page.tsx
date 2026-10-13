import { useState, type Key } from 'react';
import { SegmentedControl, SegmentedControlItem } from '@react-spectrum/s2';
import { REMOTE_COPY } from '../../copy.ts';
import { UtilityShell } from '../utility-sidebar.tsx';
import { RemoteNodes } from './remote-nodes.tsx';
import { RemoteShare } from './remote-share.tsx';
import { strong } from './service-card.tsx';

/**
 * Remote compute page (prototype designs/cuccut/app/page-shell.jsx `RemotePage`): two tabs on the right of the title, defaulting to “Share this Mac”.
 * This page lives under “Services”, so it first answers whether sharing is on. The tabs exist only in the page (the route has no tab segment).
 */
export function RemotePage() {
  const [tab, setTab] = useState<'share' | 'nodes'>('share');
  const lines = tab === 'share' ? REMOTE_COPY.ledeShare : REMOTE_COPY.ledeNodes;
  return (
    <UtilityShell
      kind="services"
      flow
      title={REMOTE_COPY.title}
      blurb={
        <>
          {lines.before}
          <b className={strong}>{lines.strong}</b>
          {lines.after}
        </>
      }
      actions={
        <SegmentedControl
          aria-label={REMOTE_COPY.tabsLabel}
          selectedKey={tab}
          onSelectionChange={(key: Key) => setTab(key === 'nodes' ? 'nodes' : 'share')}>
          <SegmentedControlItem id="share">{REMOTE_COPY.tabShare}</SegmentedControlItem>
          <SegmentedControlItem id="nodes">{REMOTE_COPY.tabNodes}</SegmentedControlItem>
        </SegmentedControl>
      }>
      {tab === 'share' ? <RemoteShare /> : <RemoteNodes />}
    </UtilityShell>
  );
}
