import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { archiveLocalMac, createDmg } from './macos-distribution.mjs';

test('local archives verify the extracted bundle and disk image and record checksums without notarization', async () => {
  const output = mkdtempSync(path.join(tmpdir(), 'cuccut-local-mac-test-'));
  const calls = [];
  const info = { CFBundleIdentifier: 'com.cuccut.app', CFBundleShortVersionString: '3.3.0', CFBundleVersion: '0' };
  const run = (command, args) => {
    calls.push({ command, args });
    if (command === 'plutil') return JSON.stringify(info);
    if (command === 'ditto' && args[0] === '-c') writeFileSync(args.at(-1), 'zip fixture');
    if (command === 'hdiutil' && args[0] === 'create') writeFileSync(args.at(-1), 'dmg fixture');
    return '';
  };
  try {
    const report = await archiveLocalMac({ app: path.join(output, 'mac/CucCut.app'), output,
      stem: 'CucCut-3.3.0-x86_64-apple-darwin-local', version: '3.3.0', build: 0, appId: 'com.cuccut.app' }, run);
    assert.equal(report.local, true);
    assert.equal(report.notarized, false);
    assert.equal(report.signature, 'ad-hoc');
    const verified = calls.filter((c) => c.command === 'codesign');
    assert.equal(verified.length, 2);
    assert.equal(verified[1].args.at(-1), report.verifiedApp);
    assert.ok(calls.some((c) => c.command === 'hdiutil' && c.args[0] === 'verify'));
    assert.ok(!calls.some((c) => c.command === 'xcrun' || c.command === 'spctl'));
    for (const item of [report.portable, report.installer]) {
      assert.match(item.sha256, /^[a-f0-9]{64}$/);
      assert.equal(item.size, readFileSync(path.join(output, item.file)).length);
      assert.equal(readFileSync(path.join(output, `${item.file}.sha256`), 'utf8'), `${item.sha256}  ${item.file}\n`);
    }
  } finally { rmSync(output, { recursive: true, force: true }); }
});

test('local archives reject a mismatched bundle before making an archive', async () => {
  const output = mkdtempSync(path.join(tmpdir(), 'cuccut-local-mac-reject-'));
  try {
    await assert.rejects(archiveLocalMac({ app: '/fixture/CucCut.app', output, stem: 'fixture',
      version: '3.3.0', build: 0, appId: 'com.cuccut.app' }, (command) => {
      assert.equal(command, 'plutil');
      return JSON.stringify({ CFBundleIdentifier: 'another.app' });
    }), /bundle ID, version or build differs/);
  } finally { rmSync(output, { recursive: true, force: true }); }
});

test('disk image creation retries a busy resource and fails at once on other errors', () => {
  let calls = 0;
  const busyTwice = () => { if (++calls < 3) throw new Error('hdiutil (1): hdiutil: create failed - Resource busy'); return 'ok'; };
  assert.equal(createDmg(['x.dmg'], busyTwice, { pauseMs: 1 }), 'ok');
  assert.equal(calls, 3);
  calls = 0;
  const broken = () => { calls++; throw new Error('hdiutil (1): create failed - No space left on device'); };
  assert.throws(() => createDmg(['x.dmg'], broken, { pauseMs: 1 }), /No space left/);
  assert.equal(calls, 1);
  calls = 0;
  const alwaysBusy = () => { calls++; throw new Error('Resource busy'); };
  assert.throws(() => createDmg(['x.dmg'], alwaysBusy, { attempts: 3, pauseMs: 1 }), /Resource busy/);
  assert.equal(calls, 3);
});
