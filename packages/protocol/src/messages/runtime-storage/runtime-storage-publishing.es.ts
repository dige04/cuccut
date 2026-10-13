import type { RuntimeStoragePublishingMessages } from './runtime-storage-publishing.ts';

export const es: RuntimeStoragePublishingMessages = {
  unreadable: "No se pudieron leer los datos de publicación. CucCut dejó el archivo tal cual y no lo modificará. Restáuralo desde una copia de seguridad o muévelo a otro lugar para empezar de cero.",
  newerVersion: "Los datos de publicación fueron guardados por una versión más reciente de CucCut. Actualiza CucCut para cambiarlos; hasta entonces solo puedes verlos.",
  conflict: "Esta publicación cambió en otro lugar. Vuelve a cargar la versión guardada antes de aplicar tus cambios.",
  settingsConflict: "La configuración de publicación cambió en otro lugar. Vuelve a cargarla antes de guardar.",
  notFound: "Esta publicación ya no existe.",
  invalidRecord: "Este cambio dejaría un registro de publicación incompleto, así que no se guardó. Revisa los valores e inténtalo de nuevo.",
  writeFailed: "No se pudieron guardar los datos de publicación en el disco. Comprueba que haya espacio disponible y que CucCut pueda escribir en su carpeta, y luego inténtalo de nuevo.",
};
