import { describe, expect, it } from 'vitest';
import type { ExternalToolStatus, GeneratedOutput, JobRecord, PipelineRun } from '@cuccut/protocol';
import { RpcError } from '@cuccut/protocol';
import { toolOfJob } from './tool-runs.ts';
import { toolJob } from './tools-test-fixtures.ts';
import {
  addEntryInput,
  addInputs,
  addNotice,
  againTranscodeDraft,
  BLANK_COMPRESS,
  BLANK_EXTRACT,
  BLANK_MERGE,
  commandText,
  crfOf,
  entryIdOfInput,
  elapsedText,
  failureDetail,
  failureRemedy,
  ffmpegLine,
  humanBytes,
  inputSizes,
  isAbsolutePath,
  mergeModeLine,
  moveInput,
  moveInputs,
  parsePathInput,
  rejectionText,
  removeInput,
  retryParams,
  settingsLine,
  sortByName,
  spaceInput,
  transcodeJobs,
  transcodeMeta,
  transcodeProblems,
  transcodeProgress,
  transcodeRequest,
  transcodeResults,
  transcodeStateWord,
  transcodeTitle,
  type TranscodeDraft,
} from './tools-transcode.ts';

const STEPS = [
  { name: 'probe', label: '读取输入' },
  { name: 'encode', label: '编码' },
  { name: 'verify', label: '校验输出' },
  { name: 'publish', label: '发布' },
];

function run(params: Record<string, unknown>, patch: Partial<PipelineRun> = {}): PipelineRun {
  return {
    name: 'transcode',
    params,
    steps: STEPS.map((s) => ({ ...s, status: 'pending', jobId: null, attempts: 0, output: null })),
    current: null,
    stoppedAt: null,
    summary: null,
    ...patch,
  };
}

function transcodeJob(params: Record<string, unknown>, patch: Partial<JobRecord> = {}, pipeline: Partial<PipelineRun> = {}): JobRecord {
  return toolJob({
    jobId: 'job_t',
    kind: 'pipeline',
    phase: 'probing',
    providerId: 'ffmpeg',
    modelId: '8.0.1',
    generation: undefined,
    pipeline: run(params, pipeline),
    ...patch,
  });
}

function videoOut(path: string, byteLength: number, patch: Partial<Extract<GeneratedOutput['media'], { kind: 'video' }>> = {}): GeneratedOutput {
  return {
    artifactId: 'sha256:ff',
    mediaType: 'video/mp4',
    byteLength,
    assetId: null,
    path,
    media: { kind: 'video', durationSec: 42, width: 1280, height: 720, videoCodec: 'h264', audioCodec: 'aac', ...patch },
  };
}

const draft = (patch: Partial<TranscodeDraft> = {}): TranscodeDraft => ({ ...BLANK_COMPRESS, inputs: ['/v/a.mp4'], ...patch });

describe('select files', () => {
  it('manually entered paths have quotes removed and terminal escapes and file:// URLs restored', () => {
    expect(parsePathInput('  "/Users/me/My Movies/a.mov" ')).toBe('/Users/me/My Movies/a.mov');
    expect(parsePathInput('/Users/me/My\\ Movies/a.mov')).toBe('/Users/me/My Movies/a.mov');
    expect(parsePathInput('file:///Users/me/My%20Movies/a.mov')).toBe('/Users/me/My Movies/a.mov');
    expect(parsePathInput('   ')).toBeNull();
    expect(isAbsolutePath('/a.mp4')).toBe(true);
    expect(isAbsolutePath('C:\\v\\a.mp4')).toBe(true);
    expect(isAbsolutePath('a.mp4')).toBe(false);
  });

  it('adding files: duplicates, non-video and relative paths are rejected, with a clear explanation', () => {
    const r = addInputs(['/v/a.mp4'], ['/v/a.mp4', '/v/b.mov', '/v/song.mp3', 'c.mp4', '/v/raw.mts']);
    // Files whose extension is not recognized (.mts) pass through, and ffprobe decides.
    expect(r.inputs).toEqual(['/v/a.mp4', '/v/b.mov', '/v/raw.mts']);
    expect(addNotice(r)).toBe('song.mp3 不是视频文件；c.mp4 不是绝对路径；a.mp4 已经在列表里');
    expect(addNotice(addInputs([], ['/v/x.mkv']))).toBeNull();
  });

  it('extract audio takes audio files separately', () => {
    expect(addInputs([], ['/v/song.mp3', '/v/a.mp4'], true).inputs).toEqual(['/v/song.mp3', '/v/a.mp4']);
    expect(addInputs([], ['/v/cover.png'], true).rejected).toEqual(['/v/cover.png']);
  });

  it('at most 100 files', () => {
    const many = Array.from({ length: 99 }, (_, i) => `/v/${i}.mp4`);
    const r = addInputs(many, ['/v/x.mp4', '/v/y.mp4', '/v/z.mp4']);
    expect(r.inputs).toHaveLength(100);
    expect(r.overflow).toBe(2);
    expect(addNotice(r)).toBe('一次最多 100 个文件，多出的 2 个没有加');
  });

  it('move up, move down, remove, drag to reorder, sort by file name', () => {
    const list = ['/a', '/b', '/c'];
    expect(moveInput(list, 2, -1)).toEqual(['/a', '/c', '/b']);
    expect(moveInput(list, 0, -1)).toEqual(list);
    expect(removeInput(list, 1)).toEqual(['/a', '/c']);
    expect(moveInputs(list, ['/c'], '/a', 'before')).toEqual(['/c', '/a', '/b']);
    expect(moveInputs(list, ['/a'], '/c', 'after')).toEqual(['/b', '/c', '/a']);
    expect(moveInputs(list, ['/a'], '/a', 'after')).toEqual(list);
    expect(sortByName(['/x/clip10.mp4', '/y/clip2.mp4', '/z/Clip1.mp4'])).toEqual(['/z/Clip1.mp4', '/y/clip2.mp4', '/x/clip10.mp4']);
  });
});

