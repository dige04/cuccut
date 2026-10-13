import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { MCP_SERVICE_TOOL_NAMES, TOOL_EFFECTS, TOOL_SURFACES } from '@cuccut/protocol';
import { serviceToolExposed } from '../services/mcp-tools.ts';
import { defaultToolRisk } from './tool-scope.ts';
import type { ToolInfo } from './tool-catalog.ts';
import { allToolSets } from './all-tool-sets.ts';

/**
 * Consistency of catalog entries (architecture §3.5, agent-surface design §2.2, §2.3): the three surfaces (tool bridge, MCP service, CLI) are all derived from catalog entries. This asserts that every entry is fully written, that examples pass their own schema, and that the MCP service's open list matches the protocol constants.
 */

interface Entry {
  name: string;
  info: ToolInfo;
  schema: z.ZodType;
  json: { properties?: Record<string, Record<string, unknown>>; required?: string[] };
}

const entries: Entry[] = allToolSets().flatMap((set) =>
  Object.keys(set.schemas).map((name) => ({
    name,
    info: set.definitions[name]!,
    schema: set.schemas[name]!,
    json: z.toJSONSchema(set.schemas[name]!, { io: 'input' }) as Entry['json'],
  })),
);

/** Enum values in a field's JSON Schema: a direct enum, an enum on array items, and an enum inside a union. */
function enumValues(prop: Record<string, unknown>): unknown[] {
  const values: unknown[] = [];
  const visit = (node: unknown) => {
    if (typeof node !== 'object' || node === null) return;
    const n = node as Record<string, unknown>;
    if (Array.isArray(n.enum)) values.push(...n.enum);
    if (n.items) visit(n.items);
    for (const branch of [...((n.anyOf as unknown[]) ?? []), ...((n.oneOf as unknown[]) ?? [])]) visit(branch);
  };
  visit(prop);
  return values;
}

describe('tool catalog entries', () => {
  it('no duplicate tool names', () => {
    const names = entries.map((e) => e.name);
    expect(new Set(names).size).toBe(names.length);
  });

  for (const { name, info, schema, json } of entries) {
    describe(name, () => {
      it('effect and surfaces fully specified; effect and annotations match', () => {
        expect(TOOL_EFFECTS).toContain(info.effect);
        expect(info.surfaces.length).toBeGreaterThan(0);
        expect(new Set(info.surfaces).size).toBe(info.surfaces.length);
        for (const surface of info.surfaces) expect(TOOL_SURFACES).toContain(surface);
        // query ⇔ readOnlyHint；destructive ⇒ destructiveHint。
        expect(info.annotations?.readOnlyHint === true).toBe(info.effect === 'query');
        if (info.effect === 'destructive') expect(info.annotations?.destructiveHint).toBe(true);
      });

      it('the first sentence of description is a one-line summary', () => {
        const first = info.description.split('\n')[0]!;
        // Same rule as the CLI's `summaryOf`: a full stop followed by a letter (`video.db`) does not end the sentence.
        const sentence = /^.*?[.!?](?=\s|$)/.exec(first)?.[0];
        expect(sentence, `"${first}" has no first sentence ending with a full stop`).toBeTruthy();
        expect([...sentence!].length, `"${sentence}" is longer than 80 characters`).toBeLessThanOrEqual(80);
        expect(info.title.trim()).not.toBe('');
      });

      it('every field has a description, and enum values are all listed in it', () => {
        for (const [field, prop] of Object.entries(json.properties ?? {})) {
          const text = prop.description;
          expect(typeof text === 'string' && text.length > 0, `${name}.${field} 没有 description`).toBe(true);
          for (const value of enumValues(prop)) {
            expect(text as string, `${name}.${field} 的说明没有列出 ${String(value)}`).toContain(String(value));
          }
        }
      });

      it('one to three examples, each passing the schema', () => {
        expect(info.examples.length).toBeGreaterThanOrEqual(1);
        expect(info.examples.length).toBeLessThanOrEqual(3);
        for (const example of info.examples) {
          expect(example.title.trim()).not.toBe('');
          const parsed = schema.safeParse(example.args);
          expect(parsed.success, `${name} 的示例「${example.title}」：${parsed.error?.message ?? ''}`).toBe(true);
        }
      });

      it('positional points to a field in the schema', () => {
        if (info.positional === undefined) return;
        expect(Object.keys(json.properties ?? {})).toContain(info.positional);
      });
    });
  }
});

describe('the MCP service\'s exposed tool list', () => {
  const sorted = <T extends { name: string }>(list: readonly T[]) => [...list].sort((a, b) => a.name.localeCompare(b.name));

  it('derived from the catalog\'s surfaces, matching the protocol constant MCP_SERVICE_TOOL_NAMES (name, title, effect)', () => {
    const derived = entries
      .filter((e) => serviceToolExposed(e.info, 'auto'))
      .map((e) => ({ name: e.name, title: e.info.title, effect: e.info.effect }));
    expect(sorted(derived)).toEqual(sorted(MCP_SERVICE_TOOL_NAMES));
  });

  it('the read level exposes only read-only tools; ask and auto expose all tools on the MCP surface', () => {
    const exposed = (level: 'read' | 'ask' | 'auto') =>
      entries
        .filter((e) => serviceToolExposed(e.info, level))
        .map((e) => e.name)
        .sort();
    expect(exposed('read')).toEqual(
      MCP_SERVICE_TOOL_NAMES.filter((t) => t.effect === 'query')
        .map((t) => t.name)
        .sort(),
    );
    expect(exposed('ask')).toEqual(exposed('auto'));
  });
});

describe('profile tool risks', () => {
  it("reading is read, the user's own answers are edit, and preference and rule writes are high (never always-allowed)", () => {
    expect(defaultToolRisk('profile_show')).toBe('read');
    expect(defaultToolRisk('profile_answer')).toBe('edit');
    expect(defaultToolRisk('profile_skip')).toBe('edit');
    for (const name of ['profile_write', 'profile_preferences_set', 'profile_rules_save', 'profile_rules_remove']) expect(defaultToolRisk(name), name).toBe('high');
  });
});
