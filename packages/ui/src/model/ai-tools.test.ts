import fs from 'node:fs';
import path from 'node:path';
import { LOCALES, setLocale } from '@cuccut/protocol';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AI_TOOL_GROUP_LABEL,
  AI_TOOLS,
  agentStaysOnPage,
  aiTool,
  canvasRatio,
  cleanupExtra,
  defaultSkillIds,
  groupSub,
  handoffHint,
  hasScope,
  intentPrompt,
  isAiToolId,
  laterNote,
  LENGTHS,
  LIST_GROUPS,
  listedTools,
  needsTranscript,
  retranslatePrompt,
  sessionOptions,
  SHORTS_COUNTS,
  SHORTS_DEFAULTS,
  SHORTS_FOCUS,
  SHORTS_LENGTHS,
  shortsAutoHint,
  shortsLengthRange,
  shortsLines,
  standingLines,
  TOOL_SKILL,
  toolEffect,
  toolTemplate,
  writingExtra,
  type AgentToolId,
} from './ai-tools.ts';

/** Repo root `skills/cuccut/built-in-skills/`: the built-in skills shipped with the app, one directory per id. */
const SKILLS_DIR = path.resolve(import.meta.dirname, '../../../../skills/cuccut/built-in-skills');
const AGENT_TOOLS: AgentToolId[] = ['polish', 'chapters', 'speakers', 'retranscribe', 'cleanup', 'stale', 'summary', 'blog', 'title', 'desc', 'cover', 'shortscut'];

describe('AI tools catalog', () => {
  it('six groups and sixteen tools, in the same order as the prototype', () => {
    expect(AI_TOOLS.map((t) => t.id)).toEqual([
      'crop',
      'shortscut',
      'polish',
      'chapters',
      'speakers',
      'retranscribe',
      'cleanup',
      'translate',
      'stale',
      'dub',
      'summary',
      'blog',
      'title',
      'desc',
      'cover',
      'soundtrack',
    ]);
  });

  it('speaker recognition, translation and dubbing go through the Runtime; smart trim is not yet possible and says why; the rest (including cutting into a short video) goes to the Agent', () => {
    expect(AI_TOOLS.filter((t) => t.tier === 'runtime').map((t) => t.id)).toEqual(['speakers', 'translate', 'dub']);
    const soon = AI_TOOLS.filter((t) => t.tier === 'soon');
    expect(soon.map((t) => t.id)).toEqual(['crop']);
    for (const t of soon) expect(t.why).toMatch(/Runtime 还没有这条流程/);
    expect(aiTool('stale').tier).toBe('agent');
    expect(aiTool('shortscut').tier).toBe('agent');
    expect(aiTool('shortscut').setup).toEqual(['找出最值得单独发布的话题，各剪成一支完整的短视频。']);
  });

  it('generate music sits in the Sound group, listed last, done on the tools page, not from the script', () => {
    expect(aiTool('soundtrack')).toMatchObject({ group: 'sound', tier: 'tool', name: '生成配乐' });
    expect(LIST_GROUPS.at(-1)).toBe('sound');
    expect(listedTools('sound').map((t) => t.id)).toEqual(['soundtrack']);
    expect(needsTranscript('soundtrack')).toBe(false);
    expect(needsTranscript('polish')).toBe(true);
  });

  it('recognizes tool ids', () => {
    expect(isAiToolId('polish')).toBe(true);
    expect(isAiToolId('export')).toBe(false);
    expect(isAiToolId(null)).toBe(false);
  });

  it('a tool the sentence does not use a range for gets no range line', () => {
    expect(hasScope('polish')).toBe(true);
    expect(hasScope('title')).toBe(true);
    expect(hasScope('chapters')).toBe(false);
    expect(hasScope('stale')).toBe(false);
  });

  it('after handing off to the Agent, only finding cuttable speech and refreshing stale translations stay in place', () => {
    expect(agentStaysOnPage('cleanup')).toBe(true);
    expect(agentStaysOnPage('stale')).toBe(true);
    expect(agentStaysOnPage('polish')).toBe(false);
    expect(agentStaysOnPage('blog')).toBe(false);
  });
});

