import { useCallback, useEffect, useState } from 'react';
import type { ResourcesSnapshot } from '@cuccut/protocol';
import { Button, NumberField, ToastQueue } from '@react-spectrum/s2';
import { Gauge, ListChecks } from 'lucide-react';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import {
  CAPACITY_LIMITS,
  autoPlaceholder,
  capacityForm,
  capacityRows,
  capacitySetting,
  demandLine,
  sameCapacity,
  type CapacityForm,
} from '../../model/resource-capacity.ts';
import { jobWaitText } from '../../model/localized-text.ts';
import { kindLabel } from '../../model/task-list.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { useConnection } from '../../state/connection-store.ts';
import { useJobs } from '../../state/jobs-store.ts';
import { useSetting } from '../../state/settings-store.ts';
import { M } from './general-settings-copy.ts';
import { RESOURCE_COPY } from './resource-capacity-copy.ts';
import { Panel, PanelHeading, RowList, SettingsRow } from './settings-ui.tsx';

/*
 * Settings → Diagnostics → “Resource scheduling” (资源调度) (architecture design §7.6, §7.7; the design mockup has no such section): the machine’s capacity and sources, who is using it, and who is waiting.
 * Memory, GPU memory and CPU threads can be capped manually (preference `resources.capacity`; leave empty for automatic). `jobs.resources` is a request, not a topic: while this section is open it is fetched every 5 seconds, and it is fetched again right away when jobs start or finish or settings change. Groups and rows are styled the same as the Group / Row of the settings page.
 * Read-only in the browser: the web allowlist does not include `settings.set`, so the cap fields and “Restore all to automatic” (全部恢复自动) are greyed out, with one line written under the intro.
 */

const rowValue = style({ font: 'ui', color: 'gray-800', userSelect: 'text' });
const field = style({ width: 144 });

const POLL_MS = 5000;

const FIELD_OF = { memory: 'memoryGB', gpuMemory: 'gpuMemoryGB', cpuThreads: 'cpuThreads' } as const;

export function ResourceCapacity() {
  const runtime = useRuntime();
  const web = runtime.host.platform === 'web';
  const connected = useConnection((s) => s.state.status === 'connected');
  const setting = useSetting('resources.capacity');
  const jobs = useJobs((s) => s.jobs);
  const [snapshot, setSnapshot] = useState<ResourcesSnapshot | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setSnapshot(await runtime.client.request('jobs.resources', {}));
      setFailed(null);
    } catch (error) {
      setFailed((error as Error).message);
    }
  }, [runtime]);

  // Refetch immediately when jobs come and go (the jobs mirror changed) or when settings change. Otherwise, fetch on an interval.
  const live = jobs
    .filter((j) => j.state === 'running' || j.state === 'queued')
    .map((j) => `${j.jobId}:${j.state}`)
    .join(',');
  useEffect(() => {
    if (!connected) return;
    void load();
    const timer = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(timer);
  }, [connected, load, live, setting]);

  const save = async (next: CapacityForm) => {
    const value = capacitySetting(next);
    if (sameCapacity(value, setting)) return;
    try {
      await runtime.client.request('settings.set', { values: { 'resources.capacity': value } });
      await load();
    } catch (error) {
      ToastQueue.negative(RESOURCE_COPY.saveFailed((error as Error).message), { timeout: 5000 });
    }
  };

  const form = capacityForm(setting);
  const overridden = setting !== null && capacitySetting(form) !== null;
  const titleOf = (owner: string, label: string) => {
    const job = jobs.find((j) => j.jobId === owner);
    return job ? kindLabel(job.kind) : label;
  };

  return (
    <>
      <Panel label={RESOURCE_COPY.title} className="flex flex-col gap-2 pb-1.5">
        <PanelHeading
          title={RESOURCE_COPY.title}
          hint={RESOURCE_COPY.lead}
          icon={<Gauge />}
          action={
            overridden ? (
              <Button variant="secondary" size="S" isDisabled={web || !connected} onPress={() => void save({ memoryGB: null, gpuMemoryGB: null, cpuThreads: null })}>
                {RESOURCE_COPY.resetAll}
              </Button>
            ) : null
          }
        />
        {web ? <p className="m-0 text-xs text-foreground/80">{M.webNote}</p> : null}
        <RowList>
          {!connected ? (
            <SettingsRow label={RESOURCE_COPY.disconnected} />
          ) : !snapshot ? (
            <SettingsRow label={failed ? RESOURCE_COPY.loadFailed : RESOURCE_COPY.loading} desc={failed ?? undefined} />
          ) : (
            capacityRows(snapshot).map((r) => {
              const key = r.dimension === 'scratchDisk' ? null : FIELD_OF[r.dimension];
              return (
                <SettingsRow key={r.dimension} label={`${r.label} · ${r.total}`} desc={r.desc}>
                  {key ? (
                    <NumberField
                      aria-label={RESOURCE_COPY.limitOf(r.label, RESOURCE_COPY.unit[key])}
                      size="S"
                      styles={field}
                      placeholder={autoPlaceholder(snapshot, key)}
                      minValue={CAPACITY_LIMITS[key].min}
                      maxValue={CAPACITY_LIMITS[key].max}
                      step={key === 'cpuThreads' ? 1 : 0.5}
                      formatOptions={key === 'cpuThreads' ? { maximumFractionDigits: 0 } : { maximumFractionDigits: 1 }}
                      value={form[key] ?? NaN}
                      isDisabled={web}
                      onChange={(value) => void save({ ...form, [key]: Number.isNaN(value) ? null : value })}
                    />
                  ) : (
                    <span className={rowValue}>{RESOURCE_COPY.notSettable}</span>
                  )}
                </SettingsRow>
              );
            })
          )}
        </RowList>
      </Panel>
      {snapshot ? (
        <Panel label={RESOURCE_COPY.inUseAndQueued} className="flex flex-col gap-2 pb-1.5">
          <PanelHeading title={RESOURCE_COPY.inUseAndQueued} icon={<ListChecks />} />
          <RowList>
            {snapshot.leases.length || snapshot.waiting.length ? (
              <>
                {snapshot.leases.map((l) => (
                  <SettingsRow key={l.leaseId} label={titleOf(l.owner, l.label)} desc={RESOURCE_COPY.inUse(demandLine(l.demand))} />
                ))}
                {snapshot.waiting.map((w) => (
                  <SettingsRow
                    key={`wait:${w.owner}`}
                    label={titleOf(w.owner, w.label)}
                    desc={RESOURCE_COPY.queued(jobWaitText(w.wait), demandLine(w.demand))}
                  />
                ))}
              </>
            ) : (
              <SettingsRow label={RESOURCE_COPY.idle} />
            )}
          </RowList>
        </Panel>
      ) : null}
    </>
  );
}
