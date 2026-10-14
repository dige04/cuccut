// The S2 style assembly shared by the renderer process (Electron) and the web client: the style macro plugin, S2 style dedupe, and the rule that production builds merge all S2 styles into one chunk.
//
// The style macro generates one CSS per call site (`macro-<content hash>.css`, with the call's location and an inline source map), and S2 components each carry a CSS of their own.
// Atomic classes repeat heavily across these files. In dev, Vite inserts a separate <style> for each: of over 2,000 stylesheets and over 30,000 rules, only a few thousand are distinct. Production builds merge them into one s2-styles chunk, but minification does not dedupe, so of over 20,000 rules, only over 2,000 are distinct. Every style computation has to go through all of them.
// Both sides dedupe with the merge in `s2-styles-merge.ts`, which keeps the cascade result unchanged: in dev, `s2-styles-client.ts` merges them into one stylesheet; in production builds, the s2-styles file is rewritten before the output is written.

import { readFileSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import macros from 'unplugin-parcel-macros';
import { normalizePath, type Plugin } from 'vite';
import { mergeLayeredCss, parseLayeredCss } from './s2-styles-merge.ts';

/** The CSS of the production s2-styles chunk: what the style macro generates, plus what the S2 and S2 AI components ship with. */
export function s2StylesChunk(id: string): string | undefined {
  if (/macro-(.*)\.css$/.test(id) || /@react-spectrum\/(s2|ai)\/.*\.css$/.test(id)) return 's2-styles';
}

/** The style macro plugin, along with style dedupe for dev and production builds. It goes first in the plugin list, since the macro must process the source before other plugins do. */
export function s2Styles(): Plugin[] {
  const macroPlugin = macros.vite() as Plugin;
  return [dedupeS2StylesInDev(macroPlugin), macroPlugin, dedupeS2StylesInBuild()];
}

/**
 * Production build: before the output is written, the CSS of the s2-styles chunk is merged and deduped (output that is already minified stays minified). The hash in the file name is computed before dedupe. Dedupe depends only on content, so the same input still gives the same file name and content. A chunk that cannot be split reliably is kept as-is, with a warning.
 */
function dedupeS2StylesInBuild(): Plugin {
  return {
    name: 'cuccut:s2-styles-build',
    apply: 'build',
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        for (const output of Object.values(bundle)) {
          if (output.type !== 'asset' || !/(^|\/)s2-styles-[^/]*\.css$/.test(output.fileName)) continue;
          const css = typeof output.source === 'string' ? output.source : new TextDecoder().decode(output.source);
          const parsed = parseLayeredCss(css);
          if (parsed) output.source = mergeLayeredCss([parsed], '');
          else this.warn(`${output.fileName} has a layout that cannot be split reliably (anonymous layer, @import, or @layer inside a conditional rule); not deduplicated`);
        }
      },
    },
  };
}

const MACRO_CSS = /^macro-[0-9a-f]{64}\.css$/;
/** The CSS that the S2 and S2 AI components ship with (pre-built dependencies are imported by absolute path). page.css is page styling on :root, not layered, so it stays in place to keep its order relative to app.css. */
const COMPONENT_CSS = /\/@react-spectrum\/(s2|ai)\/.+\.css$/;
const PAGE_CSS = /\/@react-spectrum\/s2\/page\.css$/;
/**
 * The virtual module's id: it does not end in .css, so Vite's CSS plugin does not take it over and it is handled as a JS module. It starts with / and does not contain \0, so the address Vite uses for prune notifications matches the address of import.meta.hot inside the module. (`\0…` and bare-name ids are wrapped with /@id/ on one side and not the other, so the prune callback would never fire.)
 */
const PREFIX = '/@cuccut-s2-style/';
// Uses import.meta.url rather than import.meta.dirname: electron-vite only replaces the former when it bundles the config file; the latter would become the directory containing the config file.
const CLIENT = normalizePath(fileURLToPath(new URL('./s2-styles-client.ts', import.meta.url)));
const MERGE = normalizePath(fileURLToPath(new URL('./s2-styles-merge.ts', import.meta.url)));

