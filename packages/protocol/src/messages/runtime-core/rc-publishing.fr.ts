import type { RcPublishingMessages } from './rc-publishing.ts';

export const fr: RcPublishingMessages = {
  // Who may do what (design §4.2).
  ownerOnly: 'Seul le propriétaire peut faire cela, dans l’application CucCut de cet ordinateur.',
  desktopOnly: 'Autoriser, envoyer, noter les résultats et gérer les connexions ne sont disponibles que dans l’application CucCut de cet ordinateur.',
  settingsOwnerOnly: 'Seul le propriétaire peut modifier le calendrier de publication. Demandez-lui de le modifier dans les paramètres de publication.',
  transferNotAllowed: 'L’import et l’export du calendrier sont disponibles dans l’application CucCut et en ligne de commande.',
  authorizationRequired: 'Le propriétaire doit autoriser cette publication précise dans CucCut avant qu’un agent puisse l’envoyer.',
  // Publications.
  publicationArchived: 'Cette publication est archivée. Restaurez-la avant de la modifier.',
  publicationLocked: 'Les destinations envoyées conservent leur contenu commun. Modifiez une destination en échec ou préparez une nouvelle sortie.',
  destinationLocked: 'L’envoi pour ce compte a déjà commencé. Retirez-le ou notez son résultat avant de le modifier.',
  destinationKept: 'Une destination envoyée reste dans la publication. Retirez-la ou notez son résultat avant de la supprimer.',
  destinationAccountFixed: 'Pour utiliser un autre compte, supprimez cette destination et ajoutez plutôt le compte.',
  destinationNotFound: 'Ce compte ne fait plus partie de la publication. Rechargez-la et réessayez.',
  duplicateAccount: 'Choisissez chaque compte une seule fois.',
  duplicatePlacement: 'Choisissez l’heure de chaque compte une seule fois.',
  afterExpiry: 'Choisissez une heure avant l’expiration de cette publication.',
  invalid: 'Cette publication n’est pas encore prête. Corrigez les problèmes listés, puis réessayez.',
  nothingToSend: 'Tous les comptes de cette publication ont déjà été envoyés. Préparez une nouvelle sortie pour l’envoyer à nouveau.',
  slotTaken: (p: { account: string }) =>
    `Cette heure entre en conflit avec une autre publication pour ${p.account}. Choisissez une autre heure, ou autorisez un intervalle plus court entre les publications dans les paramètres de publication.`,
  calendarRange: 'Choisissez une plage de calendrier d’au plus 93 jours, le début étant antérieur à la fin.',
  archiveInFlight: 'Retirez les envois en attente ou notez leur résultat avant d’archiver cette publication.',
  // Delivery.
  providerUnsupported: 'Cette version de CucCut publie uniquement à la main. Choisissez À la main pour cette connexion.',
  notWaiting: 'Seul un compte en attente de votre action peut être retiré.',
  cancelNotAllowed: 'Seul un compte qui n’a pas été envoyé peut être annulé. Retirez-le, ou notez d’abord son résultat.',
  reconcileFinal: 'Un envoi publié ou annulé fait partie de l’historique. Préparez une nouvelle sortie au lieu de le modifier.',
  reconcileSending: 'Attendez la fin de l’envoi en cours avant de noter un résultat.',
  reconcileFutureTime: 'Saisissez l’heure future affichée par le réseau pour cette publication.',
  // Pinned exports.
  exportRequired: 'Générez et épinglez d’abord la vidéo.',
  exportChanged: 'L’export approuvé a changé. Épinglez un export vérifié avant de publier.',
  exportStale: 'Exportez la révision actuelle avant de l’épingler, ou choisissez Générer et épingler.',
  exportNotFinished: 'Cet export n’est pas encore terminé. Attendez-le ou choisissez un autre export.',
  exportNotVideo: 'Choisissez un export MP4 terminé de la vidéo entière.',
  exportOtherVideo: 'Cet export appartient à une autre vidéo ou séquence. Choisissez un export de cette vidéo.',
  exportFileMissing: 'Le fichier exporté n’est plus sur cet ordinateur. Générez et épinglez de nouveau la vidéo.',
  exportFileChanged: 'Le fichier exporté a changé après sa génération. Générez et épinglez de nouveau la vidéo.',
  pinLocked: 'Les destinations envoyées conservent leur export épinglé. Préparez une nouvelle sortie pour utiliser un autre export.',
  renderFailed: 'L’export de cette publication ne s’est pas terminé. Générez-le et épinglez-le à nouveau.',
  renderCancelled: 'L’export de cette publication a été annulé. Générez-le et épinglez-le à nouveau quand vous êtes prêt.',
  videoNotFound: 'Cette vidéo ne se trouve pas sur cet ordinateur. Ouvrez son projet, puis réessayez.',
  sequenceNotFound: "Cette vidéo n’a pas cette séquence. Omettez la séquence pour publier la séquence principale de la vidéo.",
  sequenceOneVideo: 'Choisissez une séquence seulement lorsque vous préparez une seule vidéo.',
  // Settings, connections and accounts.
  accountNotFound: 'Ce compte n’existe plus. Rechargez les paramètres de publication et réessayez.',
  connectionNotFound: 'Cette connexion n’existe plus. Rechargez les paramètres de publication et réessayez.',
  defaultAccountMissing: 'Un compte par défaut n’existe plus. Choisissez à nouveau les comptes par défaut.',
  connectionProviderFixed: 'Une connexion conserve la voie avec laquelle elle a été ajoutée. Ajoutez une nouvelle connexion pour publier autrement.',
  accountIdentityFixed: 'Un compte conserve sa connexion et son réseau. Ajoutez plutôt un nouveau compte.',
  accountDuplicate: 'Ce compte est déjà ajouté à cette connexion.',
  accountInUse: (p: { name: string }) =>
    `${p.name} a une publication en attente, programmée ou non confirmée. Notez son résultat avant de supprimer le compte.`,
  linkInvalid: 'Choisissez un autre compte du même réseau qui n’est pas lui-même lié.',
  linkCanonical: 'D’autres comptes sont liés à celui-ci. Liez plutôt l’autre voie à ce compte.',
  // Copy proposals.
  proposalReason: 'Brouillon basé sur la vidéo, sa transcription et vos consignes de rédaction. Vérifiez-le avant de l’appliquer.',
  proposalUnreadable: "La réponse du modèle de texte n’a pas pu être lue. Relancez « Proposer un texte » ou rédigez le texte vous-même.",
  /** The name the publishing service opens a video under (shown as the video's opener). */
  principalName: 'Publication CucCut',
  // Calendar transfer and cleanup.
  backupFailed: 'Une sauvegarde des données de publication n’a pas pu être écrite, rien n’a donc été importé. Vérifiez le disque et réessayez.',
};
