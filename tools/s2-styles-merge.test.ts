import { describe, expect, it } from 'vitest';
import { mergeLayeredCss, parseLayeredCss } from './s2-styles-merge.ts';

const merge = (...sheets: string[]) =>
  mergeLayeredCss(
    sheets.map((css) => parseLayeredCss(css)!),
    '',
  );

describe('S2 style dedupe and merge', () => {
  it('within one layer, duplicate rules keep only the last occurrence; the order of other rules is unchanged', () => {
    expect(merge('@layer a{.x{color:red}}', '@layer a{.y{color:blue}}', '@layer a{.x{color:red}}')).toBe(
      '@layer a;@layer a{.y{color:blue}.x{color:red}}',
    );
  });

  it('layer order follows the first appearance of the name (declaration statements, rule blocks, nested blocks); dotted paths expand into nesting', () => {
    expect(merge('@layer b{.p{top:0}}', '@layer a;@layer b{@layer c{.q{top:1px}}}', '@layer a{.r{top:2px}}')).toBe(
      '@layer b,a,b.c;@layer b{.p{top:0}}@layer a{.r{top:2px}}@layer b.c{.q{top:1px}}',
    );
  });

  it('identical-text rules in different layers are each kept; rules outside any layer go last, keeping their order', () => {
    expect(merge('.u{color:red}@layer a{.x{color:red}}', '@layer b{.x{color:red}}.v{color:blue}.u{color:red}')).toBe(
      '@layer a,b;@layer a{.x{color:red}}@layer b{.x{color:red}}.v{color:blue}.u{color:red}',
    );
  });

  it('@media and other whole blocks count as one rule; top-level comments (source map) are dropped; parentheses inside strings and escapes do not count', () => {
    const css = '@layer a{@media (min-width:1px){.x{top:0}}}\n/*# sourceMappingURL=data:x */\n.a\\{b{content:"}{;"}';
    expect(parseLayeredCss(css)).toEqual({
      layers: ['a'],
      items: [
        { layer: 'a', text: '@media (min-width:1px){.x{top:0}}' },
        { layer: null, text: '.a\\{b{content:"}{;"}' },
      ],
    });
  });

  it('unsplittable input returns null: anonymous layers, @import, @layer inside conditional rules, unbalanced parentheses', () => {
    expect(parseLayeredCss('@layer{.x{top:0}}')).toBeNull();
    expect(parseLayeredCss('@import "a.css";.x{top:0}')).toBeNull();
    expect(parseLayeredCss('@media print{@layer a{.x{top:0}}}')).toBeNull();
    expect(parseLayeredCss('.x{top:0')).toBeNull();
  });
});
