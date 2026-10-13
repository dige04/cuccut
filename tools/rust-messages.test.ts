import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LOCALES, setLocale } from '../packages/protocol/src/i18n.ts';
import { formatRef, localizeText, type MessageParam } from '../packages/protocol/src/message-ref.ts';
import '../packages/protocol/src/messages/index.ts';
import { engineHostMessages } from '../packages/protocol/src/messages/engine-host/engineHost.ts';
import { engineMessages } from '../packages/protocol/src/messages/video-engine/engine.ts';
import { videoModelMessages } from '../packages/protocol/src/messages/video-model/videoModel.ts';
import { timeMessages } from '../packages/protocol/src/messages/editor-semantics/time.ts';
import { listMessages } from '../packages/protocol/src/messages/message-ref/list.ts';
import { engineError } from '../packages/runtime-core/src/videos/engine-host.ts';
import { messagesIn, placeholders, rustMessages } from './rust-messages.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const messages = rustMessages(root);
const RUST_AREAS = { engine: engineMessages, engineHost: engineHostMessages, videoModel: videoModelMessages, time: timeMessages, list: listMessages };
const MISSING = '\u0000missing';

/** Passes each placeholder through as its own argument: the rendered English should match the template word for word. */
function selfParams(template: string): Record<string, MessageParam> {
  return Object.fromEntries(placeholders(template).map((name) => [name, `{${name}}`]));
}

beforeEach(() => {
  vi.stubEnv('CUCCUT_LOCALE', undefined);
  setLocale('en');
});
afterEach(() => vi.unstubAllEnvs());

describe('Rust msg! and TS copy catalog', () => {
  it('finds messages in Rust', () => {
    expect(messages.length).toBeGreaterThan(300);
    expect(messages.find((m) => m.key === 'engine.notFound')).toMatchObject({ template: '{kind} {id} does not exist' });
  });

  it('a given key uses the same template everywhere', () => {
    const byKey = new Map<string, Set<string>>();
    for (const m of messages) byKey.set(m.key, (byKey.get(m.key) ?? new Set()).add(m.template));
    const conflicts = [...byKey].filter(([, templates]) => templates.size > 1).map(([key, templates]) => `${key}: ${[...templates].join(' | ')}`);
    expect(conflicts).toEqual([]);
  });

  it('every key is registered, and the English matches the Rust template', () => {
    const wrong = messages.flatMap((m) => {
      const rendered = formatRef({ key: m.key, params: selfParams(m.template) }, MISSING, 'en');
      return rendered === m.template ? [] : [`${m.file}:${m.line} ${m.key}: ${rendered === MISSING ? '没有登记' : rendered}`];
    });
    expect(wrong).toEqual([]);
  });

  it('every translation uses all parameters', () => {
    const wrong = LOCALES.filter((locale) => locale !== 'en').flatMap((locale) =>
      messages.flatMap((m) => {
        const rendered = formatRef({ key: m.key, params: selfParams(m.template) }, MISSING, locale);
        const lost = placeholders(m.template).filter((name) => !rendered.includes(`{${name}}`));
        return lost.length ? [`${locale} ${m.key}: ${lost.join(', ')}`] : [];
      }),
    );
    expect(wrong).toEqual([]);
  });

  it('the catalog has no keys that Rust no longer uses', () => {
    const used = new Set(messages.map((m) => m.key));
    const stale = Object.entries(RUST_AREAS).flatMap(([area, builders]) => Object.keys(builders).map((name) => `${area}.${name}`)).filter((key) => !used.has(key));
    expect(stale).toEqual([]);
  });
});

describe('messagesIn', () => {
  it('handles escapes, skips comments and test modules', () => {
    const source = [
      'fn a() { msg!("x.one", "Say \\"hi\\" \\u{2014} {name}", name); }',
      '/// msg!("x.doc", "in a doc comment")',
      'fn b() { msg!(',
      '    "x.two",',
      '    "first \\',
      '     second",',
      '); }',
      '#[cfg(test)]',
      'mod tests { fn t() { let _ = \'{\'; msg!("x.test", "only in tests"); } }',
      'fn c() { msg!("x.three", "after tests"); }',
    ].join('\n');
    expect(messagesIn(source).map(({ key, template }) => [key, template])).toEqual([
      ['x.one', 'Say "hi" — {name}'],
      ['x.two', 'first second'],
      ['x.three', 'after tests'],
    ]);
    expect(placeholders('{{literal}} {a} and {b_2}')).toEqual(['a', 'b_2']);
  });
});

describe('engine error references', () => {
  // Same shape as the unit tests in `crates/video-engine/src/error.rs`: entity kinds are nested references.
  const body = {
    code: 'ENTITY_NOT_FOUND',
    message: 'Clip item_1 does not exist',
    messageRef: { key: 'engine.notFound', params: { kind: { key: 'engine.kindItem', text: 'Clip' }, id: 'item_1' } },
    entityIds: ['item_1'],
    inputRevisions: [],
    retryability: 'after-refresh' as const,
    details: null,
    recovery: 'Re-read the video, then choose the target again',
    recoveryRef: { key: 'engine.notFoundRecovery' },
  };

  it('expands in the current language, nested kinds switch too', () => {
    expect(localizeText(body.message, body.messageRef)).toBe('Clip item_1 does not exist');
    setLocale('zh-Hans');
    expect(localizeText(body.message, body.messageRef)).toBe('片段 item_1 不存在');
    expect(localizeText(body.recovery, body.recoveryRef)).toBe('重新读取视频之后再选择目标');
  });

  it('unrecognized keys fall back to the English default text', () => {
    setLocale('zh-Hans');
    expect(localizeText('Something new', { key: 'engine.fromTheFuture' })).toBe('Something new');
  });

  it('RpcError carries the reference, text is in the Runtime\'s language', () => {
    setLocale('zh-Hans');
    const error = engineError(body);
    expect(error.code).toBe('not-found');
    expect(error.message).toBe('片段 item_1 不存在');
    expect(error.messageRef).toEqual(body.messageRef);
    expect(error.toPayload()).toMatchObject({ messageRef: body.messageRef });
  });

  it('concatenated multiple causes expand one by one', () => {
    const problems = { key: 'list.join', params: { head: { key: 'time.leadingZero', text: 'x' }, tail: { key: 'engine.overlap', text: 'y' } } };
    setLocale('zh-Hans');
    expect(formatRef({ key: 'engine.bodyNotSchema', params: { schema: 'cuccut.cuts/1', problems } }, '')).toBe(
      '正文不合 cuccut.cuts/1：整数不能有前导零；同一轨道上的片段不能重叠',
    );
  });
});