describe('intent sentence handed to the Agent', () => {
  it('uses the title when there is one, otherwise says this video; the default range is the whole video', () => {
    expect(intentPrompt({ tool: 'polish', title: '码与远方' })).toBe('润色「码与远方」的全篇文稿：修错字、补标点、按话题分段，不改写我的表达。');
    expect(intentPrompt({ tool: 'cleanup', title: ' ', scope: '第 2 章 · 开场' })).toBe(
      '找出这个视频第 2 章 · 开场里的口癖、长停顿和重复起句，先列出来，我确认后再剪。',
    );
  });

  it('extra requirements, one sentence per line, end with a period, skip empty ones', () => {
    expect(intentPrompt({ tool: 'chapters', title: 'A', extra: ['先润色并分段，再生成章节', '', null, '  不要用英文！ '] })).toBe(
      '给「A」按话题分出章节，每章起一个短标题。先润色并分段，再生成章节。不要用英文！',
    );
  });

  it('refresh stale translations: state which categories are checked, and what to do with the cut category, one more sentence', () => {
    expect(intentPrompt({ tool: 'stale', title: 'A', edited: true, cut: false })).toBe('「A」有几句译文过期了（原文改过），只重译这些句子，其余一个字不动。');
    expect(intentPrompt({ tool: 'stale', title: 'A', edited: 3, cut: true })).toBe(
      '「A」有几句译文过期了（3 句原文改过、原文被剪切），只重译这些句子，被剪切的按剪后的原文重译、整句剪掉的随句一起剪掉，其余一个字不动。',
    );
    expect(intentPrompt({ tool: 'stale' })).toBe('这个视频有几句译文过期了：原文改过，只重译这些句子，其余一个字不动。');
  });

  it('translation list handed to the Agent to retranslate: one sentence gives the timecode and the start of the source text, one batch gives the language and sentence count; only these sentences change', () => {
    expect(retranslatePrompt({ title: 'A', language: '英语', scope: { time: '0:12', text: '我们先看第一个例子' } })).toBe(
      '把「A」里0:12 「我们先看第一个例子」这一句重译成英语，只改这一句的译文，时间轴、字幕样式与别的句子一个字不动。',
    );
    expect(retranslatePrompt({ title: null, language: '英语', scope: { time: null, text: '剪掉了' } })).toBe(
      '把这个视频里「剪掉了」这一句重译成英语，只改这一句的译文，时间轴、字幕样式与别的句子一个字不动。',
    );
    expect(retranslatePrompt({ title: 'A', language: '日语', count: 4 })).toBe('「A」的日语译文有 4 句过期或待翻译，只重译这些句子，其余一个字不动。');
  });

  it('title and cover creation carries a count, default 6 / 3 images', () => {
    expect(intentPrompt({ tool: 'title', title: 'A', count: 8 })).toBe('给「A」起 8 个候选标题，角度各不相同，每个写一行理由，挑一个推荐。');
    expect(intentPrompt({ tool: 'title', title: 'A' })).toContain('起 6 个候选标题');
    expect(intentPrompt({ tool: 'cover', title: 'A' })).toContain('做 3 张封面候选');
  });
});

describe('settings state folded into extra requirements', () => {
  it('find cuttable speech: all checked adds nothing, unchecked ones are combined into one sentence', () => {
    expect(cleanupExtra({ fillers: true, pauses: true, repeats: true })).toEqual([]);
    expect(cleanupExtra({ fillers: false, pauses: true, repeats: false })).toEqual(['口癖不找、重复起句不找']);
  });

  it('writing: range first, length does not go into the title and cover, perspective only goes into the blog and description', () => {
    expect(writingExtra('blog', { scope: '第 1 章 · 开场', length: 'long', style: 'pop', language: '英语', view: 'viewer', note: ' 提一下嘉宾 ' })).toEqual([
      '只看第 1 章 · 开场',
      '篇幅：长',
      '风格：科普',
      '用英语写',
      '视角：观众',
      '提一下嘉宾',
    ]);
    expect(writingExtra('title', { length: 'short', style: 'custom', customStyle: '  像朋友聊天 ', platform: 'B 站', view: 'author' })).toEqual([
      '风格：像朋友聊天',
      '要发到：B 站，按它的规定写，写完提醒我核对',
    ]);
    // A custom style with no text and an automatic viewpoint: neither goes into the sentence
    expect(writingExtra('desc', { style: 'custom', customStyle: ' ', view: 'auto' })).toEqual([]);
  });

  it('blog keyframe illustrations: add one line only when checked, other tools do not add it', () => {
    const pic = '需要配图的地方从视频里取关键帧插进正文，每张配一句图注';
    expect(writingExtra('blog', { style: 'plain', frames: true })).toContain(pic);
    expect(writingExtra('blog', { style: 'plain' })).not.toContain(pic);
    expect(writingExtra('blog', { style: 'plain', frames: false })).not.toContain(pic);
    expect(writingExtra('summary', { style: 'plain', frames: true })).not.toContain(pic);
    expect(intentPrompt({ tool: 'blog', extra: writingExtra('blog', { frames: true }) })).toContain(`${pic}。`);
  });

  it('cover: the point to make, canvas ratio, cover text', () => {
    expect(writingExtra('cover', { idea: '一句话讲清', ratio: '9:16', coverText: 'phrase', length: 'long' })).toEqual([
      '封面要说的一件事：一句话讲清',
      '画幅 9:16',
      '封面上的字：一句短语',
    ]);
  });
});

describe('canvas ratio', () => {
  it('reduce to the simplest integer ratio; use 16:9 when it cannot be measured', () => {
    expect(canvasRatio(1920, 1080)).toBe('16:9');
    expect(canvasRatio(1080, 1920)).toBe('9:16');
    expect(canvasRatio(1000, 1000)).toBe('1:1');
    expect(canvasRatio(0, 1080)).toBe('16:9');
  });
});

describe('cut into a short video', () => {
  it('default duration is automatic (no range); four preset tiers; custom values are clamped to 1–600 seconds on both ends, swapped if reversed, and one second apart when equal', () => {
    expect(SHORTS_DEFAULTS.length).toBe('auto');
    expect(shortsLengthRange(SHORTS_DEFAULTS)).toBeNull();
    expect(SHORTS_LENGTHS.map((l) => l.key)).toEqual(['auto', 'short', 'medium', 'long', 'extended', 'custom']);
    expect(shortsLengthRange({ length: 'medium', lenMin: 0, lenMax: 0 })).toEqual({ min: 30, max: 60 });
    expect(shortsLengthRange({ length: 'extended', lenMin: 0, lenMax: 0 })).toEqual({ min: 60, max: 180 });
    expect(shortsLengthRange({ length: 'custom', lenMin: 90, lenMax: 20 })).toEqual({ min: 20, max: 90 });
    expect(shortsLengthRange({ length: 'custom', lenMin: 0, lenMax: 9999 })).toEqual({ min: 1, max: 600 });
    expect(shortsLengthRange({ length: 'custom', lenMin: 600, lenMax: 600 })).toEqual({ min: 599, max: 600 });
    expect(shortsLengthRange({ length: 'custom', lenMin: Number.NaN, lenMax: 45 })).toEqual({ min: 30, max: 45 });
  });

  it('parameters folded into the template one line per sentence: intent sentence, how many clips and how long, ratio and framing, subtitles, already-cut parts are not searched again, final line creates directly', () => {
    const intent = intentPrompt({ tool: 'shortscut', title: 'A', scope: '第 2 章 · 开场' });
    expect(intent).toBe('从「A」的第 2 章 · 开场里找出最值得单独发布的话题，每个话题剪成一支完整的短视频：每支一部新视频，引用同一份原片，原视频和时间轴不动。');
    const lines = toolTemplate('shortscut', intent, { lines: shortsLines(SHORTS_DEFAULTS, { hasTranslation: true }) }).split('\n');
    expect(lines).toEqual([
      intent,
      '几支由你按话题定，每支多长按话题定：从开头能抓人的那句剪到讲完，起止落在句子边界上',
      '画幅 9:16，取景自动：在片段里均匀抽几帧，看说话的人在画面哪一侧，把裁框放到他身上；找不到人就居中',
      '字幕：原文 + 译文，短视频字幕',
      '已经切过的不再找',
      '找好就直接创建成视频，不用先问我',
    ]);
  });

  it('keep the original ratio without cropping; without translation carry only the original; \'follow the speaker\' is not offered and falls back to automatic; do not have the Agent pull the video into the project', () => {
    const lines = shortsLines(
      { ...SHORTS_DEFAULTS, count: 12, length: 'medium', ratio: 'source', tracks: 'translation', style: 'video', skipDone: false },
      { hasTranslation: false },
    );
    expect(lines).toEqual([
      '要 10 支，每支 30–60 秒，起止落在句子边界上',
      '画幅：保留原画幅，不裁',
      '字幕：只要原文，沿用这部视频的样式',
      '找好就直接创建成视频，不用先问我',
    ]);
    expect(shortsLines({ ...SHORTS_DEFAULTS, focus: 'speaker' }, { hasTranslation: true })[1]).toBe('画幅 9:16，取景自动：在片段里均匀抽几帧，看说话的人在画面哪一侧，把裁框放到他身上；找不到人就居中');
    expect(shortsLines({ ...SHORTS_DEFAULTS, ratio: '1:1', focus: 'manual' }, { hasTranslation: true })[1]).toBe(
      '画幅 1:1，取景先居中，之后我逐支自己调',
    );
  });

  it('the count and length can each be left to the Agent to decide by topic: the dropdown\'s automatic goes first, the sentence in the prompt hands over only the automatic half, and the note below changes with it', () => {
    expect(SHORTS_DEFAULTS.count).toBe('auto');
    expect(SHORTS_COUNTS.map((c) => c.label)).toEqual(['自动', '1 支', '2 支', '3 支', '4 支', '5 支', '6 支', '7 支', '8 支', '9 支', '10 支']);
    const first = (s: Partial<typeof SHORTS_DEFAULTS>) => shortsLines({ ...SHORTS_DEFAULTS, ...s }, { hasTranslation: true })[0];
    expect(first({ count: 3 })).toBe('要 3 支，每支多长按话题定：从开头能抓人的那句剪到讲完，起止落在句子边界上');
    expect(first({ length: 'short' })).toBe('几支由你按话题定，每支 15–30 秒，起止落在句子边界上');
    expect(first({ count: 2, length: 'custom', lenMin: 40, lenMax: 90 })).toBe('要 2 支，每支 40–90 秒，起止落在句子边界上');
    expect(first({ count: Number.NaN })).toBe(first({ count: 'auto' }));
    expect(shortsAutoHint(SHORTS_DEFAULTS)).toBe('自动：Agent 先找出能单独成立的好话题，几支、每支多长都按话题定，不凑数也不截半截。');
    expect(shortsAutoHint({ count: 'auto', length: 'medium' })).toBe('自动：够格的话题有几个就切几支，不拿弱的凑数。');
    expect(shortsAutoHint({ count: 4, length: 'auto' })).toBe('自动：每支从开头能抓人的那句剪到话题讲完，不为凑时长拉长或截短。');
    expect(shortsAutoHint({ count: 4, length: 'custom' })).toBeNull();
  });
});

