import { useEffect, useState } from 'react';
import { localizeText, type ServiceStatus, type WebSession } from '@cuccut/protocol';
import { ActionButton, AlertDialog, Badge, Button, DialogTrigger, Switch, Text, ToastQueue } from '@react-spectrum/s2';
import Copy from '@react-spectrum/s2/icons/Copy';
import OpenIn from '@react-spectrum/s2/icons/OpenIn';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { RouteLink } from '../../cc/components/page-chrome.tsx';
import { SERVICE_COPY, SERVICES_PAGE_COPY } from '../../copy.ts';
import { browserLabel, serviceBusy, serviceStateLabel, webSessionMeta } from '../../model/services.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { useNow } from '../use-now.ts';
import { UtilityShell } from '../utility-sidebar.tsx';
import { detailXs, panel, ServiceCard, ServiceLightDot } from './service-card.tsx';
import { AutostartCheckbox, ErrorFix, PortRow, SectionHead, SetRow, useServiceStatus } from './service-parts.tsx';
import { COMMON_COPY, WEB_COPY } from './services-copy.ts';
import { copyText, toastFailure, useConfigureService, useFlipService } from './use-service-actions.ts';

/*
 * Web service detail page (prototype designs/cuccut/app/page-services.jsx `WebServicePage`; architecture design §4.8, §12.8).
 * A browser must first come in through a one-time login link (`services.web.createAccessLink`: the code is in the URL fragment, valid for 2 minutes and usable only once). After it is exchanged for a session cookie, the address can be opened directly for 12 hours. So “Open in browser” sends a new link each time, handed to the system browser.
 * “Copy address” copies the address without the code (for a browser that is already logged in). “Copy login link” is also offered (for logging in from another browser).
 * Differences from the prototype: the session row has no “page being viewed” (the Runtime does not record it); instead it shows the connection count and expiry time, and the session can be logged out. The port can be changed while running (it restarts on the new port). “Read-only” is added. The prototype's “OpenAI-compatible API” on this page has moved to the “Model API” page.
 */

const actions = style({ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 12 });
const note = style({ margin: 0, marginTop: 8, font: 'ui-xs', color: 'gray-600' });
const line = style({
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  paddingY: 8,
  borderTopWidth: 0,
  borderXWidth: 0,
  borderBottomWidth: { default: 1, ':last-child': 0 },
  borderStyle: 'solid',
  borderColor: 'gray-100',
});
const who = style({ display: 'flex', flexDirection: 'column', gap: 2, flexGrow: 1, minWidth: 0 });
const name = style({ font: 'ui', fontWeight: 'medium', color: 'gray-900' });
const empty = style({ margin: 0, font: 'ui-sm', color: 'gray-600' });
const related = style({ margin: 0, marginTop: 24, font: 'ui-sm', color: 'gray-600' });

export function WebServicePage() {
  const { status, ready, connected, state } = useServiceStatus('web');
  const flip = useFlipService('web');
  const copy = SERVICE_COPY.web;
  const usable = !!status && state !== 'unavailable';

  let heading: string = WEB_COPY.off;
  let subline: string = WEB_COPY.offSub;
  let mono = false;
  if (!status) subline = connected ? SERVICES_PAGE_COPY.loading : SERVICES_PAGE_COPY.disconnected;
  else if (state === 'unavailable') {
    heading = SERVICES_PAGE_COPY.unavailableTitle(copy.name);
    subline = COMMON_COPY.unavailableSub;
  } else if (state === 'on' && status.endpoint) {
    heading = WEB_COPY.on;
    subline = status.endpoint;
    mono = true;
  } else if (state === 'error') {
    heading = WEB_COPY.error;
    subline = localizeText(status.error, status.errorRef) ?? COMMON_COPY.errorFix;
  } else if (serviceBusy(state)) {
    heading = serviceStateLabel('web', state);
    subline = `${COMMON_COPY.portLabel} ${status.port ?? ''}`;
  }

  return (
    <UtilityShell
      kind="services"
      flow
      blurb={WEB_COPY.lede}
      title={WEB_COPY.title}
      actions={
        <Badge size="S" fillStyle="subtle" variant="neutral">
          {copy.scope}
        </Badge>
      }>
      <ServiceCard
        id="web"
        state={state}
        heading={heading}
        subline={subline}
        mono={mono}
        disabled={!connected || !ready || !usable}
        onFlip={flip}
        footer={
          usable && status ? (
            <>
              <AutostartCheckbox id="web" status={status} />
              <span className={detailXs}>{COMMON_COPY.stopsWithApp}</span>
            </>
          ) : undefined
        }>
        {state === 'error' && status ? <ErrorFix id="web" status={status} /> : null}
        {state === 'on' && status ? <WebActions status={status} disabled={!connected} /> : null}
      </ServiceCard>
      {state === 'on' ? <p className={note}>{WEB_COPY.linkNote}</p> : null}

      {usable && status ? (
        <>
          {state === 'on' ? <WebSessions status={status} disabled={!connected} /> : null}
          <SectionHead title={COMMON_COPY.section.settings} />
          <section className={panel}>
            <PortRow id="web" status={status} />
            <ReadOnlyRow status={status} disabled={!connected} />
          </section>
        </>
      ) : null}

      <p className={related}>
        {WEB_COPY.apiMoved}{' '}
        {/* A neutral inline link: the page's one yellow element is its Start action. */}
        <RouteLink route={{ tab: 'services', service: 'model-api' }} className="rounded-sm text-foreground underline decoration-foreground/40 underline-offset-2 outline-none hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-ring">
          {WEB_COPY.apiMovedLink}
        </RouteLink>
      </p>
    </UtilityShell>
  );
}

