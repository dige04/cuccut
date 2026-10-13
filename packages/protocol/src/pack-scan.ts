/**
 * The text scan for packs (pack spec §5). A pack's style guide, its reference titles and notes, and its quick actions are text that somebody else wrote and that an agent
 * will read as guidance, so each line is checked for what only makes sense as an attack on the agent: telling it to ignore its instructions, to reveal its prompt or a
 * secret, a credential, a command to run, deleting work, sending something to a web address, or a fake prompt boundary. The style guide is also held to
 * `PACK_STYLE_MAX_CHARS`.
 *
 * Blocking for the style guide, reference titles and notes, and quick actions (at install and on `packs.setStyle`); a warning only for template prompts and `SKILL.md`
 * bodies, which are instructions by nature. Dependency-free: the Runtime and the UI share it. The reasons are codes; `packScanReasonText` gives the text.
 */

import type { Localized } from './message-ref.ts';
import { ProtocolPacks as PP } from './messages/protocol/protocol-packs.ts';
import { PACK_STYLE_MAX_CHARS, type PackScanHit, type PackScanReason } from './pack.ts';

/** Letters on either side of a word, Unicode-aware (`\b` only knows ASCII, and Vietnamese words carry marks). */
const L = '\\p{L}\\p{M}\\p{N}_';
const word = (body: string) => `(?<![${L}])(?:${body})(?![${L}])`;
const VI_INSTRUCTIONS = 'hướng dẫn|chỉ dẫn|chỉ thị|quy tắc|lời nhắc';

const PATTERNS: readonly (readonly [RegExp, PackScanReason])[] = [
  // English (agentcut's scan)
  [
    new RegExp(
      `${word('ignore|disregard|forget|override')}[^.\\n]{0,40}${word('previous|prior|above|earlier|all|system|your')}[^.\\n]{0,20}${word('instructions?|rules?|prompts?|guidelines?')}`,
      'iu',
    ),
    'ignore-instructions',
  ],
  // Spanish (agentcut's scan)
  [new RegExp(`${word('ignora|olvida|omite')}[^.\\n]{0,40}${word('instrucciones|reglas|indicaciones')}`, 'iu'), 'ignore-instructions'],
  // Vietnamese: "bỏ qua / phớt lờ mọi hướng dẫn …", "bỏ qua chỉ dẫn ở trên / trước đó / hệ thống"
  [
    new RegExp(`${word('bỏ qua|phớt lờ|lờ đi')}[^.\\n]{0,30}${word('mọi|tất cả|các|những|toàn bộ')}[^.\\n]{0,10}${word(VI_INSTRUCTIONS)}`, 'iu'),
    'ignore-instructions',
  ],
  [
    new RegExp(`${word('bỏ qua|phớt lờ|lờ đi')}[^.\\n]{0,30}${word(VI_INSTRUCTIONS)}[^.\\n]{0,20}${word('trước|trước đó|ở trên|phía trên|bên trên|hệ thống|của bạn|ban đầu|cũ')}`, 'iu'),
    'ignore-instructions',
  ],
  [new RegExp(word('system prompt|developer message|you are now|act as (?:an?|the) (?:admin|root|developer)'), 'iu'), 'change-identity'],
  [new RegExp(word('từ giờ bạn là|bây giờ bạn là|lời nhắc hệ thống'), 'iu'), 'change-identity'],
  [
    new RegExp(`${word('reveal|print|show|repeat|leak')}[^.\\n]{0,30}${word('system prompt|instructions|api key|token|secret|password')}s?`, 'iu'),
    'reveal-secrets',
  ],
  // Vietnamese: "tiết lộ / để lộ / in ra … mật khẩu / khoá / khóa / bí mật / lời nhắc"
  [
    new RegExp(`${word('tiết lộ|để lộ|in ra|cho xem')}[^.\\n]{0,30}${word('mật khẩu|khoá|khóa|khoá api|khóa api|bí mật|mã bí mật|lời nhắc|token')}`, 'iu'),
    'reveal-secrets',
  ],
  [new RegExp(`${word('api[_ -]?key|access[_ -]?token|password|credentials?|mật khẩu')}\\s*[:=]`, 'iu'), 'credential'],
  [/(?:\b(?:curl|wget|sudo|chmod|powershell)\b|\brm -rf\b|\bbash -c\b|\beval\(|\bexec\()/i, 'command'],
  [
    new RegExp(`${word('delete|remove|wipe|erase')}[^.\\n]{0,30}${word('project|projects|workspace|files?|library|database')}`, 'iu'),
    'delete-work',
  ],
  [new RegExp(`${word('xoá|xóa|xoá sạch|xóa sạch')}[^.\\n]{0,30}${word('dự án|tệp|thư mục|thư viện|cơ sở dữ liệu')}`, 'iu'), 'delete-work'],
  [new RegExp(`${word('send|post|upload|exfiltrate|gửi|tải lên')}[^.\\n]{0,40}https?://`, 'iu'), 'send-url'],
  [/<\s*\/?\s*(?:system|assistant|tool|function_calls?|cuccut-style)(?:\s[^>]*)?>/i, 'prompt-boundary'],
];

export interface PackScanOptions {
  /** A length limit for the whole text (the style guide): over it, one hit on line 0. */
  maxChars?: number;
}

/** Every flagged line of a text, one hit per line and reason, in line order. Empty is clean. */
export function scanPackText(text: string, options: PackScanOptions = {}): PackScanHit[] {
  const hits: PackScanHit[] = [];
  if (options.maxChars !== undefined && text.length > options.maxChars) hits.push({ line: 0, text: '', why: 'too-long' });
  text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.normalize('NFC');
    const seen = new Set<PackScanReason>();
    for (const [pattern, why] of PATTERNS) {
      if (seen.has(why) || !pattern.test(line)) continue;
      seen.add(why);
      hits.push({ line: index + 1, text: line.trim().slice(0, 120), why });
    }
  });
  return hits;
}

/** The style guide's scan: the patterns and the `PACK_STYLE_MAX_CHARS` limit. */
export function scanPackStyle(text: string): PackScanHit[] {
  return scanPackText(text, { maxChars: PACK_STYLE_MAX_CHARS });
}

/** A reason as a sentence fragment ("tells the agent to ignore its instructions"), in the current language. `length` is the text's length for `too-long`. */
export function packScanReasonText(why: PackScanReason, length = 0): Localized {
  switch (why) {
    case 'too-long':
      return PP.whyTooLong({ length, limit: PACK_STYLE_MAX_CHARS });
    case 'ignore-instructions':
      return PP.whyIgnoreInstructions();
    case 'change-identity':
      return PP.whyChangeIdentity();
    case 'reveal-secrets':
      return PP.whyRevealSecrets();
    case 'credential':
      return PP.whyCredential();
    case 'command':
      return PP.whyCommand();
    case 'delete-work':
      return PP.whyDeleteWork();
    case 'send-url':
      return PP.whySendUrl();
    case 'prompt-boundary':
      return PP.whyPromptBoundary();
  }
}
