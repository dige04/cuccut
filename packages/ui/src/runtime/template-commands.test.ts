import { afterEach, describe, expect, it, vi } from 'vitest';
import { getLocale, setLocale, type Locale, type MediaHandle, type TemplateListResult, type TemplateSummary } from '@cuccut/protocol';
import { emptyTemplateCatalog, useTemplateCatalog } from '../state/template-catalog-store.ts';
import { RuntimeSession } from './session.ts';
import { forgetTemplateFile, loadTemplates, resetTemplateCommands, templateFileUrl, templatePrompt } from './template-commands.ts';

function summary(id: string, version = '1.0.0'): TemplateSummary {
  return {
    manifest: {
      schema: 1,
      id,
      version,
      kind: 'scene',
      title: id,
      summary: '一句话',
      description: '一小段',
      language: 'zh-CN',
      category: 'marketing',
      ratio: '16:9',
      durationSeconds: 30,
      brief: '示例',
      author: 'CucCut',
      source: 'official',
      license: 'Apache-2.0',
      tags: [],
      cover: { file: 'cover.png', tone: 'blue', figure: 'bars' },
      preview: { beats: ['一', '二', '三'] },
    },
    origin: 'user',
    languages: ['zh-CN'],
    files: { cover: true, preview: false, assets: 0 },
    pack: null,
  };
}

/** Fake session: only `client.request`, answers by method name and records each call. */
function fakeSession(answer: (method: string, params: Record<string, unknown>) => unknown) {
  const calls: { method: string; params: Record<string, unknown> }[] = [];
  const session = {
    client: {
      request: async (method: string, params: Record<string, unknown>) => {
        calls.push({ method, params });
        return answer(method, params);
      },
    },
  } as unknown as Pick<RuntimeSession, 'client'>;
  return { session, calls };
}

const startLocale = getLocale();

/** The test process pins the language with CUCCUT_LOCALE: switch it together when changing the language. */
function switchLocale(locale: Locale): void {
  vi.stubEnv('CUCCUT_LOCALE', locale);
  setLocale(locale);
}

afterEach(() => {
  vi.unstubAllEnvs();
  setLocale(startLocale);
  resetTemplateCommands();
  useTemplateCatalog.setState(emptyTemplateCatalog());
});

describe('template catalog', () => {
  it('multiple simultaneous requests send once; after fetching, sorted by source and id and put into the mirror, diagnostics carried over as is', async () => {
    const result: TemplateListResult = {
      templates: [summary('zeta'), summary('alpha')],
      diagnostics: [
        { code: 'invalid', origin: 'user', dir: 'broken', path: '/home/templates/broken', message: '清单不合规', issues: ['缺 title'] },
      ],
    };
    const { session, calls } = fakeSession(() => result);
    await Promise.all([loadTemplates(session), loadTemplates(session)]);
    expect(calls).toHaveLength(1);
    const state = useTemplateCatalog.getState();
    expect(state).toMatchObject({ status: 'ready', loaded: true, error: null });
    expect(state.templates.map((t) => t.id)).toEqual(['alpha', 'zeta']);
    expect(state.diagnostics).toHaveLength(1);
  });

  it('requested in the current UI language; if the language changes during the fetch, the old-language result is not put into the mirror and the new language is fetched separately', async () => {
    switchLocale('ja');
    const answers: Record<string, (result: TemplateListResult) => void> = {};
    const { session, calls } = fakeSession(
      (_method, params) => new Promise((resolve) => (answers[String(params.language)] = resolve)),
    );
    const first = loadTemplates(session);
    expect(calls.map((c) => c.params)).toEqual([{ language: 'ja' }]);
    switchLocale('fr');
    const second = loadTemplates(session);
    expect(calls.map((c) => c.params)).toEqual([{ language: 'ja' }, { language: 'fr' }]);
    answers.fr!({ templates: [summary('fr-only')], diagnostics: [] });
    await second;
    answers.ja!({ templates: [summary('ja-only')], diagnostics: [] });
    await first;
    expect(useTemplateCatalog.getState().templates.map((t) => t.id)).toEqual(['fr-only']);
  });

  it('fetch failure: reports failure if nothing was ever fetched; a list fetched before is not cleared', async () => {
    let fail = true;
    const { session } = fakeSession(() => {
      if (fail) throw new Error('与 Runtime 的连接已断开');
      return { templates: [summary('alpha')], diagnostics: [] };
    });
    await loadTemplates(session);
    expect(useTemplateCatalog.getState()).toMatchObject({ status: 'failed', loaded: false, error: '与 Runtime 的连接已断开' });
    fail = false;
    await loadTemplates(session);
    expect(useTemplateCatalog.getState()).toMatchObject({ status: 'ready', loaded: true });
    fail = true;
    await loadTemplates(session);
    expect(useTemplateCatalog.getState()).toMatchObject({ status: 'failed', loaded: true });
    expect(useTemplateCatalog.getState().templates).toHaveLength(1);
  });
});

