import type { WorkerFootprint } from '@cuccut/models';
import type { ResourceAmounts, ResourceCapacity, ResourceDemand } from '@cuccut/protocol';

/**
 * Peak demand and reserves for the various heavy tasks (architecture design §7.7), centralized in this one place. These are all conservative initial estimates, not measured by benchmarking; they are to be calibrated against real machines (architecture design §14, “lease fairness and resource estimation”). Byte values are all in bytes.
 */

const MiB = 1024 * 1024;
const GiB = 1024 * MiB;

/**
 * One Model Worker process (one model package, §6.5): model weights, inference activations, and decode buffers. Counted for as long as the process is alive, whether or not a task is using it.
 * When the weight size is unknown, this fixed value is used, which is also the lower bound of the weight-based estimate.
 */
export const MODEL_WORKER_DEMAND: ResourceDemand = { memory: 1 * GiB, gpuMemory: 2 * GiB, cpuThreads: 2 };

/**
 * Estimates the Model Worker's demand from the resident size after the model package is loaded (`ModelCatalog.workerFootprint`), plus 1 GiB (inference activations and decode buffers):
 *
 * - Counted in GPU memory (MLX, Core ML, candle's CUDA, GGML's CUDA or Vulkan): GPU memory is the resident size plus 1 GiB, and at least `MODEL_WORKER_DEMAND`. The process's own memory is still 1 GiB (on unified memory, the GPU amount is also counted in memory). MLX's measured resident size after loading is about the same as the weights (Qwen3-ASR 0.6B about 0.71 GB, 1.7B about 2.46 GB).
 * - Counted in memory (candle or GGML on CPU): memory is the resident size plus 1 GiB, and at least 1 GiB; it does not occupy GPU memory.
 * - Separation model packages store weights as 16-bit and upcast them to 32-bit on load, so the resident size is counted as twice the file size (HTDemucs-FT measured 673 MB vs 336 MB).
 *
 * When `footprint` is null (size unknown), the fixed value is used.
 */
export function modelWorkerDemand(footprint: WorkerFootprint | null): ResourceDemand {
  if (footprint === null) return MODEL_WORKER_DEMAND;
  if (footprint.pool === 'memory') {
    return {
      ...MODEL_WORKER_DEMAND,
      memory: Math.max(MODEL_WORKER_DEMAND.memory ?? 0, Math.round(footprint.bytes + 1 * GiB)),
      gpuMemory: 0,
    };
  }
  const gpuMemory = Math.max(MODEL_WORKER_DEMAND.gpuMemory ?? 0, Math.round(footprint.bytes + 1 * GiB));
  return { ...MODEL_WORKER_DEMAND, gpuMemory };
}

/** This local transcription's own staging: the decoded audio and segmentation results (the Worker process amount is counted separately on the holder). */
export const LOCAL_TRANSCRIBE_DEMAND: ResourceDemand = { scratchDisk: 512 * MiB };

/**
 * This local separation's own amount (the Worker process amount is counted separately on the holder): the Worker decodes the whole audio track into 44.1 kHz stereo 32-bit float, and both output streams are also in memory. The staging is the two 16-bit WAV streams plus a copy padded to the full length. Estimated for half an hour of material (decoded audio about 0.6 GB, three copies about 1.9 GB), to be calibrated against real material.
 */
export const LOCAL_SEPARATE_DEMAND: ResourceDemand = { memory: 2 * GiB, scratchDisk: 2 * GiB };

/**
 * Local text-to-image (including the model package self-check): the task's own staging (one PNG), plus this model package's Model Worker when there is no process yet. The three weight segments of image generation are streamed in layer by layer and are never resident at the same time, so the Worker's demand is computed from the peak registered for the model package (`peak`, see `ModelCatalog.imagePeak`), not the total weight. No extra activation margin is added, because the peak already includes it:
 *
 * - Counted in GPU memory (MLX, candle's CUDA): GPU memory is the peak, and at least `MODEL_WORKER_DEMAND`. The process's own memory is still 1 GiB.
 * - Counted in memory (candle on CPU): memory is the peak, and at least 1 GiB; it does not occupy GPU memory.
 *
 * When `peak` is null (not a registered text-to-image model package), the fixed value is used.
 */
