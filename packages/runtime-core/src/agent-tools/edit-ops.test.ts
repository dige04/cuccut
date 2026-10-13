import { describe, expect, it } from 'vitest';
import { compileJsonSchema } from '@cuccut/protocol/json-schema';
import { EDIT_OPERATIONS, OPERATION_FAMILIES, OPERATION_TYPES, describeOperation } from './edit-ops.ts';
import { normalizeOperations } from './video-digest.ts';

/** The operation table of `edits_ops` (`edit-ops.ts`): each operation is fully written, examples pass their own schema, the JSON Schema compiles, and examples can be filled out into the engine's shape. */

describe('edits_apply 的操作表', () => {
  it('操作不重名，每个都归到一个操作族，说明行以操作的形态开头', () => {
    expect(new Set(OPERATION_TYPES).size).toBe(OPERATION_TYPES.length);
    for (const spec of EDIT_OPERATIONS) {
      expect(OPERATION_FAMILIES).toContain(spec.family);
      expect(spec.doc.length).toBeGreaterThan(0);
      for (const line of spec.doc) expect(line.startsWith(`- {"type":"${spec.type}"`), line.slice(0, 40)).toBe(true);
    }
    for (const family of OPERATION_FAMILIES) expect(EDIT_OPERATIONS.some((s) => s.family === family)).toBe(true);
  });

  for (const spec of EDIT_OPERATIONS) {
    it(`${spec.type}：示例通过 schema 与编译后的 JSON Schema，能补成引擎的形态`, () => {
      expect(spec.example.type).toBe(spec.type);
      const parsed = spec.schema.safeParse(spec.example);
      expect(parsed.success, parsed.error?.message).toBe(true);
      const described = describeOperation(spec);
      expect(described).toMatchObject({ type: spec.type, family: spec.family, example: spec.example });
      expect(described.description.startsWith('{"type"')).toBe(true);
      expect(compileJsonSchema(described.schema).validate(spec.example)).toEqual([]);
      expect(() => normalizeOperations([spec.example], 'seq_root', '/tmp')).not.toThrow();
    });
  }
});