describe('prompts', () => {
  it('cached by id@version:language; failures are not recorded, refetched next time', async () => {
    let fail = true;
    const { session, calls } = fakeSession((_method, params) => {
      if (fail) throw new Error('没有这个模板');
      return { template: summary(String(params.id)), prompt: `正文：${String(params.id)}（${String(params.language)}）` };
    });
    await expect(templatePrompt(session, 'alpha', '1.0.0', 'en')).rejects.toThrow('没有这个模板');
    fail = false;
    expect(await templatePrompt(session, 'alpha', '1.0.0', 'en')).toBe('正文：alpha（en）');
    expect(await templatePrompt(session, 'alpha', '1.0.0', 'en')).toBe('正文：alpha（en）');
    expect(await templatePrompt(session, 'alpha', '1.0.0', 'ja')).toBe('正文：alpha（ja）');
    expect(calls.map((c) => [c.method, c.params.id, c.params.language])).toEqual([
      ['templates.get', 'alpha', 'en'],
      ['templates.get', 'alpha', 'en'],
      ['templates.get', 'alpha', 'ja'],
    ]);
  });
});

describe('attached files', () => {
  it('handle reused before expiry; requested again when close to expiry or after an error', async () => {
    let n = 0;
    let expiresIn = 10 * 60_000;
    const { session, calls } = fakeSession((_method, params): MediaHandle => {
      n++;
      return {
        url: `http://media/${String(params.path)}?n=${n}`,
        expiresAt: new Date(Date.now() + expiresIn).toISOString(),
      } as MediaHandle;
    });
    expect(await templateFileUrl(session, 'alpha', 'cover.png')).toBe('http://media/cover.png?n=1');
    expect(await templateFileUrl(session, 'alpha', 'cover.png')).toBe('http://media/cover.png?n=1');
    forgetTemplateFile('alpha', 'cover.png');
    expiresIn = 10_000;
    expect(await templateFileUrl(session, 'alpha', 'cover.png')).toBe('http://media/cover.png?n=2');
    expect(await templateFileUrl(session, 'alpha', 'cover.png')).toBe('http://media/cover.png?n=3');
    expect(calls.every((c) => c.method === 'templates.openHandle' && c.params.id === 'alpha')).toBe(true);
  });
});

describe('send with a scene template', () => {
  it('template is passed as is to conversations.send; the field is omitted when none is attached', async () => {
    const { session, calls } = fakeSession(() => ({ taskId: 'task_1' }));
    const send = RuntimeSession.prototype.send;
    await send.call(session as RuntimeSession, 'conv_1', '讲讲我的猫', undefined, [], { id: 'promo-ad', version: '1.0.0' });
    await send.call(session as RuntimeSession, 'conv_1', '讲讲我的猫');
    expect(calls[0]).toMatchObject({
      method: 'conversations.send',
      params: { conversationId: 'conv_1', text: '讲讲我的猫', template: { id: 'promo-ad', version: '1.0.0' } },
    });
    expect(calls[0]!.params).not.toHaveProperty('attachments');
    expect(calls[1]!.params).not.toHaveProperty('template');
  });
});
