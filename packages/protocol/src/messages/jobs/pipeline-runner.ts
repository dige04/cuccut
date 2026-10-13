import { defineCatalog } from '../../message-ref.ts';
import { zhHans } from './pipeline-runner.zh-Hans.ts';
import { zhHant } from './pipeline-runner.zh-Hant.ts';
import { ja } from './pipeline-runner.ja.ts';
import { ko } from './pipeline-runner.ko.ts';
import { es } from './pipeline-runner.es.ts';
import { fr } from './pipeline-runner.fr.ts';
import { de } from './pipeline-runner.de.ts';
import { nl } from './pipeline-runner.nl.ts';
import { ptBR } from './pipeline-runner.pt-BR.ts';
import { it } from './pipeline-runner.it.ts';
import { ru } from './pipeline-runner.ru.ts';
import { pl } from './pipeline-runner.pl.ts';
import { tr } from './pipeline-runner.tr.ts';
import { vi } from './pipeline-runner.vi.ts';

/** `packages/jobs/src/pipelines/pipeline-runner.ts`: errors and sub-task names emitted by the orchestration of fixed flows. */
const en = {
  unknownPipeline: (p: { name: string }) => `No pipeline named "${p.name}"`,
  entryTargetUnsupported: "This Runtime can't open videos from Library entries",
  targetMismatch: 'The target and videoId parameters refer to different videos',
  noLibrary: 'This Runtime has no user library',
  notPipeline: 'This task is not a pipeline',
  notRetryable: 'Only failed, cancelled, or interrupted pipelines can be retried',
  pipelineMissing: (p: { name: string }) => `This Runtime has no pipeline named "${p.name}"`,
  alreadyRetrying: 'The pipeline is already being retried',
  cannotOpenTarget: "This Runtime can't open the pipeline's target video",
  targetReplaced: 'A different video is now at the target location. Start over.',
  pipelineFailed: 'The pipeline ran into an error',
  stepFailed: 'The step ran into an error',
  interrupted: 'The Runtime stopped before the pipeline finished. Use pipelines.retry to continue from the step where it stopped.',
  /** For a step that starts several sub-tasks: the step name plus the sub-task's own name. */
  subtask: (p: { step: string; label: string }) => `${p.step}: ${p.label}`,
};

export type JobsPipelineRunnerMessages = typeof en;

export const JobsPipelineRunner = defineCatalog('jobsPipelineRunner', en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });
