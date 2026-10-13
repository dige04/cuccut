import dns from 'node:dns';
import net from 'node:net';
import { RpcError, type Localized } from '@cuccut/protocol';
import { JobsLinkUrl } from '@cuccut/protocol/messages/jobs/link-url.ts';

/**
 * Link checks and redaction for link import (architecture design §7.9).
 *
 * Checks: only `http(s)://` is accepted; links with a username or password are not accepted; the host must not be a local, link-local or intranet address (literal IPs, `localhost`, local names such as `.local`, single-label host names with no dot). The host name is also resolved again at submission, and if any address falls in these ranges, it is rejected.
 * What these checks cannot cover (DNS changes between the download tool's own resolution, followed redirects, and the interface and CDN addresses that the extractor requests separately) is recorded in §7.9.
 *
 * Redaction: only the normalized link appears in storage and logs. The fragment is removed; of the query parameters only those that identify the content are kept (`v`, `list`, `index`, `t`, `start`, `p`, `page`, `id`, `bvid`, `aid`); everything else (tracking parameters, signatures, tokens) is removed; the path is kept as it is. When normalization changed the link, the original link exists only in one 0600 file in Runtime Home (`LinkSources`), referenced by digest, and it is deleted when the pipeline completes.
 */

/** The query parameters kept after redaction. */
export const KEPT_QUERY_KEYS: ReadonlySet<string> = new Set(['v', 'list', 'index', 't', 'start', 'p', 'page', 'id', 'bvid', 'aid']);

const LOCAL_SUFFIXES = ['.localhost', '.local', '.internal', '.lan', '.home.arpa', '.intranet', '.corp'];

export interface CheckedLink {
  /** The original link (only in memory and in `LinkSources`). */
  raw: string;
  /** The link after normalization and redaction: used for storage, logs and the source. */
  canonical: string;
  host: string;
}

function linkError(code: string, message: Localized): RpcError {
  return new RpcError('invalid-request', message, { code });
}

/** Validates and normalizes a link. When it is not acceptable, `invalid-request` (`LINK_UNSUPPORTED`, `LINK_PRIVATE_ADDRESS`). */
export function checkLink(input: string): CheckedLink {
  const raw = input.trim();
  if (raw.startsWith('-')) throw linkError('LINK_UNSUPPORTED', JobsLinkUrl.startsWithDash());
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw linkError('LINK_UNSUPPORTED', JobsLinkUrl.invalidLink());
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw linkError('LINK_UNSUPPORTED', JobsLinkUrl.httpOnly());
  if (url.username || url.password) throw linkError('LINK_UNSUPPORTED', JobsLinkUrl.credentials());
  const host = hostOf(url);
  if (!host) throw linkError('LINK_UNSUPPORTED', JobsLinkUrl.noHost());
  if (isPrivateHost(host)) throw linkError('LINK_PRIVATE_ADDRESS', JobsLinkUrl.privateAddress());
  return { raw, canonical: redactUrl(url), host };
}

/** The host in a URL: IPv6 brackets are removed; a domain name has its trailing dot removed and is lowercased. */
function hostOf(url: URL): string {
  const host = url.hostname.toLowerCase();
  if (host.startsWith('[') && host.endsWith(']')) return host.slice(1, -1);
  return host.replace(/\.$/, '');
}

/** Normalization: removes credentials and the fragment, and keeps only the query parameters that identify the content (sorted by name). */
export function redactUrl(input: URL | string): string {
  let url: URL;
  try {
    url = typeof input === 'string' ? new URL(input) : new URL(input.href);
  } catch {
    return JobsLinkUrl.redacted().text;
  }
  url.username = '';
  url.password = '';
  url.hash = '';
  const kept = [...url.searchParams.entries()].filter(([key]) => KEPT_QUERY_KEYS.has(key));
  kept.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  url.search = kept.length > 0 ? `?${new URLSearchParams(kept).toString()}` : '';
  return url.href;
}

