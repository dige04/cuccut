/**
 * tokens.json checks (docs/design/canvas §10.5; format: the design-system skill's references/format.md "tokens.json syntax").
 * Mirrors the original `parseTokens` (model/tokens.ts): every item it drops (dropped) or warns about (warnings) becomes an issue; what is only kept in
 * the file but not shown by the editor (the original's notes: keys that are not token families, families and font entries over the limit) becomes a note,
 * not an issue (the original's own synced tokens.json carries such keys too, e.g. `meta`). Limits the original silently truncates at (themes, font families, text style groups and styles, tokens per family) and shapes it cannot read (name-to-value maps) are reported as separate issues.
 * Constants and regexes match the original. Issues are English text for agents.
 */

export const TOKENS_LIMITS = {
  bytes: 512 * 1024,
  themes: 8,
  colors: 600,
  fontFaces: 4096,
  fontFamilies: 12,
  typographyGroups: 12,
  typographyStyles: 80,
  tokensPerFamily: 60,
  extraFamilies: 12,
  colorAliasDepth: 16,
} as const;

const TOKEN_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;
const HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/;
const COLOR_ALIAS_PATTERN = /^\{([A-Za-z0-9][A-Za-z0-9_.-]{0,63})\}$/;
const EXTRA_TOKEN_FAMILY_PATTERN = /^(?!(?:__proto__|constructor|prototype)$)[A-Za-z][A-Za-z0-9_-]{0,31}$/;
const BUILTIN_TOKEN_DOCUMENT_KEYS = ['version', 'color', 'type', 'spacing', 'radius', 'shadow'];
const COLOR_FUNCTION_PATTERN = /^(?:rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|color)\([0-9a-z.,%/ \-]{1,60}\)$/;
const CSS_LENGTH_PATTERN = /^-?\d{1,4}(?:\.\d{1,6})?(?:px|rem|em|%)$|^0$/;
const FONT_WEIGHT_PATTERN = /^(?:[1-9]\d{0,2}|1000)(?: (?:[1-9]\d{0,2}|1000))?$/;
const FONT_STACK_PATTERN = /^[^;{}<>()\\\r\n\f]{1,200}$/;
const BOX_SHADOW_PATTERN = /^[a-z0-9 #%(),./+-]{1,400}$/;
const MOTION_DURATION_PATTERN = /^(?:\d{1,6}(?:\.\d{1,3})?|\.\d{1,3})m?s$/;
const MOTION_EASING_PATTERN = /^(?:linear|ease|ease-in|ease-out|ease-in-out|step-start|step-end|cubic-bezier\([-\d., ]{1,60}\)|steps\([a-z0-9, -]{1,40}\))$/;
const EXTRA_TOKEN_VALUE_PATTERN = /^[A-Za-z0-9 #%(),./+_-]{1,200}$/;

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

function isSafeFontStack(stack: string): boolean {
  if (!FONT_STACK_PATTERN.test(stack) || stack.includes('/*') || stack.includes('*/')) return false;
  let quote: string | null = null;
  for (const ch of stack) {
    if (quote === null) {
      if (ch === '"' || ch === "'") quote = ch;
    } else if (ch === quote) quote = null;
  }
  return quote === null;
}

function isColorLiteral(value: unknown): boolean {
  return typeof value === 'string' && (HEX_COLOR_PATTERN.test(value) || (COLOR_FUNCTION_PATTERN.test(value) && !/url|var|expression/.test(value)));
}

function balanced(value: string): boolean {
  let depth = 0;
  for (const ch of value) {
    if (ch === '(') depth++;
    else if (ch === ')' && --depth < 0) return false;
  }
  return depth === 0;
}

function normalizeBoxShadow(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!BOX_SHADOW_PATTERN.test(normalized) || /(?:url|var|expression|image|image-set|src)\s*\(/.test(normalized) || normalized === '') return undefined;
  return balanced(normalized) ? normalized : undefined;
}

function normalizeMotionValue(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value < 1e6) return `${Math.round(value)}ms`;
  if (typeof value !== 'string') return undefined;
  let normalized = value.trim().toLowerCase().replace(/\s+/g, ' ');
  if (normalized.startsWith('.')) normalized = '0' + normalized;
  return MOTION_DURATION_PATTERN.test(normalized) || MOTION_EASING_PATTERN.test(normalized) ? normalized : undefined;
}

function normalizeExtraTokenValue(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && Math.abs(value) < 1e6) return String(value);
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (!EXTRA_TOKEN_VALUE_PATTERN.test(normalized) || /(?:url|var|expression|image|image-set|src)\s*\(/i.test(normalized)) return undefined;
  return balanced(normalized) ? normalized : undefined;
}

function normalizeColorOrAlias(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const literal = value.trim().toLowerCase();
  if (isColorLiteral(literal)) return literal;
  const alias = value.trim().replace(/^\{--/, '{');
  return COLOR_ALIAS_PATTERN.test(alias) ? alias : undefined;
}

function normalizeCssLength(value: unknown, allowFullRadius: boolean): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (Math.abs(value) >= 1e4) return undefined;
    return value === 0 ? '0' : `${Math.round(value * 1000) / 1000}px`;
  }
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  if (allowFullRadius && normalized === 'full') return '9999px';
  return CSS_LENGTH_PATTERN.test(normalized) ? normalized : undefined;
}

