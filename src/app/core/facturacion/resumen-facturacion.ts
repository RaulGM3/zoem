import type { Invoice } from '../services/invoice.service';
import { vistaVerifactu } from '../verifactu/verifactu-ui';

export interface ImporteFacturas {
  total: number;
  facturas: number;
}

/** Cifras del panel de Facturación, referidas al mes (y trimestre) de `hoy`. */
export interface ResumenFacturacion {
  /** Total de las facturas del mes cuyo alta aceptó la AEAT (incluye AceptadoConErrores). */
  verifactuAprobado: ImporteFacturas;
  /** IVA repercutido en las facturas emitidas en el mes (las rectificativas restan). */
  ivaMes: number;
  /** IVA repercutido en el trimestre natural (lo que se liquida en el modelo 303). */
  ivaTrimestre: number;
  /** Facturas emitidas que aún no se han cobrado, de cualquier fecha. */
  pendienteCobro: ImporteFacturas;
  /** Parte de lo pendiente cuyo vencimiento ya pasó. */
  vencido: ImporteFacturas;
  /** Registros Verifactu en error (alta o anulación) que hay que revisar. */
  incidenciasVerifactu: number;
}

const centimos = (n: number): number => Math.round(n * 100) / 100;

const emitida = (f: Invoice): boolean => f.status !== 'borrador' && f.status !== 'anulada';

const porCobrar = (f: Invoice): boolean => f.status === 'pendiente' || f.status === 'vencida';

/** `vencida` no se persiste: una factura por cobrar vence cuando su fecha de vencimiento ya pasó. */
const vencida = (f: Invoice, hoy: string): boolean => f.status === 'vencida' || (porCobrar(f) && f.dueDate < hoy);

function trimestre(fecha: string): string {
  const mes = Number(fecha.slice(5, 7));
  return `${fecha.slice(0, 4)}-T${Math.ceil(mes / 3)}`;
}

function sumar(facturas: Invoice[]): ImporteFacturas {
  return { total: centimos(facturas.reduce((s, f) => s + f.total, 0)), facturas: facturas.length };
}

/** `hoy` en formato YYYY-MM-DD (fecha local), como `issueDate` y `dueDate`. */
export function resumenFacturacion(invoices: readonly Invoice[], hoy: string): ResumenFacturacion {
  const mes = hoy.slice(0, 7);
  const trim = trimestre(hoy);
  const emitidas = invoices.filter(emitida);
  const delMes = emitidas.filter((f) => f.issueDate.startsWith(mes));
  const delTrimestre = emitidas.filter((f) => trimestre(f.issueDate) === trim);
  const pendientes = invoices.filter(porCobrar);

  return {
    verifactuAprobado: sumar(delMes.filter((f) => f.verifactu?.estado === 'enviado')),
    ivaMes: centimos(delMes.reduce((s, f) => s + f.vat, 0)),
    ivaTrimestre: centimos(delTrimestre.reduce((s, f) => s + f.vat, 0)),
    pendienteCobro: sumar(pendientes),
    vencido: sumar(pendientes.filter((f) => vencida(f, hoy))),
    incidenciasVerifactu: invoices.filter((f) => vistaVerifactu(f, 0)?.estado === 'error').length,
  };
}
