// Lógica pura de la cadena Verifactu: decide transiciones de la cabecera
// (`companies/{cid}/verifactuChain/head`) y de `invoice.verifactu`. Sin I/O: el
// orquestador lee/escribe vía `ChainTx` y hace el envío FUERA de la transacción.
//
// Regla de cadena (decisión del usuario): el encadenamiento sigue el orden de
// GENERACIÓN. `head.last` avanza al RESERVAR (cuando se construye el registro) y
// la liquidación nunca lo toca; un Incorrecto o un Fault permanecen en la cadena.
import { DEFAULT_ESPERA_S, MAX_BACKOFF_S, impuestoDeEmpresa } from './config';
import { buildRegistroAlta, buildRegistroAnulacion } from './buildRegistro';
import { calcularDesglose } from './desglose';
import { esSandbox, qrUrl } from './endpoints';
import { fechaAeat } from './fechas';
import type { Resultado } from './parseResponse';
import type { ChainTx, InvoicePatch, VerifactuPatch } from './ports';
import { buildEnvelope } from './soap';
import type { ChainHead, ChainLink, CompanyDoc, InvoiceDoc, PendingRecord, QueueEntry, VerifactuState } from './types';

export type TipoRegistro = 'alta' | 'anulacion';

/** Datos que el orquestador carga (Admin SDK) para decidir la entrada o la reserva. */
export interface EntradaCadena {
  invoice: InvoiceDoc;
  company: CompanyDoc;
  tipo: TipoRegistro;
  /** Factura rectificada ya resuelta (solo alta R1). */
  original?: InvoiceDoc;
}

export type Accion =
  | { tipo: 'noop' }
  | { tipo: 'encolado' }
  /** Liquidado: el pending se cerró (la factura queda `enviado` o `error`). */
  | { tipo: 'liquidado'; estado: 'enviado' | 'error' }
  /** Transporte/unknown: el pending sigue vivo y se reenviará con backoff. */
  | { tipo: 'atascado' }
  /** Registro reservado (o a reenviar): enviar `pending.xml` FUERA de la transacción. */
  | { tipo: 'enviar'; pending: PendingRecord };

export interface Decision {
  head: ChainHead;
  invoicePatches: InvoicePatch[];
  accion: Accion;
}

export function headVacio(): ChainHead {
  return { last: null, pending: null, queue: [], nextSendAt: null, drainAt: null };
}

const iso = (d: Date): string => d.toISOString();
const masSegundos = (d: Date, s: number): Date => new Date(d.getTime() + s * 1000);

/** Segundos de espera tras `attempts` envíos fallidos: 60, 120, 240 ... tope 3600. */
export function backoffS(attempts: number): number {
  const n = Math.max(attempts, 1);
  return Math.min(DEFAULT_ESPERA_S * 2 ** (n - 1), MAX_BACKOFF_S);
}

const CAMPOS_ERROR = ['errorKind', 'errorMessage', 'codigoError', 'descripcionError'] as const;

/** Un estado distinto de `error` no arrastra los restos del error anterior (salvo los del propio parche). */
function sinErroresSiNoError<T extends Partial<VerifactuState>>(resultado: T, patch: VerifactuPatch): T {
  if (patch.estado === 'error') return resultado;
  const limpio = { ...resultado };
  for (const campo of CAMPOS_ERROR) {
    if (!(campo in patch)) delete limpio[campo];
  }
  return limpio;
}

/**
 * Aplica un parche a `invoice.verifactu`. El alta mezcla en la raíz; la anulación
 * anida en `anulacion` sin tocar los campos del alta (así el QR sobrevive).
 */
export function aplicarPatchVerifactu(
  previo: VerifactuState | undefined,
  tipo: TipoRegistro,
  patch: VerifactuPatch,
): VerifactuState {
  if (tipo === 'alta') {
    return sinErroresSiNoError({ tipoRegistro: 'alta', ...previo, ...patch }, patch);
  }
  const { tipoRegistro: _t, qrUrl: _q, ...resto } = patch;
  const base: VerifactuState = previo ?? { estado: 'no_aplica', tipoRegistro: 'alta' };
  return { ...base, anulacion: sinErroresSiNoError({ ...base.anulacion, ...resto }, patch) };
}

/** Escribe cabecera y parches de factura de una decisión (dentro de la misma transacción). */
export async function aplicarDecision(tx: ChainTx, decision: Decision): Promise<void> {
  if (decision.accion.tipo === 'noop') return;
  await tx.setHead(decision.head);
  for (const p of decision.invoicePatches) {
    await tx.patchVerifactu(p.invoiceId, p.tipo, p.patch);
  }
}

