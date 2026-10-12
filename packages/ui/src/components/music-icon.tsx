import { createIcon } from '@react-spectrum/s2';

/**
 * 音乐（生成音乐 / 配乐）图标：S2 的 MusicNote 是单符头，和音频的波形不够分得开；按原型 icons.jsx `music` 的描边几何画在 20×20 网格上——
 * 双符头的音符、符杠向右上扬，1.5 笔宽、只吃 currentColor，放进按钮与列表的图标槽时与 S2 原件一样对齐。设置侧栏仍用 S2 MusicNote。
 */
export const MusicIcon = createIcon((props) => (
  <svg {...props} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <path d="M8.2 14.6V4.2l6.6 1.6v9" />
    <path d="M8.2 7.6l6.6 1.6" />
    <path d="M4.6 14.6a1.8 1.8 0 1 0 3.6 0 1.8 1.8 0 1 0-3.6 0z" />
    <path d="M11.2 14.8a1.8 1.8 0 1 0 3.6 0 1.8 1.8 0 1 0-3.6 0z" />
  </svg>
));
