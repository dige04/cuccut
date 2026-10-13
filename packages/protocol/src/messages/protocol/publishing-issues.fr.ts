import type { PublishingIssuesMessages } from './publishing-issues.ts';

export const fr: PublishingIssuesMessages = {
  // Validation (`validatePublication`).
  approvalRequired: 'Approuvez l’export épinglé avant de publier.',
  exportRequired: 'Générez et épinglez la vidéo pour la publier.',
  accountsRequired: 'Choisissez au moins un compte.',
  timezoneInvalid: 'Choisissez un fuseau horaire valide.',
  accountUnavailable: 'Ce compte n’est plus disponible. Reconnectez-le ou choisissez un autre compte.',
  accountDuplicateRoute: 'Le même compte est sélectionné via deux voies. Choisissez une seule voie.',
  accountNotConnected: 'Connectez ce compte dans les paramètres de publication avant d’envoyer.',
  formatMismatch: 'Ce format ne correspond pas au réseau du compte. Choisissez un autre format.',
  descriptionRequired: 'Rédigez une description pour ce compte.',
  titleLength: (p: { max: number }) => `YouTube exige un titre de 1 à ${p.max} caractères.`,
  audienceRequired: 'Indiquez si cette vidéo YouTube est destinée aux enfants.',
  tagsTooLong: (p: { max: number }) => `Limitez les tags YouTube à ${p.max} caractères, sinon YouTube pourrait les supprimer.`,
  shortTooLong: 'Les Shorts YouTube durent au maximum trois minutes. Choisissez Vidéo YouTube ou raccourcissez l’export.',
  shortsClassification: 'YouTube considère comme Shorts les vidéos carrées ou verticales d’au plus trois minutes. Choisissez YouTube Short pour cet export.',
  portraitRequired: 'Ce format exige un export vertical ou carré. Générez une version verticale ou choisissez un autre format.',
  captionTooLong: (p: { length: number; max: number }) => `La description et les hashtags comptent ${p.length} caractères ; ce réseau en autorise ${p.max}. Raccourcissez-les.`,
  timeInPast: 'Cette heure est passée. Choisissez une heure future, ou effacez-la pour envoyer maintenant.',
  expiresBefore: 'Cette publication expire avant sa mise en ligne. Choisissez une heure plus tôt ou une expiration plus tardive.',
  deliveryUnsettled:
    'Une autre sortie de cette vidéo vers ce compte attend encore ou n’est pas confirmée. Notez son résultat avant de renvoyer.',
  // Route options (`routeOptionIssues`).
  optionUnlistedYoutubeOnly: 'La visibilité « non répertorié » n’est disponible que sur YouTube.',
  optionTagsYoutubeOnly: 'Les tags ne sont disponibles que sur YouTube. Placez plutôt les hashtags dans la description.',
  optionPhoneYoutubeTags: 'La voie téléphone ne peut pas définir de tags YouTube. Supprimez-les ou choisissez une autre voie.',
  optionPostbridgeYoutubeAudience:
    'Postbridge ne peut pas définir le public ni la visibilité YouTube. Acceptez les réglages configurés dans Postbridge ou choisissez une autre voie.',
  optionPostgunSynthetic: 'Postgun ne peut pas ajouter la mention de média synthétique de YouTube. Choisissez une autre voie.',
  optionYoutubeApiInteractions: 'Cette voie ne peut pas appliquer les options d’interaction ou de partenariat YouTube sélectionnées.',
  optionInstagramApi: 'Cette voie ne peut pas appliquer les options de visibilité, de mention ou d’interaction Instagram sélectionnées.',
  // Local times and slots (`localInstant`, `planSlots`, `resolveTimeField`, `calendarPlacements`).
  timeInvalid: 'Saisissez une date et une heure valides.',
  timeRequired: 'Choisissez une date et une heure.',
  timeGap: (p: { timezone: string }) => `Cette heure n’existe pas à ${p.timezone} en raison du changement d’heure. Choisissez une autre heure.`,
  timeFold: (p: { timezone: string }) =>
    `Cette heure se produit deux fois à ${p.timezone} en raison du changement d’heure. Saisissez un horodatage précis avec son décalage UTC.`,
  timestampInvalid: 'Saisissez un horodatage avec son décalage UTC, par exemple 2026-10-01T18:00:00-06:00.',
  noFreeSlot: 'Aucun créneau libre ne tient avant l’expiration. Vérifiez ses comptes, les heures hebdomadaires et l’espacement.',
  destinationMissing: 'Ce compte ne fait plus partie de la publication. Rechargez-la et réessayez.',
  // Calendar files (`parseCalendarArchive`, `inspectCalendarImport`).
  archiveInvalid: 'Choisissez un fichier de calendrier CucCut (JSON) exporté par une version prise en charge.',
  archiveDuplicatePublications: 'Le fichier de calendrier répertorie une publication deux fois. Exportez-le à nouveau depuis l’ordinateur d’origine.',
  archiveDuplicateAccounts: 'Le fichier de calendrier répertorie un compte deux fois. Exportez-le à nouveau depuis l’ordinateur d’origine.',
  archiveDuplicateConnections: 'Le fichier de calendrier répertorie une connexion deux fois. Exportez-le à nouveau depuis l’ordinateur d’origine.',
  archiveDuplicateDestinations: (p: { label: string }) =>
    `« ${p.label} » répertorie deux fois le même compte dans le fichier de calendrier. Exportez-le à nouveau depuis l’ordinateur d’origine.`,
  archiveTimezone: (p: { timezone: string }) => `Le fichier de calendrier utilise un fuseau horaire inconnu (${p.timezone}). Exportez-le à nouveau depuis l’ordinateur d’origine.`,
  archiveMissingConnection: (p: { name: string }) => `Le fichier de calendrier ne contient pas la connexion de « ${p.name} ».`,
  archiveLinkedAccount: (p: { name: string }) => `Le compte lié de « ${p.name} » dans le fichier de calendrier est invalide.`,
  archiveMissingAccount: (p: { label: string }) => `Le fichier de calendrier ne contient pas un compte utilisé par « ${p.label} ».`,
  archiveInvalidDate: (p: { label: string }) => `Le fichier de calendrier contient une date invalide pour « ${p.label} ».`,
  importConnectionConflict: (p: { name: string }) =>
    `La connexion « ${p.name} » du fichier de calendrier entre en conflit avec une connexion de cet ordinateur.`,
  importAccountConflict: (p: { name: string }) => `Le compte « ${p.name} » du fichier de calendrier entre en conflit avec un compte de cet ordinateur.`,
  importedInFlight: 'Importé pendant un envoi. Vérifiez le résultat dans l’application du réseau et notez-le avant de renvoyer.',
};
