import { defineMessages } from '@cuccut/protocol';
import { zhHans } from './thread-copy.zh-Hans.ts';
import { zhHant } from './thread-copy.zh-Hant.ts';
import { ja } from './thread-copy.ja.ts';
import { ko } from './thread-copy.ko.ts';
import { es } from './thread-copy.es.ts';
import { fr } from './thread-copy.fr.ts';
import { de } from './thread-copy.de.ts';
import { nl } from './thread-copy.nl.ts';
import { ptBR } from './thread-copy.pt-BR.ts';
import { it } from './thread-copy.it.ts';
import { ru } from './thread-copy.ru.ts';
import { pl } from './thread-copy.pl.ts';
import { tr } from './thread-copy.tr.ts';
import { vi } from './thread-copy.vi.ts';

/** Copy for executed steps in the session thread (model/thread.ts; translations are in `thread-copy.<语言>.ts`). */
const en = {
  /** CucCut's own video tools (MCP server name `cuccut`) are written as actions. */
  videoTools: {
    videos_list: 'List videos',
    videos_create: 'New video',
    videos_inspect: 'Read video',
    edits_apply: 'Edit video',
    edits_undo: 'Undo edits',
  } as Record<string, string>,
  /** Video tool actions carry their description. */
  toolTitle: (action: string, label: string) => `${action}: ${label}`,
  steps: { command: 'Run command', read: 'Read file', edit: 'Edit file', search: 'Search', other: 'Other tool' },
  /** The phrases of the group header summary (joined by `summary` in order of first appearance). */
  phrase: {
    command: 'ran commands',
    read: (count: number) => `read ${count} ${count === 1 ? 'file' : 'files'}`,
    edit: (count: number) => `edited ${count} ${count === 1 ? 'file' : 'files'}`,
    search: 'searched',
    video: (count: number) => `committed ${count} video ${count === 1 ? 'edit' : 'edits'}`,
    tool: 'called tools',
  },
  summary: (phrases: readonly string[]) => {
    const text = phrases.join(', ');
    return text.charAt(0).toUpperCase() + text.slice(1);
  },
  thinking: 'Thinking',
  stepsFallback: 'Steps',
};
export type ThreadMessages = typeof en;
export const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });
