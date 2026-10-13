import type { Route } from '../state/shell-store.ts';
import { S } from '../components/shell-copy.ts';
import { PACKS_COPY } from '../components/settings/packs-copy.ts';
import { isModelCategory, isModelPage, isSettingsSection, modelCategory, MODEL_PAGE_LABEL, SETTINGS_SECTION_INFO, settingsSub } from './settings-nav.ts';

/** Settings deep link in an Agent reply (product design §3.2.2): strictly recognized; unknown addresses must not wrongly jump to general settings. */
export function settingsLink(href: string): { route: Route; trail: string } | null {
  const match = /^\/settings\/([a-z]+)(?:\/([a-z0-9-]+)(?:\/([a-z]+))?)?\/?$/.exec(href);
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
  if (!isSettingsSection(section) || page) return null;
  const label = SETTINGS_SECTION_INFO.find((item) => item.key === section)!.label;
  if (category) {
    // Only Packs has pages: `/settings/packs/import`, `/settings/packs/export`, `/settings/packs/<id>`.
    const sub = settingsSub(section, category);
    if (!sub) return null;
    const subLabel = sub === 'import' ? PACKS_COPY.import.title : sub === 'export' ? PACKS_COPY.export.title : sub;
    return { route: { tab: 'settings', section, sub }, trail: [S.common.settings, label, subLabel].join(' › ') };
  }
  return { route: { tab: 'settings', section }, trail: [S.common.settings, label].join(' › ') };
}
