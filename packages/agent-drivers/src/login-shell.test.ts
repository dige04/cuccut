import { describe, expect, it } from 'vitest';
import { mergeLoginEnv, parseEnv0, resolveLoginShellEnv, stripHostSessionEnv } from './login-shell.ts';

describe('stripHostSessionEnv', () => {
  it('strips host Claude Code session variables by prefix, keeps user-configured and unrelated ones', () => {
    const env = {
      // Host session (part of this leaked through, found in real testing with the Claude Code desktop app)
      CLAUDECODE: '1',
      CLAUDE_CODE_ENTRYPOINT: 'sdk-ts',
      CLAUDE_EFFORT: 'high',
      CLAUDE_CODE_EFFORT_LEVEL: 'max',
      CLAUDE_CODE_ENABLE_ASK_USER_QUESTION_TOOL: 'true',
      CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING: 'true',
      CLAUDE_CODE_USER_EMAIL: 'someone@example.com',
      CLAUDE_CODE_SESSION_ID: 'abc',
      CLAUDE_AGENT_SDK_VERSION: '0.3.288',
      CLAUDE_PID: '123',
      CLAUDE_SOMETHING_NEW: 'x',
      // Set by the user
      CLAUDE_CONFIG_DIR: '/Users/me/.claude-work',
      CLAUDE_CODE_USE_BEDROCK: '1',
      CLAUDE_CODE_USE_VERTEX: '1',
      CLAUDE_CODE_OAUTH_TOKEN: 'token',
      CLAUDE_CODE_GIT_BASH_PATH: 'C:\\Git\\bin\\bash.exe',
      ANTHROPIC_BASE_URL: 'https://gateway.example.com',
      ANTHROPIC_API_KEY: 'key',
      ANTHROPIC_DEFAULT_OPUS_MODEL: 'my-opus',
      // Unrelated
      PATH: '/usr/bin',
      HOME: '/Users/me',
      MY_CLAUDE_HELPER: 'kept',
    };
    const out = stripHostSessionEnv(env);
    for (const key of [
      'CLAUDECODE',
      'CLAUDE_CODE_ENTRYPOINT',
      'CLAUDE_EFFORT',
      'CLAUDE_CODE_EFFORT_LEVEL',
      'CLAUDE_CODE_ENABLE_ASK_USER_QUESTION_TOOL',
      'CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING',
      'CLAUDE_CODE_USER_EMAIL',
      'CLAUDE_CODE_SESSION_ID',
      'CLAUDE_AGENT_SDK_VERSION',
      'CLAUDE_PID',
      'CLAUDE_SOMETHING_NEW',
    ]) {
      expect(out).not.toHaveProperty(key);
    }
    expect(out).toEqual({
      CLAUDE_CONFIG_DIR: '/Users/me/.claude-work',
      CLAUDE_CODE_USE_BEDROCK: '1',
      CLAUDE_CODE_USE_VERTEX: '1',
      CLAUDE_CODE_OAUTH_TOKEN: 'token',
      CLAUDE_CODE_GIT_BASH_PATH: 'C:\\Git\\bin\\bash.exe',
      ANTHROPIC_BASE_URL: 'https://gateway.example.com',
      ANTHROPIC_API_KEY: 'key',
      ANTHROPIC_DEFAULT_OPUS_MODEL: 'my-opus',
      PATH: '/usr/bin',
      HOME: '/Users/me',
      MY_CLAUDE_HELPER: 'kept',
    });
    // Does not modify the object passed in.
    expect(env.CLAUDECODE).toBe('1');
  });
});

describe('login shell environment', () => {
  it('parseEnv0: NUL-separated; values may contain newlines and equals signs; drops the shell\'s own state', () => {
    const text = [
      'GEMINI_API_KEY=k=1',
      'MULTI=a\nb',
      'PWD=/x',
      'OLDPWD=/y',
      'SHLVL=2',
      '_=/usr/bin/env',
      'CUCCUT_LOGIN_SHELL_PROBE=1',
      'bad',
      '',
    ].join('\0');
    expect(parseEnv0(text)).toEqual({ GEMINI_API_KEY: 'k=1', MULTI: 'a\nb' });
  });

  it('mergeLoginEnv: adds variables present only in the login shell; where both have one, the current process wins; PATH is merged with the login shell\'s entries first', () => {
    const merged = mergeLoginEnv(
      { GEMINI_API_KEY: 'from-shell', CUCCUT_HOME: '/shell/home', PATH: '/opt/homebrew/bin:/usr/bin' },
      { CUCCUT_HOME: '/runtime/home', PATH: '/usr/bin:/bin' },
    );
    expect(merged).toEqual({ GEMINI_API_KEY: 'from-shell', CUCCUT_HOME: '/runtime/home', PATH: '/opt/homebrew/bin:/usr/bin:/bin' });
    expect(mergeLoginEnv(null, { PATH: '/bin', A: '1' })).toEqual({ PATH: '/bin', A: '1' });
  });

  it.skipIf(process.platform === 'win32')('resolveLoginShellEnv: really starts a login shell and reads the full environment', async () => {
    const env = await resolveLoginShellEnv();
    expect(env?.HOME).toBeTruthy();
    expect(env?.PATH).toBeTruthy();
    expect(env).not.toHaveProperty('CUCCUT_LOGIN_SHELL_PROBE');
  });
});
