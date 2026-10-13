import { describe, expect, it } from 'vitest';
import {
  MAX_HOME_MATERIALS,
  addMaterials,
  canStartHome,
  gateGuide,
  homeBrief,
  homeGate,
  lengthLabel,
  materialOf,
  projectNameError,
  type HomeBriefOptions,
} from './home-brief.ts';

const auto: HomeBriefOptions = { images: 0, materials: [] };

describe('duration on template cards', () => {
  it('minutes and seconds are written as "about …"', () => {
    expect(lengthLabel(60)).toBe('约 1 分钟');
    expect(lengthLabel(30)).toBe('约 30 秒');
    expect(lengthLabel(90)).toBe('约 1 分钟 30 秒');
    expect(lengthLabel(600)).toBe('约 10 分钟');
    expect(lengthLabel(null)).toBeNull();
  });
});

describe('body sent to the agent', () => {
  it('sent as is when there is only the user\'s own text', () => {
    expect(homeBrief('  做一条咖啡店的宣传片 ', auto)).toBe('做一条咖啡店的宣传片');
  });

  it('a sentence is added when only materials are attached without text (same whether or not a template is attached; text is still required)', () => {
    expect(homeBrief('', { ...auto, images: 2 })).toBe('根据我附上的材料制作一条视频。');
    expect(homeBrief('', auto)).toBe('');
  });

  it('unfilled placeholders become [label], with no {{ left over (pack spec §5.5)', () => {
    expect(homeBrief('给我们的瑜伽课做一条推广短片，受众是{{受众}}', auto)).toBe('给我们的瑜伽课做一条推广短片，受众是[受众]');
    expect(homeBrief('没闭合的 {{受众', auto)).toBe('没闭合的 {{受众');
  });

  it('local media is written by path on the last line', () => {
    expect(homeBrief('', { ...auto, materials: ['/Users/me/访谈.mp4', '/Users/me/白皮书.pdf'] })).toBe(
      ['根据我附上的材料制作一条视频。', '材料：/Users/me/访谈.mp4、/Users/me/白皮书.pdf'].join('\n'),
    );
  });
});

describe('can start', () => {
  const ok = { ok: true } as const;
  it('text is enough; selecting only a template is not; attaching images or media also works', () => {
    expect(canStartHome({ text: '做个片头', images: 0, materials: 0, gate: ok }).ok).toBe(true);
    expect(canStartHome({ text: '  ', images: 0, materials: 0, gate: ok })).toEqual({ ok: false, why: '先说一句要做什么，或附上材料' });
    expect(canStartHome({ text: '', images: 1, materials: 0, gate: ok }).ok).toBe(true);
    expect(canStartHome({ text: '', images: 0, materials: 2, gate: ok }).ok).toBe(true);
  });

  it('cannot start when the agent is unavailable; does not block while still detecting', () => {
    expect(canStartHome({ text: '做个片头', images: 0, materials: 0, gate: { ok: false, reason: 'agent-missing' } })).toEqual({
      ok: false,
      why: '先连接 AI',
    });
    expect(canStartHome({ text: '做个片头', images: 0, materials: 0, gate: null }).ok).toBe(true);
  });
});

describe('agent guidance', () => {
  const driver = (id: 'claude' | 'codex', state: 'ready' | 'disabled' | 'not-installed' | 'signed-out') => ({
    id,
    name: id === 'claude' ? 'Claude Code' : 'Codex',
    state,
  });

  it('no conclusion while still detecting; one ready agent is enough', () => {
    expect(homeGate(null, [])).toBeNull();
    expect(homeGate([driver('claude', 'not-installed'), driver('codex', 'ready')], [])).toEqual({ ok: true });
    expect(gateGuide({ ok: true })).toBeNull();
  });

  it('a driver is still on first probe and none is ready: no conclusion, no flashing guidance card', () => {
    expect(homeGate([], ['codex'])).toBeNull();
    expect(homeGate([driver('claude', 'not-installed')], ['codex'])).toBeNull();
    // If one is already ready, there is no need to wait for the one still being detected.
    expect(homeGate([driver('claude', 'ready')], ['codex'])).toEqual({ ok: true });
  });

  it('installed but disabled: enable that one', () => {
    const gate = homeGate([driver('claude', 'not-installed'), driver('codex', 'disabled')], []);
    expect(gate).toEqual({ ok: false, reason: 'agent-off', enable: { id: 'codex', name: 'Codex' } });
    expect(gateGuide(gate)).toMatchObject({ title: '已安装的编码 Agent 都停用了', action: '启用 Codex', enable: { id: 'codex' } });
  });

  it('not installed or not signed in: go to Settings › Agent connections', () => {
    const gate = homeGate([driver('claude', 'signed-out'), driver('codex', 'not-installed')], []);
    expect(gate).toEqual({ ok: false, reason: 'agent-missing' });
    expect(gateGuide(gate)).toEqual({
      title: '这一项要交给编码 Agent',
      body: '装 Claude Code 或 Codex CLI 并用你自己的订阅登录，回到这里就能直接开始。',
      action: '连接 Agent',
      enable: null,
    });
  });
});

describe('local media', () => {
  it('sorted by extension into video/audio, images and documents; name taken from the file name', () => {
    expect(materialOf('/Users/me/片子/访谈.MOV')).toEqual({ path: '/Users/me/片子/访谈.MOV', name: '访谈.MOV', kind: 'media' });
    expect(materialOf('/Users/me/播客.m4a').kind).toBe('media');
    expect(materialOf('/Users/me/草图.heic').kind).toBe('image');
    expect(materialOf('C:\\docs\\白皮书.pdf')).toMatchObject({ name: '白皮书.pdf', kind: 'document' });
    expect(materialOf('/Users/me/README').kind).toBe('document');
  });

  it('same path kept once; items over the limit are returned', () => {
    const first = addMaterials([], ['/a.mp4', '/a.mp4', '', '/b.pdf']);
    expect(first).toEqual({ list: [materialOf('/a.mp4'), materialOf('/b.pdf')], rejected: 0 });
    const many = Array.from({ length: MAX_HOME_MATERIALS + 2 }, (_, i) => `/m${i}.mp3`);
    const capped = addMaterials(first.list, many);
    expect(capped.list).toHaveLength(MAX_HOME_MATERIALS);
    expect(capped.rejected).toBe(4);
  });
});

describe('name of a new project', () => {
  it('empty names, dots, slashes and control characters are rejected', () => {
    expect(projectNameError('新片')).toBeNull();
    expect(projectNameError('  ')).toBe('请输入项目名称');
    for (const name of ['..', '.', 'a/b', 'a\\b', 'a\u0007b']) expect(projectNameError(name)).toBe('项目名称不能包含斜杠或控制字符');
  });
});