/** ¿Es un reintento tras Incorrecto? (alta por rechazo: Subsanacion=S + RechazoPrevio=X; anulación: S). */
export function rechazoPrevioDe(invoice: InvoiceDoc, tipo: TipoRegistro): boolean {
  const v = invoice.verifactu;
  if (!v) return false;
  const estado = tipo === 'alta' ? v : v.anulacion;
  return estado?.rechazoPrevio === true;
}

function yaEnviada(invoice: InvoiceDoc, tipo: TipoRegistro): boolean {
  const v = invoice.verifactu;
  if (!v) return false;
  return (tipo === 'alta' ? v.estado : v.anulacion?.estado) === 'enviado';
}

function enTrabajo(head: ChainHead, invoiceId: string, tipo: TipoRegistro): boolean {
  const p = head.pending;
  if (p && p.invoiceId === invoiceId && p.tipo === tipo) return true;
  return head.queue.some((q) => q.invoiceId === invoiceId && q.tipo === tipo);
}

/** QR de la factura: solo datos de identidad, se puede calcular al encolar. */
function qrDe(e: EntradaCadena): string | undefined {
  if (e.tipo !== 'alta') return undefined;
  const impuesto = impuestoDeEmpresa(e.company.ca);
  if (!impuesto.ok) return undefined;
  const { importeTotal } = calcularDesglose(e.invoice.lineas ?? [], e.invoice.ivaRate ?? 0, impuesto.impuesto);
  return qrUrl(esSandbox(e.company.verifactu), {
    nif: e.company.cif ?? '',
    numSerie: e.invoice.invoiceNumber,
    fecha: fechaAeat(e.invoice.issueDate),
    importe: importeTotal,
  });
}

/** Marca de tiempo mínima (s) a partir de la cual se puede generar el siguiente registro. */
function guardaTimestamp(last: ChainLink | null, ahora: Date): { ok: true } | { ok: false; hasta: Date } {
  if (!last) return { ok: true };
  const ultimo = Math.floor(Date.parse(last.fechaHoraHuso) / 1000);
  const actual = Math.floor(ahora.getTime() / 1000);
  if (actual >= ultimo) return { ok: true };
  return { ok: false, hasta: new Date((ultimo + 1) * 1000) };
}

/** Reserva: construye el registro, avanza `last` y fija pending (attempts=1) con sello de envío. */
function reservar(head: ChainHead, e: EntradaCadena, ahora: Date, cola: QueueEntry[]): Decision {
  const anterior = head.last;
  const rechazoPrevio = rechazoPrevioDe(e.invoice, e.tipo);
  const registro =
    e.tipo === 'alta'
      ? buildRegistroAlta({ invoice: e.invoice, company: e.company, original: e.original, anterior, ahora, rechazoPrevio })
      : buildRegistroAnulacion({ invoice: e.invoice, company: e.company, anterior, ahora, rechazoPrevio });
  const xml = buildEnvelope({ nombreRazon: e.company.name, nif: e.company.cif ?? '' }, registro);
  const link: ChainLink = {
    ...registro.idFactura,
    huella: registro.huella,
    fechaHoraHuso: registro.fechaHoraHusoGenRegistro,
  };
  const pending: PendingRecord = {
    invoiceId: e.invoice.id,
    tipo: e.tipo,
    xml,
    huella: registro.huella,
    link,
    reservedAt: iso(ahora),
    attempts: 1,
    lastAttemptAt: iso(ahora),
  };
  const proximo = iso(masSegundos(ahora, DEFAULT_ESPERA_S));
  const patch: VerifactuPatch = {
    estado: 'pendiente',
    tipoRegistro: e.tipo,
    huella: registro.huella,
    attempts: 1,
    generadoAt: iso(ahora),
  };
  const qr = qrDe(e);
  if (qr) patch.qrUrl = qr;
  return {
    head: { last: link, pending, queue: cola, nextSendAt: proximo, drainAt: iso(masSegundos(ahora, backoffS(1))) },
    invoicePatches: [{ invoiceId: e.invoice.id, tipo: e.tipo, patch }],
    accion: { tipo: 'enviar', pending },
  };
}

