# Setup del proyecto Firebase de PRODUCCIÓN (nuevo)

> El proyecto actual `vertey-cf1b9` se mantiene para hosting de prueba / TestFlight.
> Este runbook es para conectar el **proyecto nuevo** que apuntará a
> `src/environments/environment.prod.ts`.
>
> Regla de oro: la `apiKey` de Firebase **NO es un secreto** (va en el bundle del
> cliente). Lo que protege tu data son las **security rules** y la **autorización
> en las Cloud Functions**. No pierdas tiempo escondiendo la apiKey.

## 1. Crear el proyecto

1. console.firebase.google.com → **Añadir proyecto**. Anotá el `projectId`.
2. Subí al plan **Blaze** (pago por uso). Obligatorio para Cloud Functions y Secret Manager.

## 2. Provisionar servicios (¡ojo con las regiones irreversibles!)

| Servicio | Acción | Región |
|----------|--------|--------|
| **Firestore** | Crear base de datos, modo producción | ⚠️ **`eur3`** (Europa) — **NO se puede cambiar después** |
| **Storage** | Habilitar | Misma región europea |
| **Authentication** | Habilitar **Email/Password** (+ Google si se usa) | — |
| **Cloud Functions** | Se despliegan a **`europe-west1`** (ya forzado por `setGlobalOptions` en `functions/src/index.ts`) | `europe-west1` |

## 3. Conectar el cliente

1. ⚙️ → Configuración del proyecto → Tus apps → **Web app** → registrar.
2. Copiar el objeto `firebaseConfig` y pegarlo en
   `src/environments/environment.prod.ts` (apiKey, authDomain, projectId,
   storageBucket, messagingSenderId, appId, measurementId).
3. Dejar `production: true` y `useEmulators: false` en ese archivo.

> El cliente ya invoca las functions en `europe-west1`
> (`getFunctions(getApp(), 'europe-west1')` en `app.config.ts`). Si cambiás la
> región del backend, actualizá también esa constante.

## 4. Secrets (Secret Manager) — ANTES de desplegar functions

```bash
npx -y firebase-tools@latest functions:secrets:set ELEVENLABS_WEBHOOK_SECRET --project <projectId>
```

- `ELEVENLABS_WEBHOOK_SECRET`: el secret del webhook de tu cuenta ElevenLabs.
  Sin esto, el webhook responde **500** (fail-closed) — es a propósito.
- `VERIFACTU_ENV`: se define con `defineString` (default `sandbox`). Cambialo a
  `production` por variable de entorno solo cuando AEAT esté en real.
- Los certificados AEAT (`.pfx`) se guardan solos en Secret Manager vía la
  function `storeAeatCredential` (uno por empresa, cifrado). No se cargan a mano.

## 5. Desplegar rules, indexes y functions

Ver `docs/PRODUCTION-CHECKLIST.md` para la secuencia exacta de comandos.

## 6. Pasos manuales que SE OLVIDAN (no los saltes)

- [ ] **Webhook ElevenLabs**: actualizar la URL en el panel de ElevenLabs a
      `https://europe-west1-<projectId>.cloudfunctions.net/elevenLabsWebhook`
      (cambió respecto a us-central1).
- [ ] **Primer superusuario**: registrate normal en la app, luego en Firestore
      poné a mano `users/{tuUid}.isSuperUser = true`. No hay otro bootstrap.
- [ ] **agentMappings**: registrar el mapeo `agentId → companyId` para RecepciónIA
      (solo un superusuario puede escribir esa colección).
- [ ] **App Check** (opcional, recomendado): si querés activar
      `enforceAppCheck: true` en las functions de AEAT, registrá reCAPTCHA v3 /
      App Attest y añadí `provideAppCheck(...)` al cliente. Hoy quedan en `false`
      y la seguridad la da la autorización de tenant (`assertCompanyAccess`).
- [ ] **Hosting**: conectar el dominio de producción y desplegar el build.

## 7. Verificación post-deploy

- `firebase functions:list` → todo en `europe-west1`.
- Un usuario que NO es Admin/Gestor de una empresa NO puede invocar
  `storeAeatCredential`/`verifactuSubmit` con ese `companyId` (→ `permission-denied`).
- POST al webhook sin firma válida → `403`; sin secret configurado → `500`.
- Login + crear caso + subir documento + ver dashboard funcionan contra el proyecto nuevo.