/** The three buttons on the card: open in browser (sends a new login link to the system browser), copy address, copy login link. */
function WebActions({ status, disabled }: { status: ServiceStatus; disabled: boolean }) {
  const runtime = useRuntime();
  const [busy, setBusy] = useState<'open' | 'link' | null>(null);
  const withLink = (kind: 'open' | 'link') => {
    setBusy(kind);
    runtime
      .createWebAccessLink()
      .then(({ url }) => {
        if (kind === 'link') return copyText(url, WEB_COPY.linkLabel);
        const open = runtime.host.openExternal;
        if (open) return void open(url).catch(toastFailure);
        if (!window.open(url, '_blank', 'noopener,noreferrer')) {
          copyText(url, WEB_COPY.linkLabel);
          ToastQueue.info(WEB_COPY.openFallback, { timeout: 6000 });
        }
      })
      .catch(toastFailure)
      .finally(() => setBusy(null));
  };
  return (
    <div className={actions}>
      <Button variant="accent" size="S" isDisabled={disabled} isPending={busy === 'open'} onPress={() => withLink('open')}>
        <OpenIn />
        <Text>{WEB_COPY.open}</Text>
      </Button>
      <Button variant="secondary" size="S" isDisabled={!status.endpoint} onPress={() => status.endpoint && copyText(status.endpoint, WEB_COPY.addressLabel)}>
        <Copy />
        <Text>{WEB_COPY.copyAddress}</Text>
      </Button>
      <Button variant="secondary" fillStyle="outline" size="S" isDisabled={disabled} isPending={busy === 'link'} onPress={() => withLink('link')}>
        <Text>{WEB_COPY.copyLink}</Text>
      </Button>
    </div>
  );
}

/**
 * Open browser sessions: `services.web.listSessions`. Sessions have no topic of their own. When the Web service state in the `services` topic changes (login, logout and connection-count changes all update `clients`), it re-reads once.
 */
function WebSessions({ status, disabled }: { status: ServiceStatus; disabled: boolean }) {
  const runtime = useRuntime();
  const now = useNow(60_000);
  const [sessions, setSessions] = useState<WebSession[] | null>(null);
  useEffect(() => {
    let alive = true;
    runtime
      .listWebSessions()
      .then((next) => alive && setSessions(next))
      .catch(() => alive && setSessions(null));
    return () => {
      alive = false;
    };
  }, [runtime, status]);
  const revoke = (sessionId: string) =>
    runtime
      .revokeWebSession(sessionId)
      .then((next) => {
        setSessions(next);
        ToastQueue.neutral(WEB_COPY.revoked, { timeout: 3000 });
      })
      .catch(toastFailure);
  return (
    <>
      <SectionHead title={WEB_COPY.sessionsTitle} />
      <section className={panel}>
        {sessions?.length ? (
          sessions.map((s) => (
            <div key={s.sessionId} className={line}>
              <ServiceLightDot tone={s.connections ? 'on' : 'off'} />
              <span className={who}>
                <span className={name}>{browserLabel(s.userAgent)}</span>
                <span className={detailXs}>{webSessionMeta(s, now)}</span>
              </span>
              <DialogTrigger>
                <ActionButton isQuiet size="S" isDisabled={disabled}>
                  {WEB_COPY.revoke}
                </ActionButton>
                <AlertDialog
                  variant="destructive"
                  title={WEB_COPY.revokeTitle}
                  primaryActionLabel={WEB_COPY.revokeConfirm}
                  cancelLabel={COMMON_COPY.cancel}
                  onPrimaryAction={() => void revoke(s.sessionId)}>
                  {WEB_COPY.revokeBody}
                </AlertDialog>
              </DialogTrigger>
            </div>
          ))
        ) : (
          <p className={empty}>{WEB_COPY.sessionsEmpty}</p>
        )}
      </section>
    </>
  );
}

/** Read-only (`readOnly` of `services.configure`, takes effect immediately). The method allowlist (`methods`) is not tightened in the UI in this version. */
function ReadOnlyRow({ status, disabled }: { status: ServiceStatus; disabled: boolean }) {
  const configure = useConfigureService();
  const readOnly = status.web?.readOnly ?? false;
  return (
    <SetRow label={WEB_COPY.readOnly} desc={WEB_COPY.readOnlyDesc}>
      <Switch
        size="S"
        aria-label={WEB_COPY.readOnly}
        isSelected={readOnly}
        isDisabled={disabled}
        onChange={(on) => void configure({ serviceId: 'web', readOnly: on }, WEB_COPY.readOnlySaved(on))}
      />
    </SetRow>
  );
}
