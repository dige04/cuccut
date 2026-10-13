import { describe, expect, it } from 'vitest';
import { methodParamSchemas } from './schemas.ts';
import { DESIGN_SYSTEM_ANNOTATION_LIMITS } from './design-system.ts';

describe('design system annotations carried by conversations.send / steer (docs/design/canvas §10.6)', () => {
  const base = { conversationId: 'c', text: 'hi', commandId: 'k' };
  const note = {
    system: { conversationId: 'c', path: 'spectrum-2' },
    anchor: 'comp-Button',
    section: 'components',
    label: '设计系统「Spectrum 2」 › Components › 组件 “Button”',
    detail: 'Component "Button" in section components (components/Button/) · comp-Button',
    text: '圆角改小',
  };

  it('send and steer both accept it, all three system formats are recognized, can be combined with slide and design annotations', () => {
    const slide = { deck: { conversationId: 'c', path: 'talk' }, anchor: 'a', label: 'p1', text: 'x' };
    const design = { canvas: { conversationId: 'c', path: 'poster' }, anchor: 'Main.dc.html#el-1', label: 'Main', text: 'y' };
    for (const method of ['conversations.send', 'conversations.steer'] as const) {
      const schema = methodParamSchemas[method];
      expect(schema.safeParse({ ...base, designSystemAnnotations: [note] }).success).toBe(true);
      expect(schema.safeParse({ ...base, designSystemAnnotations: [{ ...note, system: { entryId: 'e1' } }] }).success).toBe(true);
      expect(
        schema.safeParse({ ...base, designSystemAnnotations: [{ ...note, system: { projectId: 'p', path: 'brand/spectrum-2' } }] }).success,
      ).toBe(true);
      expect(schema.safeParse({ ...base, designSystemAnnotations: [{ ...note, section: undefined, detail: undefined }] }).success).toBe(true);
      expect(
        schema.safeParse({ ...base, slideAnnotations: [slide], designAnnotations: [design], designSystemAnnotations: [note] }).success,
      ).toBe(true);
    }
  });

  it('at most 20 per message, at most 2000 characters per annotation; empty annotations, extra fields and design field names are rejected', () => {
    const send = methodParamSchemas['conversations.send'];
    const many = Array.from({ length: DESIGN_SYSTEM_ANNOTATION_LIMITS.perMessage + 1 }, () => note);
    expect(send.safeParse({ ...base, designSystemAnnotations: many }).success).toBe(false);
    expect(send.safeParse({ ...base, designSystemAnnotations: many.slice(1) }).success).toBe(true);
    const text = (n: number) => [{ ...note, text: 'x'.repeat(n) }];
    expect(send.safeParse({ ...base, designSystemAnnotations: text(DESIGN_SYSTEM_ANNOTATION_LIMITS.text + 1) }).success).toBe(false);
    expect(send.safeParse({ ...base, designSystemAnnotations: text(DESIGN_SYSTEM_ANNOTATION_LIMITS.text) }).success).toBe(true);
    for (const bad of [
      { ...note, text: '   ' },
      { ...note, id: 'n1' },
      { ...note, board: 'Main.dc.html' },
      { ...note, area: true },
      { ...note, system: { path: 'spectrum-2' } },
      { ...note, anchor: '' },
      { ...note, section: '' },
      { ...note, section: 's'.repeat(201) },
    ]) {
      expect(send.safeParse({ ...base, designSystemAnnotations: [bad] }).success, JSON.stringify(bad)).toBe(false);
    }
  });
});
