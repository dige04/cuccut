import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { buildBundle, lintHtml, sampleTimes } from '../skills/cuccut/built-in-skills/motion-graphics/scripts/build-bundle.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skill = path.join(root, 'skills/cuccut/built-in-skills/motion-graphics');
const read = (rel: string) => fs.readFileSync(path.join(skill, rel), 'utf8');
const EXEMPLARS = ['lower-third', 'big-number', 'keyword-caption', 'callout-pin', 'logo-sting'];
const ASPECTS = ['16x9', '9x16'];
const exemplarFiles = EXEMPLARS.flatMap((id) => ASPECTS.map((a) => `exemplars/${id}/${a}.html`));

type Issue = { code: string; message: string; line?: number };
const codes = (html: string) => (lintHtml(html).issues as Issue[]).map((i) => i.code);

/** Performs one replacement that must match in the html, and returns the mutated text. */
function mutate(html: string, from: string | RegExp, to: string) {
  const out = html.replace(from, to);
  expect(out, `mutation did not apply: ${String(from)}`).not.toBe(html);
  return out;
}

const tmpDirs: string[] = [];
const tmp = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'cuccut-mg-bundle-'));
  tmpDirs.push(d);
  return d;
};
afterAll(() => {
  for (const d of tmpDirs) fs.rmSync(d, { recursive: true, force: true });
});

