// Orquestador del envío Verifactu. Sin I/O propio: Firestore, red y certificados llegan
// por puertos (ports.ts). Flujo: tx de entrada/reserva -> envío FUERA de la transacción ->
// tx de liquidación. Ninguna llamada de red ocurre dentro de una transacción.
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

/** Envía el XML almacenado (fuera de tx) y liquida el resultado en otra tx. Cualquier fallo de red = `unknown`. */
async function enviarYLiquidar(
  deps: EnvioDeps,
  companyId: string,
  company: CompanyDoc,
  pending: PendingRecord,
  credenciales?: Credenciales,
): Promise<void> {
  let resultado: Resultado;
  try {
    const creds = credenciales ?? (await deps.credentials(companyId));
    resultado = parseRespuesta(await deps.sender(endpointDe(company), pending.xml, creds));
  } catch {
    resultado = { tipo: 'unknown' };
  }
  await deps.store.runTx(companyId, async (tx) => {
    const head = await tx.getHead();
    await aplicarDecision(tx, decidirLiquidacion(head, pending.huella, resultado, deps.clock()));
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
  if (!company?.verifactu?.enabled) return;

  const previa = await deps.store.runTx(companyId, (tx) => tx.getHead());
  const accion = siguienteEnCola(previa, deps.clock(), forzar);
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

  const company = await deps.docs.getCompany(companyId);
  if (!company?.verifactu?.enabled) return { sent: false, motivo: 'verifactu_desactivado' };

  const invoice = await deps.docs.getInvoice(companyId, invoiceId);
  if (!invoice) return { sent: false, motivo: 'factura_no_encontrada' };

  const estado = estadoDe(invoice, tipo)?.estado;
  if (estado === 'enviado') return resultadoFinal(deps, solicitud);

  if (estado === 'pendiente' || estado === 'en_cola') {
    await drenarSinFallar(deps, companyId, { forzar: true });
    return resultadoFinal(deps, solicitud);
  }

  const original = await cargarOriginal(deps.docs, invoice, tipo);
  const precondicion = validarPrecondiciones(invoice, company, tipo, original);
  if (!precondicion.ok) {
    await marcarError(deps, companyId, invoiceId, tipo, 'precondicion', precondicion.mensaje);
    return { sent: false, motivo: 'precondicion', codigo: precondicion.codigo, mensaje: precondicion.mensaje, estado: 'error' };
  }

  let credenciales: Credenciales;
  try {
    credenciales = await deps.credentials(companyId);
  } catch {
    const mensaje = 'Certificado AEAT no configurado para esta empresa.';
    await marcarError(deps, companyId, invoiceId, tipo, 'configuracion', mensaje);
    return { sent: false, motivo: 'certificado', mensaje, estado: 'error' };
  }

  const accion = await deps.store.runTx(companyId, async (tx) => {
    const head = await tx.getHead();
    const actual = await tx.getInvoice(invoiceId);
    if (!actual) return null;
    const decision = decidirEntrada(head, { invoice: actual, company, tipo, original }, deps.clock());
    await aplicarDecision(tx, decision);
    return decision.accion;
  });

  if (accion?.tipo === 'enviar') {
    await enviarYLiquidar(deps, companyId, company, accion.pending, credenciales);
  }
  await drenarSinFallar(deps, companyId);
  return resultadoFinal(deps, solicitud);
}

/** El drenaje de cortesía al final del callable nunca debe romper la respuesta ya calculada. */
async function drenarSinFallar(deps: EnvioDeps, companyId: string, opciones: OpcionesDrenaje = {}): Promise<void> {
  try {
    await drenarEmpresa(deps, companyId, opciones);
  } catch (err) {
    console.error('[Verifactu] drenaje fallido', companyId, err instanceof Error ? err.message : 'error desconocido');
  }
}
