/**
 * Vínculo factura recibida <-> movimiento de tesorería (gasto). Funciones puras, sin framework.
 * Mismo criterio que la conciliación: importe ±0,01 y fecha a ≤ 7 días; solo gastos de salida sin vincular.
 */

import type { LineaIvaRecibida } from '../../interfaces/factura-recibida.interface';
import type { MovimientoTipo } from '../../interfaces/gestoria.interface';
import { TIPOS_IVA, type TipoIva } from '../../interfaces/iva';
import { esFechaIso } from './trimestre';

const TOLERANCIA_IMPORTE = 0.011;
export const MAX_DIAS_SUGERENCIA = 7;
const MS_DIA = 86_400_000;

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export interface MovimientoCandidato {
  id: string;
  casoId?: string;
  tipo: MovimientoTipo;
  esEntrada: boolean;
  importe: number;
  /** `yyyy-MM-dd`. */
  fecha: string;
  concepto: string;
  facturaRecibidaId?: string;
}

function dias(isoA: string, isoB: string): number {
  return Math.abs(Date.UTC(+isoA.slice(0, 4), +isoA.slice(5, 7) - 1, +isoA.slice(8, 10)) - Date.UTC(+isoB.slice(0, 4), +isoB.slice(5, 7) - 1, +isoB.slice(8, 10))) / MS_DIA;
}

/** Movimientos que probablemente son el pago de esta factura, del más probable al menos. */
export function sugerirMovimientos<T extends MovimientoCandidato>(
  factura: { total: number; fechaExpedicion: string },
  movimientos: readonly T[],
): T[] {
  if (!Number.isFinite(factura.total) || !esFechaIso(factura.fechaExpedicion)) return [];
  return movimientos
    .filter(
      (m) =>
        m.tipo === 'gasto' &&
        !m.esEntrada &&
        !m.facturaRecibidaId &&
        esFechaIso(m.fecha) &&
        Math.abs(m.importe - factura.total) <= TOLERANCIA_IMPORTE &&
        dias(m.fecha, factura.fechaExpedicion) <= MAX_DIAS_SUGERENCIA,
    )
    .map((m) => ({ m, d: dias(m.fecha, factura.fechaExpedicion), i: Math.abs(m.importe - factura.total) }))
    .sort((a, b) => a.d - b.d || a.i - b.i)
    .map((x) => x.m);
}

export interface FacturaParaMovimiento {
  proveedor: { nombre: string };
  numero: string;
  total: number;
  fechaExpedicion: string;
  lineasIva: readonly LineaIvaRecibida[];
}

export interface MovimientoDesdeFactura {
  tipo: 'gasto';
  concepto: string;
  importe: number;
  esEntrada: false;
  fecha: string;
  baseImponible: number;
  cuotaIva: number;
  tipoIva?: TipoIva;
  ivaExento?: boolean;
  facturaRecibidaId: string;
}

/** Gasto nuevo con el total de la factura. `baseImponible + cuotaIva === importe` (invariante de tesorería). */
export function movimientoDesdeFactura(f: FacturaParaMovimiento, facturaId: string): MovimientoDesdeFactura {
  const importe = round2(f.total);
  const cuotaIva = round2(f.lineasIva.reduce((s, l) => s + (l.exento ? 0 : l.cuota), 0));
  const tipos = new Set(f.lineasIva.map((l) => (l.exento ? 0 : l.tipo)));
  const unico = tipos.size === 1 ? [...tipos][0] : undefined;
  const m: MovimientoDesdeFactura = {
    tipo: 'gasto',
    concepto: `${f.proveedor.nombre} · ${f.numero}`,
    importe,
    esEntrada: false,
    fecha: f.fechaExpedicion,
    baseImponible: round2(importe - cuotaIva),
    cuotaIva,
    facturaRecibidaId: facturaId,
  };
  if (unico !== undefined && (TIPOS_IVA as readonly number[]).includes(unico)) m.tipoIva = unico as TipoIva;
  if (f.lineasIva.length > 0 && f.lineasIva.every((l) => l.exento)) m.ivaExento = true;
  return m;
}