export function localImageResources(
  bundleId: string,
  peak: WorkerFootprint | null,
): { demand: ResourceDemand; holder: { id: string; demand: ResourceDemand } } {
  let worker: ResourceDemand = MODEL_WORKER_DEMAND;
  if (peak?.pool === 'memory') {
    worker = { ...MODEL_WORKER_DEMAND, memory: Math.max(MODEL_WORKER_DEMAND.memory ?? 0, peak.bytes), gpuMemory: 0 };
  } else if (peak) {
    worker = { ...MODEL_WORKER_DEMAND, gpuMemory: Math.max(MODEL_WORKER_DEMAND.gpuMemory ?? 0, peak.bytes) };
  }
  return { demand: LOCAL_IMAGE_DEMAND, holder: { id: modelWorkerHolder(bundleId), demand: worker } };
}

/** This local image generation's own staging: one PNG (a 1536² RGBA image uncompressed is under 10 MiB), plus margin. */
export const LOCAL_IMAGE_DEMAND: ResourceDemand = { scratchDisk: 64 * MiB };

/**
 * Local music generation (§7.7): the engine starts one process per task and does not stay resident, so there is no shared holder. The peak is taken directly from the model package's registered estimate and charged to the task (Apple Silicon counts GPU memory, other platforms count memory), plus staging.
 */
export function localMusicResources(bundleId: string, peak: WorkerFootprint | null): { demand: ResourceDemand } {
  if (!peak) return { demand: { ...LOCAL_MUSIC_DEMAND, memory: MODEL_WORKER_DEMAND.memory, cpuThreads: MODEL_WORKER_DEMAND.cpuThreads } };
  void bundleId;
  return {
    demand: {
      ...LOCAL_MUSIC_DEMAND,
      cpuThreads: MODEL_WORKER_DEMAND.cpuThreads,
      ...(peak.pool === 'memory' ? { memory: peak.bytes } : { gpuMemory: peak.bytes, memory: MODEL_WORKER_DEMAND.memory }),
    },
  };
}

/** This local music generation's own staging: five minutes of 44.1 kHz stereo 16-bit WAV is about 50 MiB, plus the engine's logs and margin. */
export const LOCAL_MUSIC_DEMAND: ResourceDemand = { scratchDisk: 256 * MiB };

/** Number of frames active at the same time during final render export (the Render Worker's frame window and the encoder's buffers, §9.6). */
const VIDEO_FRAME_WINDOW = 48;
/** Staging margin for final render export: per-segment intermediate files, logs, and verification. */
const STAGING_SLACK = 64 * MiB;

/** The holder in scheduling for one model package's Model Worker: tasks for the same model package share this process in turn, and its amount is counted only once. */
export function modelWorkerHolder(bundleId: string): string {
  return `model-worker:${bundleId}`;
}

/**
 * Local transcription and synthesis (including the model package self-check): the task's own staging, plus this model package's Model Worker when there is no process yet. Recognition and candle synthesis are estimated from its resident size after loading (`footprint`, see `ModelCatalog.workerFootprint`). MLX synthesis does not provide `footprint`, so it uses the fixed value.
 */
export function localTranscribeResources(
  bundleId: string,
  footprint: WorkerFootprint | null = null,
): { demand: ResourceDemand; holder: { id: string; demand: ResourceDemand } } {
  return { demand: LOCAL_TRANSCRIBE_DEMAND, holder: { id: modelWorkerHolder(bundleId), demand: modelWorkerDemand(footprint) } };
}

/**
 * Local separation (the separation step of dubbing translation): this step's own amount, plus the separation model package's Model Worker when there is no process yet. The Worker is estimated from its resident size after loading (`ModelCatalog.workerWeightBytes`, already computed as twice the file size). Separation only has MLX model packages, and the resident size is counted in GPU memory. When the model package in use is unknown (old frozen parameters), only this step's own amount is counted.
 */
export function localSeparateResources(
  bundleId: string | null,
  weightBytes: number | null,
): { demand: ResourceDemand; holder?: { id: string; demand: ResourceDemand } } {
  if (bundleId === null) return { demand: LOCAL_SEPARATE_DEMAND };
  const footprint: WorkerFootprint | null = weightBytes === null ? null : { bytes: weightBytes, pool: 'gpuMemory' };
  return { demand: LOCAL_SEPARATE_DEMAND, holder: { id: modelWorkerHolder(bundleId), demand: modelWorkerDemand(footprint) } };
}