describe('AI tools tab', () => {
  it('first batch in the list is the three groups starting from the script plus cut into short video under Visuals and the Sound group; writing and publishing each have a subtitle sentence; the footnote says where translation is and that smart trim is not yet available', () => {
    expect(LIST_GROUPS).toEqual(['transcript', 'writing', 'publish', 'frame', 'sound']);
    expect(listedTools('frame').map((t) => t.id)).toEqual(['shortscut']);
    expect(LIST_GROUPS.flatMap((g) => listedTools(g)).map((t) => t.id)).not.toContain('crop');
    expect(LIST_GROUPS.filter((g) => g !== 'frame' && g !== 'sound').flatMap((g) => listedTools(g)).map((t) => t.id)).toEqual([
      'polish',
      'chapters',
      'speakers',
      'retranscribe',
      'cleanup',
      'summary',
      'blog',
      'title',
      'desc',
      'cover',
    ]);
    expect(groupSub('transcript')).toBeNull();
    expect(groupSub('writing')).toMatch(/读的人/);
    expect(groupSub('publish')).toMatch(/发视频的人/);
    expect(laterNote()).toMatch(/字幕面板.*音频面板.*搬到这里/);
    expect(laterNote()).toMatch(/智能裁剪/);
  });

  it('every tool has a sentence on whether it changes the video', () => {
    for (const id of AGENT_TOOLS) expect(toolEffect(id), id).toBeTruthy();
    expect(toolEffect('polish')).toMatch(/撤销/);
    expect(toolEffect('cleanup')).toMatch(/确认之前/);
    for (const id of ['summary', 'blog', 'title', 'desc', 'cover'] as const) expect(toolEffect(id)).toMatch(/^不改视频/);
  });

  it('template = intent sentence + fixed constraints: writing types carry Markdown and language, organizing types do not', () => {
    const intent = intentPrompt({ tool: 'summary', title: 'A' });
    const lines = toolTemplate('summary', intent, { language: '英语' }).split('\n');
    expect(lines[0]).toBe(intent);
    expect(lines[1]).toBe('用 Markdown 写，用英语。');
    expect(lines.join('\n')).toMatch(/mm:ss/);
    // No language given: follow the document
    expect(standingLines('desc')[0]).toBe('用 Markdown 写，语言与文稿相同。');
    expect(standingLines('title', { language: ' ' })[0]).toBe('语言与文稿相同。');
    const polish = toolTemplate('polish', '润色。');
    expect(polish).not.toMatch(/Markdown/);
    expect(polish).toMatch(/不改写我的表达/);
    // A tool with no fixed constraints has only the intent sentence; an empty intent sentence does not leave a blank line
    expect(toolTemplate('cleanup', '找口癖。')).toBe('找口癖。');
    expect(toolTemplate('cleanup', '  ')).toBe('');
  });

  it('session destination: default is a new session; \'continue\' is offered only when this video has a session with messages, marked with the message count', () => {
    const none = sessionOptions({ canCreate: true, current: null });
    expect(none.options.map((o) => o.key)).toEqual(['new']);
    expect(none.fallback).toBe('new');
    const has = sessionOptions({ canCreate: true, current: { id: 'c9', title: '剪口癖', messages: 2 } });
    expect(has.options.map((o) => o.key)).toEqual(['new', 'current']);
    expect(has.options[1]).toMatchObject({ conversationId: 'c9', label: '接着「剪口癖」' });
    expect(has.options[1]!.sub).toMatch(/已有 2 条消息/);
    // The message count has not been fetched yet: still give it, just without a number
    expect(sessionOptions({ canCreate: true, current: { id: 'c9', title: ' ', messages: null } }).options[1]!.label).toBe('接着「这个视频的会话」');
    // An empty session where nothing has been said yet does not count
    expect(sessionOptions({ canCreate: true, current: { id: 'c2', title: 'x', messages: 0 } }).options).toHaveLength(1);
    // The video is not in a project: a new session cannot see it, so it can only continue the session it lives in
    const only = sessionOptions({ canCreate: false, current: { id: 'c3', title: 'x', messages: 4 } });
    expect(only.options.map((o) => o.key)).toEqual(['current']);
    expect(only.fallback).toBe('current');
    expect(sessionOptions({ canCreate: false, current: null }).fallback).toBeNull();
  });

  it('the line below the main button changes with the destination', () => {
    expect(handoffHint('new')).toMatch(/^新开一条会话/);
    expect(handoffHint('current')).toMatch(/^发到这个视频当前的会话/);
  });

  it('every tool handed to the Agent has a built-in skill, ids all in the repo\'s skills/; if not in the list, do not attach', () => {
    const builtin = new Set(fs.readdirSync(SKILLS_DIR, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name));
    for (const id of AGENT_TOOLS) expect(TOOL_SKILL[id], id).toBeTruthy();
    for (const [tool, id] of Object.entries(TOOL_SKILL)) {
      expect(builtin.has(id!), `${tool} → ${id}`).toBe(true);
      expect(fs.existsSync(path.join(SKILLS_DIR, id!, 'SKILL.md')), `${id}/SKILL.md`).toBe(true);
    }
    const list = [{ id: 'polish-transcript' }, { id: 'video-summary' }];
    expect(defaultSkillIds('polish', list)).toEqual(['polish-transcript']);
    expect(defaultSkillIds('chapters', list)).toEqual([]);
    expect(defaultSkillIds('crop', list)).toEqual([]);
  });
});

