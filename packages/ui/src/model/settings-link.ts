import type { Route } from '../state/shell-store.ts';
import { S } from '../components/shell-copy.ts';
import { isModelCategory, isModelPage, isSettingsSection, modelCategory, MODEL_PAGE_LABEL, SETTINGS_SECTION_INFO } from './settings-nav.ts';

/** Settings deep link in an Agent reply (product design §3.2.2): strictly recognized; unknown addresses must not wrongly jump to general settings. */
export function settingsLink(href: string): { route: Route; trail: string } | null {
  const match = /^\/settings\/([a-z]+)(?:\/([a-z]+)(?:\/([a-z]+))?)?\/?$/.exec(href);
  if (!match) return null;
  const [, section, category, page] = match;
  if (section === 'models') {
    if (!isModelCategory(category)) return null;
    const info = modelCategory(category);
    if (page && (!isModelPage(page) || !info.pages.includes(page))) return null;
    const route: Route = page && isModelPage(page) ? { tab: 'models', category, page } : { tab: 'models', category };
    const trail = [S.common.settings, S.settingsPage.models, info.label, ...(page && isModelPage(page) ? [MODEL_PAGE_LABEL[page]] : [])];
    return { route, trail: trail.join(' › ') };
  }
  if (!isSettingsSection(section) || category) return null;
  return {
    route: { tab: 'settings', section },
    trail: [S.common.settings, SETTINGS_SECTION_INFO.find((item) => item.key === section)!.label].join(' › '),
  };
}
