# Checklist de producción — comandos

> Reemplazá `<projectId>` por el id del proyecto nuevo. Conviene crear un alias
> `prod` con `firebase use --add` y usar `--project prod`.

## 0. Autenticación e identificación del proyecto

```bash
npx -y firebase-tools@latest login
npx -y firebase-tools@latest projects:list
npx -y firebase-tools@latest use --add        # crear alias "prod" → <projectId>
```

## 1. Higiene de git (ya aplicada en código, verificar)

```bash
# Los archivos sensibles ya fueron sacados del índice. Confirmá que no vuelvan:
git ls-files functions/.env.vertey-cf1b9 functions/firebase-debug.log   # debe salir vacío
git status   # functions/.gitignore nuevo + los dos archivos como "deleted" del índice
```

## 2. Secrets (antes de desplegar functions)

```bash
npx -y firebase-tools@latest functions:secrets:set ELEVENLABS_WEBHOOK_SECRET --project prod
# VERIFACTU_ENV: dejar default 'sandbox'; pasar a 'production' por env var cuando AEAT esté listo
```

## 3. Tests y build en verde (gating del release)

```bash
npm test                              # suite Angular (vitest) — debe pasar
npm --prefix functions run build      # compila functions (TS) — debe pasar
```

## 4. Deploy de rules, indexes, storage y functions (europe-west1)

```bash
npx -y firebase-tools@latest deploy --only firestore:rules,firestore:indexes,storage --project prod
npx -y firebase-tools@latest deploy --only functions --project prod
```

## 5. Borrar functions viejas en us-central1

> La región no se cambia in-place: el deploy crea las nuevas en europe-west1, pero
> las viejas en us-central1 quedan vivas hasta que las borres.

```bash
npx -y firebase-tools@latest functions:delete elevenLabsWebhook   --region us-central1 --project prod
npx -y firebase-tools@latest functions:delete storeAeatCredential --region us-central1 --project prod
npx -y firebase-tools@latest functions:delete verifactuSubmit     --region us-central1 --project prod
npx -y firebase-tools@latest functions:delete generateDocx        --region us-central1 --project prod
```

## 6. Build de producción Angular + hosting

```bash
npm run build
npx -y firebase-tools@latest deploy --only hosting --project prod
```

## 7. Acciones manuales NO-CLI (no olvidar)

- [ ] Firestore creado en ubicación **`eur3`** (irreversible).
- [ ] `firebaseConfig` del proyecto nuevo pegado en `environment.prod.ts`.
- [ ] URL del **webhook actualizada en el panel de ElevenLabs** (nueva región).
- [ ] `users/{tuUid}.isSuperUser = true` seteado a mano (primer superusuario).
- [ ] `agentMappings` registrado para RecepciónIA.
- [ ] Decisión sobre App Check antes de poner `enforceAppCheck: true`.

## 8. Smoke test post-deploy

```bash
npx -y firebase-tools@latest functions:list --project prod   # todo en europe-west1
```

- [ ] Login + crear caso + subir documento + dashboard OK.
- [ ] Usuario sin rol Admin/Gestor NO puede llamar storeAeatCredential/verifactuSubmit (permission-denied).
- [ ] Webhook sin firma válida → 403; sin secret → 500.
