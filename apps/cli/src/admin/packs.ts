import fs from 'node:fs/promises';
import { newId, PACK_STYLE_MAX_CHARS } from '@cuccut/protocol';
import { defineNoun, readStdin } from './context.ts';
import { M } from './packs-copy.ts';
import { formatInstalled, formatPreview, formatRemoved, parsePackId } from './packs-output.ts';

/**
 * Admin bucket `cuccut packs inspect|install|remove|restore|style` (pack spec §8): installing decides what text every later agent follows, so like adding a skill it is
 * done by a person, in the desktop app or here. Listing, reading and the project's style choice are on the agent surface (`packs list|read|choose-style`).
 *
 * A `<source>` that names an existing folder is passed as its absolute path; anything else (a GitHub or `https://` address) goes to the Runtime as typed.
 */
export const packs = defineNoun({
  name: 'packs',
  partial: true,
  verbs: ['inspect', 'install', 'remove', 'restore', 'style'],
  get usage() {
    return M.packsHelp;
  },
  options: { replace: { type: 'boolean' } },
  async run(ctx) {
    const [sub, arg, ...extra] = ctx.args;
    const replace = ctx.values.replace === true;
    if (!arg || (replace && sub !== 'install')) throw ctx.usageError();
    if (sub === 'style') {
      if (extra.length > 1) throw ctx.usageError();
      const id = ctx.parse(() => parsePackId(arg));
      const file = extra[0];
      if (file === undefined) {
        const detail = await ctx.client.request('packs.get', { id });
        return ctx.done(detail.style, detail.style ? [detail.style.text.trimEnd()] : [M.noStyle(detail.pack.name, id)]);
      }
      const text = file === '-' ? await readStdin(null) : await readFile(ctx.resolve(file));
      const detail = await ctx.client.request('packs.setStyle', { id, text });
      return ctx.done(detail, [
        detail.style ? M.styleSaved(detail.pack.name, detail.style.text.length, PACK_STYLE_MAX_CHARS) : M.styleRemoved(detail.pack.name),
        M.takesEffect,
      ]);
    }
    if (extra.length > 0) throw ctx.usageError();
    if (sub === 'inspect' || sub === 'install') {
      const source = await sourceOf(arg, ctx.resolve(arg));
      if (sub === 'inspect') {
        const preview = await ctx.client.request('packs.inspect', { source, commandId: newId('cmd') });
        return ctx.done(preview, formatPreview(preview, source));
      }
      const result = await ctx.client.request('packs.install', { source, ...(replace ? { replace } : {}), commandId: newId('cmd') });
      return ctx.done(result, [...formatInstalled(result), M.takesEffect]);
    }
    if (sub === 'remove') {
      const result = await ctx.client.request('packs.remove', { id: ctx.parse(() => parsePackId(arg)) });
      return ctx.done(result, formatRemoved(result));
    }
    if (sub !== 'restore') throw ctx.usageError();
    const result = await ctx.client.request('packs.restore', { trashId: arg });
    return ctx.done(result, [M.restored(result.pack.name, result.pack.version)]);
  },
});

/** A folder that exists is passed as its absolute path; anything else as typed (the Runtime classifies it). */
async function sourceOf(typed: string, resolved: string): Promise<string> {
  const stat = await fs.stat(resolved).catch(() => null);
  return stat?.isDirectory() ? resolved : typed;
}

async function readFile(file: string): Promise<string> {
  try {
    return await fs.readFile(file, 'utf8');
  } catch (error) {
    throw new Error(M.fileUnreadable(file, (error as NodeJS.ErrnoException).code ?? String(error)));
  }
}
