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
  // Maps JavaScript API para el autocompletado de ciudades (Places API New). Limita la clave por referrer HTTP
  // y solo a Places API (New), y pon una alerta de presupuesto en GCP. Si queda vacío, la ciudad se escribe a mano.
  googleMapsApiKey: '',
  // Web Push certificate (Firebase Console > Project settings > Cloud Messaging > Web Push certificates).
  // Si queda vacío, el web push se desactiva (la app nativa no lo necesita).
  vapidKey: '',
};
