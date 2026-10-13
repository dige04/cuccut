import { describe, expect, it } from 'vitest';
import { sourceAllowed } from './source-gate.ts';

describe('source gate', () => {
  it.each([
    '127.0.0.1',
    '127.255.255.254',
    '10.0.0.1',
    '10.255.255.255',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.0.1',
    '192.168.255.255',
    '169.254.1.2',
    '::1',
    '0:0:0:0:0:0:0:1',
    '::ffff:127.0.0.1',
    '::ffff:192.168.1.20',
    '::FFFF:10.1.2.3',
    '::ffff:c0a8:0114',
    '0:0:0:0:0:ffff:ac10:0001',
    'fe80::1',
    'fe80::1%en0',
    'FE80::abcd:1234',
    'febf::1',
    'fc00::1',
    'fd12:3456:789a::1',
  ])('allow %s', (address) => {
    expect(sourceAllowed(address)).toBe(true);
  });

  it.each([
    '8.8.8.8',
    '1.1.1.1',
    '172.15.255.255',
    '172.32.0.1',
    '192.169.0.1',
    '169.253.0.1',
    '11.0.0.1',
    '0.0.0.0',
    '255.255.255.255',
    '100.64.0.1',
    '::',
    '::2',
    '::ffff:8.8.8.8',
    '::ffff:0808:0808',
    // IPv4-compatible (deprecated) is not a mapping: it is not judged as IPv4.
    '::127.0.0.1',
    // An IPv4 address embedded in a NAT64 prefix is not allowed either.
    '64:ff9b::192.168.1.1',
    'fec0::1',
    'ff02::1',
    '2001:db8::1',
    '2606:4700::1111',
    'fe00::1',
    'fbff::1',
  ])('reject %s', (address) => {
    expect(sourceAllowed(address)).toBe(false);
  });

  it.each([undefined, null, '', 'localhost', 'not-an-ip', '192.168.1', '192.168.1.1.1', '::ffff:192.168.1.256', 'fe80::1::2', '%en0'])(
    'missing or invalid address %s is not allowed',
    (address) => {
      expect(sourceAllowed(address)).toBe(false);
    },
  );

  it('with allowAnySource on, any address is allowed (including missing)', () => {
    expect(sourceAllowed('8.8.8.8', true)).toBe(true);
    expect(sourceAllowed('2001:db8::1', true)).toBe(true);
    expect(sourceAllowed(undefined, true)).toBe(true);
  });
});
