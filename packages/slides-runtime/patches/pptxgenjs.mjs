// PptxGenJS 3.12.0 的应用扩展（渐变、平铺填充、图片圆角、占位符继承、自定义主题与母版等 25 处，见 README.md）。
// 不改 node_modules：构建时按 pptxgenjs-3.12.0.json 改写读进来的发行文件，apps/slides-editor 的 Vite 与 esbuild 插件调用它。
// 发行文件的 SHA-256 与版本对不上时直接报错，不对错的代码打补丁。

import crypto from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';

const manifestBytes = fs.readFileSync(new URL('./pptxgenjs-3.12.0.json', import.meta.url));
const manifest = JSON.parse(manifestBytes);
const digest = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const marker = `// CucCut slides runtime PptxGenJS extensions: ${digest(manifestBytes)}`;

/** 装好的 pptxgenjs 目录（按 slides-runtime 包解析，工作区提升到根 node_modules 时也找得到）。 */
export function pptxgenjsDir() {
  const require = createRequire(new URL('../package.json', import.meta.url));
  return path.dirname(require.resolve('pptxgenjs/package.json'));
}

/** 要打补丁的发行文件名（`pptxgen.es.js`、`pptxgen.cjs.js`）；别的文件返回 null。 */
export function pptxgenjsDistFile(id) {
  const match = /[\\/]pptxgenjs[\\/]dist[\\/]([^\\/?]+)(?:\?.*)?$/.exec(id);
  return match && Object.hasOwn(manifest.upstreamFiles, match[1]) ? match[1] : null;
}

/** 给一个发行文件打补丁，返回改写后的源码；已经打过的原样返回。 */
export function patchPptxgenjs(source, file) {
  if (source.endsWith(marker + '\n')) return source;
  const expected = manifest.upstreamFiles[file];
  if (!expected) throw new Error(`No PptxGenJS extension records for ${file}.`);
  const version = JSON.parse(fs.readFileSync(path.join(pptxgenjsDir(), 'package.json'), 'utf8')).version;
  if (version !== manifest.version) throw new Error(`PptxGenJS extension requires ${manifest.version}; found ${version}.`);
  if (digest(source) !== expected) {
    throw new Error(`Unexpected PptxGenJS distribution at ${file}; reinstall the pinned npm release before applying extensions.`);
  }
  const sourceType = file.endsWith('.es.js') ? 'module' : 'script';
  const ast = parse(source, { sourceType });
  const replacements = [];
  const additions = [];
  for (const record of manifest.records) {
    const parsed = parse(record.code, { sourceType: 'script' }).program.body[0];
    if (record.kind === 'add-function') {
      additions.push(record.code);
      continue;
    }
    const expression = parsed.type === 'ExpressionStatement' ? parsed.expression : undefined;
    if (record.kind === 'add-method') {
      additions.push(`PptxGenJS.prototype.${record.name} = ${generate(expression).code};`);
      continue;
    }
    const matches = [];
    traverse(ast, {
      FunctionDeclaration(p) {
        if (record.kind === 'function' && p.node.id?.name === record.name) matches.push(p.node);
      },
      AssignmentExpression(p) {
        const left = p.node.left;
        if (left.type !== 'MemberExpression' || left.computed || left.property.name !== record.name) return;
        if (record.kind === 'constructor-field' && left.object.type === 'ThisExpression') matches.push(p.node.right);
        if (
          record.kind === 'method' &&
          left.object.type === 'MemberExpression' &&
          left.object.object.name === 'PptxGenJS' &&
          left.object.property.name === 'prototype'
        ) {
          matches.push(p.node.right);
        }
      },
    });
    if (matches.length !== 1) throw new Error(`Expected one ${record.kind} ${record.name} in ${file}; found ${matches.length}.`);
    const before = matches[0];
    replacements.push({
      start: before.start,
      end: before.end,
      code: record.kind === 'function' ? record.code.trim() : generate(expression).code,
    });
  }
  let patched = source;
  for (const change of replacements.sort((a, b) => b.start - a.start)) {
    patched = patched.slice(0, change.start) + change.code + patched.slice(change.end);
  }
  patched += '\n' + additions.join('\n') + '\n' + marker + '\n';
  parse(patched, { sourceType });
  return patched;
}

/** 扩展的条数，测试与构建日志用。 */
export const PPTXGENJS_EXTENSION_COUNT = manifest.records.length;
