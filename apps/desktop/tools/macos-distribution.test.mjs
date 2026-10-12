import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { archiveLocalMac } from './macos-distribution.mjs';

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
