import { useEffect, useRef, useState, type RefObject } from 'react';
import { Button, SearchField, type TextFieldRef } from '@react-spectrum/s2';
import HelpCircle from '@react-spectrum/s2/icons/HelpCircle';
import InfoCircle from '@react-spectrum/s2/icons/InfoCircle';
import ListBulleted from '@react-spectrum/s2/icons/ListBulleted';
import Play from '@react-spectrum/s2/icons/Play';
import Search from '@react-spectrum/s2/icons/Search';
import Transcript from '@react-spectrum/s2/icons/Transcript';
import { iconStyle, style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { Button as RACButton } from 'react-aria-components';
import { XIcon } from 'lucide-react';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { Dialog, DialogContent } from '../../cc/ui/dialog.tsx';
import { Button as CcButton } from '../../cc/ui/button.tsx';
import { HELP_COPY as COPY } from '../../copy.ts';
import { HELP_GUIDES, helpCta, searchGuides, type HelpCta, type HelpGuide } from '../../model/help-guides.ts';
import { useEditor } from '../../state/editor-store.ts';
import { useHelp } from '../../state/help-store.ts';
import { defaultRoute, routeVideo, useShell } from '../../state/shell-store.ts';
import { openHome } from '../start/open-home.ts';
import { EDGE, FOOT, INSET, NAV_FILL } from './dialog-fills.ts';
import { HelpArticle } from './help-article.tsx';
import { GuideList, detail, intro, kbd, sectionHeading, sectionTitle } from './help-guide-list.tsx';
import { HelpKeys } from './help-keys.tsx';
import { HelpStart } from './help-start.tsx';

type Section = 'start' | 'guide' | 'keys' | 'faq';

const SECTIONS: readonly { id: Section; icon: typeof Play }[] = [
  { id: 'start', icon: Play },
  { id: 'guide', icon: Transcript },
  { id: 'keys', icon: ListBulleted },
  { id: 'faq', icon: HelpCircle },
];

/**
 * 帮助中心（原型 help-center.jsx / help-center.css）：挂在外壳一处，经 useHelp 开合。内容是内置的离线指南
 * （model/help-guides.ts），不连网。
 *
 * The surface is agentcut's dialog (cc/ui/dialog.tsx): near-black translucent material with a fine lit edge, 20px
 * corners and a blurred dim backdrop; the footer sits on a darker strip. Esc, the close button and a click on the
 * backdrop close it.
 */
export function HelpCenter({ platform }: { platform: string }) {
  const isOpen = useHelp((s) => s.isOpen);
  const session = useHelp((s) => s.session);
  const close = useHelp((s) => s.close);
  const searchRef = useRef<TextFieldRef>(null);

  // 焦点归还：S2 弹层（RAC FocusScope）关闭时自己把焦点还给打开前的元素；它没还成（比如来源在弹层开着时被换掉了）
  // 而且来源还在页面上时，这里补一次。
  useEffect(() => {
    if (isOpen) return;
    const origin = useHelp.getState().origin;
    if (!origin) return;
    const timer = window.setTimeout(() => {
      const active = document.activeElement;
      if (origin.isConnected && (active === null || active === document.body)) origin.focus();
    }, 300);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  // 每次打开按打开次数换 key 重新开始（上一次的分节、搜索与文章不带过来）。
  return (
    <Dialog open={isOpen} onOpenChange={(open) => (open ? undefined : close())}>
      <DialogContent
        showCloseButton={false}
        // Land in the search field, as the Spectrum dialog did; fall back to the default (first tabbable) otherwise.
        initialFocus={() => searchRef.current?.getInputElement() ?? true}
        className="flex h-[min(716px,calc(100dvh-48px))] w-[min(860px,calc(100%-2rem))] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(860px,calc(100%-2rem))]">
        <HelpDialog key={session} mac={platform === 'darwin'} searchRef={searchRef} onClose={close} />
      </DialogContent>
    </Dialog>
  );
}

function HelpDialog({ mac: macDefault, searchRef, onClose }: { mac: boolean; searchRef: RefObject<TextFieldRef | null>; onClose(): void }) {
  const content = useRef<HTMLDivElement>(null);
  const [section, setSection] = useState<Section>('start');
  const [query, setQuery] = useState('');
  const [article, setArticle] = useState<HelpGuide | null>(null);
  const [mac, setMac] = useState(macDefault);
  const inVideo = useShell((s) => routeVideo(s.route) !== undefined);
  const searching = query.trim() !== '';

  useEffect(() => {
    if (content.current) content.current.scrollTop = 0;
  }, [article, section, query]);

  const choose = (id: Section) => {
    setSection(id);
    setQuery('');
    setArticle(null);
  };
  const search = (value: string) => {
    setQuery(value);
    setArticle(null);
  };

  // 去做（原型 `navigate`）：先关帮助，再去对应的地方。只做这里真能到的（见 model/help-guides 的 helpCta）；
  // `close` 只关帮助，回到视频。
  const act = (cta: HelpCta) => {
    onClose();
    const shell = useShell.getState();
    if (cta.target === 'new') openHome(shell.route.tab === 'home' ? shell.route.projectId : null);
    else if (cta.target === 'space') shell.go(defaultRoute('space'));
    else if (cta.target === 'agent') shell.go({ tab: 'settings', section: 'agent' });
    else if (cta.target === 'models') shell.go({ tab: 'models', category: 'asr', page: 'local' });
    else if (cta.target === 'subtitle') useEditor.getState().showPanel('subtitle');
  };

  const listing = searching ? searchGuides(query) : HELP_GUIDES.filter((guide) => guide.group === section);
  const sectionLabel = COPY.sections[section];

  return (
    <div className={shell}>
      <header className={`${header} ${EDGE}`}>
        <span className={brand}>
          <HelpCircle />
          <DialogPrimitive.Title className={heading}>{COPY.title}</DialogPrimitive.Title>
        </span>
        <span className={headerNote}>{COPY.subtitle}</span>
        {/* The dialog is portalled outside any `data-cc` subtree; the cc button needs the scoped preflight. */}
        <span data-cc="" className="contents">
          <CcButton variant="ghost" size="icon-sm" aria-label={COPY.close} title={COPY.close} onClick={onClose}>
            <XIcon aria-hidden />
          </CcButton>
        </span>
      </header>
      <div className={layout}>
        <nav className={`${nav} ${EDGE} ${INSET}`} aria-label={COPY.navLabel}>
          <div className={navTitle}>{COPY.navTitle}</div>
          {SECTIONS.map(({ id, icon: Icon }) => {
            const current = !searching && section === id;
            return (
              <RACButton
                key={id}
                className={(state) => `${navRow({ ...state, isCurrent: current })} ${NAV_FILL}`}
                aria-current={current ? 'page' : undefined}
                onPress={() => choose(id)}>
                <Icon styles={navIcon} />
                {COPY.sections[id]}
              </RACButton>
            );
          })}
          <div className={navNote}>
            <InfoCircle styles={navIcon} />
            <span>
              {COPY.navNote[0]}
              <br />
              {COPY.navNote[1]}
            </span>
          </div>
        </nav>
        <div className={main}>
          <div className={searchBar}>
            <SearchField
              ref={searchRef}
              size="L"
              aria-label={COPY.searchLabel}
              placeholder={COPY.searchPlaceholder}
              value={query}
              onChange={search}
              onClear={() => search('')}
              styles={searchField}
            />
          </div>
          <div ref={content} className={`${body} cc-scroll`}>
            {article ? (
              <HelpArticle
                guide={article}
                backLabel={searching ? COPY.backToResults : COPY.backTo(sectionLabel)}
                cta={helpCta(article, inVideo)}
                onBack={() => setArticle(null)}
                onAction={() => act(helpCta(article, inVideo))}
                onRead={setArticle}
              />
            ) : searching ? (
              <>
                <div className={sectionHeading}>
                  <h2 className={sectionTitle}>{COPY.results}</h2>
                  <span role="status" className={detail}>
                    {COPY.found(listing.length)}
                  </span>
                </div>
                {listing.length ? (
                  <GuideList guides={listing} onRead={setArticle} />
                ) : (
                  <div className={empty}>
                    <Search styles={emptyIcon} data-cc-icons="own" />
                    <h3 className={emptyTitle}>{COPY.emptyTitle}</h3>
                    <p className={emptyBody}>{COPY.emptyBody}</p>
                    <Button variant="secondary" onPress={() => choose('start')}>
                      {COPY.emptyAction}
                    </Button>
                  </div>
                )}
              </>
            ) : section === 'start' ? (
              <HelpStart onRead={setArticle} onChoose={choose} />
            ) : section === 'keys' ? (
              <HelpKeys mac={mac} onPlatform={setMac} />
            ) : (
              <>
                <div className={sectionHeading}>
                  <h2 className={sectionTitle}>{section === 'guide' ? COPY.guideTitle : COPY.faqTitle}</h2>
                </div>
                <p className={intro}>{section === 'guide' ? COPY.guideIntro : COPY.faqIntro}</p>
                <GuideList guides={listing} onRead={setArticle} />
              </>
            )}
          </div>
          <footer className={`${footer} ${FOOT}`}>
            <span className={detail}>{COPY.footer}</span>
            <span className={spacer} />
            <kbd className={kbd}>Esc</kbd>
            <span className={detail}>{COPY.close}</span>
          </footer>
        </div>
      </div>
    </div>
  );
}

/** 原型 .help-center：填满对话框（高 min(716px, 视口 − 48px)）；底色是对话框自己的材质，这里不再铺一层。 */
const shell = style({
  display: 'flex',
  flexDirection: 'column',
  flexGrow: 1,
  minHeight: 0,
  fontFamily: 'sans',
  color: 'gray-800',
});
const header = style({
  display: 'flex',
  alignItems: 'center',
  gap: 16,
  flexShrink: 0,
  height: 64,
  paddingStart: 24,
  paddingEnd: 20,
  borderWidth: 0,
  borderBottomWidth: 1,
  borderStyle: 'solid',
});
const brand = style({ display: 'flex', alignItems: 'center', gap: 8, flexGrow: 1, minWidth: 0, color: 'gray-900', '--iconPrimary': { type: 'fill', value: 'currentColor' } });
// agentcut dialog titles are medium weight (cc `DialogTitle`).
const heading = style({ margin: 0, fontSize: 'ui-lg', fontWeight: 'medium', color: 'gray-900' });
const headerNote = style({ font: 'ui-sm', color: 'gray-600', whiteSpace: 'nowrap' });
const layout = style({ display: 'flex', flexGrow: 1, minHeight: 0 });
const nav = style({
  display: 'flex',
  flexDirection: 'column',
  flexShrink: 0,
  boxSizing: 'border-box',
  width: { default: 180, '@media (max-width: 760px)': 140 },
  paddingTop: { default: 24, '@media (max-width: 760px)': 20 },
  paddingBottom: { default: 16, '@media (max-width: 760px)': 20 },
  paddingX: { default: 12, '@media (max-width: 760px)': 8 },
  // Fill and edge come from dialog-fills.ts: a thin tint on the dialog material, never another layer of glass.
  borderWidth: 0,
  borderEndWidth: 1,
  borderStyle: 'solid',
});
/** 原型 .t-section：11px 粗体灰字。 */
const navTitle = style({ marginX: 12, marginBottom: 12, font: 'ui-xs', fontWeight: 'bold', color: 'gray-600' });
/** 原型 .siderow, in agentcut's rail shape: 12px corners (a two-line label stays a card, not a lozenge); fills in dialog-fills.ts. */
const navRow = style<{ isHovered: boolean; isFocusVisible: boolean; isCurrent: boolean }>({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexShrink: 0,
  boxSizing: 'border-box',
  width: 'full',
  marginY: 2,
  paddingX: 12,
  paddingY: 8,
  borderWidth: 0,
  borderRadius: '[12px]',
  font: 'ui',
  fontWeight: { default: 'normal', isCurrent: 'medium' },
  color: { default: 'gray-800', isCurrent: 'gray-900' },
  '--iconPrimary': { type: 'fill', value: 'currentColor' },
  textAlign: 'start',
  cursor: 'pointer',
  outlineStyle: { default: 'none', isFocusVisible: 'solid' },
  outlineColor: 'focus-ring',
  outlineWidth: 2,
  transition: 'default',
});
const navIcon = iconStyle({ size: 'S' });
const navNote = style({
  display: { default: 'flex', '@media (max-width: 760px)': 'none' },
  alignItems: 'start',
  gap: 8,
  marginTop: 'auto',
  marginX: 8,
  font: 'ui-xs',
  lineHeight: '[1.6]',
  color: 'gray-600',
  '--iconPrimary': { type: 'fill', value: 'currentColor' },
});
const main = style({ display: 'flex', flexDirection: 'column', flexGrow: 1, minWidth: 0 });
const searchBar = style({
  flexShrink: 0,
  paddingTop: { default: 20, '@media (max-width: 760px)': 16 },
  paddingX: { default: 28, '@media (max-width: 760px)': 20 },
});
const searchField = style({ width: 'full' });
const body = style({
  flexGrow: 1,
  minHeight: 0,
  overflowY: 'auto',
  paddingY: { default: 24, '@media (max-width: 760px)': 20 },
  paddingX: { default: 28, '@media (max-width: 760px)': 20 },
});
const empty = style({ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, paddingY: 64, paddingX: 20, textAlign: 'center' });
const emptyIcon = iconStyle({ size: 'XL', color: 'gray' });
const emptyTitle = style({ margin: 0, font: 'ui', fontWeight: 'bold', color: 'gray-900' });
const emptyBody = style({ maxWidth: 340, margin: 0, font: 'ui-sm', lineHeight: '[1.6]', color: 'gray-700' });
const footer = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexShrink: 0,
  paddingY: 12,
  paddingX: 28,
  borderWidth: 0,
  borderTopWidth: 1,
  borderStyle: 'solid',
  // agentcut dialog footer: a darker strip under a fine line (dialog-fills.ts `FOOT`).
});
const spacer = style({ flexGrow: 1 });
