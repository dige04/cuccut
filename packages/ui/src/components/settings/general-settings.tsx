import { useCallback, useEffect, useState } from 'react';
import {
  LOCALES,
  LOCALE_NATIVE_NAMES,
  isLanguagePreference,
  resolveLanguage,
  type ExternalToolStatus,
} from '@cuccut/protocol';
import {
  Button,
  NumberField,
  Picker,
  PickerItem,
  SegmentedControl,
  SegmentedControlItem,
  StatusLight,
  Switch,
  TextField,
  ToastQueue,
} from '@react-spectrum/s2';
import { Archive, Download, Globe, Monitor, PenLine } from 'lucide-react';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { AUTO_ROW, autoUpdatePatch } from '../../model/app-update.ts';
import { shortenPath } from '../../model/format.ts';
import {
  SAVE_DIR_ROW,
  LINE_LENGTH_PRESETS,
  TRASH_DAYS,
  autoUpdateOn,
  downloaderLine,
  endpointProblem,
  endpointValue,
  lineLengthKey,
  lineLengthText,
  trashDaysValue,
} from '../../model/general-settings.ts';
import { CUE_PARAMS } from '../../model/speech-cues.ts';
import { useRuntime } from '../../runtime/context.tsx';
import { useAppUpdate } from '../../state/app-update-store.ts';
import { useConnection } from '../../state/connection-store.ts';
import { useSetting, useSettings } from '../../state/settings-store.ts';
import { useShell } from '../../state/shell-store.ts';
import { ModelSourceRow } from '../models/model-source-row.tsx';
import { M } from './general-settings-copy.ts';
import { useSaveSettings, useSettingsReady } from './save-settings.ts';
import { SettingsGroup, SettingsRow } from './settings-ui.tsx';

/*
 * Settings › General (design mockup page-settings.jsx `GeneralSection`, settings-update.jsx `AppUpdateAutoRow`, import-panel.jsx
 * `DownloaderSettings`): the interface, editing and transcription, and download and update groups follow the design mockup. Keys that the contract has but this page of the design mockup does not draw (download source, strict offline,
 * trash retention days) are appended after them in the same style. Values are read from the settings mirror (`useSetting`); a change calls `settings.set`, and the effective value comes back through the `settings` topic.
 *
 * No fakes: keys that neither the Runtime nor the UI uses yet (after transcription completes, subtitle line length), and items the design mockup does not implement (cue background), are still drawn,
 * but greyed out, with a line below each explaining why. Auto-update is executed by the desktop main process using these two keys, and appears only in the desktop host that manages updates. Groups and rows are styled the same as SettingsGroup / SettingsRow on the settings page (the panel and row in settings-ui.tsx). Appearance (light/dark) is no longer offered: CucCut is dark only.
 */

const fieldLine = style({ display: 'flex', alignItems: 'start', flexWrap: 'wrap', gap: 8, paddingBottom: 4 });
const endpointInput = style({ flexGrow: 1, minWidth: 220 });
const languagePicker = style({ width: 200 });
const daysField = style({ width: 112 });

export function GeneralSettings() {
  const web = useRuntime().host.platform === 'web';
  const ready = useSettingsReady();
  return (
    <>
      <InterfaceGroup />
      <EditingGroup />
      <DownloadsGroup web={web} ready={ready} />
      <SourcesGroup web={web} ready={ready} />
      <SpaceGroup web={web} ready={ready} />
    </>
  );
}

function InterfaceGroup() {
  const language = useShell((s) => s.language);
  const setLanguage = useShell((s) => s.setLanguage);
  const system = LOCALE_NATIVE_NAMES[resolveLanguage('system', navigator.languages ?? [navigator.language])];
  return (
    <SettingsGroup title={M.interfaceGroup} icon={<Monitor />}>
      <SettingsRow label={M.language} desc={M.languageDesc}>
        <Picker
          size="S"
          aria-label={M.language}
          selectedKey={language}
          onSelectionChange={(key) => isLanguagePreference(key) && setLanguage(key)}
          styles={languagePicker}>
          <PickerItem id="system">{M.languageSystem(system)}</PickerItem>
          {LOCALES.map((locale) => (
            <PickerItem key={locale} id={locale}>
              {LOCALE_NATIVE_NAMES[locale]}
            </PickerItem>
          ))}
        </Picker>
      </SettingsRow>
    </SettingsGroup>
  );
}