/** Entrada de una factura: no-op si ya está, encola si hay algo delante, reserva si no. */
export function decidirEntrada(headActual: ChainHead | null, e: EntradaCadena, ahora: Date): Decision {
  const head = headActual ?? headVacio();
  if (enTrabajo(head, e.invoice.id, e.tipo) || yaEnviada(e.invoice, e.tipo)) {
    return { head, invoicePatches: [], accion: { tipo: 'noop' } };
  }

  const hayAlgoDelante = head.pending !== null || head.queue.length > 0;
  const enEspera = head.nextSendAt !== null && ahora.getTime() < Date.parse(head.nextSendAt);
  const guarda = guardaTimestamp(head.last, ahora);

  if (!hayAlgoDelante && !enEspera && guarda.ok) {
    return reservar(head, e, ahora, []);
  }

  const patch: VerifactuPatch = { estado: 'en_cola', tipoRegistro: e.tipo, encoladoAt: iso(ahora) };
  const qr = qrDe(e);
  if (qr) patch.qrUrl = qr;
  const instantes: number[] = [];
  if (head.nextSendAt) instantes.push(Date.parse(head.nextSendAt));
  if (!guarda.ok) instantes.push(guarda.hasta.getTime());
  const drainAt = head.drainAt ?? iso(new Date(Math.max(ahora.getTime(), ...instantes)));
  return {
    head: { ...head, queue: [...head.queue, { invoiceId: e.invoice.id, tipo: e.tipo, encoladoAt: iso(ahora) }], drainAt },
    invoicePatches: [{ invoiceId: e.invoice.id, tipo: e.tipo, patch }],
    accion: { tipo: 'encolado' },
  };
}

// ---------------------------------------------------------------------------
// Liquidación: NUNCA toca `last` (el registro ya avanzó la cadena al reservar).
// ---------------------------------------------------------------------------

/** R7.10: aceptado por duplicado SOLO en un reenvío, con 3000 y RegistroDuplicado Correcta/AceptadaConErrores. */
function estadoDuplicadoAceptable(pending: PendingRecord, r: Extract<Resultado, { tipo: 'incorrecto' }>): 'Correcta' | 'AceptadaConErrores' | null {
  if (pending.attempts < 2 || r.codigo !== '3000' || !r.duplicado) return null;
  const estado = r.duplicado.estado;
  return estado === 'Correcta' || estado === 'AceptadaConErrores' ? estado : null;
}

function esperaDe(resultado: Resultado): number | undefined {
  return 'esperaS' in resultado ? resultado.esperaS : undefined;
}

/**
 * Liquida el pending (clave: su huella). correcto/aceptadoConErrores -> enviado;
 * incorrecto -> error + rechazoPrevio (o aceptado por duplicado, R7.10); fault -> error
 * liquidado (configuracion); transporte/unknown -> el pending sigue con backoff.
 */
export function decidirLiquidacion(headActual: ChainHead | null, huella: string, resultado: Resultado, ahora: Date): Decision {
  const head = headActual ?? headVacio();
  const pending = head.pending;
  if (!pending || pending.huella !== huella) {
    return { head, invoicePatches: [], accion: { tipo: 'noop' } };
  }
  const { invoiceId, tipo } = pending;
  const base = Date.parse(pending.lastAttemptAt ?? pending.reservedAt);

  if (resultado.tipo === 'transporte' || resultado.tipo === 'unknown') {
    const lastError = resultado.tipo === 'transporte' ? `HTTP ${resultado.status}` : 'Respuesta no reconocida';
    return {
      head: { ...head, pending: { ...pending, lastError }, drainAt: iso(masSegundos(ahora, backoffS(pending.attempts))) },
      invoicePatches: [],
      accion: { tipo: 'atascado' },
    };
  }

  const nextSendAt = resultado.tipo === 'fault' ? head.nextSendAt : iso(new Date(base + (esperaDe(resultado) ?? DEFAULT_ESPERA_S) * 1000));
  const cerrado = (): ChainHead => ({
    last: head.last,
    pending: null,
    queue: head.queue,
    nextSendAt,
    drainAt: head.queue.length > 0 ? (nextSendAt ?? iso(ahora)) : null,
  });
  const patchDe = (patch: VerifactuPatch): InvoicePatch[] => [{ invoiceId, tipo, patch }];

  switch (resultado.tipo) {
    case 'correcto': {
      const patch: VerifactuPatch = { estado: 'enviado', enviadoAt: iso(ahora), aceptadoConErrores: false, rechazoPrevio: false };
      if (resultado.csv) patch.csv = resultado.csv;
      return { head: cerrado(), invoicePatches: patchDe(patch), accion: { tipo: 'liquidado', estado: 'enviado' } };
    }
    case 'aceptadoConErrores': {
      const patch: VerifactuPatch = { estado: 'enviado', enviadoAt: iso(ahora), aceptadoConErrores: true, rechazoPrevio: false };
      if (resultado.csv) patch.csv = resultado.csv;
      if (resultado.codigo) patch.codigoError = resultado.codigo;
      if (resultado.descripcion) patch.descripcionError = resultado.descripcion;
      return { head: cerrado(), invoicePatches: patchDe(patch), accion: { tipo: 'liquidado', estado: 'enviado' } };
    }
    case 'incorrecto': {
      const duplicado = estadoDuplicadoAceptable(pending, resultado);
      if (duplicado) {
        const patch: VerifactuPatch = {
          estado: 'enviado',
          enviadoAt: iso(ahora),
          aceptadoConErrores: duplicado === 'AceptadaConErrores',
          rechazoPrevio: false,
        };
        return { head: cerrado(), invoicePatches: patchDe(patch), accion: { tipo: 'liquidado', estado: 'enviado' } };
      }
      const patch: VerifactuPatch = {
        estado: 'error',
        errorKind: 'aeat',
        rechazoPrevio: true,
        errorMessage: [resultado.codigo, resultado.descripcion].filter(Boolean).join(': ') || 'AEAT rechazó el registro',
      };
      if (resultado.codigo) patch.codigoError = resultado.codigo;
      if (resultado.descripcion) patch.descripcionError = resultado.descripcion;
      return { head: cerrado(), invoicePatches: patchDe(patch), accion: { tipo: 'liquidado', estado: 'error' } };
    }
    case 'fault': {
      // AEAT no registró nada: no hay rechazoPrevio. El registro generado se queda en la cadena.
      const patch: VerifactuPatch = { estado: 'error', errorKind: 'configuracion', errorMessage: resultado.faultstring };
      return { head: cerrado(), invoicePatches: patchDe(patch), accion: { tipo: 'liquidado', estado: 'error' } };
    }
  }
}

