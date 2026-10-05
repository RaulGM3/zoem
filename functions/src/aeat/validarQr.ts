// Lógica del callable `validarQrFacturaRecibida`, separada del wiring para testearla sin Firebase.
// El cliente SOLO aporta {companyId, facturaId}: la URL a consultar sale del `qr.url` almacenado, se vuelve a
// parsear con la lista blanca de hosts/rutas de la AEAT y se RECONSTRUYE antes de la petición (anti-SSRF).
import { HttpsError } from 'firebase-functions/v2/https';
import type { EstadoQr } from './estadoQr';
import { parseValidarQr } from './parseValidarQr';
import { parseQrVerifactu } from './qrVerifactu';
import type { Consultar } from './validarQrFetch';

export type Autorizar = (uid: string, companyId: string) => Promise<void>;

export interface SolicitudValidarQr {
  companyId: string;
  facturaId: string;
}

/** Lo que se persiste en `qrValidacion` (el adaptador añade `at` con la hora del servidor). */
export interface QrValidacionServidor {
  estado: Extract<EstadoQr, 'encontrada' | 'no_encontrada' | 'no_verificable' | 'error'>;
  /** Enlace de consulta manual en la sede de la AEAT. */
  urlConsulta: string;
  /** Solo en `error`. */
  mensaje?: string;
}

export interface ValidarQrDeps {
  /** `null` si no existe en esa empresa. `qrUrl` null si la factura no tiene QR. */
  leerFactura(companyId: string, facturaId: string): Promise<{ qrUrl: string | null } | null>;
  consultar: Consultar;
  guardar(companyId: string, facturaId: string, validacion: QrValidacionServidor): Promise<void>;
}

const MENSAJE_RED = 'No se pudo consultar a la AEAT. Inténtalo más tarde o verifica la factura manualmente.';

const textoNoVacio = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

export function validarEntrada(data: unknown): SolicitudValidarQr {
  const d = typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {};
  const { companyId, facturaId } = d;
  if (!textoNoVacio(companyId) || !textoNoVacio(facturaId)) {
    throw new HttpsError('invalid-argument', 'Faltan companyId o facturaId');
  }
  return { companyId, facturaId };
}

/** Autenticación -> validación -> autorización de tenant (Admin/Gestor) -> consulta -> persistencia. */
export async function manejarValidarQr(
  deps: ValidarQrDeps,
  autorizar: Autorizar,
  uid: string | undefined,
  data: unknown,
): Promise<QrValidacionServidor> {
  if (!uid) throw new HttpsError('unauthenticated', 'Autenticación requerida');
  const { companyId, facturaId } = validarEntrada(data);
  // Las Cloud Functions BYPASSEAN las rules: la autorización de tenant se hace aquí.
  await autorizar(uid, companyId);

  const factura = await deps.leerFactura(companyId, facturaId);
  if (!factura) throw new HttpsError('not-found', 'Factura no encontrada para esta empresa');
  if (!factura.qrUrl) throw new HttpsError('failed-precondition', 'La factura no tiene QR');

  const qr = parseQrVerifactu(factura.qrUrl);
  if (!qr.ok) throw new HttpsError('failed-precondition', `QR no válido: ${qr.motivo}`);
  const urlConsulta = qr.datos.url;

  let validacion: QrValidacionServidor;
  try {
    const { status, html } = await deps.consultar(urlConsulta);
    if (status !== 200) {
      validacion = { estado: 'error', urlConsulta, mensaje: `La AEAT respondió con HTTP ${status}.` };
    } else {
      const r = parseValidarQr(html);
      validacion =
        r.estado === 'error'
          ? { estado: 'error', urlConsulta, mensaje: r.mensaje ?? 'Respuesta de la AEAT no reconocida.' }
          : { estado: r.estado, urlConsulta };
    }
  } catch {
    validacion = { estado: 'error', urlConsulta, mensaje: MENSAJE_RED };
  }

  await deps.guardar(companyId, facturaId, validacion);
  return validacion;
}
