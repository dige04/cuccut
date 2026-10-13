import { describe, expect, it } from 'vitest';
import { templateSlots, templateUnfilledText } from '@cuccut/protocol';
import {
  fillSlot,
  filledSlot,
  fromPromptSegments,
  isSlotToken,
  nextSlotIndex,
  slotLabels,
  slotParts,
  slotsForAgent,
  toPromptSegments,
} from './prompt-slots.ts';

const serialize = (parts: ReturnType<typeof slotParts>) => parts.map((x) => (x.type === 'slot' ? `{{${x.label}}}` : x.text)).join('');

const CASES = [
  '',
  '没有占位符的一句话',
  '给{{产品或服务}}做一条推广，面向{{受众}}。',
  '{{a}}{{b}}',
  '开头{{a}}\n第二行{{b}}结尾',
  '没闭合的 {{受众 后面还有字',
  '空的 {{}} 不算',
  '{{目标 受众}} 带空格',
  '{{{a}}}',
  '{{跨\n行}}',
  '{{a}b}}',
  '看 https://example.com/a?b=1 和 {{受众}}',
];

const slot = (label: string) => ({
  type: 'token' as const,
  text: label,
  value: { type: 'placeholder' as const, placeholderType: 'text' as const },
});

describe('slotParts', () => {
  it('strict round trip with fragments (usePromptValue relies on it to decide whether to rebuild)', () => {
    for (const s of CASES) expect(serialize(slotParts(s))).toBe(s);
  });

  it('recognized placeholders match the parsing in @cuccut/protocol', () => {
    for (const s of CASES) {
      expect(slotParts(s).flatMap((x) => (x.type === 'slot' ? [x.label] : []))).toEqual(templateSlots(s));
      expect(
        slotParts(s)
          .map((x) => (x.type === 'slot' ? `[${x.label}]` : x.text))
          .join(''),
      ).toBe(templateUnfilledText(s));
    }
  });

  it('adjacent placeholders, line breaks, labels with spaces; produces no empty text fragments', () => {
    expect(slotParts('')).toEqual([]);
    expect(slotParts('{{a}}{{b}}')).toEqual([
      { type: 'slot', label: 'a' },
      { type: 'slot', label: 'b' },
    ]);
    expect(slotParts('开头{{a}}\n第二行')).toEqual([
      { type: 'text', text: '开头' },
      { type: 'slot', label: 'a' },
      { type: 'text', text: '\n第二行' },
    ]);
    expect(slotParts('{{ 受众 }}')).toEqual([{ type: 'slot', label: ' 受众 ' }]);
    for (const x of slotParts('{{a}}x{{b}}')) expect(x.type === 'slot' || x.text.length > 0).toBe(true);
  });

  it('unclosed {{, empty {{}}, multi-line and bracketed ones are kept as plain text', () => {
    expect(slotParts('没闭合的 {{受众')).toEqual([{ type: 'text', text: '没闭合的 {{受众' }]);
    expect(slotParts('空的 {{}}')).toEqual([{ type: 'text', text: '空的 {{}}' }]);
    expect(slotParts('{{跨\n行}}')).toEqual([{ type: 'text', text: '{{跨\n行}}' }]);
    expect(slotParts('{{{a}}}')).toEqual([
      { type: 'text', text: '{' },
      { type: 'slot', label: 'a' },
      { type: 'text', text: '}' },
    ]);
  });
});

describe('slotLabels / slotsForAgent', () => {
  it('labels are de-duplicated, in order of appearance', () => {
    expect(slotLabels('给{{产品}}做，面向{{受众}}，再说一次{{产品}}')).toEqual(['产品', '受众']);
    expect(slotLabels('都填好了')).toEqual([]);
  });

  it('unfilled ones are written as [label], without keeping {{', () => {
    expect(slotsForAgent('给{{产品或服务}}做一条推广，面向{{受众}}。')).toBe('给[产品或服务]做一条推广，面向[受众]。');
    expect(slotsForAgent('{{a}}{{b}}\n{{c')).toBe('[a][b]\n{{c');
    expect(slotsForAgent('没有占位符')).toBe('没有占位符');
  });
});

