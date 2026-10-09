// Orquestador del envío Verifactu. Sin I/O propio: Firestore, red y certificados llegan
// por puertos (ports.ts). Flujo: tx de entrada/reserva -> envío FUERA de la transacción ->
// tx de liquidación. Ninguna llamada de red ocurre dentro de una transacción.
import { esEmpresaDemo } from '../autoservicio/suscripcion';
import {
  aplicarDecision,
  decidirEntrada,
  decidirLiquidacion,
  decidirReenvio,
  reservarDesdeCola,
  siguienteEnCola,
} from './chain';
import type { EntradaCadena, TipoRegistro } from './chain';
import { esSandbox, soapEndpoint } from './endpoints';
import { parseRespuesta } from './parseResponse';
import type { Resultado } from './parseResponse';
import { MENSAJE_SIN_CERTIFICADO, clasificarErrorCredenciales, mensajeCredenciales } from './credenciales';
import type { ChainStore, Clock, Credenciales, CredentialReader, DocReader, SoapSender } from './ports';
import { validarPrecondiciones } from './preconditions';
import type { CodigoPrecondicion } from './preconditions';
import type { CompanyDoc, EstadoVerifactu, InvoiceDoc, PendingRecord, QueueEntry } from './types';

export interface EnvioDeps {
  store: ChainStore;
  docs: DocReader;
  sender: SoapSender;
  credentials: CredentialReader;
  clock: Clock;
}

export interface SolicitudEnvio {
  companyId: string;
  invoiceId: string;
  tipo: TipoRegistro;
}

export type ResultadoEnvio =
  | { sent: false; motivo: 'verifactu_desactivado' }
  | { sent: false; motivo: 'factura_no_encontrada' }
  | { sent: false; motivo: 'precondicion'; codigo: CodigoPrecondicion; mensaje: string; estado: 'error' }
  | { sent: false; motivo: 'certificado'; mensaje: string; estado: 'error' }
  /** `sent` = AEAT lo tiene aceptado (estado `enviado`); el resto de estados se leen en `estado`. */
  | { sent: boolean; motivo?: undefined; estado: EstadoVerifactu; mensaje?: string; csv?: string };

export interface OpcionesDrenaje {
  /** Reintento manual: ignora backoff y control de flujo (sigue siendo un solo envío). */
  forzar?: boolean;
}

const iso = (d: Date): string => d.toISOString();

/** Mensaje legible de cualquier error (los `catch` de este módulo no deben tragarse el motivo). */
function detalleError(err: unknown): { message: string; code?: unknown; stack?: string } {
  if (err instanceof Error) return { message: err.message, code: (err as { code?: unknown }).code, stack: err.stack };
  return { message: String(err) };
}

/** Sandbox salvo que la empresa diga explícitamente `sandbox: false` (lectura SIEMPRE en servidor). */
export function endpointDe(company: CompanyDoc): string {
  return soapEndpoint(esSandbox(company.verifactu));
}

function estadoDe(invoice: InvoiceDoc, tipo: TipoRegistro) {
  const v = invoice.verifactu;
  return tipo === 'alta' ? v : v?.anulacion;
}

async function cargarOriginal(docs: DocReader, invoice: InvoiceDoc, tipo: TipoRegistro): Promise<InvoiceDoc | undefined> {
  if (tipo !== 'alta' || invoice.tipoFactura !== 'R1' || !invoice.facturaRectificadaId) return undefined;
  return (await docs.getInvoice(invoice.companyId, invoice.facturaRectificadaId)) ?? undefined;
}

async function marcarError(
  deps: EnvioDeps,
  companyId: string,
  invoiceId: string,
  tipo: TipoRegistro,
  errorKind: 'precondicion' | 'configuracion',
  errorMessage: string,
): Promise<void> {
  await deps.store.runTx(companyId, async (tx) => {
    await tx.patchVerifactu(invoiceId, tipo, { estado: 'error', tipoRegistro: tipo, errorKind, errorMessage });
  });
}

async function resultadoFinal(deps: EnvioDeps, solicitud: SolicitudEnvio): Promise<ResultadoEnvio> {
  const invoice = await deps.docs.getInvoice(solicitud.companyId, solicitud.invoiceId);
  const v = invoice ? estadoDe(invoice, solicitud.tipo) : undefined;
  const estado = v?.estado ?? 'no_aplica';
  const resultado: ResultadoEnvio = { sent: estado === 'enviado', estado };
  if (v?.errorMessage) resultado.mensaje = v.errorMessage;
  if (v?.csv) resultado.csv = v.csv;
  return resultado;
}

export { MENSAJE_SIN_CERTIFICADO };

