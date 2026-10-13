import { useState } from 'react';
import type { ServiceClient } from '@cuccut/protocol';
import {
  ActionButton,
  AlertDialog,
  Button,
  ButtonGroup,
  Content,
  Dialog,
  DialogContainer,
  DialogTrigger,
  Form,
  Heading,
  InlineAlert,
  Text,
  TextField,
  ToastQueue,
} from '@react-spectrum/s2';
import Add from '@react-spectrum/s2/icons/Add';
import Copy from '@react-spectrum/s2/icons/Copy';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { agoLabel } from '../../model/format.ts';
import { withToken } from '../../model/services-api.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { useConnection } from '../../state/connection-store.ts';
import { useNow } from '../use-now.ts';
import { detail } from './service-card.tsx';
import { CLIENTS_COPY } from './services-copy.ts';
import { copyText, toastFailure } from './use-service-actions.ts';

/*
 * Clients and tokens (shared by the MCP service and the model API service; architecture design §4.8 “one token per client, individually revocable”).
 * The prototype's page-services.jsx “Access token ••••” is one global token that is replaced on each launch. The Runtime issues tokens per client and stores only hashes,
 * so here the flow is: create (the plaintext token is shown only this once) → copy → revoke. The plaintext token lives only in the local state of the create dialog; it does not go into the store and is not logged.
 * The client list comes from `clients` in the `services` topic; after a revocation, the topic sends the new state.
 */

type Kind = 'mcp' | 'model-api';

const list = style({ marginTop: 4 });
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
const name = style({ font: 'ui', fontWeight: 'medium', color: 'gray-900', overflowWrap: 'anywhere' });
const meta = style({ font: 'ui-xs', color: 'gray-600' });
const empty = style({ margin: 0, marginTop: 8, font: 'ui-sm', color: 'gray-600' });
const foot = style({ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 });
const tokenBox = style({
  display: 'block',
  marginTop: 8,
  padding: 12,
  borderRadius: '[12px]',
  backgroundColor: 'gray-75',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'gray-200',
  font: 'code-sm',
  color: 'gray-900',
  overflowWrap: 'anywhere',
  userSelect: 'all',
});
const tokenActions = style({ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 });
const tokenLabel = style({ display: 'block', marginTop: 16, font: 'ui-sm', fontWeight: 'medium', color: 'gray-800' });

export function ServiceClients({ kind, clients, disabled }: { kind: Kind; clients: readonly ServiceClient[]; disabled: boolean }) {
  const [creating, setCreating] = useState(false);
  const now = useNow(60_000);
  return (
    <>
      <p className={detail}>{CLIENTS_COPY.lede}</p>
      {clients.length ? (
        <div className={list}>
          {clients.map((client) => (
            <div key={client.clientId} className={line}>
              <span className={who}>
                <span className={name}>{client.name}</span>
                <span className={meta}>
                  {CLIENTS_COPY.meta(agoLabel(client.createdAt, now), client.lastUsedAt ? agoLabel(client.lastUsedAt, now) : null)}
                </span>
              </span>
              <RevokeClient kind={kind} client={client} disabled={disabled} />
            </div>
          ))}
        </div>
      ) : (
        <p className={empty}>{CLIENTS_COPY.empty}</p>
      )}
      <div className={foot}>
        <Button variant="secondary" size="S" isDisabled={disabled} onPress={() => setCreating(true)}>
          <Add />
          <Text>{CLIENTS_COPY.create}</Text>
        </Button>
      </div>
      {creating ? <CreateClientDialog kind={kind} onClose={() => setCreating(false)} /> : null}
    </>
  );
}

function RevokeClient({ kind, client, disabled }: { kind: Kind; client: ServiceClient; disabled: boolean }) {
  const runtime = useRuntime();
  const revoke = () =>
    (kind === 'mcp' ? runtime.revokeMcpClient(client.clientId) : runtime.revokeModelApiClient(client.clientId))
      .then(() => ToastQueue.neutral(CLIENTS_COPY.revoked(client.name), { timeout: 3000 }))
      .catch(toastFailure);
  return (
    <DialogTrigger>
      <ActionButton isQuiet size="S" isDisabled={disabled} aria-label={`${CLIENTS_COPY.revoke} ${client.name}`}>
        {CLIENTS_COPY.revoke}
      </ActionButton>
      <AlertDialog
        variant="destructive"
        title={CLIENTS_COPY.revokeTitle(client.name)}
        primaryActionLabel={CLIENTS_COPY.revokeConfirm}
        cancelLabel={CLIENTS_COPY.cancel}
        onPrimaryAction={() => void revoke()}>
        {CLIENTS_COPY.revokeBody}
      </AlertDialog>
    </DialogTrigger>
  );
}

