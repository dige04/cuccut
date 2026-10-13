import net from 'node:net';

/**
 * Source gate (node protocol spec §2): looks only at the peer address of the socket, never reads any forwarding header.
 *
 * Allowed by default: loopback (`127/8`, `::1`), private ranges (`10/8`, `172.16/12`, `192.168/16`), link-local (`169.254/16`, `fe80::/10`), unique local (`fc00::/7`). `::ffff:a.b.c.d` (IPv4-mapped) is judged by the IPv4 address inside it. Everything else is not allowed; the check is skipped when `allowAnySource` is on.
 * An address that is missing or not a valid IP (the socket has already disconnected) is not allowed.
 */
export function sourceAllowed(remoteAddress: string | undefined | null, allowAnySource = false): boolean {
  if (allowAnySource) return true;
  if (!remoteAddress) return false;
  // Link-local addresses may carry a scope: `fe80::1%en0`.
  const address = remoteAddress.split('%')[0]!;
  const family = net.isIP(address);
  if (family === 4) return ipv4Allowed(address);
  if (family === 6) return ipv6Allowed(address);
  return false;
}

function ipv4Allowed(address: string): boolean {
  const octets = address.split('.').map(Number);
  const [a, b] = octets as [number, number, number, number];
  if (a === 127) return true; // loopback 127/8
  if (a === 10) return true; // 10/8
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12
  if (a === 192 && b === 168) return true; // 192.168/16
  if (a === 169 && b === 254) return true; // link-local 169.254/16
  return false;
}

function ipv6Allowed(address: string): boolean {
  const groups = expandIpv6(address);
  if (!groups) return false;
  // loopback ::1
  if (groups.slice(0, 7).every((g) => g === 0) && groups[7] === 1) return true;
  // IPv4-mapped ::ffff:a.b.c.d
  if (groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff) {
    const hi = groups[6]!;
    const lo = groups[7]!;
    return ipv4Allowed(`${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`);
  }
  const first = groups[0]!;
  if ((first & 0xffc0) === 0xfe80) return true; // link-local fe80::/10
  if ((first & 0xfe00) === 0xfc00) return true; // unique local fc00::/7
  return false;
}

/** Expands valid IPv6 text into eight 16-bit integers; the last part may be a dotted-decimal IPv4. */
function expandIpv6(address: string): number[] | null {
  let text = address.toLowerCase();
  const lastColon = text.lastIndexOf(':');
  const last = text.slice(lastColon + 1);
  if (last.includes('.')) {
    // A dotted-decimal IPv4 at the end is converted into two groups of hex: `::ffff:1.2.3.4` → `::ffff:102:304`.
    if (net.isIP(last) !== 4) return null;
    const [a, b, c, d] = last.split('.').map(Number) as [number, number, number, number];
    text = `${text.slice(0, lastColon + 1)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const parse = (part: string): number[] =>
    part === '' ? [] : part.split(':').map((g) => (/^[0-9a-f]{1,4}$/.test(g) ? parseInt(g, 16) : NaN));
  let groups: number[];
  if (text.includes('::')) {
    const halves = text.split('::');
    if (halves.length !== 2) return null;
    const left = parse(halves[0]!);
    const right = parse(halves[1]!);
    const missing = 8 - left.length - right.length;
    if (missing < 1) return null;
    groups = [...left, ...new Array<number>(missing).fill(0), ...right];
  } else {
    groups = parse(text);
  }
  if (groups.length !== 8 || groups.some((g) => !Number.isInteger(g) || g < 0 || g > 0xffff)) return null;
  return groups;
}