function normalizeFontWeight(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 1000) return String(value);
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (normalized === 'normal') return '400';
  if (normalized === 'bold') return '700';
  return FONT_WEIGHT_PATTERN.test(normalized) ? normalized : undefined;
}

const colorAliasTarget = (value: string | undefined) => (value === undefined ? undefined : COLOR_ALIAS_PATTERN.exec(value)?.[1]);

interface ColorToken {
  name: string;
  value: Record<string, string>;
}

/** Original `explainColorAliasError`: the alias points to a missing token, forms a cycle or is nested deeper than 16 levels. */
function explainColorAliasError(token: ColorToken, themeId: string, baseThemeId: string, byName: Map<string, ColorToken>): { why: string; own: boolean } | undefined {
  const seen = new Set([token.name]);
  let current = token;
  for (let index = 0; index <= TOKENS_LIMITS.colorAliasDepth; index++) {
    const target = colorAliasTarget(current.value[themeId] ?? current.value[baseThemeId]);
    if (target === undefined) return undefined;
    const entry = byName.get(target);
    if (entry === undefined) return { why: `${index === 0 ? '' : `reaches {${target}}, which `}names no color token`, own: index === 0 };
    if (seen.has(target)) return { why: 'is a cycle', own: target === token.name };
    seen.add(target);
    current = entry;
  }
  return { why: `chains deeper than ${TOKENS_LIMITS.colorAliasDepth}`, own: true };
}

/** Original `removeInvalidColorAliases`. */
function removeInvalidColorAliases(themes: readonly { id: string }[], tokens: ColorToken[], dropped: string[]): void {
  const baseThemeId = themes[0]!.id;
  for (;;) {
    const byName = new Map(tokens.map(t => [t.name, t]));
    const items: [ColorToken, string, string, boolean][] = [];
    for (const token of tokens) {
      for (const theme of themes) {
        if (colorAliasTarget(token.value[theme.id]) === undefined) continue;
        const error = explainColorAliasError(token, theme.id, baseThemeId, byName);
        if (error !== undefined) items.push([token, theme.id, error.why, error.own]);
      }
    }
    if (items.length === 0) return;
    const anyOwn = items.some(item => item[3]);
    for (const [token, themeId, why, own] of items) {
      if (anyOwn && !own) continue;
      dropped.push(`color ${token.name} [${themeId}]: ${String(token.value[themeId])} ${why}`);
      delete token.value[themeId];
    }
    for (let index = 0; index < tokens.length; index++) {
      const token = tokens[index]!;
      if (Object.hasOwn(token.value, baseThemeId)) continue;
      const theme = themes.find(t => Object.hasOwn(token.value, t.id));
      if (theme === undefined) {
        dropped.push(`color ${token.name}: no valid value`);
        tokens.splice(index--, 1);
      } else {
        token.value[baseThemeId] = token.value[theme.id]!;
        delete token.value[theme.id];
      }
    }
  }
}

/** Whether a family has the list shape the original can read, `{"tokens":[…]}`; a name-to-value map (DTCG / W3C) gets a note. */
function shapeProblem(key: string, value: unknown): string | null {
  if (!isObject(value)) return `"${key}" must be an object {"tokens":[{"name","value","usage"}…]}`;
  if (!Array.isArray(value.tokens)) {
    return `"${key}" is not shaped {"tokens":[{"name","value","usage"}…]}: a name-to-value map is valid JSON the editor cannot read (the family shows empty and its entries leave the file at the first token edit); make it a list`;
  }
  return null;
}

/** Result of `checkTokensText`: issues (must fix) and notes (the original's notes: kept in the file, not shown by the editor, no fix needed). One English sentence each. */
export interface TokensCheck {
  problems: string[];
  notes: string[];
}