/** Every http(s) link in a piece of text (a tool's error message) is replaced with its redacted form. */
export function redactUrlsInText(text: string): string {
  return text.replace(/https?:\/\/[^\s'"<>]+/gi, (match) => redactUrl(match));
}

/** The host name itself points to this machine or the intranet: literal private addresses, `localhost`, local suffixes, single-label names with no dot. */
export function isPrivateHost(host: string): boolean {
  if (net.isIP(host)) return isPrivateAddress(host);
  if (host === 'localhost' || LOCAL_SUFFIXES.some((suffix) => host.endsWith(suffix))) return true;
  return !host.includes('.');
}

/** Local, link-local, private, shared, reserved and multicast addresses (IPv4 and IPv6, including the IPv4-mapped and NAT64 forms). */
export function isPrivateAddress(address: string): boolean {
  const version = net.isIP(address);
  if (version === 4) return isPrivateV4(address);
  if (version !== 6) return true;
  const lower = address.toLowerCase();
  const mapped = /^(?:::ffff:|64:ff9b::)(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
  if (mapped) return isPrivateV4(mapped[1]!);
  const words = expandV6(lower);
  if (!words) return true;
  if (words.every((w) => w === 0)) return true; // ::
  if (words.slice(0, 7).every((w) => w === 0) && words[7] === 1) return true; // ::1
  if (words[0]! === 0 && words[1]! === 0 && words[2]! === 0 && words[3]! === 0 && words[4]! === 0 && words[5]! === 0xffff) {
    return isPrivateV4(`${words[6]! >> 8}.${words[6]! & 255}.${words[7]! >> 8}.${words[7]! & 255}`);
  }
  if (words[0]! === 0x64 && words[1]! === 0xff9b) {
    return isPrivateV4(`${words[6]! >> 8}.${words[6]! & 255}.${words[7]! >> 8}.${words[7]! & 255}`);
  }
  const first = words[0]!;
  if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((first & 0xffc0) === 0xfec0) return true; // fec0::/10 site-local (deprecated)
  if ((first & 0xff00) === 0xff00) return true; // multicast
  if (first === 0x2001 && words[1]! === 0x0db8) return true; // documentation
  return false;
}

function isPrivateV4(address: string): boolean {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return true;
  const [a, b, c] = parts as [number, number, number, number];
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
}

function expandV6(address: string): number[] | null {
  const zone = address.indexOf('%');
  const bare = zone >= 0 ? address.slice(0, zone) : address;
  const [head, tail, extra] = bare.split('::');
  if (extra !== undefined) return null;
  const parse = (part: string | undefined) => (part ? part.split(':').map((h) => Number.parseInt(h, 16)) : []);
  const front = parse(head);
  const back = tail === undefined ? [] : parse(tail);
  const fill = tail === undefined ? 0 : 8 - front.length - back.length;
  const words = [...front, ...Array<number>(Math.max(0, fill)).fill(0), ...back];
  if (words.length !== 8 || words.some((w) => !Number.isInteger(w) || w < 0 || w > 0xffff)) return null;
  return words;
}

/** Resolves a host name to all of its addresses (uses the system resolver by default). */
export type HostLookup = (host: string) => Promise<string[]>;

export const systemLookup: HostLookup = async (host) =>
  (await dns.promises.lookup(host, { all: true, verbatim: true })).map((a) => a.address);

/**
 * Resolves the host name at submission: if any address is local or intranet, it is rejected (`LINK_PRIVATE_ADDRESS`); if it cannot be resolved, it is `LINK_NETWORK_ERROR`.
 * Literal IPs are no longer resolved.
 */
export async function checkResolvedHost(host: string, lookup: HostLookup): Promise<void> {
  if (net.isIP(host)) return;
  let addresses: string[];
  try {
    addresses = await lookup(host);
  } catch {
    throw new RpcError('conflict', JobsLinkUrl.unresolvable({ host }), { code: 'LINK_NETWORK_ERROR' });
  }
  if (addresses.length === 0) throw new RpcError('conflict', JobsLinkUrl.noAddresses({ host }), { code: 'LINK_NETWORK_ERROR' });
  if (addresses.some(isPrivateAddress)) {
    throw linkError('LINK_PRIVATE_ADDRESS', JobsLinkUrl.resolvesPrivate({ host }));
  }
}
