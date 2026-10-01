import type { InvoiceLinea } from '../services/invoice.service';
import { esLineaExenta, tasaEfectivaLinea } from '../../interfaces/iva';

/** Tolerancia de coma flotante al pasar a céntimos (1.005 * 100 = 100.49999...). */
const EPSILON_CENTIMOS = 1e-6;

/** Euros a céntimos enteros, half away from zero (igual que el servidor). */
function aCentimos(euros: number): number {
  const signo = euros < 0 ? -1 : 1;
  return signo * Math.round(Math.abs(euros) * 100 + EPSILON_CENTIMOS);
}

/** Redondeo de un valor ya en céntimos, half away from zero (igual que el servidor). */
function redondearCentimos(centimos: number): number {
  const signo = centimos < 0 ? -1 : 1;
  return signo * Math.round(Math.abs(centimos) + EPSILON_CENTIMOS);
}

export interface GrupoIva {
  /** Tipo en porcentaje (21, 10, 4...). */
  pct: number;
  base: number;
  cuota: number;
}

export interface TotalesRegistro {
  /** Suma de las bases redondeadas por grupo (gravadas y exentas). */
  baseTotal: number;
  /** Solo grupos gravados (tipo efectivo > 0), en orden de aparición. */
  grupos: GrupoIva[];
  cuotaTotal: number;
  /** ImporteTotal del registro Verifactu: suma de (base + cuota) redondeadas por grupo. */
  total: number;
}

/**
 * Totales de una factura tal y como los calcula el servidor para el registro Verifactu
 * (`calcularDesglose` en functions/src/aeat/desglose.ts: base y cuota redondeadas a
 * céntimos POR GRUPO). El QR lleva ese ImporteTotal, así que el PDF debe imprimir el
 * mismo número y no el total bruto sin redondear de `invoice.total`.
 */
export function totalesRegistro(lineas: readonly InvoiceLinea[], ivaGlobal: number): TotalesRegistro {
  const basePorClave = new Map<string, { puntosBase: number; base: number }>();

  for (const l of lineas) {
    const exenta = esLineaExenta(l, ivaGlobal);
    const puntosBase = exenta ? 0 : Math.round(tasaEfectivaLinea(l, ivaGlobal) * 10000);
    const clave = exenta ? `X|${l.causaExencion ?? ''}` : `S1|${puntosBase}`;
    const previo = basePorClave.get(clave);
    if (previo) previo.base += l.base;
    else basePorClave.set(clave, { puntosBase, base: l.base });
  }

  let baseCent = 0;
  let cuotaCent = 0;
  const grupos: GrupoIva[] = [];

  for (const { puntosBase, base } of basePorClave.values()) {
    const bCent = aCentimos(base);
    baseCent += bCent;
    if (puntosBase === 0) continue;
    const cCent = redondearCentimos((bCent * puntosBase) / 10000);
    cuotaCent += cCent;
    grupos.push({ pct: puntosBase / 100, base: bCent / 100, cuota: cCent / 100 });
  }

  return {
    baseTotal: baseCent / 100,
    grupos,
    cuotaTotal: cuotaCent / 100,
    total: (baseCent + cuotaCent) / 100,
  };
}
