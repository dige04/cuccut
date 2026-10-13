import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { Conversation, TimelineItem } from '@cuccut/protocol';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ConversationStore, type ConversationRecord, type ConversationStoreLog } from './conversation-store.ts';

let dir: string;
let warnings: { message: string; fields?: Record<string, unknown> }[];
let log: ConversationStoreLog;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cuccut-conversations-'));
  warnings = [];
  log = { info: () => {}, warn: (message, fields) => warnings.push({ message, fields }) };
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

function record(id = 'conv_1'): ConversationRecord {
  return {
    schemaVersion: 1,
    conversation: { id, title: 'T', updatedAt: '2026-01-01T00:00:00Z' } as Conversation,
    items: [],
    seq: '0',
    agent: { driverId: 'codex', persistence: null },
  };
}

function agentMessage(id: string, text: string, streaming = true): TimelineItem {
  return { id, createdAt: '2026-01-01T00:00:00Z', taskId: 'task_1', kind: 'agent-message', text, streaming };
}

async function lines(id = 'conv_1'): Promise<Record<string, unknown>[]> {
  const text = await fs.readFile(path.join(dir, `${id}.jsonl`), 'utf8');
  const [header, ...rows] = text
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line) as Record<string, unknown>);
  expect(header).toEqual({ op: 'header', formatVersion: 2 });
  return rows;
}

async function reload(): Promise<ConversationStore> {
  const store = new ConversationStore(dir, { log });
  await store.load();
  return store;
}

/** JSON equivalent of a complete record (ignoring differences such as undefined). */
function plain(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}

