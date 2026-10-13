import { setLocale } from '@cuccut/protocol';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CliError } from '../envelope.ts';
import { buildTree, commandOf, needsConfirmation, renderToolNames, summaryOf } from './command-tree.ts';
import { extractGlobals, parseToolArgs } from './flags.ts';
import { HELP_MAX_LINES, displayWidth, exampleCommand, renderCommandHelp, renderGroupHelp, renderMainHelp } from './help.ts';
import { loadSnapshot } from './snapshot.ts';
import { findTool, specOf } from './spec.ts';

const snapshot = loadSnapshot();
if (!snapshot) throw new Error('没有目录快照：先运行 npm run build:catalog');
const admin = [{ name: 'models', verbs: ['configure', 'accounts', 'usage', 'default', 'remove'] }, { name: 'settings' }, { name: 'web' }];

afterEach(() => {
  vi.unstubAllEnvs();
  setLocale('zh-Hans');
});

describe('help', () => {
  it.each(['zh-Hans', 'en'] as const)('a help screen is at most 40 lines (%s)', (locale) => {
    vi.stubEnv('CUCCUT_LOCALE', locale);
    setLocale(locale);
    const text = renderMainHelp(snapshot.tools, admin);
    const lines = text.split('\n');
    expect(lines.length).toBeLessThanOrEqual(HELP_MAX_LINES);
    // Each top-level verb and noun group takes one line.
    const tree = buildTree(snapshot.tools);
    for (const verb of tree.verbs.keys()) expect(lines.some((line) => line.startsWith(`  ${verb} `))).toBe(true);
    for (const noun of tree.nouns.keys()) expect(lines.some((line) => line.startsWith(`  ${noun} `))).toBe(true);
    for (const line of lines.slice(2)) expect(displayWidth(line)).toBeLessThanOrEqual(120);
    expect(text).toContain('help <command>');
    expect(text).toContain('spec [<name>]');
  });

  it('each command\'s help can be derived, with arguments, effects and examples', () => {
    const names = snapshot.tools.map((tool) => tool.name);
    for (const tool of snapshot.tools) {
      const command = commandOf(tool);
      const text = renderCommandHelp(command, names);
      expect(text.startsWith(`cuccut ${command.display}`)).toBe(true);
      for (const field of Object.keys((tool.inputSchema.properties ?? {}) as object)) {
        expect(text).toContain(`--${field.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`);
      }
      if (tool.examples.length) expect(text).toContain(`cuccut ${command.display}`);
    }
    const group = renderGroupHelp(snapshot.tools, 'models', admin[0]);
    expect(group).toContain('capabilities');
    expect(group).toContain('configure');
  });

  it('a command line written from a catalog example parses back to the same arguments', async () => {
    for (const tool of snapshot.tools) {
      const command = commandOf(tool);
      for (const example of tool.examples) {
        const line = exampleCommand(command, example.args);
        // Examples for commands that need confirmation carry `--yes`: the CLI's own flags are taken out first, as in `runCli`.
        const { globals, rest: words } = extractGlobals(shellSplit(line).slice(1 + command.display.split(' ').length));
        expect(globals.yes, line).toBe(needsConfirmation(tool));
        const parsed = await parseToolArgs(command, words, globals, {
          cwd: '/',
          readFile: async () => {
            throw new Error('示例不读文件');
          },
          readStdin: async () => '',
        });
        expect(parsed, `${tool.name}: ${line}`).toEqual(example.args);
      }
    }
  });

  it('commands that need confirmation (videos delete, models install): examples and common flags include --yes', () => {
    const tree = buildTree(snapshot.tools);
    for (const display of [
      ['videos', 'delete'],
      ['models', 'install'],
    ]) {
      const command = tree.nouns.get(display[0]!)!.get(display[1]!)!;
      const text = renderCommandHelp(command);
      const examples = text.split('\n').filter((line) => line.startsWith(`  cuccut ${command.display}`));
      expect(examples.length, command.display).toBeGreaterThan(0);
      for (const line of examples) expect(line).toMatch(/ --yes$/);
      expect(text).toMatch(/\n  --yes  /);
    }
    const wait = renderCommandHelp(tree.nouns.get('jobs')!.get('wait')!);
    expect(wait).toContain('--timeout <s>');
    expect(wait).not.toContain('--no-wait');
  });

  it('tool names in descriptions are written as commands; the summary takes the first sentence', () => {
    const names = snapshot.tools.map((tool) => tool.name);
    expect(renderToolNames('先用 videos_inspect，再 edits_apply；transcribe 不动', names)).toBe(
      '先用 cuccut videos inspect，再 cuccut edits apply；transcribe 不动',
    );
    expect(renderToolNames('videos_import_package', names)).toBe('cuccut videos import-package');
    expect(summaryOf('列出工作目录里的视频（含 video.db 的子目录）。第二句。')).toBe('列出工作目录里的视频（含 video.db 的子目录）。');
  });
});

describe('spec', () => {
  it('the whole catalog and each item carry the interface version and parse as JSON', () => {
    const whole = JSON.parse(JSON.stringify(specOf(snapshot, snapshot.editOps, undefined))) as Record<string, unknown>;
    expect(whole.interfaceVersion).toBe(snapshot.interfaceVersion);
    expect(whole.tools).toHaveLength(snapshot.tools.length);
    for (const name of ['videos_inspect', 'videos.inspect', 'videos inspect']) {
      expect(specOf(snapshot, snapshot.editOps, name)).toMatchObject({
        interfaceVersion: snapshot.interfaceVersion,
        tool: { name: 'videos_inspect' },
      });
    }
    expect(findTool(snapshot.tools, 'videos.import-package')?.name).toBe('videos_import_package');
    expect(specOf(snapshot, snapshot.editOps, 'transcribe')).toMatchObject({ tool: { name: 'transcribe', effect: 'job' } });
  });

  it('edits.<operation> gives the operation\'s schema; an unknown name is INVALID_ARGUMENTS', () => {
    expect(specOf(snapshot, snapshot.editOps, 'edits.renameVideo')).toMatchObject({ operation: { type: 'renameVideo' } });
    expect(specOf(snapshot, snapshot.editOps, 'edits.apply')).toMatchObject({ tool: { name: 'edits_apply' } });
    expect(() => specOf(snapshot, snapshot.editOps, 'edits.nope')).toThrow(CliError);
    expect(() => specOf(snapshot, snapshot.editOps, 'nope')).toThrow(CliError);
  });
});

/** Splits words by POSIX shell single-quote rules (`exampleCommand` uses only single quotes). */
function shellSplit(line: string): string[] {
  const words: string[] = [];
  let word = '';
  let quoted = false;
  let started = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i]!;
    if (quoted) {
      if (char === "'") quoted = false;
      else word += char;
    } else if (char === "'") {
      quoted = true;
      started = true;
    } else if (char === '\\' && line[i + 1] === "'") {
      word += "'";
      i++;
    } else if (char === ' ') {
      if (started) words.push(word);
      word = '';
      started = false;
    } else {
      word += char;
      started = true;
    }
  }
  if (started) words.push(word);
  return words;
}
