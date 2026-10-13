import { useState } from 'react';
import { Radio, RadioGroup, SegmentedControl, SegmentedControlItem } from '@react-spectrum/s2';
import { style } from '@react-spectrum/s2/style' with { type: 'macro' };
import { defaultFileNames, projectSettings, type ProjectTarget } from '../../model/export-settings.ts';
import { BAKE_POLICIES, EXPORT_COPY, PLANNED_PROJECT_TARGETS } from './export-copy.ts';
import { SubmitFoot } from './export-footer.tsx';
import { FileRows, Note, PlaceRow, Sec, SumRow, Summary } from './export-parts.tsx';
import type { ExportEnv, ExportSubmit } from './use-export-submit.ts';

/**
 * "Project" page (design mockup export-project.jsx, model-export.js `PROJECT_TARGETS`): export to editing software, algorithmic elements, summary.
 *
 * The project formats the Runtime can export are FCP7 XML (xmeml, which both Premiere Pro and DaVinci Resolve can import), plus the CucCut portable bundle (`.cuccut`, which collects the video, all documents and assets into one file). JianYing / CapCut, Final Cut Pro (FCPXML), Shotcut and Kdenlive are not wired up: they are listed and disabled.
 * The mockup's three-way choice for algorithmic elements (convert to video material / convert even if lossy / give up) is not wired up: text, graphics, subtitles, transitions and effects cannot be written into the project, and each one is recorded in the export notices (listed in the receipt after completion).
 */

const targetName = style({ font: 'ui-sm', fontWeight: 'medium', color: 'gray-900' });
const targetMeta = style({ display: 'block', font: 'ui-xs', color: 'gray-600' });

export function ExportProjectTab({ env, submitter, onClose }: { env: ExportEnv; submitter: ExportSubmit; onClose: () => void }) {
  const [target, setTarget] = useState<ProjectTarget>('xmeml');
  const [missing, setMissing] = useState<'fail' | 'skip'>('fail');
  const settings = projectSettings(target, missing);
  const files = defaultFileNames(env.videoName, settings, env.documents);
  const portable = target === 'portable';

  return (
    <>
      <Sec first>{EXPORT_COPY.editors}</Sec>
      <RadioGroup aria-label={EXPORT_COPY.editors} size="S" value={target} onChange={(value) => setTarget(value as ProjectTarget)}>
        <Radio value="xmeml">
          <TargetText name={EXPORT_COPY.xmemlName} meta={EXPORT_COPY.xmemlMeta} />
        </Radio>
        <Radio value="portable">
          <TargetText name={EXPORT_COPY.portableName} meta={EXPORT_COPY.portableMeta} />
        </Radio>
        {PLANNED_PROJECT_TARGETS.map((t) => (
          <Radio key={t.id} value={t.id} isDisabled>
            <TargetText name={t.name} meta={`${t.meta} · ${EXPORT_COPY.plannedTarget}`} />
          </Radio>
        ))}
      </RadioGroup>

      {portable ? (
        <>
          <Sec>{EXPORT_COPY.missingAssets}</Sec>
          <SegmentedControl aria-label={EXPORT_COPY.missingAssets} selectedKey={missing} onSelectionChange={(key) => setMissing(key === 'skip' ? 'skip' : 'fail')}>
            <SegmentedControlItem id="fail">{EXPORT_COPY.missingFail}</SegmentedControlItem>
            <SegmentedControlItem id="skip">{EXPORT_COPY.missingSkip}</SegmentedControlItem>
          </SegmentedControl>
          <Note>{EXPORT_COPY.portableNote}</Note>
        </>
      ) : (
        <>
          <Sec>{EXPORT_COPY.bake}</Sec>
          <RadioGroup aria-label={EXPORT_COPY.bake} size="S" isDisabled value="none">
            {BAKE_POLICIES.map((p) => (
              <Radio key={p.key} value={p.key}>
                {p.label}
              </Radio>
            ))}
          </RadioGroup>
          <Note>{EXPORT_COPY.bakeBlocked}</Note>
          <Note>{EXPORT_COPY.xmemlNote}</Note>
        </>
      )}

      <Summary>
        <SumRow label={EXPORT_COPY.willExport}>{portable ? EXPORT_COPY.portableName : `${EXPORT_COPY.xmemlName} · ${EXPORT_COPY.xmemlMeta}`}</SumRow>
        <FileRows names={files} />
        <PlaceRow videoId={env.videoId} />
      </Summary>

      <SubmitFoot env={env} submitter={submitter} settings={settings} label={portable ? EXPORT_COPY.exportPortable : EXPORT_COPY.exportProject} onClose={onClose} />
    </>
  );
}

function TargetText({ name, meta }: { name: string; meta: string }) {
  return (
    <span>
      <span className={targetName}>{name}</span>
      <span className={targetMeta}>{meta}</span>
    </span>
  );
}