/**
 * Create a client: first fill in the name. After success, the same dialog switches to “The token is shown only once”.
 * State lives in the outer dialog (S2's Dialog renders its children once in each of several slots; see name-dialog.tsx); closing it discards the state.
 */
function CreateClientDialog({ kind, onClose }: { kind: Kind; onClose: () => void }) {
  const runtime = useRuntime();
  const connected = useConnection((s) => s.state.status === 'connected');
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<{ name: string; token: string; snippet: string | null } | null>(null);
  const trimmed = value.trim();
  const valid = trimmed.length > 0 && trimmed.length <= 100;

  const submit = async () => {
    if (!valid || busy || issued) return;
    setBusy(true);
    try {
      const { client, token } = kind === 'mcp' ? await runtime.createMcpClient(trimmed) : await runtime.createModelApiClient(trimmed);
      // The snippet without clientId: the placeholder is exactly `<令牌>`, and it is replaced with the plaintext only in the clipboard. If the snippet cannot be fetched, the token must still be shown to the user first.
      const info = await (kind === 'mcp' ? runtime.mcpConnectionInfo() : runtime.modelApiConnectionInfo()).catch(() => null);
      setIssued({ name: client.name, token, snippet: info?.snippet ?? null });
    } catch (error) {
      toastFailure(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    // Do not set isDismissible: S2's dismissible dialog hides the button group, and the token step needs an explicit click on “Done”, so an accidental click outside does not close it.
    <DialogContainer onDismiss={onClose}>
      <Dialog size="M">
        {({ close }) => (
          <>
            <Heading slot="title">{issued ? CLIENTS_COPY.tokenTitle(issued.name) : CLIENTS_COPY.createTitle}</Heading>
            <Content>
              {issued ? (
                <>
                  <InlineAlert variant="notice">
                    <Content>{CLIENTS_COPY.tokenOnce}</Content>
                  </InlineAlert>
                  <span className={tokenLabel}>{CLIENTS_COPY.tokenLabel}</span>
                  <code className={tokenBox}>{issued.token}</code>
                  <div className={tokenActions}>
                    <Button variant="secondary" size="S" onPress={() => copyText(issued.token, CLIENTS_COPY.tokenCopiedLabel)}>
                      <Copy />
                      <Text>{CLIENTS_COPY.copyToken}</Text>
                    </Button>
                    {issued.snippet !== null ? (
                      <Button
                        variant="secondary"
                        size="S"
                        onPress={() => copyText(withToken(issued.snippet ?? '', issued.token), CLIENTS_COPY.snippetCopiedLabel)}>
                        <Copy />
                        <Text>{CLIENTS_COPY.copySnippetWithToken}</Text>
                      </Button>
                    ) : null}
                  </div>
                </>
              ) : (
                <Form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void submit();
                  }}>
                  <TextField
                    label={CLIENTS_COPY.nameLabel}
                    placeholder={CLIENTS_COPY.namePlaceholder}
                    description={CLIENTS_COPY.nameDesc}
                    value={value}
                    onChange={setValue}
                    maxLength={100}
                    autoFocus
                  />
                </Form>
              )}
            </Content>
            <ButtonGroup>
              {issued ? (
                <Button variant="accent" onPress={close}>
                  {CLIENTS_COPY.done}
                </Button>
              ) : (
                <>
                  <Button variant="secondary" onPress={close}>
                    {CLIENTS_COPY.cancel}
                  </Button>
                  <Button variant="accent" isDisabled={!valid || !connected} isPending={busy} onPress={() => void submit()}>
                    {CLIENTS_COPY.confirmCreate}
                  </Button>
                </>
              )}
            </ButtonGroup>
          </>
        )}
      </Dialog>
    </DialogContainer>
  );
}
