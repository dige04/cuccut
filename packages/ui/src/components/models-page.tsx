import { useEffect, type ReactNode } from 'react';
import { Cloud, Laptop, Mic, type LucideIcon } from 'lucide-react';
import { SectionHeader } from '../cc/components/page-chrome.tsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../cc/ui/tabs.tsx';
import { resolveModelsRoute } from '../model/models-route.ts';
import {
  MODEL_PAGE_LABEL,
  modelCategory,
  ONLY_PAGE_NOTE,
  type ModelCategory,
  type ModelPage,
} from '../model/settings-nav.ts';
import { useShell } from '../state/shell-store.ts';
import { CloudModels } from './models/cloud-models.tsx';
import { LocalModels } from './models/local-models.tsx';
import { ModelsDirCard } from './models/models-dir-card.tsx';
import { MODELS_PAGE_COPY } from './models/models-copy.ts';
import { MyVoices } from './models/my-voices.tsx';

/** Page tab icons: on this computer, in the cloud, my voices. */
const PAGE_ICON: Record<ModelPage, LucideIcon> = { local: Laptop, cloud: Cloud, voices: Mic };

/** Model settings in Settings (product design §2.1, §7.6), sharing the settings navigation and scroll container.
 * The model category remembers the last page of Local / Cloud / My voice; switching tabs does not add history entries.
 */
export function ModelSettings({ category, page: requested }: { category: ModelCategory; page?: ModelPage }) {
  const replace = useShell((s) => s.replace);
  const last = useShell((s) => s.modelPages);
  const setModelPage = useShell((s) => s.setModelPage);
  const location = resolveModelsRoute(category, requested, last);
  const info = modelCategory(category);

  useEffect(() => {
    setModelPage(location.category, location.page);
  }, [setModelPage, location.category, location.page]);

  const body = (p: ModelPage): ReactNode =>
    p === 'local' ? (
      <>
        <ModelsDirCard />
        <LocalModels category={category} />
      </>
    ) : p === 'cloud' ? (
      <CloudModels category={category} />
    ) : (
      <MyVoices />
    );
  const firstPage = info.pages[0]!;

  if (info.pages.length < 2) {
    return (
      <>
        <SectionHeader title={info.label} blurb={info.description} />
        {ONLY_PAGE_NOTE[firstPage] ? <p className="m-0 -mt-2 text-xs text-muted-foreground">{ONLY_PAGE_NOTE[firstPage]}</p> : null}
        <div className="min-w-0">{body(firstPage)}</div>
      </>
    );
  }

  // Local / cloud / my voices as a capsule segmented control beside the heading (agentcut tabs); switching replaces
  // the route rather than adding history.
  return (
    <Tabs
      value={location.page}
      onValueChange={(key) => {
        if (key !== location.page) replace({ tab: 'models', category, page: key as ModelPage });
      }}
      className="flex min-w-0 flex-col gap-5">
      <SectionHeader
        title={info.label}
        blurb={info.description}
        actions={
          <TabsList aria-label={MODELS_PAGE_COPY.tabs(info.label)}>
            {info.pages.map((p) => {
              const Icon = PAGE_ICON[p];
              return (
                <TabsTrigger key={p} value={p} className="px-3.5">
                  <Icon aria-hidden />
                  {MODEL_PAGE_LABEL[p]}
                </TabsTrigger>
              );
            })}
          </TabsList>
        }
      />
      {info.pages.map((p) => (
        <TabsContent key={p} value={p} className="min-w-0">
          {body(p)}
        </TabsContent>
      ))}
    </Tabs>
  );
}
