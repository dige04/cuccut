import type { ModelLicense } from '@cuccut/protocol';
import { ModelsImageBundles as M } from '@cuccut/protocol/messages/models/image-bundles.ts';
import type { BundleDefinition } from './bundle-registry.ts';

/**
 * Model packs for local text-to-image (architecture design §6.3). `bundleId` is `<model>@<backend>-<quantization>`. The repos, versions and file lists (`repo-manifests.ts`) match the older CucCut, pinned to the same versions.
 *
 * Qwen-Image-2.1's text encoder, DiT and VAE live in one repo, and the whole repo is one `image` component. The three stages run in sequence, streamed in layer by layer, and are never resident at the same time, so the Model Worker's peak is far below the total weight size (about 10 GB). Resource scheduling counts `image.peakBytes` (measured), not a weight-based estimate. The MLX variant is listed only on Apple Silicon; on other platforms the candle variants are listed instead (`platformBundles`).
 */

const MiB = 1024 * 1024;
const GiB = 1024 * MiB;

const QWEN_IMAGE_LICENSE: ModelLicense = {
  name: 'Qwen RESEARCH LICENSE AGREEMENT',
  url: 'https://huggingface.co/Qwen/Qwen-Image-2.1/blob/main/LICENSE',
  commercialUse: false,
  // The license summary is for people to read: use a getter, which generates it in the current language when read (when listing status, serializing over the wire).
  get summary() {
    return M.qwenImageLicense().text;
  },
};

/**
 * Aspect ratios and default pixel sizes: long side 1024, short side scaled to a multiple of 32 (same sizing rule as the older version). The first one is the default size.
 * The Worker accepts a wider rule (multiples of 32, long side ≤ 1536, long/short ratio ≤ 3). Here we list only the few sizes the UI and requests can pick.
 */
export const QWEN_IMAGE_ASPECTS: ReadonlyArray<{ ratio: string; size: string }> = [
  { ratio: '1:1', size: '1024x1024' },
  { ratio: '16:9', size: '1024x576' },
  { ratio: '9:16', size: '576x1024' },
  { ratio: '4:3', size: '1024x768' },
  { ratio: '3:4', size: '768x1024' },
  { ratio: '2.35:1', size: '1024x448' },
];

const QWEN_IMAGE_MLX: BundleDefinition = {
  bundleId: 'qwen-image-2.1@mlx-4bit',
  capability: 'image',
  backend: 'mlx',
  device: 'metal',
  components: {
    image: { family: 'qwen-image', repo: 'mlx-community/Qwen-Image-2.1-MLX-4bit', revision: '4db4e8c0c0e7a1debf0320415bec8388e888494c' },
  },
  label: 'Qwen-Image-2.1',
  license: QWEN_IMAGE_LICENSE,
  image: {
    family: 'qwen-image',
    aspects: QWEN_IMAGE_ASPECTS,
    extraSizes: ['512x512'],
    maxPromptChars: 1024,
    // The "steps" control in the design draft image-gen.jsx: 8–40, adjusted by 4 at a time, default 20.
    steps: { min: 8, max: 40, step: 4, default: 20 },
    // Measured peak process memory of the Model Worker (phys_footprint): about 0.7 GB at 256², about 1.0 GB at 1024² (MLX peak 0.94 GB). The older version's same pipeline at 512² was about 0.8 GB. Budget up to 2 GiB to leave room for larger sizes (long side up to 1536) and fluctuation.
    peakBytes: 2 * GiB,
    slow: true,
  },
};

/**
 * The same model pack for the candle backend (architecture design §6.5): the same MLX 4-bit repo, dequantized matrix by matrix as needed (same as the older version), and listed only on platforms other than Apple Silicon. On CPU it computes in f32, on CUDA in bf16. It is very slow on CPU: 1024² at 20 steps takes about three hours (measured, see §6.5).
 */
const QWEN_IMAGE_CANDLE: BundleDefinition = {
  ...QWEN_IMAGE_MLX,
  bundleId: 'qwen-image-2.1@candle',
  backend: 'candle',
  device: 'cpu',
  image: {
    ...QWEN_IMAGE_MLX.image!,
    // On CPU, computation is f32, and memory counts toward process memory. Measured peak process memory on this machine (phys_footprint): 256² 2.4 GB, 1024² 4.7 GB (the peak is in VAE decode; the DiT stage is 3.3 GB, made up of about 0.9 GB for dequantized matrices layer by layer plus attention chunks). The resident set also includes mapped weight pages (4.9 GB at 1024²); that part is file cache and reclaimable, so it is not counted. Budget up to 6 GiB to cover the long side 1536 size and fluctuation.
    peakBytes: 6 * GiB,
    // On CUDA, computation is bf16, and memory counts toward VRAM. This machine has no CUDA. The older version's same pipeline measured a peak of 3.57 GiB across the whole card at 1024×576 (including about 1.2 GB for the desktop); 1024² was not measured.
    devicePeakBytes: { cuda: 4 * GiB },
  },
};

export const IMAGE_BUNDLES: readonly BundleDefinition[] = [QWEN_IMAGE_MLX, QWEN_IMAGE_CANDLE];
