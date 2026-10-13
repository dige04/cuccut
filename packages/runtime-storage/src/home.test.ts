import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { defaultSessionsDir, resolveRuntimeHome } from './home.ts';

const user = path.resolve('/Users/me');

describe('working directory for sessions without a project (architecture design §3.10)', () => {
  it('default Home uses the app data directory provided by the system; same whether or not CUCCUT_HOME is explicitly given (the desktop app always passes it)', () => {
    const implicit = resolveRuntimeHome({}, 'darwin', user);
    const explicit = resolveRuntimeHome({ CUCCUT_HOME: path.join(user, '.cuccut') }, 'darwin', user);
    expect(implicit.scratchDir).toBe(path.join(user, 'Library', 'Application Support', 'CucCut', 'Sessions'));
    expect(explicit.scratchDir).toBe(implicit.scratchDir);
    // The old version kept it in Home: moved at startup.
    expect(implicit.legacyScratchDir).toBe(path.join(user, '.cuccut', 'scratch'));
  });

  it('other Homes (development, testing) go under <home>/scratch; CUCCUT_SESSIONS_DIR takes precedence', () => {
    const dev = resolveRuntimeHome({ CUCCUT_HOME: path.join(user, 'repo', '.dev', 'cuccut-home') }, 'darwin', user);
    expect(dev.scratchDir).toBe(path.join(user, 'repo', '.dev', 'cuccut-home', 'scratch'));
    expect(dev.legacyScratchDir).toBeNull();
    const custom = resolveRuntimeHome({ CUCCUT_SESSIONS_DIR: path.join(user, 'sessions') }, 'darwin', user);
    expect(custom.scratchDir).toBe(path.join(user, 'sessions'));
    expect(custom.legacyScratchDir).toBe(path.join(user, '.cuccut', 'scratch'));
  });

  it('app data directories per platform', () => {
    expect(defaultSessionsDir({ LOCALAPPDATA: 'C:\\Users\\me\\AppData\\Local' }, 'win32', 'C:\\Users\\me')).toBe(
      'C:\\Users\\me\\AppData\\Local\\CucCut\\Sessions',
    );
    expect(defaultSessionsDir({}, 'win32', 'C:\\Users\\me')).toBe('C:\\Users\\me\\AppData\\Local\\CucCut\\Sessions');
    expect(defaultSessionsDir({}, 'linux', '/home/me')).toBe('/home/me/.local/share/CucCut/Sessions');
    expect(defaultSessionsDir({ XDG_DATA_HOME: '/data' }, 'linux', '/home/me')).toBe('/data/CucCut/Sessions');
  });
});

describe('pack paths (pack spec §6)', () => {
  it('keeps templates where they were and puts packs and choices beside them', () => {
    const home = resolveRuntimeHome({ CUCCUT_HOME: path.join(user, 'home') }, 'darwin', user);
    expect(home.templatesDir).toBe(path.join(user, 'home', 'templates'));
    expect(home.packsDir).toBe(path.join(user, 'home', 'packs'));
    expect(home.packChoicesFile).toBe(path.join(user, 'home', 'store', 'pack-choices.json'));
    expect(home.skillsDir).toBe(path.join(user, 'home', 'skills'));
  });
});

describe('publishing paths', () => {
  it('the publishing store is under store/ and pinned exports are outside artifacts/', () => {
    const home = resolveRuntimeHome({ CUCCUT_HOME: path.join(user, '.cuccut') }, 'darwin', user);
    expect(home.publishingFile).toBe(path.join(user, '.cuccut', 'store', 'publishing.json'));
    expect(home.publishingDir).toBe(path.join(user, '.cuccut', 'publishing'));
    expect(path.relative(home.artifactsDir, home.publishingDir).startsWith('..')).toBe(true);
  });
});
