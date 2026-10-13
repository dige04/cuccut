import type { RcPublishingMessages } from './rc-publishing.ts';

export const es: RcPublishingMessages = {
  // Who may do what (design §4.2).
  ownerOnly: 'Solo el propietario puede hacer esto, en la app de CucCut de este equipo.',
  desktopOnly: 'Autorizar, enviar, registrar resultados y gestionar conexiones solo está disponible en la app de CucCut de este equipo.',
  settingsOwnerOnly: 'Solo el propietario puede cambiar el horario de publicación. Pídele que lo cambie en los ajustes de publicación.',
  transferNotAllowed: 'La importación y exportación del calendario están disponibles en la app de CucCut y en la línea de comandos.',
  authorizationRequired: 'El propietario debe autorizar esta publicación exacta en CucCut antes de que un agente pueda enviarla.',
  // Publications.
  publicationArchived: 'Esta publicación está archivada. Restáurala antes de cambiarla.',
  publicationLocked: 'Los destinos enviados conservan su contenido compartido. Edita un destino fallido o prepara un nuevo lanzamiento.',
  destinationLocked: 'El envío de esta cuenta ya ha comenzado. Retíralo o registra su resultado antes de cambiarlo.',
  destinationKept: 'Un destino enviado permanece en la publicación. Retíralo o registra su resultado antes de quitarlo.',
  destinationAccountFixed: 'Para usar otra cuenta, quita este destino y añade la cuenta en su lugar.',
  destinationNotFound: 'Esta cuenta ya no forma parte de la publicación. Recárgala e inténtalo de nuevo.',
  duplicateAccount: 'Elige cada cuenta solo una vez.',
  duplicatePlacement: 'Elige la hora de cada cuenta solo una vez.',
  afterExpiry: 'Elige una hora antes de que caduque esta publicación.',
  invalid: 'Esta publicación todavía no está lista. Corrige los problemas indicados e inténtalo de nuevo.',
  nothingToSend: 'Todas las cuentas de esta publicación ya se enviaron. Prepara un nuevo lanzamiento para enviarla de nuevo.',
  slotTaken: (p: { account: string }) =>
    `Esta hora entra en conflicto con otra publicación de ${p.account}. Elige otra hora o permite menos tiempo entre publicaciones en los ajustes de publicación.`,
  calendarRange: 'Elige un rango de calendario de como máximo 93 días, con el inicio antes del final.',
  archiveInFlight: 'Retira los envíos pendientes o registra su resultado antes de archivar esta publicación.',
  // Delivery.
  providerUnsupported: 'Esta versión de CucCut solo publica manualmente. Elige Manual para esta conexión.',
  notWaiting: 'Solo se puede retirar una cuenta que espera tu acción.',
  cancelNotAllowed: 'Solo se puede cancelar una cuenta que no se envió. Retírala o registra antes su resultado.',
  reconcileFinal: 'Un envío publicado o cancelado forma parte del historial. Prepara un nuevo lanzamiento en lugar de cambiarlo.',
  reconcileSending: 'Espera a que termine el envío actual antes de registrar un resultado.',
  reconcileFutureTime: 'Introduce la hora futura que muestra la red para esta publicación.',
  // Pinned exports.
  exportRequired: 'Renderiza y fija primero el vídeo.',
  exportChanged: 'La exportación aprobada cambió. Fija una exportación verificada antes de publicar.',
  exportStale: 'Exporta la revisión actual antes de fijarla, o elige Renderizar y fijar.',
  exportNotFinished: 'Esta exportación no ha terminado. Espera a que termine o elige otra exportación.',
  exportNotVideo: 'Elige una exportación MP4 terminada de todo el vídeo.',
  exportOtherVideo: 'Esta exportación es de otro vídeo o secuencia. Elige una exportación de este vídeo.',
  exportFileMissing: 'El archivo exportado ya no está en este equipo. Renderiza y fija de nuevo el vídeo.',
  exportFileChanged: 'El archivo exportado cambió después de renderizarse. Renderiza y fija de nuevo el vídeo.',
  pinLocked: 'Los destinos enviados conservan su exportación fijada. Prepara un nuevo lanzamiento para usar otra exportación.',
  renderFailed: 'La exportación de esta publicación no terminó. Renderízala y fíjala de nuevo.',
  renderCancelled: 'La exportación de esta publicación se canceló. Renderízala y fíjala de nuevo cuando quieras.',
  videoNotFound: 'Este vídeo no está en este equipo. Abre su proyecto y luego inténtalo de nuevo.',
  sequenceNotFound: "This video has no such sequence. Leave the sequence out to publish the video's main sequence.",
  sequenceOneVideo: 'Choose a sequence only when preparing one video.',
  // Settings, connections and accounts.
  accountNotFound: 'Esta cuenta ya no existe. Recarga los ajustes de publicación e inténtalo de nuevo.',
  connectionNotFound: 'Esta conexión ya no existe. Recarga los ajustes de publicación e inténtalo de nuevo.',
  defaultAccountMissing: 'Una cuenta predeterminada ya no existe. Vuelve a elegir las cuentas predeterminadas.',
  connectionProviderFixed: 'Una conexión conserva la ruta con la que se añadió. Añade una nueva conexión para publicar de otra forma.',
  accountIdentityFixed: 'Una cuenta conserva su conexión y su red. Añade una cuenta nueva en su lugar.',
  accountDuplicate: 'Esta cuenta ya está añadida a esta conexión.',
  accountInUse: (p: { name: string }) =>
    `${p.name} tiene una publicación pendiente, programada o sin confirmar. Registra su resultado antes de quitar la cuenta.`,
  linkInvalid: 'Elige otra cuenta de la misma red que no esté vinculada a sí misma.',
  linkCanonical: 'Otras cuentas están vinculadas a esta. Vincula la otra ruta a esta cuenta en su lugar.',
  // Copy proposals.
  proposalReason: 'Borrador basado en el vídeo, su transcripción y tus pautas de redacción. Revísalo antes de aplicarlo.',
  proposalUnreadable: "The text model's answer couldn't be read. Try Propose text again, or write the text yourself.",
  /** The name the publishing service opens a video under (shown as the video's opener). */
  principalName: 'Publicación de CucCut',
  // Calendar transfer and cleanup.
  backupFailed: 'No se pudo escribir una copia de seguridad de los datos de publicación, así que no se importó nada. Revisa el disco e inténtalo de nuevo.',
};