/** Clasifica el fallo, lo deja en el log (motivo + código/mensaje, nunca material del certificado) y devuelve el texto para el usuario. */
function mensajeFalloCredenciales(err: unknown): string {
  const motivo = clasificarErrorCredenciales(err);
  const { message, code } = detalleError(err);
  console.error('[Verifactu] credenciales no disponibles', { motivo, code, message });
  return mensajeCredenciales(motivo);
}

/**
 * Envía el XML almacenado (fuera de tx) y liquida el resultado en otra tx. Un fallo de red es
 * `unknown`. Si faltan las credenciales el pending sigue con su backoff (la cadena no cambia),
 * pero se anota `avisoMessage` en la factura para que el motivo sea visible sin pasarla a error.
 */
async function enviarYLiquidar(
  deps: EnvioDeps,
  companyId: string,
  company: CompanyDoc,
  pending: PendingRecord,
  credenciales?: Credenciales,
): Promise<void> {
  let resultado: Resultado = { tipo: 'unknown' };
  let avisoCredenciales: string | undefined;
  const endpoint = endpointDe(company);
  console.log('[Verifactu:debug] enviarYLiquidar -> inicio', {
    companyId,
    invoiceId: pending.invoiceId,
    tipo: pending.tipo,
    attempts: pending.attempts,
    huella: pending.huella,
    endpoint,
    sandbox: company.verifactu?.sandbox,
  });
  console.log('[Verifactu:debug] enviarYLiquidar -> XML enviado a AEAT:\n' + pending.xml);
  try {
    let creds = credenciales;
    if (!creds) {
      try {
        creds = await deps.credentials(companyId);
      } catch (err) {
        console.error('[Verifactu:debug] enviarYLiquidar -> NO se pudieron leer las credenciales', detalleError(err));
        avisoCredenciales = mensajeFalloCredenciales(err);
      }
    }
    if (creds) {
      const inicio = Date.now();
      const http = await deps.sender(endpoint, pending.xml, creds);
      console.log('[Verifactu:debug] enviarYLiquidar -> respuesta HTTP de AEAT', {
        ms: Date.now() - inicio,
        status: http.status,
      });
      console.log('[Verifactu:debug] enviarYLiquidar -> body de AEAT:\n' + http.body);
      resultado = parseRespuesta(http);
      console.log('[Verifactu:debug] enviarYLiquidar -> respuesta interpretada', resultado);
      if (resultado.tipo === 'unknown') {
        console.warn('[Verifactu:debug] enviarYLiquidar -> respuesta NO reconocida (unknown): el pending queda atascado con backoff');
      }
    }
  } catch (err) {
    console.error('[Verifactu:debug] enviarYLiquidar -> fallo de red/TLS enviando a AEAT (se trata como unknown)', detalleError(err));
    resultado = { tipo: 'unknown' };
  }
  await deps.store.runTx(companyId, async (tx) => {
    const head = await tx.getHead();
    const decision = decidirLiquidacion(head, pending.huella, resultado, deps.clock());
    console.log('[Verifactu:debug] enviarYLiquidar -> decisión de liquidación', {
      accion: decision.accion,
      invoicePatches: decision.invoicePatches,
      sinCertificado: avisoCredenciales !== undefined,
    });
    if (avisoCredenciales !== undefined && decision.accion.tipo === 'atascado') {
      decision.invoicePatches.push({
        invoiceId: pending.invoiceId,
        tipo: pending.tipo,
        patch: { estado: 'pendiente', avisoMessage: avisoCredenciales },
      });
    }
    await aplicarDecision(tx, decision);
  });
}

/** La cabeza de la cola ya no se puede enviar (factura borrada o precondición rota): sale de la cola. */
async function descartarCabeza(
  deps: EnvioDeps,
  companyId: string,
  entrada: QueueEntry,
  mensaje: string,
): Promise<void> {
  await deps.store.runTx(companyId, async (tx) => {
    const head = await tx.getHead();
    const cabeza = head?.queue[0];
    if (!head || head.pending || !cabeza || cabeza.invoiceId !== entrada.invoiceId || cabeza.tipo !== entrada.tipo) return;
    const invoice = await tx.getInvoice(entrada.invoiceId);
    const queue = head.queue.slice(1);
    await tx.setHead({ ...head, queue, drainAt: queue.length > 0 ? (head.nextSendAt ?? iso(deps.clock())) : null });
    if (invoice) {
      await tx.patchVerifactu(entrada.invoiceId, entrada.tipo, {
        estado: 'error',
        tipoRegistro: entrada.tipo,
        errorKind: 'precondicion',
        errorMessage: mensaje,
      });
    }
  });
}

/**
 * Un tick de drenaje de una empresa: reenvía el pending atascado o reserva la cabeza de la
 * cola, siempre respetando backoff y control de flujo (salvo `forzar`). Un envío por llamada.
 */
