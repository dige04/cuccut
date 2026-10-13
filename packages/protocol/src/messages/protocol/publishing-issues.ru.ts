import type { PublishingIssuesMessages } from './publishing-issues.ts';

export const ru: PublishingIssuesMessages = {
  // Validation (`validatePublication`).
  approvalRequired: 'Перед публикацией утвердите закреплённый экспорт.',
  exportRequired: 'Чтобы опубликовать видео, отрендерите его и закрепите.',
  accountsRequired: 'Выберите хотя бы один аккаунт.',
  timezoneInvalid: 'Выберите корректный часовой пояс.',
  accountUnavailable: 'Этот аккаунт больше недоступен. Переподключите его или выберите другой.',
  accountDuplicateRoute: 'Один и тот же аккаунт выбран через два маршрута. Выберите один маршрут.',
  accountNotConnected: 'Перед отправкой подключите этот аккаунт в настройках публикации.',
  formatMismatch: 'Этот формат не подходит для сети аккаунта. Выберите другой формат.',
  descriptionRequired: 'Напишите описание для этого аккаунта.',
  titleLength: (p: { max: number }) => `YouTube требует название длиной от 1 до ${p.max} символов.`,
  audienceRequired: 'Укажите, предназначено ли это видео YouTube для детей.',
  tagsTooLong: (p: { max: number }) => `Уложите теги YouTube в ${p.max} символов, иначе YouTube может их отбросить.`,
  shortTooLong: 'Shorts на YouTube могут длиться не более трёх минут. Выберите видео YouTube или сократите экспорт.',
  shortsClassification: 'YouTube считает квадратные или вертикальные видео до трёх минут Shorts. Выберите для этого экспорта YouTube Short.',
  portraitRequired: 'Этому формату нужен вертикальный или квадратный экспорт. Отрендерите вертикальную версию или выберите другой формат.',
  captionTooLong: (p: { length: number; max: number }) => `Описание и хэштеги занимают ${p.length} символов; эта сеть допускает ${p.max}. Сократите их.`,
  timeInPast: 'Это время уже прошло. Выберите будущее время или очистите поле, чтобы отправить сейчас.',
  expiresBefore: 'Эта публикация истекает раньше, чем выйдет в эфир. Выберите более раннее время или более позднюю дату окончания.',
  deliveryUnsettled:
    'Другой релиз этого видео на этот аккаунт всё ещё ожидает или не подтверждён. Зафиксируйте его результат, прежде чем отправлять снова.',
  // Route options (`routeOptionIssues`).
  optionUnlistedYoutubeOnly: 'Видимость «по ссылке» доступна только на YouTube.',
  optionTagsYoutubeOnly: 'Теги доступны только на YouTube. Вместо них добавьте хэштеги в описание.',
  optionPhoneYoutubeTags: 'Маршрут через телефон не может задавать теги YouTube. Удалите их или выберите другой маршрут.',
  optionPostbridgeYoutubeAudience:
    'Postbridge не может задать аудиторию или видимость на YouTube. Примите настройки, заданные в Postbridge, или выберите другой маршрут.',
  optionPostgunSynthetic: 'Postgun не может добавить на YouTube пометку о синтетическом контенте. Выберите другой маршрут.',
  optionYoutubeApiInteractions: 'Этот маршрут не может применить выбранные параметры взаимодействия или партнёрства YouTube.',
  optionInstagramApi: 'Этот маршрут не может применить выбранные параметры видимости, пометки или взаимодействия Instagram.',
  // Local times and slots (`localInstant`, `planSlots`, `resolveTimeField`, `calendarPlacements`).
  timeInvalid: 'Введите корректные дату и время.',
  timeRequired: 'Выберите дату и время.',
  timeGap: (p: { timezone: string }) => `Этого времени не существует в часовом поясе ${p.timezone} из-за перевода часов. Выберите другое время.`,
  timeFold: (p: { timezone: string }) =>
    `В часовом поясе ${p.timezone} это время повторяется из-за перевода часов. Введите точную метку времени с её смещением UTC.`,
  timestampInvalid: 'Введите метку времени со смещением UTC, например 2026-10-01T18:00:00-06:00.',
  noFreeSlot: 'До истечения срока свободного времени не находится. Проверьте аккаунты, еженедельное время и интервалы.',
  destinationMissing: 'Этот аккаунт больше не входит в публикацию. Загрузите её заново и попробуйте ещё раз.',
  // Calendar files (`parseCalendarArchive`, `inspectCalendarImport`).
  archiveInvalid: 'Выберите файл календаря CucCut (JSON), экспортированный поддерживаемой версией.',
  archiveDuplicatePublications: 'В файле календаря одна публикация указана дважды. Экспортируйте его заново с исходного компьютера.',
  archiveDuplicateAccounts: 'В файле календаря один аккаунт указан дважды. Экспортируйте его заново с исходного компьютера.',
  archiveDuplicateConnections: 'В файле календаря одно подключение указано дважды. Экспортируйте его заново с исходного компьютера.',
  archiveDuplicateDestinations: (p: { label: string }) =>
    `«${p.label}» указывает один и тот же аккаунт дважды в файле календаря. Экспортируйте его заново с исходного компьютера.`,
  archiveTimezone: (p: { timezone: string }) => `Файл календаря использует неизвестный часовой пояс (${p.timezone}). Экспортируйте его заново с исходного компьютера.`,
  archiveMissingConnection: (p: { name: string }) => `В файле календаря нет подключения для «${p.name}».`,
  archiveLinkedAccount: (p: { name: string }) => `Связанный аккаунт для «${p.name}» в файле календаря некорректен.`,
  archiveMissingAccount: (p: { label: string }) => `В файле календаря нет аккаунта, который использует «${p.label}».`,
  archiveInvalidDate: (p: { label: string }) => `В файле календаря некорректная дата для «${p.label}».`,
  importConnectionConflict: (p: { name: string }) =>
    `Подключение «${p.name}» из файла календаря конфликтует с подключением на этом компьютере.`,
  importAccountConflict: (p: { name: string }) => `Аккаунт «${p.name}» из файла календаря конфликтует с аккаунтом на этом компьютере.`,
  importedInFlight: 'Импортировано во время отправки. Проверьте результат в приложении сети и зафиксируйте его, прежде чем отправлять снова.',
};
