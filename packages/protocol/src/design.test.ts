import { describe, expect, it } from 'vitest';
import { methodParamSchemas } from './schemas.ts';
import { DESIGN_ANNOTATION_LIMITS } from './design.ts';
import { WEB_DEFAULT_METHODS, WEB_READ_METHODS } from './web.ts';

describe('design annotations carried by conversations.send / steer (docs/design/canvas §9)', () => {
  const base = { conversationId: 'c', text: 'hi', commandId: 'k' };
  const note = {
    canvas: { conversationId: 'c', path: 'poster' },
    anchor: 'Main.dc.html#el-12',
    board: 'Main.dc.html',
    label: 'Main › 按钮 "立即预订"',
    detail: 'Main.dc.html › body > div > button "Book now"',
    text: '按钮再大一点',
  };

  it('send and steer both accept it, all three canvas formats are recognized, can be combined with slide annotations', () => {
    const slide = { deck: { conversationId: 'c', path: 'talk' }, anchor: 'a', label: 'p1', text: 'x' };
    for (const method of ['conversations.send', 'conversations.steer'] as const) {
      const schema = methodParamSchemas[method];
      expect(schema.safeParse({ ...base, designAnnotations: [note] }).success).toBe(true);
      expect(schema.safeParse({ ...base, designAnnotations: [{ ...note, canvas: { entryId: 'e1' } }] }).success).toBe(true);
      expect(schema.safeParse({ ...base, designAnnotations: [{ ...note, canvas: { projectId: 'p', path: 'designs/poster' } }] }).success).toBe(
        true,
      );
      expect(schema.safeParse({ ...base, designAnnotations: [{ ...note, area: true, board: undefined, detail: undefined }] }).success).toBe(
        true,
      );
      expect(schema.safeParse({ ...base, slideAnnotations: [slide], designAnnotations: [note] }).success).toBe(true);
    }
  });

  it('at most 20 per message, at most 2000 characters per annotation; empty annotations, extra fields and slide field names are rejected', () => {
    const send = methodParamSchemas['conversations.send'];
    const many = Array.from({ length: DESIGN_ANNOTATION_LIMITS.perMessage + 1 }, () => note);
    expect(send.safeParse({ ...base, designAnnotations: many }).success).toBe(false);
    expect(send.safeParse({ ...base, designAnnotations: many.slice(1) }).success).toBe(true);
    expect(send.safeParse({ ...base, designAnnotations: [{ ...note, text: 'x'.repeat(DESIGN_ANNOTATION_LIMITS.text + 1) }] }).success).toBe(
      false,
    );
    expect(send.safeParse({ ...base, designAnnotations: [{ ...note, text: 'x'.repeat(DESIGN_ANNOTATION_LIMITS.text) }] }).success).toBe(true);
    expect(send.safeParse({ ...base, designAnnotations: [{ ...note, text: '   ' }] }).success).toBe(false);
    expect(send.safeParse({ ...base, designAnnotations: [{ ...note, id: 'n1' }] }).success).toBe(false);
    expect(send.safeParse({ ...base, designAnnotations: [{ ...note, slideId: 's1' }] }).success).toBe(false);
    expect(send.safeParse({ ...base, designAnnotations: [{ ...note, canvas: { path: 'poster' } }] }).success).toBe(false);
    expect(send.safeParse({ ...base, designAnnotations: [{ ...note, anchor: '' }] }).success).toBe(false);
    expect(send.safeParse({ ...base, designAnnotations: [{ ...note, board: '' }] }).success).toBe(false);
  });
});

describe('design.open (docs/design/canvas §6.1)', () => {
  it('parameter is FileTarget', () => {
    const schema = methodParamSchemas['design.open'];
    expect(schema.safeParse({ conversationId: 'c', path: 'poster' }).success).toBe(true);
    expect(schema.safeParse({ entryId: 'e1' }).success).toBe(true);
    expect(schema.safeParse({ path: 'poster' }).success).toBe(false);
  });

  it('in the Web default and read-only sets, same as slides.open', () => {
    expect(WEB_DEFAULT_METHODS).toContain('design.open');
    expect(WEB_READ_METHODS).toContain('design.open');
  });
});
