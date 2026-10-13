import { StatusLight } from '@react-spectrum/s2';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { RUNTIME_CARD_COPY } from '../../copy.ts';
import { shortenPath } from '../../model/format.ts';
import { runtimeStateLabel } from '../../model/services.ts';
import { useConnection } from '../../state/connection-store.ts';

/*
 * CucCut Runtime card: the Runtime's connection status, version, process, start time and data directory. It was originally the first card on the services overview. Once the services page became three external services, it no longer belongs under “Services”, so it is extracted into a standalone component, mounted by Settings › Diagnostics (this change does not modify the settings page).
 * It does not depend on the page layout and can be placed in any column.
 */

const card = style({
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: 16,
  borderRadius: '[16px]',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'gray-200',
  backgroundColor: 'gray-50',
});
const cardHead = style({ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 });
const name = style({ font: 'title-sm' });
const facts = style({ display: 'grid', gridTemplateColumns: ['auto', '1fr'], columnGap: 16, rowGap: 4, margin: 0, font: 'ui-sm' });
const term = style({ color: 'gray-600' });
const value = style({ margin: 0, overflowWrap: 'anywhere', userSelect: 'text' });

export function RuntimeCard() {
  const state = useConnection((s) => s.state);
  return (
    <section className={card} aria-label={RUNTIME_CARD_COPY.name}>
      <div className={cardHead}>
        <span className={name}>{RUNTIME_CARD_COPY.name}</span>
        <StatusLight variant={state.status === 'connected' ? 'positive' : state.status === 'incompatible' ? 'negative' : 'notice'}>
          {runtimeStateLabel(state.status)}
        </StatusLight>
      </div>
      {state.status === 'connected' ? (
        <dl className={facts}>
          <dt className={term}>{RUNTIME_CARD_COPY.version}</dt>
          <dd className={value}>{RUNTIME_CARD_COPY.versionValue(state.runtime.runtimeVersion, state.runtime.protocolVersion)}</dd>
          <dt className={term}>{RUNTIME_CARD_COPY.pid}</dt>
          <dd className={value}>{state.runtime.pid}</dd>
          <dt className={term}>{RUNTIME_CARD_COPY.startedAt}</dt>
          <dd className={value}>{new Date(state.runtime.startedAt).toLocaleString('zh-CN')}</dd>
          <dt className={term}>{RUNTIME_CARD_COPY.home}</dt>
          <dd className={value}>{shortenPath(state.runtime.home)}</dd>
        </dl>
      ) : null}
    </section>
  );
}