/** Editing and transcription: none of the three items is used yet. They are drawn per the design mockup and greyed out, with a note stating what actually happens now. */
function EditingGroup() {
  const after = useSetting('transcribe.afterComplete');
  const lineLength = useSetting('captions.maxLineLength');
  const preset = lineLengthKey(lineLength);
  const custom = lineLength && !preset ? lineLengthText(lineLength) : null;
  return (
    <SettingsGroup title={M.editingGroup} icon={<PenLine />}>
      <SettingsRow label={M.autoOpen} desc={M.autoOpenDesc} note={M.autoOpenNote}>
        <Switch aria-label={M.autoOpen} isDisabled isSelected={(after ?? 'open-video') === 'open-video'} />
      </SettingsRow>
      <SettingsRow label={M.lineLength} desc={M.lineLengthDesc} note={M.lineLengthNote(CUE_PARAMS.maxChars, custom)}>
        <SegmentedControl aria-label={M.lineLength} isDisabled selectedKey={preset}>
          {LINE_LENGTH_PRESETS.map((p) => (
            <SegmentedControlItem key={p.key} id={p.key}>
              {p.label}
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
      </SettingsRow>
      <SettingsRow label={M.cueShading} desc={M.cueShadingDesc} note={M.cueShadingNote}>
        <Switch aria-label={M.cueShading} isDisabled isSelected={false} />
      </SettingsRow>
    </SettingsGroup>
  );
}

function DownloadsGroup({ web, ready }: { web: boolean; ready: boolean }) {
  return (
    <SettingsGroup title={M.downloadsGroup} icon={<Download />}>
      <SaveDirRow web={web} ready={ready} />
      <AutoUpdateRow ready={ready} />
      <DownloaderRow web={web} />
    </SettingsGroup>
  );
}

/**
 * Automatically check for and download updates (design mockup settings-update.jsx `AppUpdateAutoRow`): one toggle controls two keys. When on, both are on; when off, only automatic download is turned off
 * (it still checks on schedule, and when a new version is found it reminds the user “ready to update” (可以更新了)). The main process schedules checks and downloads by these two keys. This row does not appear when the host has no update surface (web) or when this build does not manage updates
 * (development build, App Store build).
 */
function AutoUpdateRow({ ready }: { ready: boolean }) {
  const updatable = useRuntime().host.updates !== undefined;
  const unsupported = useAppUpdate((s) => s.snapshot?.state.k === 'unsupported');
  const save = useSaveSettings();
  const check = useSetting('updates.autoCheck');
  const download = useSetting('updates.autoDownload');
  if (!updatable || unsupported) return null;
  return (
    <SettingsRow label={AUTO_ROW.label} desc={AUTO_ROW.desc}>
      <Switch
        aria-label={AUTO_ROW.label}
        isDisabled={!ready}
        isSelected={autoUpdateOn(check, download)}
        onChange={(on) => void save(autoUpdatePatch(on), on ? M.autoUpdateOn : M.autoUpdateOff)}
      />
    </SettingsRow>
  );
}

/** Default save location (`downloads.directory`): the system panel picks the folder; in the browser a local folder cannot be picked. */
function SaveDirRow({ web, ready }: { web: boolean; ready: boolean }) {
  const runtime = useRuntime();
  const save = useSaveSettings();
  const dir = useSetting('downloads.directory');
  const [busy, setBusy] = useState(false);
  const pick = async () => {
    setBusy(true);
    try {
      const next = await runtime.host.pickDirectory({ title: SAVE_DIR_ROW.pickTitle });
      if (next) await save({ 'downloads.directory': next }, SAVE_DIR_ROW.changed);
    } catch (error) {
      ToastQueue.negative(SAVE_DIR_ROW.pickFailed((error as Error).message), { timeout: 5000 });
    } finally {
      setBusy(false);
    }
  };
  const reset = async () => {
    setBusy(true);
    await save({ 'downloads.directory': null }, SAVE_DIR_ROW.resetDone);
    setBusy(false);
  };
  const off = web || !ready || busy;
  return (
    <SettingsRow
      label={SAVE_DIR_ROW.label}
      desc={
        <>
          <div>{SAVE_DIR_ROW.desc}</div>
          <div>{dir ? shortenPath(dir) : SAVE_DIR_ROW.systemDefault}</div>
        </>
      }
      note={web ? SAVE_DIR_ROW.webNote : undefined}>
      {dir ? (
        <Button variant="secondary" size="S" isDisabled={off} onPress={() => void reset()}>
          {SAVE_DIR_ROW.reset}
        </Button>
      ) : null}
      <Button variant="secondary" size="S" isDisabled={off} onPress={() => void pick()}>
        {SAVE_DIR_ROW.change}
      </Button>
    </SettingsRow>
  );
}

type ToolCheck = { status: 'checking' } | { status: 'done'; tool: ExternalToolStatus | null } | { status: 'failed'; message: string };

/**
 * Video download tool (design mockup `DownloaderSettings`): a read-only row stating whether yt-dlp is usable right now. Detection only runs `yt-dlp --version` locally and does not go online
 * (`externalTools.detect`). The design mockup’s install, update and “install scope” (安装范围) are not done here: CucCut downloads it only when an agent imports from a link and you have agreed.
 * Not detected in the browser (the Runtime does not expose external tools to web pages).
 */
function DownloaderRow({ web }: { web: boolean }) {
  const runtime = useRuntime();
  const connected = useConnection((s) => s.state.status === 'connected');
  const [check, setCheck] = useState<ToolCheck>({ status: 'checking' });
  const recheck = useCallback(() => {
    setCheck({ status: 'checking' });
    runtime.detectExternalTool('yt-dlp').then(
      (tool) => setCheck({ status: 'done', tool }),
      (error: Error) => setCheck({ status: 'failed', message: error.message }),
    );
  }, [runtime]);
  useEffect(() => {
    if (!web && connected) recheck();
  }, [web, connected, recheck]);
  if (web) return <SettingsRow label={M.downloader} desc={M.downloaderWeb} />;
  const line = check.status === 'done' ? downloaderLine(check.tool) : null;
  const desc = check.status === 'checking' ? M.checking : check.status === 'failed' ? M.checkFailed(check.message) : (line?.desc ?? '');
  return (
    <SettingsRow label={M.downloader} desc={desc}>
      {line ? (
        <StatusLight size="S" variant={line.tone}>
          {line.status}
        </StatusLight>
      ) : null}
      <Button variant="secondary" size="S" isDisabled={!connected} isPending={check.status === 'checking' && connected} onPress={recheck}>
        {M.checkAgain}
      </Button>
    </SettingsRow>
  );
}

/**
 * Present in the contract but not drawn on this page of the design mockup: download source and strict offline. The model download source is the same row as “Download and storage” (下载与存储) on the local models page (model-source-row.tsx).
 * Read-only in the browser: the web allowlist does not include `settings.set`, so it is greyed out with a line giving the reason.
 */
function SourcesGroup({ web, ready }: { web: boolean; ready: boolean }) {
  const save = useSaveSettings();
  const strict = useSetting('offline.strict');
  return (
    <SettingsGroup title={M.sourcesGroup} icon={<Globe />}>
      <ModelSourceRow label={M.modelsEndpoint} />
      <EndpointRow
        settingKey="tools.downloadEndpoint"
        label={M.toolsEndpoint}
        desc={M.toolsEndpointDesc}
        placeholder={M.toolsEndpointPlaceholder}
        web={web}
        ready={ready}
      />
      <SettingsRow label={M.strictOffline} desc={M.strictOfflineDesc} note={web ? M.webNote : undefined}>
        <Switch
          aria-label={M.strictOffline}
          isDisabled={web || !ready}
          isSelected={strict ?? false}
          onChange={(on) => void save({ 'offline.strict': on }, on ? M.strictOfflineOn : M.strictOfflineOff)}
        />
      </SettingsRow>
    </SettingsGroup>
  );
}

/** A download source: enter a base URL and save. Clearing it and saving, or clicking “Restore default” (恢复默认), goes back to the default source. The rules are the same as the contract’s validation; invalid values cannot be saved. */
function EndpointRow({
  settingKey,
  label,
  desc,
  placeholder,
  web,
  ready,
}: {
  settingKey: 'tools.downloadEndpoint';
  label: string;
  desc: string;
  placeholder: string;
  web: boolean;
  ready: boolean;
}) {
  const save = useSaveSettings();
  const saved = useSetting(settingKey) ?? '';
  const [value, setValue] = useState(saved);
  const [busy, setBusy] = useState(false);
  useEffect(() => setValue(saved), [saved]);
  const next = endpointValue(value);
  const problem = endpointProblem(value);
  const commit = async (endpoint: string | null) => {
    setBusy(true);
    await save({ [settingKey]: endpoint }, endpoint ? M.endpointChanged(endpoint) : M.endpointReset(label));
    setBusy(false);
  };
  const off = web || !ready || busy;
  return (
    <SettingsRow
      label={label}
      desc={desc}
      note={web ? M.webNote : undefined}
      below={
        <div className={fieldLine}>
          <TextField
            aria-label={label}
            size="S"
            value={value}
            onChange={setValue}
            placeholder={placeholder}
            isInvalid={problem !== null}
            errorMessage={problem ?? undefined}
            isDisabled={off}
            styles={endpointInput}
          />
          <Button variant="secondary" size="S" isDisabled={off || problem !== null || (next ?? '') === saved} onPress={() => void commit(next)}>
            {M.save}
          </Button>
          {saved ? (
            <Button variant="secondary" size="S" isDisabled={off} onPress={() => void commit(null)}>
              {M.resetDefault}
            </Button>
          ) : null}
        </div>
      }
    />
  );
}

/** Present in the contract but not drawn on this page of the design mockup: trash retention days. Clearing the number box = restore default. Read-only in the browser. */
function SpaceGroup({ web, ready }: { web: boolean; ready: boolean }) {
  const save = useSaveSettings();
  const days = useSetting('space.trashRetentionDays');
  const fallback = useSettings((s) => s.snapshot?.defaults['space.trashRetentionDays'] ?? null);
  return (
    <SettingsGroup title="Space" icon={<Archive />}>
      <SettingsRow
        label={M.trashDays}
        desc={M.trashDaysDesc(fallback)}
        note={web ? M.webNote : undefined}>
        <NumberField
          aria-label={M.trashDays}
          size="S"
          minValue={TRASH_DAYS.min}
          maxValue={TRASH_DAYS.max}
          step={1}
          value={days ?? Number.NaN}
          isDisabled={web || !ready}
          styles={daysField}
          onChange={(input) => {
            const next = trashDaysValue(input);
            if (next !== days) void save({ 'space.trashRetentionDays': next });
          }}
        />
      </SettingsRow>
    </SettingsGroup>
  );
}