describe('submit', () => {
  it('blocks when no file is selected, merge has only one segment, bitrate is out of range, or the output directory is not an absolute path', () => {
    expect(transcodeProblems(draft({ inputs: [] }), 'compress')).toEqual(['先选一个视频文件']);
    expect(transcodeProblems(draft({ inputs: [] }), 'merge')).toEqual(['至少要两段视频']);
    expect(transcodeProblems(draft(), 'merge')).toEqual(['至少要两段视频，再加一段']);
    expect(transcodeProblems(draft({ rate: 'bitrate', videoKbps: 50 }), 'compress')).toEqual(['视频码率要在 100–200000 kbps 之间']);
    expect(transcodeProblems(draft({ outDir: 'out' }), 'compress')).toEqual(['输出目录要写绝对路径']);
    expect(transcodeProblems(draft({ outDir: '  ' }), 'compress')).toEqual([]);
    expect(transcodeProblems(draft({ inputs: ['/a.mp4', '/b.mp4'] }), 'merge')).toEqual([]);
  });

  it('by quality only CRF is given, by bitrate only bitrate; no directory selected and no scaling are omitted', () => {
    expect(transcodeRequest(draft(), 'compress')).toEqual({ inputs: ['/v/a.mp4'], action: 'compress', codec: 'h264', crf: 26, audioBitrateKbps: 128 });
    expect(transcodeRequest(draft({ codec: 'hevc', quality: 'smaller', maxHeight: 720, outDir: ' /out ' }), 'compress')).toEqual({
      inputs: ['/v/a.mp4'],
      action: 'compress',
      codec: 'hevc',
      maxHeight: 720,
      crf: 35,
      audioBitrateKbps: 128,
      outDir: '/out',
    });
    const byRate = transcodeRequest({ ...BLANK_MERGE, inputs: ['/a.mp4', '/b.mp4'], rate: 'bitrate', videoKbps: 2500, audioKbps: 192 }, 'merge');
    expect(byRate).toEqual({ inputs: ['/a.mp4', '/b.mp4'], action: 'merge', codec: 'h264', videoBitrateKbps: 2500, audioBitrateKbps: 192 });
    expect('crf' in byRate).toBe(false);
    expect(crfOf('high', 'h264')).toBe(22);
  });

  it('extract audio gives only file, audio bitrate and output directory; with no file selected says video or audio', () => {
    expect(transcodeRequest({ ...BLANK_EXTRACT, inputs: ['/v/a.mp4'], maxHeight: 720, outDir: '/out' }, 'extract-audio')).toEqual({
      inputs: ['/v/a.mp4'],
      action: 'extract-audio',
      audioBitrateKbps: 128,
      outDir: '/out',
    });
    expect(transcodeProblems({ ...BLANK_EXTRACT }, 'extract-audio')).toEqual(['先选一个视频或音频文件']);
  });

  it('Space entries are recorded in the list as space:<entryId>: not treated as relative paths, not added twice, replaced with { entryId } on submit', () => {
    expect(spaceInput('ent_1')).toBe('space:ent_1');
    expect(entryIdOfInput('space:ent_1')).toBe('ent_1');
    expect(entryIdOfInput('/v/a.mp4')).toBeNull();
    const inputs = addEntryInput(addEntryInput(['/v/a.mp4'], 'ent_1'), 'ent_1');
    expect(inputs).toEqual(['/v/a.mp4', 'space:ent_1']);
    expect(transcodeProblems({ ...BLANK_MERGE, inputs }, 'merge')).toEqual([]);
    expect(transcodeRequest({ ...BLANK_EXTRACT, inputs }, 'extract-audio').inputs).toEqual(['/v/a.mp4', { entryId: 'ent_1' }]);
    const names: Record<string, string> = { 'space:ent_1': 'clip10.mp4', 'space:ent_2': 'clip2.mp4' };
    expect(sortByName(['space:ent_1', 'space:ent_2'], (i) => names[i] ?? i)).toEqual(['space:ent_2', 'space:ent_1']);
    const done = transcodeJob(
      { inputs: ['/v/a.mp4', '/v/b.mp4'], action: 'extract-audio' },
      {
        state: 'completed',
        result: {
          documentId: null,
          artifactId: 'sha256:aa',
          outputs: [{ artifactId: 'sha256:aa', mediaType: 'audio/mp4', byteLength: 2 * 1024 * 1024, assetId: null, path: '/dl/a.m4a', media: { kind: 'audio', durationSec: 42, sampleRate: 48000, channels: 2 } }],
        },
      },
    );
    expect(transcodeMeta(done)).toBe('提取音频 2 个');
    expect(transcodeResults(done)).toEqual([{ path: '/dl/a.m4a', name: 'a.m4a', meta: '0:42 · 48 kHz', size: '2.0 MB' }]);
    expect(toolOfJob(done)).toBe('extract-audio');
  });

  it('one-line summary of settings', () => {
    expect(settingsLine(draft())).toBe('原始分辨率 · H.264 · 均衡 · 音频 128 kbps');
    expect(settingsLine(draft({ maxHeight: 720, codec: 'hevc', rate: 'bitrate', videoKbps: 3000 }))).toBe('720p · H.265 · 3000 kbps · 音频 128 kbps');
  });

  it('when rejected names ffmpeg; the rest uses the Runtime\'s own wording', () => {
    expect(rejectionText(new RpcError('conflict', '找不到 ffmpeg', { code: 'MEDIA_TOOL_UNAVAILABLE' }))).toBe('ffmpeg 不能用：找不到 ffmpeg');
    expect(rejectionText(new RpcError('not-found', '找不到输入文件 /v/a.mp4'))).toBe('找不到输入文件 /v/a.mp4');
  });
});

describe('ffmpeg status', () => {
  const status = (patch: Partial<ExternalToolStatus>): ExternalToolStatus =>
    ({ name: 'ffmpeg', label: 'ffmpeg', state: 'installed', version: '8.0.1', reason: null, remedy: null, ...patch }) as ExternalToolStatus;
  it('ready, not installed, too old', () => {
    expect(ffmpegLine(status({}))).toEqual({ ready: true, text: 'ffmpeg 8.0.1 就绪', remedy: null });
    expect(ffmpegLine(status({ state: 'missing', version: null, remedy: '安装 ffmpeg' }))).toEqual({ ready: false, text: '要先装 ffmpeg', remedy: '安装 ffmpeg' });
    expect(ffmpegLine(status({ state: 'outdated', version: '3.4', reason: '低于 4.0' })).ready).toBe(false);
    expect(ffmpegLine(null).ready).toBe(false);
  });
});

describe('records', () => {
  const compress = transcodeJob({ inputs: ['/v/holiday.mov'], action: 'compress', codec: 'h264', maxHeight: 720, crf: 26, audioBitrateKbps: 128 });
  const merge = transcodeJob(
    { inputs: ['/v/a.mp4', '/v/b.mp4', '/v/c.mp4'], action: 'merge', codec: 'h264', crf: 23, audioBitrateKbps: 128 },
    { jobId: 'job_m', createdAt: '2026-10-03T00:01:00.000Z' },
  );

  it('lists only UI-submitted transcode parent tasks, newest first; other pipelines, subtasks, ones in video, and hidden ones are not listed', () => {
    const translate = transcodeJob({}, { jobId: 'job_x' }, { name: 'translate' });
    const step = toolJob({ jobId: 'job_s', kind: 'pipeline-step', parentJobId: 'job_t' });
    const inVideo = transcodeJob({ inputs: ['/a'], action: 'compress' }, { jobId: 'job_v', videoId: 'vid_1' });
    const byAgent = transcodeJob({ inputs: ['/a'], action: 'compress' }, { jobId: 'job_g', submitter: { kind: 'agent', id: 'a1' } as JobRecord['submitter'] });
    const list = transcodeJobs([compress, merge, translate, step, inVideo, byAgent], []);
    expect(list.map((j) => j.jobId)).toEqual(['job_m', 'job_t']);
    expect(transcodeJobs([compress, merge], ['job_m']).map((j) => j.jobId)).toEqual(['job_t']);
  });

  it('title and settings line', () => {
    expect(transcodeTitle(compress)).toBe('holiday.mov');
    expect(transcodeTitle(merge)).toBe('a.mp4 + 2 段');
    expect(transcodeMeta(compress)).toBe('压缩 · ≤720p · H.264 · 均衡（CRF 26）');
    expect(transcodeMeta(merge)).toBe('合并 3 段 · H.264 · CRF 23');
    const done = { ...compress, result: { documentId: null, artifactId: 'sha256:ff', outputs: [videoOut('/v/holiday-compressed.mp4', 1000)] } };
    expect(transcodeTitle(done)).toBe('holiday-compressed.mp4');
  });

  it('while encoding, reads the subtask\'s per-second progress; other steps write which step', () => {
    const child = toolJob({ jobId: 'job_enc', kind: 'pipeline-step', phase: 'encoding', progress: { done: 12.4, total: 42, unit: 'seconds' } });
    const running = transcodeJob(
      { inputs: ['/a.mp4'], action: 'compress' },
      { phase: 'encoding', progress: { done: 1, total: 4, unit: 'steps' } },
      { current: 1, steps: STEPS.map((s, i) => ({ ...s, status: i === 0 ? 'completed' : i === 1 ? 'running' : 'pending', jobId: i === 1 ? 'job_enc' : null, attempts: i <= 1 ? 1 : 0, output: null })) },
    );
    expect(transcodeProgress(running, [running, child])).toEqual({ text: '编码中 0:12 / 0:42 · 29%', percent: 29 });
    // The sub-job has not arrived yet: do not fake a percentage.
    expect(transcodeProgress(running, [running])).toEqual({ text: '编码中', percent: null });
    const probing = transcodeJob({ inputs: ['/a.mp4'], action: 'compress' }, {}, { current: 0 });
    expect(transcodeProgress(probing, [probing])).toEqual({ text: '读取输入 · 第 1/4 步', percent: null });
    expect(transcodeProgress(transcodeJob({ inputs: ['/a.mp4'], action: 'compress' }, { state: 'queued', phase: 'queued' }), []).text).toBe('排队中');
    // This step's sub-job is queued: write the reason the Runtime recorded.
    const waiting = toolJob({ jobId: 'job_enc', kind: 'pipeline-step', state: 'queued', phase: 'queued', wait: { reason: 'concurrency', detail: '等 ffmpeg 空出名额', since: '2026-10-03T00:00:01.000Z' } });
    expect(transcodeProgress(running, [running, waiting])).toEqual({ text: '编码 · 等 ffmpeg 空出名额', percent: null });
  });

  it('compress result row: output spec and how much was saved (source file size comes from the read-input step)', () => {
    const probe = { ...STEPS[0]!, status: 'completed' as const, jobId: 'job_p', attempts: 1, output: { stats: [{ size: 68.4 * 1024 * 1024, mtimeMs: 1 }], mode: 're-encode', reason: null } };
    const params = { inputs: ['/v/holiday.mov'], action: 'compress', codec: 'h264', crf: 26, audioBitrateKbps: 128 };
    const steps = [probe, ...STEPS.slice(1).map((s) => ({ ...s, status: 'completed' as const, jobId: null, attempts: 1, output: null }))];
    const finished = (bytes: number) =>
      transcodeJob(params, { state: 'completed', result: { documentId: null, artifactId: 'sha256:ff', outputs: [videoOut('/v/holiday-compressed.mp4', bytes)] } }, { steps });
    const done = finished(21.8 * 1024 * 1024);
    expect(transcodeResults(done)).toEqual([
      { path: '/v/holiday-compressed.mp4', name: 'holiday-compressed.mp4', meta: '1280×720 · 0:42 · H.264 / AAC', size: '68.4 MB → 21.8 MB（小 68%）' },
    ]);
    // When the source file size cannot be read, only write the output size.
    const bare = transcodeJob({ inputs: ['/v/a.mov'], action: 'compress' }, { result: done.result });
    expect(inputSizes(bare)).toBeNull();
    expect(transcodeResults(bare)[0]!.size).toBe('21.8 MB');
    expect(humanBytes(512 * 1024)).toBe('512 KB');
    // Smaller by less than 1%: do not write “smaller by 0%”.
    expect(transcodeResults(finished(68.3 * 1024 * 1024))[0]!.size).toBe('68.4 MB → 68.3 MB（几乎没变）');
    expect(transcodeResults(finished(70 * 1024 * 1024))[0]!.size).toBe('68.4 MB → 70.0 MB（没有变小）');
  });

  it('merge result row gives the total source file size, not savings; with stream copy the settings row only gives segment count and stream copy', () => {
    const probe = { ...STEPS[0]!, status: 'completed' as const, jobId: 'job_p', attempts: 1, output: { stats: [{ size: 400 * 1024, mtimeMs: 1 }, { size: 443 * 1024, mtimeMs: 1 }], mode: 'stream-copy', reason: null } };
    const params = { inputs: ['/v/a.mp4', '/v/b.mp4'], action: 'merge', codec: 'h264', crf: 22, audioBitrateKbps: 128 };
    const running = transcodeJob(params, { state: 'running' }, { steps: [probe, ...STEPS.slice(1).map((s) => ({ ...s, status: 'pending' as const, jobId: null, attempts: 0, output: null }))] });
    expect(transcodeMeta(running)).toBe('合并 2 段 · 流复制');
    const done = transcodeJob(
      params,
      { state: 'completed', result: { documentId: null, artifactId: 'sha256:ff', outputs: [videoOut('/v/a-merged.mp4', 842 * 1024)] } },
      {
        steps: [probe, ...STEPS.slice(1).map((s) => ({ ...s, status: 'completed' as const, jobId: null, attempts: 1, output: null }))],
        summary: { action: 'merge', mode: 'stream-copy', reason: null, executor: { tool: 'ffmpeg', version: '8.0.1', commands: [] }, files: ['/v/a-merged.mp4'] },
      },
    );
    expect(transcodeMeta(done)).toBe('合并 2 段 · 流复制');
    expect(transcodeResults(done)[0]!.size).toBe('842 KB（源文件共 843 KB）');
    // Merges that re-encode still write the codec and quality.
    const reencoded = transcodeJob(params, {}, { summary: { action: 'merge', mode: 're-encode', reason: '分辨率不一致', executor: { tool: 'ffmpeg', version: '8.0.1', commands: [] }, files: [] } });
    expect(transcodeMeta(reencoded)).toBe('合并 2 段 · H.264 · 高画质（CRF 22）');
  });

  it('merge states stream copy or re-encode and why; a decision made by the read-input step before completion is written out first', () => {
    const copied = transcodeJob({ inputs: ['/a.mp4', '/b.mp4'], action: 'merge' }, {}, {
      summary: { action: 'merge', mode: 'stream-copy', reason: null, executor: { tool: 'ffmpeg', version: '8.0.1', commands: [] }, files: ['/a-merged.mp4'] },
    });
    expect(mergeModeLine(copied)).toEqual({ mode: 'stream-copy', text: '各段参数一致：直接流复制，没有重新编码，画质不变' });
    const probing = transcodeJob({ inputs: ['/a.mp4', '/b.mp4'], action: 'merge' }, {}, {
      steps: STEPS.map((s, i) => ({ ...s, status: i ? 'pending' : 'completed', jobId: null, attempts: 0, output: i ? null : { mode: 're-encode', reason: '分辨率不一致（1920x1080 / 1280x720）', stats: [] } })),
    });
    expect(mergeModeLine(probing)).toEqual({ mode: 're-encode', text: '重新编码：分辨率不一致（1920x1080 / 1280x720）' });
    expect(mergeModeLine(compress)).toBeNull();
    expect(mergeModeLine(merge)).toBeNull();
  });

  it('copy command: one per line, arguments with spaces are quoted', () => {
    const done = transcodeJob({ inputs: ['/a.mp4'], action: 'compress' }, {}, {
      summary: { action: 'compress', mode: 're-encode', reason: null, executor: { tool: 'ffmpeg', version: '8', commands: [['-i', 'file:my clip.mp4', '-crf', '26', 'my clip-compressed.mp4']] }, files: [] },
    });
    expect(commandText(done)).toBe("ffmpeg -i 'file:my clip.mp4' -crf 26 'my clip-compressed.mp4'");
    expect(commandText(compress)).toBeNull();
  });

  it('status word, duration, failure fix and original text', () => {
    expect(transcodeStateWord({ state: 'running', endedAt: null })).toBe('处理中');
    expect(transcodeStateWord({ state: 'queued', endedAt: null })).toBe('排队中');
    expect(transcodeStateWord({ state: 'completed', endedAt: 'x' })).toBeNull();
    expect(elapsedText({ startedAt: '2026-10-03T00:00:00.000Z', endedAt: '2026-10-03T00:01:05.000Z' })).toBe('用了 1 分 5 秒');
    expect(elapsedText({ startedAt: '2026-10-03T00:00:00.000Z', endedAt: '2026-10-03T00:00:00.400Z' })).toBe('不到 1 秒');
    const failed = transcodeJob({ inputs: ['/a.mp4'], action: 'compress' }, {
      state: 'failed',
      error: { code: 'EXPORT_VALIDATION_FAILED', message: 'a.mp4 的输出没有通过校验', details: { problems: ['时长 1.00 秒，应约为 5.00 秒'] } },
    });
    expect(failureRemedy(failed)).toMatch(/没有通过校验/);
    expect(failureDetail(failed)).toBe('时长 1.00 秒，应约为 5.00 秒');
    expect(failureDetail({ error: { code: 'TRANSCODE_FAILED', message: 'x', details: { stderr: ' No space left on device \n' } } })).toBe('No space left on device');
    expect(failureRemedy({ state: 'interrupted', error: null })).toBeNull();
    // ffmpeg is missing: use the sentence the Runtime gives for its platform; if none is given, only say what to install, without guessing the platform.
    const winget = '安装 ffmpeg（含 ffprobe，例如 winget install --id Gyan.FFmpeg -e），或用环境变量 CUCCUT_FFMPEG 指定';
    expect(
      failureRemedy({ state: 'failed', error: { code: 'MEDIA_TOOL_UNAVAILABLE', message: '找不到 ffmpeg', details: { remedy: winget } } }),
    ).toBe(`${winget}，然后再试一次`);
    const bare = failureRemedy({ state: 'failed', error: { code: 'MEDIA_TOOL_UNAVAILABLE', message: '找不到 ffmpeg' } });
    expect(bare).toBe('安装 ffmpeg，或用 CUCCUT_FFMPEG 指定路径，然后再试一次');
    expect(ffmpegLine(null).remedy).not.toMatch(/brew|winget|apt/);
  });

  it('carry back to left: frozen parameters return to the form, CRF takes the closest preset; retry uses the original parameters', () => {
    expect(againTranscodeDraft(compress, BLANK_COMPRESS)).toEqual({ ...BLANK_COMPRESS, inputs: ['/v/holiday.mov'], maxHeight: 720, quality: 'balanced' });
    // For h264, 23 is farther from “balanced, 26” than “high quality, 22” is: pick high quality.
    expect(againTranscodeDraft(merge, BLANK_MERGE)?.quality).toBe('high');
    const byRate = transcodeJob({ inputs: ['/a.mp4'], action: 'compress', codec: 'hevc', videoBitrateKbps: 2500, audioBitrateKbps: 96, outDir: '/out' });
    expect(againTranscodeDraft(byRate, BLANK_COMPRESS)).toMatchObject({ codec: 'hevc', rate: 'bitrate', videoKbps: 2500, audioKbps: 96, outDir: '/out' });
    expect(retryParams(merge)).toEqual(merge.pipeline!.params);
    expect(againTranscodeDraft(toolJob(), BLANK_COMPRESS)).toBeNull();
  });
});
