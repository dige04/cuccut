import type { AssetRecord, AudioMix, EditOperation, Sequence, VideoItem } from '@cuccut/protocol';

/**
 * Detach audio (the “分离音频” action on CucCut v2's video clip): in one transaction, create a new audio track and turn the clip's own sound into an audio segment. It uses the same source, the same time mapping, and the same start and length, and copies the volume, fades and envelope. Then it turns off the video's own sound (`setAudioMix.muted`, which the engine writes as `embeddedAudio.enabled: false`). One undo step reverts it. The new audio clip does not carry the video's effects (`broll` and the like apply only to the picture) or its extensions.
 */

/** The `ref` of the audio track created in the same transaction. */
export const DETACH_TRACK_REF = 'detached-audio';

/** Whether this segment has sound to detach: the source has an audio track, its own sound is on, and it plays at a constant rate (freeze frames have no sound). */
export function canDetachAudio(item: VideoItem, asset: AssetRecord | undefined): boolean {
  return !!asset?.revisions[item.assetRef.revision]?.audio && item.embeddedAudio.enabled && item.timeMap.kind === 'linear';
}

/** The one operation that detaches this segment's sound. */
export function detachAudioOperations(sequence: Sequence, item: VideoItem): EditOperation[] {
  const { fps } = sequence;
  const { enabled: _enabled, envelope, ...fades } = item.embeddedAudio;
  const mix: AudioMix = envelope?.length ? { ...fades, envelope } : fades;
  return [
    { type: 'addTrack', sequenceId: sequence.id, kind: 'audio', ref: DETACH_TRACK_REF },
    {
      type: 'insertItems',
      sequenceId: sequence.id,
      items: [
        {
          type: 'audio',
          trackRef: DETACH_TRACK_REF,
          assetRef: item.assetRef,
          fromFrame: item.span.fromFrame,
          subframeOffset: { ticks: '0', timescale: 1 },
          // Frame counts become exact time: durationFrames × den / num seconds, without floating point.
          playDuration: { ticks: String(item.span.durationFrames * fps.den), timescale: fps.num },
          timeMap: item.timeMap,
          mix,
          ...(item.name !== undefined ? { name: item.name } : {}),
        },
      ],
    },
    { type: 'setAudioMix', sequenceId: sequence.id, itemId: item.id, muted: true },
  ];
}
