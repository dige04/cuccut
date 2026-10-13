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
 * 设置 → 诊断 →「资源调度」（架构设计 §7.6、§7.7；设计稿没有这一块）：机器的容量与来源、谁在用、谁在等；
 * 内存、GPU 内存与 CPU 线程可以手动设上限（偏好设置 `resources.capacity`，留空为自动）。`jobs.resources` 是请求不是主题，
 * 这一节开着时每 5 秒取一次，任务有进出、改了设置也立即重取。分组与行的样式与设置页的 Group / Row 相同。
 * 浏览器里只读：Web 白名单不含 `settings.set`，上限框与「全部恢复自动」置灰，导语下写一句。
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

  // 任务有进出时（jobs 镜像变了）、设置变了时立即重取；其余时候按间隔取。
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
