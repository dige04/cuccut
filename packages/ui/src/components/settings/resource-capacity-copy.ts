import { defineMessages } from '@cuccut/protocol';
import { zhHans } from './resource-capacity-copy.zh-Hans.ts';
import { zhHant } from './resource-capacity-copy.zh-Hant.ts';
import { ja } from './resource-capacity-copy.ja.ts';
import { ko } from './resource-capacity-copy.ko.ts';
import { es } from './resource-capacity-copy.es.ts';
import { fr } from './resource-capacity-copy.fr.ts';
import { de } from './resource-capacity-copy.de.ts';
import { nl } from './resource-capacity-copy.nl.ts';
import { ptBR } from './resource-capacity-copy.pt-BR.ts';
import { it } from './resource-capacity-copy.it.ts';
import { ru } from './resource-capacity-copy.ru.ts';
import { pl } from './resource-capacity-copy.pl.ts';
import { tr } from './resource-capacity-copy.tr.ts';
import { vi } from './resource-capacity-copy.vi.ts';

/** Copy for Settings › “Resource scheduling” (资源调度) (resource-capacity.tsx). English is the source of keys and types; translations live in `resource-capacity-copy.<language>.ts`. */
const en = {
  title: 'Resource scheduling',
  resetAll: 'Reset all to automatic',
  lead: "Heavy tasks like transcription, local models and exports queue by this computer's capacity: they start when they fit and otherwise wait for earlier ones to finish. Capacity is detected automatically. If this computer also runs other large programs, or detection is off, you can set a limit by hand; leave it empty for automatic.",
  disconnected: 'Not connected to Runtime',
  loadFailed: "Couldn't read resource status",
  loading: 'Reading resource status…',
  /** Accessible name of the input: “memory limit, in GB”. */
  limitOf: (label: string, unit: string) => `${label} limit (${unit})`,
  unit: { memoryGB: 'GB', gpuMemoryGB: 'GB', cpuThreads: 'threads' },
  notSettable: "Can't be set by hand",
  inUseAndQueued: 'In use and queued',
  inUse: (demand: string) => `In use · ${demand}`,
  queued: (detail: string | null, demand: string) => `Queued · ${detail ?? 'Waiting to start'} · Needs ${demand}`,
  idle: 'No tasks are using local resources',
  saveFailed: (message: string) => `Couldn't save: ${message}`,
};

export type ResourceCapacityMessages = typeof en;

export const RESOURCE_COPY = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });
