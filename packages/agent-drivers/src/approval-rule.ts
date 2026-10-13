/**
 * The rule recorded by "always allow": the command name, plus a second word that looks like a subcommand (`npm install`, `git status`). Parts with paths or arguments do not go into the rule, so that a rule does not match only a one-off argument.
 *
 * - A command wrapped in a shell (Codex often sends `/bin/zsh -lc 'npm test'` or `bash -lc "git status"`) uses the command actually run inside.
 * - A leading `cd <dir> &&` is skipped: it only changes the working directory.
 * - If what remains is still several commands (`&&`, `||`, `;`, `|`, `&`, newlines), has redirection or command substitution (`>`, `<`, `` ` ``, `$(`), or starts with `VAR=...`, it returns null and no "always allow" is offered: a rule matches only one command, so `npm install && rm -rf ~` must not be allowed by `npm install`.
 */
export function commandRule(command: string): string | null {
  let words = parseSimpleCommand(command);
  for (let depth = 0; words?.length; depth++) {
    const wrapped = shellScript(words);
    if (wrapped === null) break;
    // Too many layers of wrapping, or no script after `-c`: it cannot tell what is actually executed.
    if (wrapped === 'invalid' || depth >= 3) return null;
    words = parseSimpleCommand(wrapped.script);
  }
  const head = words?.[0];
  if (!words || !head) return null;
  if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(head)) return null;
  const name = head.split('/').pop()!;
  if (!name) return null;
  const sub = words[1];
  return sub && /^[a-z][\w-]*$/.test(sub) ? `${name} ${sub}` : name;
}

const SHELLS = new Set(['sh', 'bash', 'zsh', 'dash', 'ksh']);

/**
 * The script in `<shell> [options] -c '<script>'` (`-lc`, `-l -c`, `--login -c` and `-o pipefail -c` all count).
 * If it is not a shell, or there is no `-c` before the first non-option word (a script file), it returns null and the command is handled as an ordinary one. No script after `-c`: `invalid`.
 */
function shellScript(words: string[]): { script: string } | 'invalid' | null {
  const name = words[0]!.split('/').pop()!;
  if (!SHELLS.has(name)) return null;
  for (let i = 1; i < words.length; i++) {
    const word = words[i]!;
    if (/^-[A-Za-z]+$/.test(word) && word.includes('c')) return i + 1 < words.length ? { script: words[i + 1]! } : 'invalid';
    if (/^[-+]o$/.test(word)) i++;
    else if (!/^(-[A-Za-z]+|--[\w-]+)$/.test(word)) return null;
  }
  return null;
}

type Token = { op: string } | { word: string };

/**
 * Splits one line of shell into the words of a single simple command: handles single quotes, double quotes and backslashes, and strips a leading `cd <dir> &&`.
 * If control operators, redirection or command substitution remain, it returns null (see `commandRule`).
 */
function parseSimpleCommand(input: string): string[] | null {
  const tokens = tokenize(input);
  if (!tokens) return null;
  let start = 0;
  while (isWord(tokens[start], 'cd') && 'word' in (tokens[start + 1] ?? {}) && isOp(tokens[start + 2], '&&')) start += 3;
  const words: string[] = [];
  for (const token of tokens.slice(start)) {
    if ('op' in token) return null;
    words.push(token.word);
  }
  return words;
}

function isWord(token: Token | undefined, word: string): boolean {
  return !!token && 'word' in token && token.word === word;
}

function isOp(token: Token | undefined, op: string): boolean {
  return !!token && 'op' in token && token.op === op;
}

/** null: unmatched quotes, or command substitution is present (it does not guess what that expands to). */
function tokenize(input: string): Token[] | null {
  const tokens: Token[] = [];
  let word = '';
  let inWord = false;
  const flush = () => {
    if (inWord) tokens.push({ word });
    word = '';
    inWord = false;
  };
  for (let i = 0; i < input.length; i++) {
    const c = input[i]!;
    if (c === "'") {
      const end = input.indexOf("'", i + 1);
      if (end < 0) return null;
      word += input.slice(i + 1, end);
      inWord = true;
      i = end;
    } else if (c === '"') {
      let j = i + 1;
      for (; j < input.length && input[j] !== '"'; j++) {
        if (input[j] === '`' || (input[j] === '$' && input[j + 1] === '(')) return null;
        if (input[j] === '\\' && j + 1 < input.length) {
          j++;
          if (!'"\\$`\n'.includes(input[j]!)) word += '\\';
        }
        word += input[j];
      }
      if (j >= input.length) return null;
      inWord = true;
      i = j;
    } else if (c === '\\') {
      if (i + 1 < input.length) word += input[++i];
      inWord = true;
    } else if (c === '`' || (c === '$' && input[i + 1] === '(')) {
      return null;
    } else if (c === ' ' || c === '\t') {
      flush();
    } else if ('&|;<>()\n'.includes(c)) {
      flush();
      const two = input.slice(i, i + 2);
      const op = ['&&', '||', '>>', '<<'].includes(two) ? two : c;
      tokens.push({ op });
      i += op.length - 1;
    } else {
      word += c;
      inWord = true;
    }
  }
  flush();
  return tokens;
}