/**
 * In dev, the CSS of the style macro and the S2 components is handed to `s2-styles-client.ts` to be merged and deduped, instead of inserting a <style> for each. Each CSS chunk becomes a JS module; on load it registers its rules, and when it is no longer referenced (after a hot update, Vite prunes it), it unregisters.
 * The inline source map (the whole source file) that comes with the macro's CSS is removed, so in devtools these rules no longer map back to source lines. Static styles still carry `-macro-static-*` location info.
 */
function dedupeS2StylesInDev(macroPlugin: Plugin): Plugin {
  const loadMacroCss = macroPlugin.load as (this: unknown, id: string) => string;
  const hasMacroCss = (macroPlugin as unknown as { loadInclude: (id: string) => boolean }).loadInclude;
  /**
   * Macro CSS seen so far (source map removed), keyed by file name. When the macro plugin re-transforms a file, it first deletes all the CSS it generated last time, and re-registers after the transform.
   * Identical CSS is shared under one file name across files, so during that gap another file parsing a same-named CSS would not find it. This happens whenever a full page reload follows dependency pre-bundling, and whenever many files are re-transformed at once.
   * The file name is a hash of the content, so the recorded content never goes stale.
   */
  const seen = new Map<string, string>();
  const macroCss = (context: unknown, id: string): string | undefined => {
    if (!seen.has(id) && hasMacroCss(id)) {
      seen.set(id, loadMacroCss.call(context, id).replace(/\n\/\*# sourceMappingURL=[^*]*\*\/\s*$/, ''));
    }
    return seen.get(id);
  };
  return {
    name: 'cuccut:s2-styles-dev',
    apply: 'serve',
    enforce: 'pre',
    // `@react-spectrum/s2/style` is only for the style macro in Node (its exports have only the node condition). Dependency scanning resolves by browser conditions and cannot resolve it, so the whole scan fails. Pre-bundling is deferred to page load, and a full page reload happens once dependencies are found. Skip it during the scan.
    config: () => ({ optimizeDeps: { exclude: ['@react-spectrum/s2/style'] } }),
    // If the dedupe itself changes (the registry exists once per page), do a full page reload: hot replacement would start a new, empty registry, and styles already registered could not come back.
    hotUpdate({ file }) {
      if (file !== CLIENT && file !== MERGE) return;
      this.environment.hot.send({ type: 'full-reload' });
      return [];
    },
    resolveId(source) {
      if (source.startsWith(PREFIX)) return source;
      if (MACRO_CSS.test(source)) {
        // When the macro plugin does not have this one and has not seen it before, hand it back, with the same error as before.
        if (macroCss(this, source) === undefined) return;
        return PREFIX + source.slice(0, -'.css'.length);
      }
      if (isAbsolute(source) && COMPONENT_CSS.test(source) && !PAGE_CSS.test(source)) {
        return `${PREFIX}fs/${source.replace(/^\//, '').slice(0, -'.css'.length)}`;
      }
    },
    load(id) {
      if (!id.startsWith(PREFIX)) return;
      const rest = id.slice(PREFIX.length);
      // Absolute path of a component's CSS: on POSIX the leading / is removed; on Windows it starts with a drive letter.
      const file = rest.startsWith('fs/') ? rest.slice('fs/'.length) : null;
      const source = (file === null ? rest : /^[A-Za-z]:\//.test(file) ? file : `/${file}`) + '.css';
      let css: string;
      if (MACRO_CSS.test(source)) {
        const content = macroCss(this, source);
        if (content === undefined) return this.error(`style macro did not generate ${source}`);
        css = content;
      } else {
        css = readFileSync(source, 'utf8');
      }
      return [
        `import { addStyle, removeStyle } from ${JSON.stringify(CLIENT)};`,
        `const id = ${JSON.stringify(source)};`,
        `addStyle(id, ${JSON.stringify(css)});`,
        'if (import.meta.hot) {',
        '  import.meta.hot.accept();',
        '  import.meta.hot.prune(() => removeStyle(id));',
        '}',
      ].join('\n');
    },
  };
}