// ---------------------------------------------------------------------------
// Drenaje: la cola es FIFO estricta, un envío por empresa y por tick.
// ---------------------------------------------------------------------------
export type AccionDrenaje =
  | { tipo: 'nada' }
  | { tipo: 'esperar'; hasta: Date }
  /** Hay un pending atascado: reenviar su XML almacenado (`decidirReenvio`). */
  | { tipo: 'reenviar' }
  /** Reservar la cabeza de la cola (`reservarDesdeCola` con la factura cargada). */
  | { tipo: 'reservar'; entrada: QueueEntry };

/**
 * Qué hacer en este tick. Un pending vivo bloquea a la cola. `forzar` (reintento manual)
 * ignora el backoff y el control de flujo, pero sigue siendo un solo envío.
 */
export function siguienteEnCola(headActual: ChainHead | null, ahora: Date, forzar = false): AccionDrenaje {
  const head = headActual ?? headVacio();
  const siguienteEntrada = head.queue[0];
  if (!head.pending && !siguienteEntrada) return { tipo: 'nada' };

  const instantes = [head.nextSendAt, head.pending ? head.drainAt : null]
    .filter((x): x is string => x !== null)
    .map((x) => Date.parse(x));
  const hasta = new Date(Math.max(0, ...instantes));
  if (!forzar && ahora.getTime() < hasta.getTime()) return { tipo: 'esperar', hasta };

  return head.pending ? { tipo: 'reenviar' } : { tipo: 'reservar', entrada: siguienteEntrada };
}

/** Reenvío del pending: mismo XML byte a byte; attempts++ y sello de envío antes de enviar. */
export function decidirReenvio(headActual: ChainHead | null, ahora: Date): Decision {
  const head = headActual ?? headVacio();
  const previo = head.pending;
  if (!previo) return { head, invoicePatches: [], accion: { tipo: 'noop' } };
  const pending: PendingRecord = { ...previo, attempts: previo.attempts + 1, lastAttemptAt: iso(ahora) };
  return {
    head: {
      ...head,
      pending,
      nextSendAt: iso(masSegundos(ahora, DEFAULT_ESPERA_S)),
      drainAt: iso(masSegundos(ahora, backoffS(pending.attempts))),
    },
    invoicePatches: [
      { invoiceId: pending.invoiceId, tipo: pending.tipo, patch: { estado: 'pendiente', attempts: pending.attempts } },
    ],
    accion: { tipo: 'enviar', pending },
  };
}

/** Reserva la cabeza de la cola (debe ser `e.invoice`). Si la guarda de tiempo lo impide, sigue en cola. */
export function reservarDesdeCola(headActual: ChainHead | null, e: EntradaCadena, ahora: Date): Decision {
  const head = headActual ?? headVacio();
  const cabeza = head.queue[0];
  if (head.pending || !cabeza || cabeza.invoiceId !== e.invoice.id || cabeza.tipo !== e.tipo) {
    return { head, invoicePatches: [], accion: { tipo: 'noop' } };
  }
  const guarda = guardaTimestamp(head.last, ahora);
  if (!guarda.ok) {
    return { head: { ...head, drainAt: iso(guarda.hasta) }, invoicePatches: [], accion: { tipo: 'encolado' } };
  }
  return reservar(head, e, ahora, head.queue.slice(1));
}