describe('ConversationStore', () => {
  it('new session\'s first line is a snapshot; streaming updates to the same item only append upsert rows; no write when nothing changed', async () => {
    const store = new ConversationStore(dir, { log });
    await store.load();
    const r = record();
    store.put(r);
    await store.flush();
    expect((await lines()).map((l) => l.op)).toEqual(['snapshot']);

    const message = agentMessage('item_1', 'he') as Extract<TimelineItem, { kind: 'agent-message' }>;
    r.items.push(message);
    for (const text of ['hel', 'hell', 'hello']) {
      store.markDirty(r.conversation.id);
      await store.flush();
      message.text = text;
    }
    message.streaming = false;
    store.markDirty(r.conversation.id);
    await store.flush();

    const written = await lines();
    expect(written.map((l) => l.op)).toEqual(['snapshot', 'item', 'item', 'item', 'item']);
    expect(written.slice(1).every((l) => (l.item as TimelineItem).id === 'item_1')).toBe(true);

    const size = (await fs.stat(path.join(dir, 'conv_1.jsonl'))).size;
    store.markDirty(r.conversation.id);
    await store.flush();
    expect((await fs.stat(path.join(dir, 'conv_1.jsonl'))).size).toBe(size);

    expect(plain((await reload()).get('conv_1'))).toEqual(plain(r));
  });

  it('metadata and task contract written as meta rows; replayed result matches memory', async () => {
    const store = new ConversationStore(dir, { log });
    await store.load();
    const r = record();
    r.items.push(agentMessage('item_1', 'a'), agentMessage('item_2', 'b'));
    store.put(r);
    await store.flush();

    r.seq = '5';
    r.conversation.title = 'Renamed';
    r.agent.persistence = { threadId: 'th_1' };
    r.tasks = { task_1: { revisions: [], checkResults: [] } };
    (r.items[0] as { text: string }).text = 'a2';
    r.items.push(agentMessage('item_3', 'c'));
    store.markDirty('conv_1');
    await store.flush();

    const written = await lines();
    expect(written.map((l) => l.op)).toEqual(['snapshot', 'item', 'item', 'meta']);
    expect(Object.keys(written[3]!).sort()).toEqual(['agent', 'conversation', 'op', 'seq', 'tasks']);

    r.tasks.task_2 = { revisions: [], checkResults: [] };
    store.markDirty('conv_1');
    await store.flush();
    expect((await lines()).at(-1)).toEqual({ op: 'meta', tasks: { task_2: { revisions: [], checkResults: [] } } });

    const again = await reload();
    expect(plain(again.get('conv_1'))).toEqual(plain(r));
    expect(again.get('conv_1')!.items.map((i) => i.id)).toEqual(['item_1', 'item_2', 'item_3']);

    // The first save after a restart writes only the changed parts.
    const loaded = again.get('conv_1')!;
    (loaded.items[1] as { text: string }).text = 'b2';
    again.markDirty('conv_1');
    await again.flush();
    expect((await lines()).map((l) => l.op)).toEqual(['snapshot', 'item', 'item', 'meta', 'meta', 'item']);
  });

  it('item deleted or reordered: write a snapshot, do not append', async () => {
    const store = new ConversationStore(dir, { log });
    await store.load();
    const r = record();
    r.items.push(agentMessage('item_1', 'a'), agentMessage('item_2', 'b'), agentMessage('item_3', 'c'));
    store.put(r);
    await store.flush();
    r.items.splice(1, 1);
    store.markDirty('conv_1');
    await store.flush();
    expect((await lines()).map((l) => l.op)).toEqual(['snapshot']);
    r.items.reverse();
    store.markDirty('conv_1');
    await store.flush();
    expect((await lines()).map((l) => l.op)).toEqual(['snapshot']);
    expect((await reload()).get('conv_1')!.items.map((i) => i.id)).toEqual(['item_3', 'item_1']);
  });

  it('trailing partial line skipped and logged; unreadable lines in the middle also skipped', async () => {
    const store = new ConversationStore(dir, { log });
    await store.load();
    const r = record();
    r.items.push(agentMessage('item_1', 'a'));
    store.put(r);
    await store.flush();
    (r.items[0] as { text: string }).text = 'ab';
    store.markDirty('conv_1');
    await store.flush();
    await fs.appendFile(path.join(dir, 'conv_1.jsonl'), '{"op":"item","item":{"id":"item_1","te');

    const again = await reload();
    expect(plain(again.get('conv_1'))).toEqual(plain(r));
    expect(warnings.map((w) => w.message)).toEqual(['Conversation log ends with a partial line; skipped it']);

    // Later writes must not be appended after a partial line; they need to be visible when read back next time.
    const loaded = again.get('conv_1')!;
    loaded.items.push({ id: 'item_2', createdAt: '2026-01-01T00:00:01Z', taskId: 'task_1', kind: 'user-message', text: 'hi' } as TimelineItem);
    again.markDirty('conv_1');
    await again.flush();
    warnings = [];
    const third = await reload();
    expect(plain(third.get('conv_1'))).toEqual(plain(loaded));
    expect(warnings).toEqual([]);
  });

  it('unrecognized file renamed to .corrupt-<time> and skipped: bad file header, no snapshot, empty file', async () => {
    await fs.writeFile(path.join(dir, 'conv_bad.jsonl'), 'not json\n{"op":"item"}\n');
    await fs.writeFile(path.join(dir, 'conv_empty.jsonl'), '');
    await fs.writeFile(path.join(dir, 'conv_noheader.jsonl'), `${JSON.stringify({ op: 'snapshot', ...record('conv_noheader') })}\n`);
    await fs.writeFile(path.join(dir, 'conv_noshot.jsonl'), '{"op":"header","formatVersion":2}\n{"op":"item","item":{"id":"x"}}\n');
    const store = new ConversationStore(dir, { log });
    expect(await store.load()).toEqual([]);
    const names = await fs.readdir(dir);
    expect(names.filter((n) => n.endsWith('.jsonl'))).toEqual([]);
    for (const id of ['conv_bad', 'conv_empty', 'conv_noheader', 'conv_noshot']) {
      expect(names.some((n) => n.startsWith(`${id}.jsonl.corrupt-`))).toBe(true);
    }
    expect(warnings).toHaveLength(4);
    // A file renamed this way is not read again at the next startup.
    warnings = [];
    expect(await (await reload()).list()).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it('unknown formatVersion or schemaVersion: log, do not read, keep the file', async () => {
    const header = '{"op":"header","formatVersion":2}\n';
    await fs.writeFile(path.join(dir, 'conv_v2.jsonl'), `${header}${JSON.stringify({ op: 'snapshot', ...record('conv_v2'), schemaVersion: 2 })}\n`);
    await fs.writeFile(path.join(dir, 'conv_f3.jsonl'), `{"op":"header","formatVersion":3}\n${JSON.stringify({ op: 'snapshot', ...record('conv_f3') })}\n`);
    await fs.writeFile(path.join(dir, 'conv_old.json'), JSON.stringify({ ...record('conv_old'), schemaVersion: 9 }));
    expect(await (await reload()).list()).toEqual([]);
    expect(warnings.map((w) => w.fields?.formatVersion ?? w.fields?.schemaVersion).sort()).toEqual([2, 3, 9]);
    expect((await fs.readdir(dir)).sort()).toEqual(['conv_f3.jsonl', 'conv_old.json', 'conv_v2.jsonl']);
  });

  it('compaction: when the log exceeds the threshold, the whole record is written as one snapshot line with equivalent content', async () => {
    const store = new ConversationStore(dir, { log });
    await store.load();
    const r = record();
    const message = agentMessage('item_1', '') as Extract<TimelineItem, { kind: 'agent-message' }>;
    r.items.push(message);
    store.put(r);
    await store.flush();
    let sawLong = false;
    for (let i = 0; i < 200; i++) {
      message.text += 'x';
      store.markDirty('conv_1');
      await store.flush();
      if ((await lines()).length > 50) sawLong = true;
    }
    expect(sawLong).toBe(true);
    // 1 item: the line limit is 1 × 4 + 64; after compaction, the line count falls back.
    expect((await lines()).length).toBeLessThanOrEqual(69);
    expect(plain((await reload()).get('conv_1'))).toEqual(plain(r));
    expect((await fs.readdir(dir)).filter((n) => n.endsWith('.tmp'))).toEqual([]);
  });

  it('old .json migrated to a .jsonl snapshot, old file renamed to .json.migrated; old file ignored when a .jsonl of the same name exists', async () => {
    const legacy = record('conv_legacy');
    legacy.items.push(agentMessage('item_1', 'old', false));
    await fs.writeFile(path.join(dir, 'conv_legacy.json'), JSON.stringify(legacy, null, 2));

    const store = await reload();
    expect(plain(store.get('conv_legacy'))).toEqual(plain(legacy));
    expect((await fs.readdir(dir)).sort()).toEqual(['conv_legacy.json.migrated', 'conv_legacy.jsonl']);
    expect((await lines('conv_legacy')).map((l) => l.op)).toEqual(['snapshot']);

    // The first save after migration appends only the changes.
    const loaded = store.get('conv_legacy')!;
    loaded.items.push(agentMessage('item_2', 'new'));
    store.markDirty('conv_legacy');
    await store.flush();
    expect((await lines('conv_legacy')).map((l) => l.op)).toEqual(['snapshot', 'item']);

    await fs.writeFile(path.join(dir, 'conv_legacy.json'), JSON.stringify(record('conv_legacy')));
    const again = await reload();
    expect(again.get('conv_legacy')!.items).toHaveLength(2);
    expect(warnings.map((w) => w.message)).toEqual(['Legacy conversation file ignored: a conversation log with the same name exists']);
  });

  it('delete removes the log file; pending writes do not write it back', async () => {
    const store = new ConversationStore(dir, { log });
    await store.load();
    store.put(record());
    await store.flush();
    store.markDirty('conv_1');
    await store.delete('conv_1');
    await store.flush();
    expect(await fs.readdir(dir)).toEqual([]);
    expect(store.get('conv_1')).toBeUndefined();
  });
});
