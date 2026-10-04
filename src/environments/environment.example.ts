// Plantilla: copia a environment.ts / environment.prod.ts (ambos ignorados por git) y rellena los valores.
export const environment = {
  production: false,
  useEmulators: false,
  firebase: {
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: '',
    measurementId: '',
    databaseId: undefined as string | undefined,
  },
  recaptchaSiteKey: '',
  // Web Push certificate (Firebase Console > Project settings > Cloud Messaging > Web Push certificates).
  // Si queda vacío, el web push se desactiva (la app nativa no lo necesita).
  vapidKey: '',
};
