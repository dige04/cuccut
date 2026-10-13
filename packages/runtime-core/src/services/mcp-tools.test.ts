import { describe, expect, it } from 'vitest';
import { allToolSets } from '../agent-tools/all-tool-sets.ts';
import type { ToolInfo } from '../agent-tools/tool-catalog.ts';
import { describeServiceTool, serviceToolExposed } from './mcp-tools.ts';

const exposed: { name: string; info: ToolInfo }[] = allToolSets().flatMap((set) =>
  Object.keys(set.schemas)
    .map((name) => ({ name, info: set.definitions[name]! }))
    .filter((e) => serviceToolExposed(e.info, 'auto')),
);

/** Tools whose MCP description rewrites part of the catalog text (rather than replacing it outright). */
const REWRITTEN = ['jobs_inspect', 'edits_apply', 'compositions_preview', 'videos_frames', 'speak', 'image', 'music'];

describe('MCP tool descriptions', () => {
  it('every rewrite still matches the catalog text and changes it', () => {
    for (const name of REWRITTEN) {
      const entry = exposed.find((e) => e.name === name);
      expect(entry, name).toBeDefined();
      expect(describeServiceTool(name, entry!.info).description, name).not.toBe(entry!.info.description);
    }
  });

  it('no exposed description gives session-only wording (lines that also say what external services get are fine)', () => {
    for (const { name, info } of exposed) {
      const sessionOnly = describeServiceTool(name, info)
        .description.split('\n')
        .filter((line) => /working directory|this session|artifacts_save/.test(line) && !/external service/.test(line));
      expect(sessionOnly, name).toEqual([]);
    }
  });
});
