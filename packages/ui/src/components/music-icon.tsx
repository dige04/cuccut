import { createIcon } from '@react-spectrum/s2';

/**
 * Music (generate music / background score) icon: S2's MusicNote is a single-notehead glyph, which isn't distinct enough from the audio waveform. It is drawn with the stroke geometry of the prototype icons.jsx `music` on a 20×20 grid—
 * a double-notehead note with the beam rising to the upper right, 1.5 stroke width, using only currentColor. In the icon slots of buttons and lists it aligns the same way as the S2 original. The settings sidebar still uses S2 MusicNote.
 */
export const MusicIcon = createIcon((props) => (
  <svg {...props} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M8.2 14.6V4.2l6.6 1.6v9" />
    <path d="M8.2 7.6l6.6 1.6" />
    <path d="M4.6 14.6a1.8 1.8 0 1 0 3.6 0 1.8 1.8 0 1 0-3.6 0z" />
    <path d="M11.2 14.8a1.8 1.8 0 1 0 3.6 0 1.8 1.8 0 1 0-3.6 0z" />
  </svg>
));
