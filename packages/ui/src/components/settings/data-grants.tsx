import { useMemo, useState } from 'react';
import { localizeText, type Grant } from '@cuccut/protocol';
import { AlertDialog, Badge, Button, DialogContainer, Switch, ToastQueue } from '@react-spectrum/s2';
import { CloudUpload } from 'lucide-react';
import { endedCount, grantFacts, grantStateLabel, grantTitle, listedGrants, revokeConfirmText, revokeResultLine } from '../../model/data-grants.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { useConnection } from '../../state/connection-store.ts';
import { useGrants } from '../../state/grants-store.ts';
import { useModels } from '../../state/models-store.ts';
import { useSpace } from '../../state/space-store.ts';
import { GRANTS_COPY } from './data-grants-copy.ts';
import { M } from './general-settings-copy.ts';
import { Panel, PanelHeading, RowList, SettingsRow } from './settings-ui.tsx';

/*
 * 设置 → 隐私 →「数据外发授权」（架构设计 §12.5；设计稿没有这一块）：列出发给云端服务商的持续授权，可以撤销。
 * 发放只在两处：启用服务商时默认一条、审批时选「以后都允许」。这里不新建也不改（`grants.create/update` 没有界面）。
 * 分组与行的样式与设置页的 Group / Row 相同。浏览器里没有这一节的数据：Web 白名单不含 `grants.*`，订阅不了 `grants` 主题，
 * 那里不写「加载中」，直接说浏览器里没有。
 */

export function DataGrants() {
  const runtime = useRuntime();
  const web = runtime.host.platform === 'web';
  const connected = useConnection((s) => s.state.status === 'connected');
  const { ready, grants } = useGrants();
  const capabilities = useModels((s) => s.capabilities);
  const entries = useSpace((s) => s.entries);
  const [showEnded, setShowEnded] = useState(false);
  const [revoking, setRevoking] = useState<Grant | null>(null);

  const labels = useMemo(() => {
    const map = new Map<string, string>();
    if (capabilities) for (const view of Object.values(capabilities)) for (const p of view.providers) map.set(p.providerId, p.label);
    return map;
  }, [capabilities]);
  const videoNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of entries) if (e.kind === 'video' && e.ref && 'videoId' in e.ref) map.set(e.ref.videoId, e.name);
    return map;
  }, [entries]);

  const ended = endedCount(grants);
  const list = listedGrants(grants, showEnded);

  const revoke = async (grant: Grant) => {
    try {
      ToastQueue.positive(revokeResultLine(await runtime.revokeGrant(grant.grantId)), { timeout: 5000 });
    } catch (error) {
      ToastQueue.negative(GRANTS_COPY.revokeFailed((error as Error).message), { timeout: 5000 });
    }
  };

  return (
    <Panel label={GRANTS_COPY.title} className="flex flex-col gap-2 pb-1.5">
      <PanelHeading
        title={GRANTS_COPY.title}
        hint={GRANTS_COPY.lead}
        icon={<CloudUpload />}
        action={
          ended ? (
            <Switch size="S" isSelected={showEnded} onChange={setShowEnded}>
              {GRANTS_COPY.showEnded(ended)}
            </Switch>
          ) : null
        }
      />
      <RowList>
        {web ? (
          <GrantRow label={M.webUnavailable} />
        ) : !ready ? (
          <GrantRow label={connected ? GRANTS_COPY.loading : GRANTS_COPY.disconnected} />
        ) : list.length ? (
          list.map((g) => (
            <GrantRow
              key={g.grantId}
              label={grantTitle(g, labels)}
              desc={[localizeText(g.purpose, g.purposeRef), grantFacts(g, g.scope.videoId ? (videoNames.get(g.scope.videoId) ?? null) : null)].filter(Boolean).join(' · ')}
              ended={g.state !== 'active'}>
              {g.state === 'active' ? (
                <Button variant="secondary" size="S" isDisabled={!connected} onPress={() => setRevoking(g)}>
                  {GRANTS_COPY.revoke}
                </Button>
              ) : (
                <Badge variant="neutral" size="S" fillStyle="subtle">
                  {grantStateLabel(g.state)}
                </Badge>
              )}
            </GrantRow>
          ))
        ) : (
          <GrantRow label={grants.length ? GRANTS_COPY.noActive : GRANTS_COPY.none} desc={GRANTS_COPY.emptyDesc} />
        )}
      </RowList>
      <DialogContainer onDismiss={() => setRevoking(null)}>
        {revoking ? (
          <AlertDialog
            variant="destructive"
            title={GRANTS_COPY.revokeTitle(grantTitle(revoking, labels))}
            primaryActionLabel={GRANTS_COPY.revoke}
            cancelLabel={GRANTS_COPY.cancel}
            onPrimaryAction={() => void revoke(revoking)}>
            {revokeConfirmText(revoking)}
          </AlertDialog>
        ) : null}
      </DialogContainer>
    </Panel>
  );
}

function GrantRow({ label, desc, ended = false, children }: { label: string; desc?: string; ended?: boolean; children?: React.ReactNode }) {
  return (
    <SettingsRow label={label} desc={desc} muted={ended}>
      {children}
    </SettingsRow>
  );
}