export async function drenarEmpresa(deps: EnvioDeps, companyId: string, opciones: OpcionesDrenaje = {}): Promise<void> {
  const forzar = opciones.forzar ?? false;
  const company = await deps.docs.getCompany(companyId);
  // Despacho demo: jamás se contacta con la AEAT.
  if (!company?.verifactu?.enabled || esEmpresaDemo(company)) {
    console.log('[Verifactu:debug] drenarEmpresa -> Verifactu desactivado, no se drena', { companyId });
    return;
  }

  const previa = await deps.store.runTx(companyId, (tx) => tx.getHead());
  const accion = siguienteEnCola(previa, deps.clock(), forzar);
  console.log('[Verifactu:debug] drenarEmpresa -> estado de la cola', {
    companyId,
    forzar,
    accion: accion.tipo,
    pending: previa?.pending ? { invoiceId: previa.pending.invoiceId, tipo: previa.pending.tipo, attempts: previa.pending.attempts } : null,
    queue: previa?.queue,
    nextSendAt: previa?.nextSendAt,
    drainAt: previa?.drainAt,
  });
  if (accion.tipo === 'nada' || accion.tipo === 'esperar') return;

  let precarga: { entrada: QueueEntry; original?: InvoiceDoc } | undefined;
  if (accion.tipo === 'reservar') {
    const { entrada } = accion;
    const invoice = await deps.docs.getInvoice(companyId, entrada.invoiceId);
    if (!invoice) {
      await descartarCabeza(deps, companyId, entrada, 'La factura ya no existe.');
      return;
    }
    const original = await cargarOriginal(deps.docs, invoice, entrada.tipo);
    const precondicion = validarPrecondiciones(invoice, company, entrada.tipo, original);
    if (!precondicion.ok) {
      console.warn('[Verifactu:debug] drenarEmpresa -> precondición rota en la cabeza de la cola: se descarta', {
        invoiceId: entrada.invoiceId,
        precondicion,
      });
      await descartarCabeza(deps, companyId, entrada, precondicion.mensaje);
      return;
    }
    precarga = { entrada, original };
  }

  // Se vuelve a decidir DENTRO de la tx con la cabecera fresca: dos drenajes concurrentes no envían a la vez.
  const enviar = await deps.store.runTx(companyId, async (tx) => {
    const head = await tx.getHead();
    const ahora = deps.clock();
    const actual = siguienteEnCola(head, ahora, forzar);
    if (actual.tipo === 'reenviar') {
      const decision = decidirReenvio(head, ahora);
      await aplicarDecision(tx, decision);
      return decision.accion.tipo === 'enviar' ? decision.accion.pending : null;
    }
    if (
      actual.tipo === 'reservar' &&
      precarga &&
      actual.entrada.invoiceId === precarga.entrada.invoiceId &&
      actual.entrada.tipo === precarga.entrada.tipo
    ) {
      const invoice = await tx.getInvoice(actual.entrada.invoiceId);
      if (!invoice) return null;
      const entrada: EntradaCadena = { invoice, company, tipo: actual.entrada.tipo, original: precarga.original };
      const decision = reservarDesdeCola(head, entrada, ahora);
      await aplicarDecision(tx, decision);
      return decision.accion.tipo === 'enviar' ? decision.accion.pending : null;
    }
    return null;
  });

  if (enviar) await enviarYLiquidar(deps, companyId, company, enviar);
}

/**
 * Procesa una solicitud de envío (alta o anulación) de una factura: precondiciones,
 * entrada/reserva, envío, liquidación y un drenaje al final. Reintentar una factura que ya
 * está en curso (`pendiente`/`en_cola`) es solo un disparador de drenaje forzado.
 */
