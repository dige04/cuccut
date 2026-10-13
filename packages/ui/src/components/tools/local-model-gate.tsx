import { useState, type ReactNode } from 'react';
import type { ModelBundleStatus } from '@cuccut/protocol';
import { Button, ProgressBar, Text } from '@react-spectrum/s2';
import Download from '@react-spectrum/s2/icons/Download';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { downloadView, inlineInstallMode } from '../../model/models-install.ts';
import type { ModelCategory } from '../../model/settings-nav.ts';
import { localNotDownloaded } from '../../model/tools-image.ts';
import type { ToolModelOption } from '../../model/tools-models.ts';
import { useModels } from '../../state/models-store.ts';
import { useShell } from '../../state/shell-store.ts';
import { InstallDialog } from '../models/install-dialog.tsx';
import { IMAGE_LOCAL_COPY } from '../models/models-copy.ts';
import { Gate, SectionLink } from './tool-parts.tsx';
import { GATE_COPY } from './tools-copy.ts';

/*
 * The gate shown when the selected local model cannot be used yet (the local branch of design file image-gen.jsx `EngineGate`, and panel-tts.jsx `TtsModelGate`): if it is not downloaded, it offers
 * “Download {size}”, which goes through the same install dialog as the settings page and shows the size and license first; if the weights are already present and only the shared components are missing, it completes the install instead, downloads only what is missing, and does not ask for the license again.
 * While downloading, it shows a progress bar; if this platform or build cannot run the model, it offers only “Switch to an available cloud model”.
 * Every state also offers “Manage local models…”.
 */

const progress = style({ display: 'flex', alignItems: 'center', gap: 8, font: 'ui-sm', color: 'gray-800' });
const progressBar = style({ width: 120 });

/**
 * In-place download card for a local model pack: the title is “Download X first · size”. When not downloading, it offers a download (or resume, if it stopped halfway); while downloading, it shows progress. `extra` is an extra button the caller can add
 * (such as switching to another model), and `category` decides which section of settings “Manage local models…” opens. The caller stops rendering it once the model is installed.
 */
export function LocalDownloadGate({
  bundle,
  name,
  category,
  body,
  licenseUse,
  extra,
}: {
  bundle: ModelBundleStatus;
  name: string;
  category: ModelCategory;
  body: (paused: boolean) => string;
  /** The line in the install dialog for when commercial use is not allowed (the wording used for the default speech synthesis). */
  licenseUse?: string;
  extra?: ReactNode;
}) {
  const go = useShell((s) => s.go);
  const bundles = useModels((s) => s.bundles);
  // The choice between download and completion is fixed when the dialog opens: components land one by one during a download, so the dialog must not change plan midway.
  const [installing, setInstalling] = useState<'install' | 'complete' | null>(null);
  const view = downloadView(bundle);
  const label = view.state === 'running' ? GATE_COPY.downloading(view.percent) : null;
  return (
    <>
      <Gate
        title={view.size ? `${GATE_COPY.download(name)} · ${view.size}` : GATE_COPY.download(name)}
        body={body(view.state === 'paused')}
        actions={
          <>
            {label ? (
              <span className={progress} role="status">
                <ProgressBar
                  size="S"
                  aria-label={label}
                  isIndeterminate={view.percent === null}
                  {...(view.percent === null ? {} : { value: view.percent })}
                  styles={progressBar}
                />
                {label}
              </span>
            ) : (
              // Neutral: the form's own submit is the view's one yellow.
              <Button variant="secondary" size="S" onPress={() => setInstalling(inlineInstallMode(bundle, bundles))}>
                <Download />
                <Text>
                  {view.state === 'paused' ? GATE_COPY.resume : view.size ? GATE_COPY.downloadSize(view.size) : GATE_COPY.downloadButton}
                </Text>
              </Button>
            )}
            {extra}
            <SectionLink onPress={() => go({ tab: 'models', category, page: 'local' })}>{GATE_COPY.manageLocal}</SectionLink>
          </>
        }
      />
      {installing ? (
        <InstallDialog
          bundleId={bundle.bundleId}
          name={name}
          license={bundle.license ?? null}
          {...(licenseUse ? { licenseUse } : {})}
          mode={installing}
          onClose={() => setInstalling(null)}
        />
      ) : null}
    </>
  );
}

/** The gate for the local model selected for image generation (the tool page and the editor's image panel); the fallback only goes to the cloud (design file `preferred`). */
export function LocalModelGate<M>({
  selected,
  options,
  onSwitch,
}: {
  selected: ToolModelOption<M> | null;
  options: readonly ToolModelOption<M>[];
  onSwitch: (option: ToolModelOption<M>) => void;
}) {
  const go = useShell((s) => s.go);
  const bundles = useModels((s) => s.bundles);
  if (!selected || selected.usable || !selected.local) return null;

  const alt = options.find((o) => o.usable && !o.local);
  const switchButton = alt ? (
    <Button variant="secondary" size="S" onPress={() => onSwitch(alt)}>
      {GATE_COPY.switchTo(`${alt.provider} · ${alt.modelId}`)}
    </Button>
  ) : null;
  const bundle = bundles.find((b) => b.bundleId === selected.modelId) ?? null;

  if (selected.why !== localNotDownloaded() || !bundle) {
    return (
      <Gate
        title={GATE_COPY.localUnavailable(selected.label)}
        body={GATE_COPY.localUnavailableBody(selected.why ?? '')}
        actions={
          <>
            {switchButton}
            <SectionLink onPress={() => go({ tab: 'models', category: 'image', page: 'local' })}>{GATE_COPY.manageLocal}</SectionLink>
          </>
        }
      />
    );
  }

  return (
    <LocalDownloadGate
      bundle={bundle}
      name={selected.label}
      category="image"
      body={(paused) => (paused ? GATE_COPY.downloadBodyPaused : GATE_COPY.downloadBody)}
      licenseUse={IMAGE_LOCAL_COPY.licenseUse}
      extra={switchButton}
    />
  );
}
