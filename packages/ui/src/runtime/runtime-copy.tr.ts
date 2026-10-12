import type { RuntimeMessages } from './runtime-copy.ts';

export const tr: RuntimeMessages = {
  missingContext: 'RuntimeContext eksik',
  mediaStatus: (status) => `Medya hizmeti ${status} döndürdü`,
  noRootSequence: 'Yeni videoda ana sekans yok',
  waveformName: 'Dalga formu',
  noDuration: 'Videonun henüz süresi yok, bu yüzden dalga formu eklenmedi',
  noOpenVideo: 'Açık video yok',
  notCaughtUp: 'Video henüz eşitlenmedi ve şu anda değiştirilemiyor',
};