/**
 * Final render export (Render Worker plus ffmpeg encoding): base 1.5 GiB plus the RGBA frames in the frame window; 4 threads. The staging is 1.5 times the encoded output (estimated at 0.1 bit per pixel when the bitrate is unknown), plus the mixed WAV. When loudness normalization is on, add three 32-bit intermediate files for mastering.
 */
export function videoExportDemand(input: {
  width: number;
  height: number;
  fps: number;
  durationSec: number;
  bitrateKbps: number | null;
  audioBitrateKbps: number;
  sampleRate: number;
  channels: number;
  loudness?: boolean;
}): ResourceDemand {
  const frameBytes = input.width * input.height * 4;
  const kbps = input.bitrateKbps ?? Math.max(2_000, (input.width * input.height * input.fps * 0.1) / 1_000);
  const encoded = (input.durationSec * (kbps + input.audioBitrateKbps) * 1_000) / 8;
  const wav = input.durationSec * input.sampleRate * input.channels * (input.loudness ? 2 + 4 * 3 : 2);
  return {
    memory: Math.round(1.5 * GiB + frameBytes * VIDEO_FRAME_WINDOW),
    cpuThreads: 4,
    scratchDisk: Math.round(encoded * 1.5 + wav + STAGING_SLACK),
  };
}

/**
 * Audio export (ffmpeg mixing, loudness mastering, and encoding): 512 MiB, 2 threads. The staging is twice the 32-bit intermediate files; when loudness normalization is on, add three copies for mastering (two rounds of intermediate results plus the written PCM). When the duration is unknown, 1 GiB is used.
 */
export function audioExportDemand(input: {
  durationSec: number | null;
  sampleRate: number;
  channels: number;
  loudness?: boolean;
}): ResourceDemand {
  const copies = input.loudness ? 2 + 3 : 2;
  const scratch = input.durationSec === null ? 1 * GiB : input.durationSec * input.sampleRate * input.channels * 4 * copies + STAGING_SLACK;
  return { memory: 512 * MiB, cpuThreads: 2, scratchDisk: Math.round(scratch) };
}

/** File transcoding (ffmpeg re-encoding or merging): 1 GiB, 4 threads; the staging is 1.2 times the total input size. */
export function transcodeDemand(inputBytes: number): ResourceDemand {
  return { memory: 1 * GiB, cpuThreads: 4, scratchDisk: Math.round(inputBytes * 1.2 + STAGING_SLACK) };
}

/** Model download and verification: 256 MiB, 1 thread; the staging is the number of bytes still to download (a part paused earlier is already on disk). */
export function modelDownloadDemand(remainingBytes: number): ResourceDemand {
  return { memory: 256 * MiB, cpuThreads: 1, scratchDisk: Math.round(remainingBytes + STAGING_SLACK) };
}

/** Reserves: `system` is kept for the system and other apps, and no one uses it; `interactive` is kept for interactive operations, and background tasks do not use it (§7.6 “foreground preview first”). */
export interface ResourceReserves {
  system: ResourceAmounts;
  interactive: ResourceAmounts;
}

/**
 * Reserves computed from capacity: the system keeps 25% of memory (at least 2 GiB), keeps 1 thread when there are 4 or more threads, and keeps 1 GiB of disk. Interactive keeps 1 GiB of memory, 512 MiB of GPU memory, and a quarter of the threads (at most 2).
 */
export function defaultReserves(capacity: ResourceCapacity): ResourceReserves {
  return {
    system: {
      memory: Math.max(2 * GiB, Math.round(capacity.memory * 0.25)),
      gpuMemory: capacity.gpuMemory === null ? null : 0,
      cpuThreads: capacity.cpuThreads >= 4 ? 1 : 0,
      scratchDisk: capacity.scratchDisk === null ? null : 1 * GiB,
    },
    interactive: {
      memory: 1 * GiB,
      gpuMemory: capacity.gpuMemory === null ? null : 512 * MiB,
      cpuThreads: Math.min(2, Math.floor(capacity.cpuThreads / 4)),
      scratchDisk: capacity.scratchDisk === null ? null : 0,
    },
  };
}
