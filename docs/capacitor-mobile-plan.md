# Plan: Zoem en iOS y Android con Capacitor

> Objetivo: publicar la web app actual en App Store y Play Store **con push notifications**,
> sin romper la web. Futuro (parqueado): escáner de boletas/facturas.

## Contexto del proyecto (verificado)

- Angular **21** SPA pura — builder `@angular/build:application`, salida `dist/Zoem/browser`, **sin SSR**.
- **Firebase web SDK** (`firebase` ^12 + `@angular/fire` ^21).
- Tailwind 4, standalone components, signals.

## Principio rector: la web NO se rompe

**Capacitor es aditivo, no sustitutivo.** No toca `ng build`.

- El MISMO `dist/Zoem/browser` sirve a las 3 plataformas: web, iOS, Android.
- El deploy web a Firebase Hosting queda igual (cero cambios).
- Capacitor crea dos carpetas nuevas en el repo: `/ios` y `/android` (proyectos nativos).
- Todo código nativo va detrás de un guard y encapsulado en un service de abstracción:

```ts
import { Capacitor } from '@capacitor/core';

if (Capacitor.isNativePlatform()) {
  // Solo iOS/Android. En web es código muerto.
}
```

Componentes piden "registrame para push" a un `PushService` y NO saben si están en web o nativo
(single responsibility + container pattern).

---

## Fase 0 — Cuentas y prerrequisitos (manual, no es código)

- [ ] **Apple Developer Program** — 99 USD/año (obligatorio para push iOS y publicar).
- [ ] **Google Play Console** — 25 USD una vez.
- [ ] **Xcode** instalado (Mac ✓ ya lo tenés).
- [ ] **Android Studio** instalado.

## Fase 1 — Scaffolding Capacitor (sin tocar código Angular)

- [ ] `npm i @capacitor/core` + `npm i -D @capacitor/cli`
- [ ] `npx cap init` → app name "Zoem", appId tipo `com.zoem.app`
- [ ] Configurar `webDir: 'dist/Zoem/browser'` en `capacitor.config.ts`
- [ ] `npm i @capacitor/ios @capacitor/android` → `npx cap add ios && npx cap add android`
- [ ] `ng build && npx cap sync` → `npx cap open ios` (correr en simulador)
- [ ] **Verificar router / base href** bajo `capacitor://localhost` (base href debe ser `/`).
- [ ] **Firebase Auth en WebView**: usar `indexedDBLocalPersistence` o la sesión se pierde.
      Email/password va bien. Google/Apple Sign-In → requieren plugin nativo (ver nota auth).

## Fase 2 — Push notifications (FCM)

- [ ] Backend: **Firebase Cloud Messaging** (ya usás Firebase, mismo backend web + nativo).
- [ ] `npm i @capacitor/push-notifications @capacitor-firebase/messaging`
- [ ] Crear `PushService` (abstracción): registro de token, permisos, handlers.
- [ ] **iOS**: subir **APNs key** a Firebase Console + activar capability "Push Notifications"
      en Xcode (requiere cuenta Apple paga).
- [ ] **Android**: `google-services.json` en el proyecto Android.
- [ ] Guardar el FCM token del usuario en Firestore para poder enviarle push dirigido.

## Fase 3 — Escáner de boletas/facturas (FUTURO, parqueado)

- [ ] `@capacitor/camera` para captura.
- [ ] Para recorte tipo "document scanner": evaluar plugin community (mlkit document scanner).
- [ ] Encapsular en `ScannerService` con el mismo patrón de abstracción.

---

## Gotchas que NO pueden morder después

1. **Firebase Auth + WebView**: popup/redirect NO anda bien en WebView. Email/password OK;
   social login (Google/Apple) requiere `@capacitor-firebase/authentication` (plugin nativo).
   > Nota: el botón de Google login ya estaba comentado en `login.html`.
2. **Apple "Sign in with Apple"**: si ofrecés login social, Apple lo EXIGE o rechaza la review.
3. **Apple guideline 4.2 (minimum functionality)**: una app "solo web envuelta" sin features
   nativas a veces la rechazan. El **push notifications** justifica la razón nativa de existir.
4. **Apple revisa a mano** — presupuestar tiempo de review (días) en cada release.

## Orden recomendado de arranque

`Fase 0 (cuentas)` → `Fase 1 (scaffolding + correr en simulador)` → `Fase 2 (push)`.
La Fase 1 no requiere las cuentas pagas; podés ver la app en simulador antes de pagar nada.
Las cuentas pagas se vuelven obligatorias para **push en dispositivo real** y para **publicar**.