/**
 * Checks the text of tokens.json. Reads it the way the original `parseTokens` does: dropped values and warnings are issues, plus the limits the original silently truncates at and shapes it cannot read;
 * what the original only records as notes (hidden keys, families and font entries over the limit) are notes.
 */
export function checkTokensText(text: string): TokensCheck {
  const problems: string[] = [];
  const notes: string[] = [];
  const dropped: string[] = [];
  let source: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(text);
    if (!isObject(parsed)) return { problems: ['is not a JSON object'], notes };
    source = parsed;
  } catch (error) {
    return { problems: [`is not valid JSON: ${String((error as Error).message).slice(0, 120)}`], notes };
  }

  // color
  if (Object.hasOwn(source, 'color') && !isObject(source.color)) problems.push('"color" must be an object {"themes":[…],"tokens":[…]}');
  const sourceColor = isObject(source.color) ? source.color : {};
  if (isObject(source.color) && !Array.isArray(sourceColor.tokens) && !Array.isArray(sourceColor.groups) && Object.hasOwn(sourceColor, 'tokens')) {
    problems.push('"color.tokens" is not a list: a name-to-value map is valid JSON the editor cannot read; make it [{"name","value","usage"}…]');
  }
  if (isObject(source.color) && !Object.hasOwn(sourceColor, 'tokens') && !Object.hasOwn(sourceColor, 'groups')) {
    const keys = Object.keys(sourceColor).filter(k => k !== 'themes' && k !== 'note');
    if (keys.length > 0) problems.push('"color" has no "tokens" list: a name-to-value map is valid JSON the editor cannot read; make it {"themes":[…],"tokens":[{"name","value","usage"}…]}');
  }
  const sourceThemes = asArray(sourceColor.themes);
  if (sourceThemes.length > TOKENS_LIMITS.themes) problems.push(`color has ${sourceThemes.length} themes; at most ${TOKENS_LIMITS.themes} are read`);
  const themes: { id: string }[] = [];
  const themeIds = new Set<string>();
  for (const theme of sourceThemes) {
    if (themes.length >= TOKENS_LIMITS.themes) break;
    const id = isObject(theme) && typeof theme.id === 'string' ? theme.id.trim().toLowerCase() : typeof theme === 'string' ? theme.trim().toLowerCase() : '';
    if (!TOKEN_NAME_PATTERN.test(id) || themeIds.has(id) || id === 'constructor' || id === 'prototype' || Object.hasOwn(Object.prototype, id)) {
      dropped.push(`theme ${JSON.stringify(id)}: bad or duplicate id`);
      continue;
    }
    themeIds.add(id);
    themes.push({ id });
  }
  if (themes.length === 0) themes.push({ id: 'light' });
  const baseThemeId = themes[0]!.id;
  const colorNames = new Set<string>();
  const colorTokens: ColorToken[] = [];
  const sourceColorTokens = Array.isArray(sourceColor.tokens)
    ? asArray(sourceColor.tokens)
    : asArray(sourceColor.groups).flatMap(group => (isObject(group) ? asArray(group.tokens) : []));
  if (Array.isArray(sourceColor.tokens) && Array.isArray(sourceColor.groups)) {
    problems.push('color has both "tokens" and a legacy "groups"; only "tokens" is read');
  }
  if (sourceColorTokens.length > TOKENS_LIMITS.colors) problems.push(`color tokens capped at ${TOKENS_LIMITS.colors}; the rest are ignored`);
  for (const token of sourceColorTokens) {
    if (colorTokens.length >= TOKENS_LIMITS.colors) break;
    if (!isObject(token)) continue;
    const name = typeof token.name === 'string' ? token.name.trim().replace(/^--/, '') : '';
    if (!TOKEN_NAME_PATTERN.test(name) || colorNames.has(name)) {
      dropped.push(`color ${JSON.stringify(name)}: bad or duplicate name`);
      continue;
    }
    const value: Record<string, string> = {};
    if (isObject(token.value)) {
      for (const theme of themes) {
        const normalized = Object.hasOwn(token.value, theme.id) ? normalizeColorOrAlias(token.value[theme.id]) : undefined;
        if (normalized !== undefined) value[theme.id] = normalized;
        else if (Object.hasOwn(token.value, theme.id)) dropped.push(`color ${name} [${theme.id}]: not a color value`);
      }
    } else {
      const normalized = normalizeColorOrAlias(token.value);
      if (normalized !== undefined) value[baseThemeId] = normalized;
    }
    if (!Object.hasOwn(value, baseThemeId)) {
      const borrowed = themes.map(t => value[t.id]).find(v => v !== undefined);
      if (borrowed === undefined) {
        dropped.push(`color ${name}: no valid value`);
        continue;
      }
      value[baseThemeId] = borrowed;
    }
    colorNames.add(name);
    colorTokens.push({ name, value });
  }
  removeInvalidColorAliases(themes, colorTokens, dropped);

  // type
  if (Object.hasOwn(source, 'type') && !isObject(source.type)) problems.push('"type" must be an object {"fonts":[…],"families":{…},"groups":[…]}');
  const sourceType = isObject(source.type) ? source.type : {};
  for (const key of ['fonts', 'groups'] as const) {
    if (Object.hasOwn(sourceType, key) && !Array.isArray(sourceType[key])) problems.push(`"type.${key}" must be a list`);
  }
  if (Object.hasOwn(sourceType, 'families') && !isObject(sourceType.families)) problems.push('"type.families" must be an object {"<key>":"<font stack>"}');
  const sourceFonts = asArray(sourceType.fonts);
  if (sourceFonts.length > TOKENS_LIMITS.fontFaces) {
    notes.push(`type.fonts: ${sourceFonts.length - TOKENS_LIMITS.fontFaces} entries after the first ${TOKENS_LIMITS.fontFaces} fonts are kept in the file but not read`);
  }
  for (const font of sourceFonts.slice(0, TOKENS_LIMITS.fontFaces)) {
    if (!isObject(font)) continue;
    const family = typeof font.family === 'string' ? font.family.trim() : '';
    const file = typeof font.file === 'string' ? font.file.trim() : '';
    if (family === '' || !isSafeFontStack(family) || /["']/.test(family)) {
      dropped.push(`font ${JSON.stringify(file)}: bad family name`);
      continue;
    }
    if (file === '' || /^[a-z][a-z0-9+.-]*:/i.test(file)) {
      dropped.push(`font ${JSON.stringify(family)}: bad file path (a relative path into the system, e.g. fonts/Name.woff2)`);
    }
  }
  const families: Record<string, string> = {};
  if (isObject(sourceType.families)) {
    const keys = Object.keys(sourceType.families);
    if (keys.length > TOKENS_LIMITS.fontFamilies) problems.push(`type.families has ${keys.length} families; at most ${TOKENS_LIMITS.fontFamilies} are read`);
    let index = 0;
    for (const key of keys) {
      if (index >= TOKENS_LIMITS.fontFamilies) break;
      const id = key.trim().toLowerCase();
      const stack = sourceType.families[key];
      if (!TOKEN_NAME_PATTERN.test(id) || typeof stack !== 'string' || !isSafeFontStack(stack.trim())) {
        dropped.push(`font family ${JSON.stringify(key)}: bad key or stack`);
        continue;
      }
      families[id] = stack.trim();
      index++;
    }
  }
  const sourceGroups = asArray(sourceType.groups);
  if (sourceGroups.length > TOKENS_LIMITS.typographyGroups) problems.push(`type.groups has ${sourceGroups.length} groups; at most ${TOKENS_LIMITS.typographyGroups} are read`);
  const styleNames = new Set<string>();
  let styleCount = 0;
  let stylesSeen = 0;
  for (const group of sourceGroups.slice(0, TOKENS_LIMITS.typographyGroups)) {
    if (!isObject(group)) continue;
    if (Object.hasOwn(group, 'styles') && !Array.isArray(group.styles)) problems.push(`type group ${JSON.stringify(group.name ?? '')}: "styles" must be a list`);
    for (const style of asArray(group.styles)) {
      stylesSeen++;
      if (styleCount >= TOKENS_LIMITS.typographyStyles) continue;
      if (!isObject(style)) continue;
      const name = typeof style.name === 'string' ? style.name.trim().replace(/^\./, '') : '';
      if (!TOKEN_NAME_PATTERN.test(name) || styleNames.has(name)) {
        dropped.push(`type style ${JSON.stringify(name)}: bad or duplicate name`);
        continue;
      }
      if (normalizeCssLength(style.fontSize, false) === undefined) {
        dropped.push(`type style ${name}: bad fontSize`);
        continue;
      }
      styleNames.add(name);
      styleCount++;
    }
  }
  if (stylesSeen > TOKENS_LIMITS.typographyStyles) problems.push(`type has ${stylesSeen} styles; at most ${TOKENS_LIMITS.typographyStyles} are read`);

  // spacing, radius, shadow, extra families
  const familyOf = new Map<string, string>(colorTokens.map(t => [t.name, 'color']));
  const scalarFamily = (input: unknown, family: string, normalize: (value: unknown, name: string) => unknown): void => {
    const tokens = asArray(isObject(input) ? input.tokens : undefined);
    if (tokens.length > TOKENS_LIMITS.tokensPerFamily) problems.push(`${family} has ${tokens.length} tokens; at most ${TOKENS_LIMITS.tokensPerFamily} are read`);
    let count = 0;
    for (const token of tokens) {
      if (count >= TOKENS_LIMITS.tokensPerFamily) break;
      if (!isObject(token)) continue;
      const name = typeof token.name === 'string' ? token.name.trim().replace(/^--/, '') : '';
      const other = familyOf.get(name);
      if (!TOKEN_NAME_PATTERN.test(name) || other === family) {
        dropped.push(`${family} ${JSON.stringify(name)}: bad or duplicate name`);
        continue;
      }
      if (other !== undefined) {
        dropped.push(`${family} ${name}: a ${other} token already has that name (one --${name} across every family)`);
        continue;
      }
      if (normalize(token.value, name) === undefined) {
        dropped.push(`${family} ${name}: bad value`);
        continue;
      }
      familyOf.set(name, family);
      count++;
    }
  };
  const shadowValue = (input: unknown, name: string): Record<string, string> | undefined => {
    const value: Record<string, string> = {};
    if (isObject(input)) {
      for (const theme of themes) {
        if (!Object.hasOwn(input, theme.id)) continue;
        const normalized = normalizeBoxShadow(input[theme.id]);
        if (normalized !== undefined) value[theme.id] = normalized;
        else dropped.push(`shadow ${name} [${theme.id}]: not a box-shadow value`);
      }
    } else {
      const normalized = normalizeBoxShadow(input);
      if (normalized !== undefined) value[baseThemeId] = normalized;
    }
    if (!Object.hasOwn(value, baseThemeId)) {
      const theme = themes.find(t => Object.hasOwn(value, t.id));
      if (theme === undefined) return undefined;
      value[baseThemeId] = value[theme.id]!;
    }
    return value;
  };
  for (const key of ['spacing', 'radius'] as const) {
    if (Object.hasOwn(source, key)) {
      const shape = shapeProblem(key, source[key]);
      if (shape) problems.push(shape);
    }
  }
  scalarFamily(source.spacing, 'spacing', value => normalizeCssLength(value, false));
  scalarFamily(source.radius, 'radius', value => normalizeCssLength(value, true));
  scalarFamily(source.shadow, 'shadow', shadowValue);
  if (Object.hasOwn(source, 'shadow') && !(isObject(source.shadow) && Array.isArray(source.shadow.tokens))) {
    notes.push('"shadow" is not shaped {"tokens":[{name,value,usage}]}: kept in the file, not shown');
  }
  let extraCount = 0;
  for (const key of Object.keys(source)) {
    if (BUILTIN_TOKEN_DOCUMENT_KEYS.includes(key)) continue;
    const value = source[key];
    if (key === 'name' && typeof value === 'string') continue;
    if (!EXTRA_TOKEN_FAMILY_PATTERN.test(key) || !isObject(value) || !Array.isArray(value.tokens)) {
      notes.push(`${JSON.stringify(key.slice(0, 40))} is not a token family ({"tokens":[{name,value,usage}]}): kept in the file, not shown`);
      continue;
    }
    if (extraCount >= TOKENS_LIMITS.extraFamilies) {
      notes.push(`token families beyond the built-in ones are capped at ${TOKENS_LIMITS.extraFamilies}: ${JSON.stringify(key)} is kept in the file, not shown`);
      continue;
    }
    extraCount++;
    scalarFamily(value, key, key === 'motion' ? v => normalizeMotionValue(v) ?? normalizeExtraTokenValue(v) : normalizeExtraTokenValue);
  }
  return { problems: [...problems, ...dropped], notes };
}

/** Paths referenced by `type.fonts[].file` in tokens.json (a bare file name means `fonts/<file>`, as in the original). */
export function tokenFontFiles(text: string): string[] {
  try {
    const parsed: unknown = JSON.parse(text);
    if (!isObject(parsed) || !isObject(parsed.type)) return [];
    const files: string[] = [];
    for (const font of asArray(parsed.type.fonts)) {
      if (!isObject(font) || typeof font.file !== 'string') continue;
      const file = font.file.trim();
      if (file === '' || /^[a-z][a-z0-9+.-]*:/i.test(file)) continue;
      files.push(file.includes('/') ? file : `fonts/${file}`);
    }
    return files;
  } catch {
    return [];
  }
}
