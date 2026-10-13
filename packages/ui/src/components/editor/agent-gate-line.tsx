import { Link } from '@react-spectrum/s2';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import type { GateGuide } from '../../model/home-brief.ts';
import { useGateFix } from '../start/gate-card.tsx';
import { EDITOR_COPY as E } from './editor-copy.ts';

const line = style({
  margin: 0,
  font: 'ui-xs',
  color: 'gray-700',
  lineHeight: '[1.5]',
});

/**
 * The line shown in the editor when the Agent cannot be used (the “Use” row on the tool page, the floating conversation at the bottom-right): one sentence of reason plus a link to deal with it.
 * The start page uses the full guide card (start/gate-card.tsx); an orange card in a narrow panel is too heavy and clashes with the settings items around it.
 */
export function AgentGateLine({ guide }: { guide: GateGuide }) {
  const { busy, fix } = useGateFix(guide);
  return (
    <p className={line} role="status">
      {guide.title}
      {E.gap}
      <Link variant="secondary" onPress={() => !busy && void fix()}>
        {guide.action}
      </Link>
    </p>
  );
}
