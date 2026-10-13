/**
 * For tests: fake answers to requests that the Speech Worker (the subtitle and translation core) sends to the text model. Requests follow a file contract: the carrier package to be rewritten is inside `<BEGIN INPUT name="<kind>.src.<ext>">`, and the translation page is one `<p id="<sentence ID>">` per sentence inside a `<section>`.
 * The translation page gets one answer per sentence (when there are alignment groups, lines are written per group). Other requests (such as the target-language brief) get an invalid answer, so the core takes its own fallback path.
 */

interface Tag {
  open: string;
  inner: string;
}

function tags(html: string, name: string): Tag[] {
  const out: Tag[] = [];
  let rest = html;
  for (;;) {
    const start = rest.indexOf(`<${name} `);
    if (start < 0) return out;
    const after = rest.slice(start);
    const openEnd = after.indexOf('>');
    const close = after.indexOf(`</${name}>`);
    out.push({ open: after.slice(0, openEnd), inner: after.slice(openEnd + 1, close) });
    rest = after.slice(close + name.length + 3);
  }
}

function attr(open: string, name: string): string | null {
  const match = new RegExp(` ${name}="([^"]*)"`).exec(open);
  return match ? match[1]!.replaceAll('&quot;', '"').replaceAll('&amp;', '&') : null;
}

/** The kind of request (`translate`, `brief`, …); null when it is not a request under the file contract. */
export function speechRequestKind(user: string): string | null {
  return /<BEGIN INPUT name="([a-z-]+)\.src\./.exec(user)?.[1] ?? null;
}

/** The sentence IDs to translate on the translation page (the editable `<p>`s). */
export function requestedSentences(user: string): string[] {
  return tags(user, 'section')
    .flatMap((section) => tags(section.inner, 'p'))
    .filter((p) => attr(p.open, 'data-editable') !== 'false')
    .map((p) => attr(p.open, 'id')!);
}

/**
 * Fake answer. `line(sentenceId, group)` gives the translation of one sentence (when there are alignment groups, group `group`). When not given, it writes a distinct sentence in the target language (the core's quality gate would reject a page where every translation is identical and short, or in the wrong language).
 */
export function fakeSpeechAnswer(user: string, line?: (sentenceId: string, group: number) => string): string {
  if (speechRequestKind(user) !== 'translate') return '<article></article>';
  const chinese = /data-target="(zh|ja)/.test(user);
  let ordinal = 0;
  const text = (id: string, group: number) => {
    if (line) return line(id, group);
    ordinal++;
    return chinese ? `好的，第${ordinal}句。` : `This is line ${ordinal}.`;
  };
  let out = '<article>';
  for (const section of tags(user, 'section')) {
    out += `<section id="${attr(section.open, 'id')}">`;
    for (const p of tags(section.inner, 'p')) {
      if (attr(p.open, 'data-editable') === 'false') continue;
      const id = attr(p.open, 'id')!;
      out += `<p id="${id}">`;
      const groups = attr(p.open, 'data-align-groups');
      const words = attr(p.open, 'data-align-words');
      if (groups)
        out += groups
          .split(';')
          .map((group, i) => `<span data-src="${group.split('@')[0]}">${text(id, i)}</span>`)
          .join('');
      else if (words) out += `<span data-src="1-${words.split('[').length - 1}">${text(id, 0)}</span>`;
      else out += text(id, 0);
      out += '</p>';
    }
    out += '</section>';
  }
  return `${out}</article>`;
}