describe('English interface', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    setLocale('zh-Hans');
  });

  const english = () => {
    vi.stubEnv('CUCCUT_LOCALE', 'en');
    setLocale('en');
  };

  it('tool names, groups and options change with the language; reads the same catalog object', () => {
    const polish = aiTool('polish');
    expect(polish.name).toBe('润色文稿');
    english();
    expect(polish.name).toBe('Polish transcript');
    expect(AI_TOOL_GROUP_LABEL[polish.group]).toBe('Transcript');
    expect(LENGTHS.map((l) => l.label)).toEqual(['Short', 'Medium', 'Long']);
    expect(SHORTS_COUNTS.slice(0, 3).map((c) => c.label)).toEqual(['Auto', '1', '2']);
    expect(shortsLines({ ...SHORTS_DEFAULTS, count: 1 }, { hasTranslation: true })[0]).toBe(
      'Make 1 short, each as long as its topic needs, from the opening hook to where the point lands, starting and ending on sentence boundaries',
    );
    expect(shortsLines({ ...SHORTS_DEFAULTS, length: 'medium' }, { hasTranslation: true })[0]).toBe(
      'Decide how many shorts from the topics you find, each 30–60 seconds, starting and ending on sentence boundaries',
    );
    for (const t of AI_TOOLS.filter((x) => x.tier === 'soon')) expect(t.why).toMatch(/Runtime doesn’t have this workflow yet/);
  });

  it('for Latin and Cyrillic interface languages, the additional requirements keep sentence-end punctuation and spaces between sentences', () => {
    vi.stubEnv('CUCCUT_LOCALE', undefined);
    for (const locale of LOCALES.filter((value) => !['zh-Hans', 'zh-Hant', 'ja', 'ko'].includes(value))) {
      setLocale(locale);
      const head = intentPrompt({ tool: 'polish' });
      expect(intentPrompt({ tool: 'polish', extra: ['First requirement', 'Second requirement!'] })).toBe(
        `${head} First requirement. Second requirement!`,
      );
    }
  });

  it('intent sentences and additional requirements are written in English, with a final English period added and one space between sentences', () => {
    english();
    expect(intentPrompt({ tool: 'polish', title: 'Code', scope: 'Chapter 2 · Intro', extra: ['Keep it short', 'Thanks!'] })).toBe(
      'Polish the transcript of Chapter 2 · Intro of “Code”: fix typos, add punctuation, and split into paragraphs by topic, without rewriting my wording. Keep it short. Thanks!',
    );
    expect(intentPrompt({ tool: 'stale', edited: 1, cut: 2 })).toBe(
      'Some translations in this video are out of date (1 sentence edited in the source, 2 sentences cut in the source). Retranslate only those sentences; retranslate cut ones from the source as cut, and remove the translations of fully cut sentences along with them. Leave everything else exactly as it is.',
    );
    expect(intentPrompt({ tool: 'title' })).toContain('Suggest 6 title candidates');
    expect(retranslatePrompt({ title: 'Code', language: 'Japanese', count: 1 })).toBe(
      '1 sentence of the Japanese translation of “Code” is out of date or not yet translated. Retranslate only those sentences and leave everything else exactly as it is.',
    );
    expect(retranslatePrompt({ title: null, language: 'Japanese', scope: { time: '1:05', text: 'Hello' } })).toMatch(
      /^Retranslate the sentence at 1:05 in this video \(“Hello”\) into Japanese\./,
    );

    expect(cleanupExtra({ fillers: false, pauses: false, repeats: true })).toEqual(['Don’t look for filler words and long pauses']);
    expect(writingExtra('blog', { length: 'long', style: 'pop', view: 'viewer' })).toEqual(['Length: Long', 'Style: Explainer', 'Point of view: viewer']);
    expect(writingExtra('blog', { frames: true })).toEqual([
      'Where a picture is needed, grab keyframes from the video and put them in the article, each with a caption',
    ]);
    expect(toolTemplate('summary', 'Summarize.', { language: 'French' }).split('\n')[1]).toBe('Write in Markdown, in French.');
    expect(sessionOptions({ canCreate: true, current: { id: 'c', title: 'Cut', messages: 1 } }).options[1]!.sub).toMatch(/^1 message so far/);
    expect(handoffHint('new')).toMatch(/^Starts a new session/);
  });

  it('every interface language has full copy for the AI tools tab', () => {
    vi.stubEnv('CUCCUT_LOCALE', undefined);
    for (const locale of LOCALES) {
      setLocale(locale);
      for (const id of AGENT_TOOLS) expect(toolEffect(id), `${locale} ${id}`).toBeTruthy();
      expect(standingLines('summary', { language: 'X' })[0], locale).toContain('X');
      expect(sessionOptions({ canCreate: true, current: { id: 'c', title: 'T', messages: 3 } }).options[1]!.sub, locale).toContain('3');
      expect(groupSub('writing'), locale).toBeTruthy();
      expect(retranslatePrompt({ title: 'T', language: 'L', count: 7 }), locale).toMatch(/7[^]*L|L[^]*7/);
      expect(retranslatePrompt({ title: 'T', language: 'L', scope: { time: '0:01', text: 'Q' } }), locale).toMatch(/0:01[^]*Q/);
    }
  });
});