describe('converts to and from PromptFieldValue fragments', () => {
  it('draft to fragments: placeholders become placeholder tokens', () => {
    expect(toPromptSegments('给{{产品}}做，面向{{受众}}。')).toEqual([
      { type: 'text', text: '给' },
      slot('产品'),
      { type: 'text', text: '做，面向' },
      slot('受众'),
      { type: 'text', text: '。' },
    ]);
    expect(toPromptSegments('')).toEqual([]);
  });

  it('fragments to draft: strict round trip', () => {
    for (const s of CASES) expect(fromPromptSegments(toPromptSegments(s))).toBe(s);
  });

  it('placeholder tokens are written back as {{label}}, link tokens as the full address, other tokens as their text', () => {
    expect(
      fromPromptSegments([
        { type: 'text', text: '看 ' },
        { type: 'token', text: 'example.com', value: { type: 'url', url: 'https://example.com/a' } },
        { type: 'text', text: ' 给 ' },
        slot('受众'),
        { type: 'token', text: '@', value: { type: 'anchor', valueType: 'file' } },
      ]),
    ).toBe('看 https://example.com/a 给 {{受众}}@');
  });

  it('after typing replaces it, the fragment is plain text (a {{x}} the user types does not become a token either)', () => {
    expect(fromPromptSegments([{ type: 'text', text: '给{{x}}' }])).toBe('给{{x}}');
  });

  it('isSlotToken only recognizes text-type placeholders', () => {
    expect(isSlotToken(slot('a'))).toBe(true);
    expect(isSlotToken({ type: 'token', text: '@', value: { type: 'placeholder', placeholderType: 'token' } })).toBe(false);
    expect(isSlotToken({ type: 'text', text: 'a' })).toBe(false);
    expect(isSlotToken(null)).toBe(false);
  });
});

describe('nextSlotIndex', () => {
  const segs = toPromptSegments('给{{产品}}做，面向{{受众}}。');

  it('searches forward from the fragment with the cursor, wrapping around to the start at the end', () => {
    expect(nextSlotIndex(segs, -1)).toBe(1);
    expect(nextSlotIndex(segs, 1)).toBe(3);
    expect(nextSlotIndex(segs, 3)).toBe(1);
    expect(nextSlotIndex(segs, 4)).toBe(1);
  });

  it('with only one left, always returns it; returns -1 when there are no placeholder tokens', () => {
    expect(nextSlotIndex(toPromptSegments('{{a}}'), 0)).toBe(0);
    expect(nextSlotIndex(toPromptSegments('都填好了'), 0)).toBe(-1);
    expect(nextSlotIndex([], -1)).toBe(-1);
  });
});

describe('filledSlot / fillSlot', () => {
  const template = '转录这个视频，并翻译成{{目标语言}}，做成双语字幕。';

  it('recognizes what the user filled a slot with: matches the few characters around the placeholder, allowing extra text before and after', () => {
    expect(filledSlot(template, '目标语言', '转录这个视频，并翻译成日文，做成双语字幕。')).toBe('日文');
    expect(filledSlot(template, '目标语言', 'https://youtu.be/x 转录这个视频，并翻译成 English ，做成双语字幕。另外加章节')).toBe('English');
    const en = 'Transcribe this video and translate it into {{target language}} as bilingual subtitles.';
    expect(filledSlot(en, 'target language', 'Transcribe this video and translate it into Spanish as bilingual subtitles.')).toBe('Spanish');
  });

  it('returns null when it is still the placeholder, unfilled, edited beyond recognition, multi-line or too long; also null when the template has no such slot', () => {
    expect(filledSlot(template, '目标语言', template)).toBeNull();
    expect(filledSlot(template, '目标语言', '转录这个视频，并翻译成[目标语言]，做成双语字幕。')).toBeNull();
    expect(filledSlot(template, '目标语言', '转录这个视频，并翻译成 ，做成双语字幕。')).toBeNull();
    expect(filledSlot(template, '目标语言', '给这个视频加上字幕。')).toBeNull();
    expect(filledSlot(template, '目标语言', '转录这个视频，并翻译成日\n文，做成双语字幕。')).toBeNull();
    expect(filledSlot(template, '目标语言', `转录这个视频，并翻译成${'长'.repeat(40)}，做成双语字幕。`)).toBeNull();
    expect(filledSlot(template, '受众', '转录这个视频，并翻译成日文，做成双语字幕。')).toBeNull();
    expect(filledSlot('{{a}}', 'a', '随便')).toBeNull();
  });

  it('fillSlot replaces only the first placeholder with the same name; $ in the value is kept as is', () => {
    expect(fillSlot(template, '目标语言', '日文')).toBe('转录这个视频，并翻译成日文，做成双语字幕。');
    expect(fillSlot('{{a}} 和 {{a}}', 'a', '$&')).toBe('$& 和 {{a}}');
  });
});
