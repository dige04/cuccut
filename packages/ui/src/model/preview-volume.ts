/**
 * Listening volume for the editor preview (prototype editor-keys.jsx borrows the fullscreen player's keys, model-player.js `stepVolume`):
 * during playback ↑/↓ moves 10 per step; raising it cancels mute, and reaching 0 counts as muted; M toggles mute. This only sets how loud this window is; it is not written into the video and does not affect export.
 */

/** Volume as an integer 0–100; while muted the volume is still remembered, and unmuting returns to the previous level. */
export interface MonitorLevel {
  volume: number;
  muted: boolean;
}

export const VOLUME_STEP = 10;
export const FULL_VOLUME: MonitorLevel = { volume: 100, muted: false };

/** ↑ (`1`) / ↓ (`-1`): step one notch from the remembered volume. Moving up cancels mute; moving down only counts as muted at 0 (prototype `stepVol`). */
export function stepMonitor(level: MonitorLevel, direction: 1 | -1): MonitorLevel {
  const volume = Math.min(100, Math.max(0, Math.round((level.volume || 0) + direction * VOLUME_STEP)));
  return { volume, muted: direction > 0 ? false : volume === 0 };
}

export function toggleMute(level: MonitorLevel): MonitorLevel {
  return { ...level, muted: !level.muted };
}

/** Multiplier handed to the preview engine (0–1). */
export function monitorGain(level: MonitorLevel): { volume: number; muted: boolean } {
  return { volume: Math.min(1, Math.max(0, level.volume / 100)), muted: level.muted };
}

/** Convert the engine's remembered multiplier back to 0–100. */
export function monitorLevel(gain: { volume: number; muted: boolean }): MonitorLevel {
  return { volume: Math.round(Math.min(1, Math.max(0, gain.volume)) * 100), muted: gain.muted };
}
