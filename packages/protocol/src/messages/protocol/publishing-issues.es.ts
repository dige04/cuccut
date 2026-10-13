import type { PublishingIssuesMessages } from './publishing-issues.ts';

export const es: PublishingIssuesMessages = {
  // Validation (`validatePublication`).
  approvalRequired: 'Aprueba la exportación fijada antes de publicar.',
  exportRequired: 'Renderiza y fija el vídeo para publicarlo.',
  accountsRequired: 'Elige al menos una cuenta.',
  timezoneInvalid: 'Elige una zona horaria válida.',
  accountUnavailable: 'Esta cuenta ya no está disponible. Vuelve a conectarla o elige otra.',
  accountDuplicateRoute: 'La misma cuenta está seleccionada por dos rutas. Elige una ruta.',
  accountNotConnected: 'Conecta esta cuenta en los ajustes de publicación antes de enviar.',
  formatMismatch: 'Este formato no coincide con la red de la cuenta. Elige otro formato.',
  descriptionRequired: 'Escribe una descripción para esta cuenta.',
  titleLength: (p: { max: number }) => `YouTube necesita un título de 1 a ${p.max} caracteres.`,
  audienceRequired: 'Indica si este vídeo de YouTube está dirigido a niños.',
  tagsTooLong: (p: { max: number }) => `Mantén las etiquetas de YouTube dentro de ${p.max} caracteres, o YouTube podría descartarlas.`,
  shortTooLong: 'Los Shorts de YouTube pueden durar como máximo tres minutos. Elige vídeo de YouTube o acorta la exportación.',
  shortsClassification: 'YouTube trata como Shorts los vídeos cuadrados o verticales de hasta tres minutos. Elige YouTube Short para esta exportación.',
  portraitRequired: 'Este formato necesita una exportación vertical o cuadrada. Renderiza una versión vertical o elige otro formato.',
  captionTooLong: (p: { length: number; max: number }) => `La descripción y los hashtags tienen ${p.length} caracteres; esta red permite ${p.max}. Acórtalos.`,
  timeInPast: 'Esta hora ya ha pasado. Elige una hora futura o bórrala para enviar ahora.',
  expiresBefore: 'Esta publicación caduca antes de publicarse. Elige una hora anterior o una caducidad posterior.',
  deliveryUnsettled:
    'Otro lanzamiento de este vídeo a esta cuenta sigue pendiente o sin confirmar. Registra su resultado antes de enviar de nuevo.',
  // Route options (`routeOptionIssues`).
  optionUnlistedYoutubeOnly: 'La visibilidad no listada solo está disponible en YouTube.',
  optionTagsYoutubeOnly: 'Las etiquetas solo están disponibles en YouTube. Pon los hashtags en la descripción.',
  optionPhoneYoutubeTags: 'La ruta del teléfono no puede establecer etiquetas de YouTube. Quítalas o elige otra ruta.',
  optionPostbridgeYoutubeAudience:
    'Postbridge no puede establecer el público ni la visibilidad de YouTube. Acepta los ajustes configurados en Postbridge o elige otra ruta.',
  optionPostgunSynthetic: 'Postgun no puede añadir la declaración de medios sintéticos de YouTube. Elige otra ruta.',
  optionYoutubeApiInteractions: 'Esta ruta no puede aplicar las opciones de interacción o colaboración de YouTube seleccionadas.',
  optionInstagramApi: 'Esta ruta no puede aplicar las opciones de visibilidad, declaración o interacción de Instagram seleccionadas.',
  // Local times and slots (`localInstant`, `planSlots`, `resolveTimeField`, `calendarPlacements`).
  timeInvalid: 'Introduce una fecha y una hora válidas.',
  timeRequired: 'Elige una fecha y una hora.',
  timeGap: (p: { timezone: string }) => `Esta hora no existe en ${p.timezone} porque cambian los relojes. Elige otra hora.`,
  timeFold: (p: { timezone: string }) =>
    `Esta hora se repite en ${p.timezone} porque cambian los relojes. Introduce una marca de tiempo exacta con su desfase UTC.`,
  timestampInvalid: 'Introduce una marca de tiempo con su desfase UTC, por ejemplo 2026-10-01T18:00:00-06:00.',
  noFreeSlot: 'No hay ningún hueco libre antes de que caduque. Revisa sus cuentas, las horas semanales y el espaciado.',
  destinationMissing: 'Esta cuenta ya no forma parte de la publicación. Recárgala e inténtalo de nuevo.',
  // Calendar files (`parseCalendarArchive`, `inspectCalendarImport`).
  archiveInvalid: 'Elige un archivo de calendario de CucCut (JSON) exportado por una versión compatible.',
  archiveDuplicatePublications: 'El archivo de calendario incluye una publicación dos veces. Vuelve a exportarlo desde el equipo original.',
  archiveDuplicateAccounts: 'El archivo de calendario incluye una cuenta dos veces. Vuelve a exportarlo desde el equipo original.',
  archiveDuplicateConnections: 'El archivo de calendario incluye una conexión dos veces. Vuelve a exportarlo desde el equipo original.',
  archiveDuplicateDestinations: (p: { label: string }) =>
    `«${p.label}» incluye la misma cuenta dos veces en el archivo de calendario. Vuelve a exportarlo desde el equipo original.`,
  archiveTimezone: (p: { timezone: string }) => `El archivo de calendario usa una zona horaria desconocida (${p.timezone}). Vuelve a exportarlo desde el equipo original.`,
  archiveMissingConnection: (p: { name: string }) => `Al archivo de calendario le falta la conexión de «${p.name}».`,
  archiveLinkedAccount: (p: { name: string }) => `La cuenta vinculada de «${p.name}» en el archivo de calendario no es válida.`,
  archiveMissingAccount: (p: { label: string }) => `Al archivo de calendario le falta una cuenta que usa «${p.label}».`,
  archiveInvalidDate: (p: { label: string }) => `El archivo de calendario tiene una fecha no válida para «${p.label}».`,
  importConnectionConflict: (p: { name: string }) =>
    `La conexión «${p.name}» del archivo de calendario entra en conflicto con una conexión de este equipo.`,
  importAccountConflict: (p: { name: string }) => `La cuenta «${p.name}» del archivo de calendario entra en conflicto con una cuenta de este equipo.`,
  importedInFlight: 'Se importó mientras había un envío en curso. Comprueba el resultado en la app de la red y regístralo antes de enviar de nuevo.',
};
