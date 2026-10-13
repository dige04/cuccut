import { describe, expect, it } from 'vitest';
import { methodParamSchemas } from './schemas.ts';
import { SLIDE_ANNOTATION_LIMITS } from './slides.ts';

describe('slide annotations carried by conversations.send / steer (docs/design/slides §9)', () => {
  const base = { conversationId: 'c', text: 'hi', commandId: 'k' };
  const note = {
    deck: { conversationId: 'c', path: 'talk' },
    anchor: 'sl1 > sb0101:nth-of-type(1)',
    slideId: 's03',
    label: '第 3 页 › 标题 “AI 时代该学什么”',
    detail: 'Element on slide 3 (s03)',
    text: '标题太长，拆成两行',
  };

  it('send and steer both accept; all three deck forms are recognized', () => {
    for (const method of ['conversations.send', 'conversations.steer'] as const) {
      const schema = methodParamSchemas[method];
      expect(schema.safeParse({ ...base, slideAnnotations: [note] }).success).toBe(true);
      expect(schema.safeParse({ ...base, slideAnnotations: [{ ...note, deck: { entryId: 'e1' } }] }).success).toBe(true);
      expect(schema.safeParse({ ...base, slideAnnotations: [{ ...note, deck: { projectId: 'p', path: 'decks/talk' } }] }).success).toBe(true);
      expect(schema.safeParse({ ...base, slideAnnotations: [{ ...note, area: true, slideId: undefined, detail: undefined }] }).success).toBe(
        true,
      );
    }
  });

  it('at most 20 per message, at most 2000 characters per annotation; empty annotations and extra fields are not accepted', () => {
    const send = methodParamSchemas['conversations.send'];
    const many = Array.from({ length: SLIDE_ANNOTATION_LIMITS.perMessage + 1 }, () => note);
    expect(send.safeParse({ ...base, slideAnnotations: many }).success).toBe(false);
    expect(send.safeParse({ ...base, slideAnnotations: many.slice(1) }).success).toBe(true);
    expect(send.safeParse({ ...base, slideAnnotations: [{ ...note, text: 'x'.repeat(SLIDE_ANNOTATION_LIMITS.text + 1) }] }).success).toBe(false);
    expect(send.safeParse({ ...base, slideAnnotations: [{ ...note, text: 'x'.repeat(SLIDE_ANNOTATION_LIMITS.text) }] }).success).toBe(true);
    expect(send.safeParse({ ...base, slideAnnotations: [{ ...note, text: '   ' }] }).success).toBe(false);
    expect(send.safeParse({ ...base, slideAnnotations: [{ ...note, id: 'n1' }] }).success).toBe(false);
    expect(send.safeParse({ ...base, slideAnnotations: [{ ...note, deck: { path: 'talk' } }] }).success).toBe(false);
    expect(send.safeParse({ ...base, slideAnnotations: [{ ...note, anchor: '' }] }).success).toBe(false);
  });
});