describe('motion-graphics lint', () => {
  it.each(['scaffold.html', ...exemplarFiles])('%s passes lint, and has no windows that cannot be statically evaluated', (rel) => {
    const r = lintHtml(read(rel));
    expect(r.issues).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.meta.duration).toBe(4);
    expect(r.meta.fps).toBe(30);
    expect(r.meta.entranceEnd).toBeLessThanOrEqual(2.2);
  });

  const base = read('exemplars/lower-third/16x9.html');

  it('no unified exit → EXIT_MISSING', () => {
    expect(codes(mutate(base, /\s*const exit = 1 - easeInOut\(.*\n/, '\n'))).toContain('EXIT_MISSING');
  });

  it('exit window too early → EXIT_WINDOW', () => {
    expect(codes(mutate(base, 'DURATION - 0.62, DURATION - 0.05', 'DURATION - 1.5, DURATION - 0.05'))).toContain('EXIT_WINDOW');
  });

  it('last entrance too late → HOLD_TOO_SHORT; data-motion-continuous skips the hold check', () => {
    const late = mutate(base, 'range(time, 0.9, 1.45)', 'range(time, 1.9, 2.45)');
    expect(codes(late)).toEqual(['HOLD_TOO_SHORT']);
    expect(codes(mutate(late, 'data-composition-id="main"', 'data-composition-id="main" data-motion-continuous="true"'))).toEqual([]);
  });

  it('periodic windows inside Math.sin do not count as entrances (callout-pin\'s pulse)', () => {
    const r = lintHtml(read('exemplars/callout-pin/16x9.html'));
    expect(r.meta.windows.some((w: { periodic: boolean; end: number }) => w.periodic && w.end > 3)).toBe(true);
    expect(r.issues).toEqual([]);
  });

  it('first entrance starts at 0 → FIRST_ENTRY_TOO_EARLY; window too short → WINDOW_LENGTH', () => {
    expect(codes(mutate(base, 'range(time, 0.03, 0.63)', 'range(time, 0, 0.6)'))).toContain('FIRST_ENTRY_TOO_EARLY');
    expect(codes(mutate(base, 'range(time, 0.25, 0.82)', 'range(time, 0.25, 0.3)'))).toContain('WINDOW_LENGTH');
  });

  it('external references → EXTERNAL_URL / EXTERNAL_SCRIPT / EXTERNAL_LINK / CSS_IMPORT / NETWORK_API', () => {
    expect(codes(mutate(base, '<section id="scene">', '<section id="scene"><img src="https://example.com/a.png">'))).toContain(
      'EXTERNAL_URL',
    );
    expect(codes(mutate(base, '<section id="scene">', '<section id="scene"><img src="//cdn.example.com/a.png">'))).toContain(
      'EXTERNAL_URL',
    );
    expect(codes(mutate(base, '</body>', '<script src="lib.js"></script></body>'))).toContain('EXTERNAL_SCRIPT');
    expect(codes(mutate(base, '<style>', '<link rel="stylesheet" href="a.css"><style>'))).toContain('EXTERNAL_LINK');
    expect(codes(mutate(base, '<style>', '<style>@import "a.css";'))).toContain('CSS_IMPORT');
    expect(codes(mutate(base, '/* slot:motion */', '/* slot:motion */ fetch("a.json");'))).toContain('NETWORK_API');
  });

  it('non-determinism → NONDETERMINISTIC; rAF outside play() → RAF_OUTSIDE_PLAY', () => {
    expect(codes(mutate(base, '/* slot:motion */', '/* slot:motion */ const jitter = Math.random();'))).toContain('NONDETERMINISTIC');
    expect(codes(mutate(base, '/* slot:motion */', '/* slot:motion */ const now = Date.now();'))).toContain('NONDETERMINISTIC');
    expect(codes(mutate(base, '/* slot:motion */', '/* slot:motion */ requestAnimationFrame(() => {});'))).toEqual(['RAF_OUTSIDE_PLAY']);
  });

  it('missing color token → TOKEN_MISSING; missing copy marker → COPY_PRIMARY_MISSING / COPY_RULE_MISSING', () => {
    expect(codes(mutate(base, /;--accent:#[0-9a-f]+/, ''))).toEqual(['TOKEN_MISSING']);
    expect(codes(mutate(base, ' data-copy-primary>', '>'))).toContain('COPY_PRIMARY_MISSING');
    expect(codes(mutate(base, '.copy{max-width:100%;overflow:hidden;text-overflow:ellipsis}', ''))).toContain('COPY_RULE_MISSING');
  });

  it('missing or invalid root element attributes → ROOT_ATTR_MISSING / ROOT_ATTR_INVALID / VIEWPORT_MISMATCH / TIMELINE_REGISTRY_MISSING', () => {
    expect(codes(mutate(base, / data-structure="[^"]*"/, ''))).toContain('ROOT_ATTR_MISSING');
    expect(codes(mutate(base, 'data-fps="30"', 'data-fps="0"'))).toContain('ROOT_ATTR_INVALID');
    expect(codes(mutate(base, 'content="width=1920,height=1080"', 'content="width=1280,height=720"'))).toContain('VIEWPORT_MISMATCH');
    expect(codes(mutate(base, 'window.__timelines = { [COMPOSITION_ID]: timeline };', ''))).toContain('TIMELINE_REGISTRY_MISSING');
  });

  it('over 512 KB → FILE_TOO_LARGE', () => {
    expect(codes(mutate(base, '</body>', `<!-- ${'x'.repeat(520 * 1024)} --></body>`))).toContain('FILE_TOO_LARGE');
  });
});

describe('motion-graphics examples', () => {
  // After removing the layout slots, viewport, root size, aspect ratio and title, the landscape and portrait versions must be identical.
  const strip = (html: string) =>
    html
      .replace(/\/\* slot:layout \*\/[\s\S]*?<\/style>/, '')
      .replace(/content="width=\d+,height=\d+"/, '')
      .replace(/width:\d+px;height:\d+px;/, '')
      .replace(/data-width="\d+" data-height="\d+"/, '')
      .replace(/data-aspect-ratio="[^"]*"/, '')
      .replace(/<title>[^<]*<\/title>/, '');

  it.each(EXEMPLARS)('%s landscape and portrait versions differ only in layout slots and dimensions', (id) => {
    expect(strip(read(`exemplars/${id}/9x16.html`))).toBe(strip(read(`exemplars/${id}/16x9.html`)));
  });

  it.each(exemplarFiles)('%s colors come only from three tokens', (rel) => {
    const html = read(rel).replace(/#root\{[^}]*\}/, '');
    expect(html.match(/#[0-9a-fA-F]{3,8}\b(?![\w-])/g) ?? []).toEqual([]);
    expect(html).not.toMatch(/\brgba?\(|\bhsla?\(/);
  });

  it('skill directory has no symlinks or dot-prefixed files', () => {
    const walk = (dir: string): string[] =>
      fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const p = path.join(dir, e.name);
        expect(e.name.startsWith('.'), p).toBe(false);
        expect(e.isSymbolicLink(), p).toBe(false);
        return e.isDirectory() ? walk(p) : [p];
      });
    expect(walk(skill).length).toBeGreaterThan(10);
  });

  it('the html fence in references/scaffold.md is byte-identical to scaffold.html', () => {
    const md = read('references/scaffold.md');
    const fence = /```html\n([\s\S]*?)```/.exec(md);
    expect(fence?.[1]).toBe(read('scaffold.html'));
  });
});

describe('motion-graphics build', () => {
  const html = path.join(skill, 'exemplars/big-number/16x9.html');

  it('writes a complete manifest, contentHash is stable, files.manifest matches the actual files', () => {
    const a = buildBundle({ html, out: tmp() });
    const b = buildBundle({ html, out: tmp() });
    expect(a.ok).toBe(true);
    expect(a.manifest.contentHash).toBe(b.manifest.contentHash);
    expect(a.manifest.contentHash).toMatch(/^sha256-[0-9a-f]{64}$/);

    const manifest = JSON.parse(fs.readFileSync(path.join(a.dir, 'bundle.manifest.json'), 'utf8'));
    expect(manifest).toEqual({
      format: 'cuccut.code-bundle',
      schemaVersion: 1,
      bundleId: 'big-number',
      revision: '1',
      contentHash: a.manifest.contentHash,
      runtime: { engine: 'browser', contract: 'hyperframes/1', entry: 'index.html', frameworkHints: [] },
      source: { filesManifest: 'files.manifest.json', dependencyLock: 'dependency.lock', buildRecipe: 'build.recipe.json' },
      intrinsic: { width: 1920, height: 1080, fps: { num: 30, den: 1 }, durationFrames: 120 },
      output: { alpha: true, colorSpace: 'srgb', audio: 'none' },
      timing: { access: 'random' },
      timeDependencies: [{ kind: 'local-only' }],
      permissions: { network: 'deny', assetIds: [] },
    });

    const files = JSON.parse(fs.readFileSync(path.join(a.dir, 'files.manifest.json'), 'utf8')) as {
      path: string;
      size: number;
      sha256: string;
    }[];
    expect(files.map((f) => f.path)).toEqual(['build.recipe.json', 'dependency.lock', 'index.html']);
    for (const f of files) {
      const data = fs.readFileSync(path.join(a.dir, f.path));
      expect(f.size).toBe(data.length);
      expect(f.sha256).toBe(crypto.createHash('sha256').update(data).digest('hex'));
    }
    expect(manifest.contentHash).toBe('sha256-' + crypto.createHash('sha256').update(JSON.stringify(files)).digest('hex'));
    expect(fs.readFileSync(path.join(a.dir, 'index.html'), 'utf8')).toBe(fs.readFileSync(html, 'utf8'));
    expect(fs.readFileSync(path.join(a.dir, 'dependency.lock'), 'utf8')).toBe('');
    expect(JSON.parse(fs.readFileSync(path.join(a.dir, 'build.recipe.json'), 'utf8'))).toMatchObject({
      tool: 'motion-graphics/build-bundle',
      inputs: { html: '16x9.html' },
    });
  });

  it('parameters change bundleId / revision / alpha', () => {
    const r = buildBundle({ html, out: tmp(), bundleId: 'stat-card', revision: 'r7', alpha: false });
    expect(r.manifest).toMatchObject({ bundleId: 'stat-card', revision: 'r7', output: { alpha: false } });
    expect(r.dir.endsWith(`${path.sep}r7`)).toBe(true);
  });

  it('writes no files when lint fails', () => {
    const dir = tmp();
    const bad = path.join(dir, 'bad.html');
    fs.writeFileSync(bad, fs.readFileSync(html, 'utf8').replace('/* slot:motion */', '/* slot:motion */ Math.random();'));
    const out = path.join(dir, 'out');
    const r = buildBundle({ html: bad, out });
    expect(r.ok).toBe(false);
    expect(r.lint.issues.map((i: Issue) => i.code)).toContain('NONDETERMINISTIC');
    expect(fs.existsSync(out)).toBe(false);
  });

  it('verify\'s sample times fall within the envelope', () => {
    const { meta } = lintHtml(fs.readFileSync(html, 'utf8'));
    const t = sampleTimes(meta);
    expect(t.start).toBe(0);
    expect(t.end).toBe(4);
    expect(t.beforeEnd).toBe(3.7);
    expect(t.entranceEnd).toBeLessThan(t.holdMid);
    expect(t.holdMid).toBeLessThan(meta.exitStart);
  });
});
