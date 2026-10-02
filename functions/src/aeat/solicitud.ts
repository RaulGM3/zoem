// Validación de entrada y autorización del callable `verifactuSubmit`, separadas del wiring
// (`onCall`) para poder testearlas sin Firebase. El cliente SOLO aporta {companyId, invoiceId, tipo}:
// endpoint y sandbox se leen siempre de la empresa en servidor.
import { HttpsError } from 'firebase-functions/v2/https';
import { procesarEnvio } from './submit';
import type { EnvioDeps, ResultadoEnvio, SolicitudEnvio } from './submit';

export type Autorizar = (uid: string, companyId: string) => Promise<void>;

function textoNoVacio(valor: unknown): valor is string {
  return typeof valor === 'string' && valor.trim() !== '';
}

export function validarEntrada(data: unknown): SolicitudEnvio {
  const d = typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {};
  const { companyId, invoiceId, tipo } = d;
  if (!textoNoVacio(companyId) || !textoNoVacio(invoiceId)) {
    throw new HttpsError('invalid-argument', 'Faltan companyId o invoiceId');
  }
  if (tipo !== 'alta' && tipo !== 'anulacion') {
    throw new HttpsError('invalid-argument', "tipo debe ser 'alta' o 'anulacion'");
  }
  return { companyId, invoiceId, tipo };
}

/** Autenticación -> validación -> autorización de tenant -> envío. */
export async function manejarSolicitud(
  deps: EnvioDeps,
  autorizar: Autorizar,
  uid: string | undefined,
  data: unknown,
): Promise<ResultadoEnvio> {
  console.log('[Verifactu:debug] manejarSolicitud -> entrada', { uid, data });
  if (!uid) throw new HttpsError('unauthenticated', 'Autenticación requerida');
  const solicitud = validarEntrada(data);
  // Las Cloud Functions BYPASSEAN las rules: la autorización de tenant se hace aquí.
  try {
    await autorizar(uid, solicitud.companyId);
  } catch (err) {
    console.error('[Verifactu:debug] manejarSolicitud -> autorización DENEGADA', { uid, companyId: solicitud.companyId, err });
    throw err;
  }

  let resultado: ResultadoEnvio;
  try {
    resultado = await procesarEnvio(deps, solicitud);
  } catch (err) {
    console.error('[Verifactu:debug] manejarSolicitud -> procesarEnvio LANZÓ', solicitud, err);
    throw err;
  }
  if (resultado.motivo === 'factura_no_encontrada') {
    throw new HttpsError('not-found', 'Factura no encontrada para esta empresa');
  }
  return resultado;
}
