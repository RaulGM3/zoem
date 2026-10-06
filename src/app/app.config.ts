import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding, withPreloading } from '@angular/router';
import { PrecargaLigera } from './core/navegacion/precarga-ligera';
import { provideAgentTools } from './core/agent/agent-tools';
import { provideFirebaseApp, initializeApp, getApp } from '@angular/fire/app';
import { provideAppCheck, initializeAppCheck, ReCaptchaEnterpriseProvider } from '@angular/fire/app-check';
import { provideAuth, getAuth, connectAuthEmulator } from '@angular/fire/auth';
import { provideFirestore, getFirestore, connectFirestoreEmulator } from '@angular/fire/firestore';
import { provideStorage, getStorage, connectStorageEmulator } from '@angular/fire/storage';
import { provideMessaging, getMessaging } from '@angular/fire/messaging';
import { provideFunctions, getFunctions, connectFunctionsEmulator } from '@angular/fire/functions';

import { Capacitor } from '@capacitor/core';
import { routes } from './app.routes';
import { shouldProvideWebMessaging } from './core/firebase/messaging-providers';
import { environment } from '../environments/environment';

// Región de Cloud Functions (debe coincidir con setGlobalOptions del backend).
const FUNCTIONS_REGION = 'europe-west1';

declare global {
  interface Window {
    FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string;
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding(), withPreloading(PrecargaLigera)),
    provideAgentTools(),
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    provideAppCheck(() => {
      if (!environment.production) {
        window.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
      }
      return initializeAppCheck(getApp(), {
        provider: new ReCaptchaEnterpriseProvider(environment.recaptchaSiteKey),
        isTokenAutoRefreshEnabled: true,
      });
    }),
    provideAuth(() => {
      const auth = getAuth();
      if (environment.useEmulators) {
        connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
      }
      return auth;
    }),
    provideFirestore(() => {
      const firestore = environment.firebase.databaseId
        ? getFirestore(getApp(), environment.firebase.databaseId)
        : getFirestore();
      if (environment.useEmulators) {
        connectFirestoreEmulator(firestore, 'localhost', 8080);
      }
      return firestore;
    }),
    provideStorage(() => {
      const storage = getStorage();
      if (environment.useEmulators) {
        connectStorageEmulator(storage, 'localhost', 9199);
      }
      return storage;
    }),
    provideFunctions(() => {
      const functions = getFunctions(getApp(), FUNCTIONS_REGION);
      if (environment.useEmulators) {
        connectFunctionsEmulator(functions, 'localhost', 5001);
      }
      return functions;
    }),
    // Web push (FCM): solo navegador con Service Worker; nativo usa @capacitor/push-notifications.
    ...(shouldProvideWebMessaging(Capacitor.isNativePlatform(), typeof navigator === 'undefined' ? undefined : navigator)
      ? [provideMessaging(() => getMessaging())]
      : []),
  ],
};
