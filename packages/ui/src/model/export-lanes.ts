import { defineMessages, type CaptionItem, type DocumentRecord, type Id, type Sequence, type Track } from '@cuccut/protocol';
import { trackRows } from './editor.ts';
import { zhHans } from './export-lanes.zh-Hans.ts';
import { zhHant } from './export-lanes.zh-Hant.ts';
import { ja } from './export-lanes.ja.ts';
import { ko } from './export-lanes.ko.ts';
import { es } from './export-lanes.es.ts';
import { fr } from './export-lanes.fr.ts';
import { de } from './export-lanes.de.ts';
import { nl } from './export-lanes.nl.ts';
import { ptBR } from './export-lanes.pt-BR.ts';
import { it } from './export-lanes.it.ts';
import { ru } from './export-lanes.ru.ts';
import { pl } from './export-lanes.pl.ts';
import { tr } from './export-lanes.tr.ts';
import { vi } from './export-lanes.vi.ts';

/** Copy for the export popover's track list (English is the source of keys and types; translations are in `export-lanes.zh-Hans.ts`). */
const en = {
  hidden: 'Hidden on the timeline',
  otherSolo: 'Another track is soloed',
  muted: 'Muted on the timeline',
  otherSoloAudio: 'Another track is soloed',
  subtitles: 'Subtitles',
  names: (names: readonly string[]) => names.join(', '),
  sound: (reason: string) => `Sound: ${reason}`,
  clips: (n: number) => (n === 1 ? '1 clip' : `${n} clips`),
  sounds: (n: number) => (n === 1 ? '1 audio clip' : `${n} audio clips`),
};
export type ExportLanesMessages = typeof en;
const M = defineMessages(en, { 'zh-Hans': zhHans, 'zh-Hant': zhHant, ja, ko, es, fr, de, nl, 'pt-BR': ptBR, it, ru, pl, tr, vi });

/**
 * The export popover's “What's in the picture” and “What's in the sound” (the design draft's `Lane` in export.jsx and `soundLanes` in export-audio.jsx):
 * for each timeline track, whether it goes into the picture and whether it makes sound in this export.
 *
 * The rules match the rendering (`TrackRules` in crates/render-graph): hide affects only the picture, mute affects only the sound; solo applies separately to the visual group and the audio group,
 * each on its own. When a track is soloed, other visual tracks stay out of the picture.
 *
 * The design draft lets each track be toggled here, for this export only, followed by “sync to timeline”; the Runtime's export has no per-track override parameter
 * (only `burnCaptions` decides whether subtitles are burned into the picture), so here it is read-only: the toggles follow the timeline, and changes must be made on the timeline.
 */

export interface ExportLane {
  trackId: Id;
  kind: Track['kind'];
  /** Named the same as the timeline row headers: “Picture”, “Audio 2”, “Subtitles · English”. */
  label: string;
  /** A short description: “3 clips”, “2 sound segments”, “interview transcript”. */
  sub: string;
  /** Picture: whether visual and subtitle tracks are drawn in this export; null for audio tracks. */
  picture: boolean | null;
  /** Sound: whether audio tracks and visual tracks with sound make sound in this export; null for subtitle tracks and for visual tracks without sound. */
  sound: boolean | null;
  /** Reasons a track is off: "Hidden on the timeline", "Another track is solo-visible", "Muted on the timeline", "Another track is solo-audible". */
  reason: string | null;
}

function soloRules(tracks: readonly Track[]) {
  const visualSolo = tracks.some((t) => t.solo.enabled && t.solo.group === 'visual');
  const audioSolo = tracks.some((t) => t.solo.enabled && t.solo.group === 'audio');
  return {
    visible: (t: Track) => t.visible && (!visualSolo || (t.solo.enabled && t.solo.group === 'visual')),
    audible: (t: Track) => !t.muted && (!audioSolo || (t.solo.enabled && t.solo.group === 'audio')),
    hiddenReason: (t: Track) => (!t.visible ? M.hidden : M.otherSolo),
    mutedReason: (t: Track) => (t.muted ? M.muted : M.otherSoloAudio),
  };
}

/** Tracks on the timeline, in the same order as the timeline (subtitles on top, picture by stacking order, audio at the bottom); tracks with no enabled instances are not listed. */
export function exportLanes(sequence: Sequence, documents: Record<Id, DocumentRecord>): ExportLane[] {
  const rules = soloRules(sequence.tracks);
  const lanes: ExportLane[] = [];
  for (const { track, label } of trackRows(sequence)) {
    const items = sequence.items.filter((i) => i.trackId === track.id && i.enabled);
    if (!items.length) continue;
    if (track.kind === 'subtitle') {
      const names = [...new Set(items.filter((i): i is CaptionItem => i.type === 'caption').map((i) => documents[i.documentId]?.name ?? M.subtitles))];
      const on = rules.visible(track);
      lanes.push({ trackId: track.id, kind: track.kind, label, sub: (names.length ? M.names(names) : '') || M.subtitles, picture: on, sound: null, reason: on ? null : rules.hiddenReason(track) });
    } else if (track.kind === 'visual') {
      const picture = rules.visible(track);
      const voiced = items.some((i) => (i.type === 'video' && i.embeddedAudio.enabled) || (i.type === 'composition' && i.audio?.enabled));
      const sound = voiced ? rules.audible(track) : null;
      const reason = !picture ? rules.hiddenReason(track) : sound === false ? M.sound(rules.mutedReason(track)) : null;
      lanes.push({ trackId: track.id, kind: track.kind, label, sub: M.clips(items.length), picture, sound, reason });
    } else {
      const sound = rules.audible(track);
      lanes.push({ trackId: track.id, kind: track.kind, label, sub: M.sounds(items.length), picture: null, sound, reason: sound ? null : rules.mutedReason(track) });
    }
  }
  return lanes;
}

/** Whether a row goes into the final export this time: it counts if either the picture or the sound is on. */
export function laneOn(lane: ExportLane): boolean {
  return lane.picture === true || lane.sound === true;
}

/** What's in the sound: the tracks that make sound (audio tracks, and visual tracks with sound). */
export function soundLanes(lanes: readonly ExportLane[]): ExportLane[] {
  return lanes.filter((l) => l.sound !== null);
}
