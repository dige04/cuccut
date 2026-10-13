import { RpcError, SETTING_DESCRIPTIONS, type SettingsSnapshot } from '@cuccut/protocol';
import { defineNoun } from './context.ts';
import { M } from './settings-copy.ts';
import { formatSettingLine, formatSettingValue, formatSettings, parseSettingsArgs } from './settings-output.ts';

/** `cuccut settings`: reads and writes the preferences held by the Runtime through `settings.get` / `settings.set` (Architecture design §5.10). */
export const settings = defineNoun({
  name: 'settings',
  get usage() {
    return M.help;
  },
  options: {},
  async run(ctx) {
    const command = ctx.parse(() => parseSettingsArgs(ctx.args));
    if (command.kind === 'list') {
      // When `keys` is not given, all keys are shown.
      const view = (await ctx.client.request('settings.get', {})) as SettingsSnapshot;
      return ctx.done(view, formatSettings(view));
    }
    if (command.kind === 'get') {
      const view = await ctx.client.request('settings.get', { keys: [command.key] });
      return ctx.done({ key: command.key, value: view.settings[command.key] }, [formatSettingValue(view.settings[command.key])]);
    }
    const value = command.kind === 'set' ? command.value : null;
    const view = await ctx.client.request('settings.set', { values: { [command.key]: value } }).catch((error: unknown) => {
      // Keys are already checked locally. If a value is rejected, it does not meet the rules, so give that key's explanation rather than a generic "invalid argument".
      if (error instanceof RpcError && error.code === 'invalid-request') {
        throw ctx.usageError(M.settingRejected(command.key, formatSettingValue(value), SETTING_DESCRIPTIONS[command.key]));
      }
      throw error;
    });
    return ctx.done(view, [formatSettingLine(view, command.key)]);
  },
});
