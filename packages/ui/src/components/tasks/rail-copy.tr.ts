import type { RailMessages } from './rail-copy.ts';

export const tr: RailMessages = {
  running: (n: number) => `${n} sürüyor`,
  finished: (n: number) => `${n} tamamlandı`,
  nothingYet: 'Henüz yok',
  tasksBlurb: 'Döküm, çeviri, dışa aktarmalar ve ajanların işleri tek bir listede. Adımlarını ve sonuçlarını görmek için bir görevi açın.',
  toolCount: (n: number) => `${n} araç`,
  moreFinished: (n: number) => `${n} tane daha Tüm görevler'de`,
};