export async function procesarEnvio(deps: EnvioDeps, solicitud: SolicitudEnvio): Promise<ResultadoEnvio> {
  const { companyId, invoiceId, tipo } = solicitud;
  console.log('[Verifactu:debug] procesarEnvio -> solicitud', solicitud);

  const company = await deps.docs.getCompany(companyId);
  console.log('[Verifactu:debug] procesarEnvio -> empresa', {
    existe: company !== null,
    name: company?.name,
    cif: company?.cif,
    ca: company?.ca,
    verifactu: company?.verifactu,
  });
  if (!company?.verifactu?.enabled || esEmpresaDemo(company)) {
    console.warn('[Verifactu:debug] procesarEnvio -> SALE: Verifactu desactivado en la empresa (servidor)');
    return { sent: false, motivo: 'verifactu_desactivado' };
  }

  const invoice = await deps.docs.getInvoice(companyId, invoiceId);
  if (!invoice) {
    console.warn('[Verifactu:debug] procesarEnvio -> SALE: factura no encontrada (o de otra empresa)', { invoiceId });
    return { sent: false, motivo: 'factura_no_encontrada' };
  }
  console.log('[Verifactu:debug] procesarEnvio -> factura', {
    invoiceNumber: invoice.invoiceNumber,
    tipoFactura: invoice.tipoFactura,
    issueDate: invoice.issueDate,
    total: invoice.total,
    ivaRate: invoice.ivaRate,
    clienteNombre: invoice.clienteNombre,
    clienteNif: invoice.clienteNif,
    clienteTipoId: invoice.clienteTipoId,
    lineas: invoice.lineas,
    verifactu: invoice.verifactu,
  });

  const estado = estadoDe(invoice, tipo)?.estado;
  if (estado === 'enviado') {
    console.log('[Verifactu:debug] procesarEnvio -> SALE: ya estaba enviada');
    return resultadoFinal(deps, solicitud);
  }

  if (estado === 'pendiente' || estado === 'en_cola') {
    console.log('[Verifactu:debug] procesarEnvio -> ya en curso: solo drenaje forzado', { estado });
    await drenarSinFallar(deps, companyId, { forzar: true });
    return resultadoFinal(deps, solicitud);
  }

  const original = await cargarOriginal(deps.docs, invoice, tipo);
  const precondicion = validarPrecondiciones(invoice, company, tipo, original);
  if (!precondicion.ok) {
    console.warn('[Verifactu:debug] procesarEnvio -> SALE: precondición rota', precondicion);
    await marcarError(deps, companyId, invoiceId, tipo, 'precondicion', precondicion.mensaje);
    return { sent: false, motivo: 'precondicion', codigo: precondicion.codigo, mensaje: precondicion.mensaje, estado: 'error' };
  }
  console.log('[Verifactu:debug] procesarEnvio -> precondiciones OK');

  let credenciales: Credenciales;
  try {
    credenciales = await deps.credentials(companyId);
    console.log('[Verifactu:debug] procesarEnvio -> credenciales leídas (certificado + clave en PEM)');
  } catch (err) {
    console.error('[Verifactu:debug] procesarEnvio -> SALE: no se pudieron leer las credenciales', detalleError(err));
    const mensaje = mensajeFalloCredenciales(err);
    await marcarError(deps, companyId, invoiceId, tipo, 'configuracion', mensaje);
    return { sent: false, motivo: 'certificado', mensaje, estado: 'error' };
  }

  const accion = await deps.store.runTx(companyId, async (tx) => {
    const head = await tx.getHead();
    const actual = await tx.getInvoice(invoiceId);
    if (!actual) return null;
    const decision = decidirEntrada(head, { invoice: actual, company, tipo, original }, deps.clock());
    console.log('[Verifactu:debug] procesarEnvio -> decisión de entrada en la cadena', {
      accion: decision.accion.tipo,
      headPrevio: head
        ? { last: head.last, pending: head.pending?.invoiceId ?? null, queue: head.queue, nextSendAt: head.nextSendAt, drainAt: head.drainAt }
        : null,
      invoicePatches: decision.invoicePatches,
    });
    // Datos con los que se construye el QR, para comparar con la `qrUrl` del patch.
    const qrPatch = decision.invoicePatches.find((p) => p.invoiceId === invoiceId)?.patch.qrUrl;
    console.log('[Verifactu:debug] procesarEnvio -> QR', {
      qrUrl: qrPatch,
      entradas: { nifEmisor: company.cif, numSerie: actual.invoiceNumber, issueDate: actual.issueDate, totalFactura: actual.total },
    });
    if (decision.accion.tipo !== 'noop' && tipo === 'alta' && !qrPatch) {
      console.warn('[Verifactu:debug] procesarEnvio -> el patch NO lleva qrUrl (¿impuesto de la CA no soportado?)', { ca: company.ca });
    }
    await aplicarDecision(tx, decision);
    return decision.accion;
  });

  if (accion === null) console.warn('[Verifactu:debug] procesarEnvio -> la factura desapareció dentro de la transacción');
  if (accion?.tipo === 'enviar') {
    await enviarYLiquidar(deps, companyId, company, accion.pending, credenciales);
  }
  await drenarSinFallar(deps, companyId);
  const final = await resultadoFinal(deps, solicitud);
  console.log('[Verifactu:debug] procesarEnvio -> resultado final', final);
  return final;
}

/** El drenaje de cortesía al final del callable nunca debe romper la respuesta ya calculada. */
async function drenarSinFallar(deps: EnvioDeps, companyId: string, opciones: OpcionesDrenaje = {}): Promise<void> {
  try {
    await drenarEmpresa(deps, companyId, opciones);
  } catch (err) {
    console.error('[Verifactu] drenaje fallido', companyId, detalleError(err));
  }
}
