import { onCall } from 'firebase-functions/v2/https';
import { assertCompanyAccess } from '../lib/assertCompanyAccess';
import { crearDeps } from './adapters';
import { manejarSolicitud } from './solicitud';
import type { ResultadoEnvio } from './submit';

/**
 * Callable de envío a AEAT: entrada `{companyId, invoiceId, tipo: 'alta'|'anulacion'}`.
 * Solo cableado; la lógica vive en solicitud.ts / submit.ts (testeadas). Reintentar una factura
 * `error`/`pendiente`/`en_cola` es llamar de nuevo con la misma entrada.
 * Timeout 120 s: un envío (30 s de socket) + liquidación + drenaje de cortesía.
 */
export const verifactuSubmit = onCall<unknown, Promise<ResultadoEnvio>>(
  { enforceAppCheck: false, timeoutSeconds: 120, invoker: 'public' },
  (request) => manejarSolicitud(crearDeps(), assertCompanyAccess, request.auth?.uid, request.data),
);
