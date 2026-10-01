import type { CausaExencion, CodigoImpuesto, DetalleDesglose, InvoiceLineaDoc } from './types';

/** Máximo de DetalleDesglose por registro según el XSD de AEAT. */
export const MAX_DESGLOSE = 12;

/** Tolerancia para errores de coma flotante al pasar a céntimos (1.005 * 100 = 100.49999...). */
const EPSILON_CENTIMOS = 1e-6;

/** Euros a céntimos enteros, half away from zero. */
function aCentimos(euros: number): number {
  const signo = euros < 0 ? -1 : 1;
  return signo * Math.round(Math.abs(euros) * 100 + EPSILON_CENTIMOS);
}

/** Redondeo de un valor ya en céntimos (puede traer fracción), half away from zero. */
function redondearCentimos(centimos: number): number {
  const signo = centimos < 0 ? -1 : 1;
  return signo * Math.round(Math.abs(centimos) + EPSILON_CENTIMOS);
}

function formatCentimos(centimos: number): string {
  const signo = centimos < 0 ? '-' : '';
  const abs = Math.abs(centimos);
  const euros = Math.floor(abs / 100);
  const resto = String(abs % 100).padStart(2, '0');
  return `${signo}${euros}.${resto}`;
}

function tasaEfectiva(linea: InvoiceLineaDoc, ivaGlobal: number): number {
  return linea.aplicaIva ? (linea.ivaRate ?? ivaGlobal) : 0;
}

/** Espejo de `esLineaExenta` de la app (src/app/interfaces/iva.ts): no hay código compartido por el rootDir. */
export function esLineaExenta(linea: InvoiceLineaDoc, ivaGlobal: number): boolean {
  return !linea.aplicaIva || tasaEfectiva(linea, ivaGlobal) === 0;
}

interface Grupo {
  clave: string;
  tasaPuntosBase: number;
  causa?: CausaExencion;
  base: number;
}

export interface ResultadoDesglose {
  detalles: DetalleDesglose[];
  cuotaTotal: string;
  importeTotal: string;
}

/**
 * Agrupa las líneas por (tipo, calificación/causa) y calcula base y cuota por grupo
 * redondeadas a céntimos. No trunca: el llamador comprueba `MAX_DESGLOSE`.
 * Lanza si una línea exenta no trae `causaExencion` (nunca se adivina una causa).
 */
export function calcularDesglose(
  lineas: readonly InvoiceLineaDoc[],
  ivaRateGlobal: number,
  impuesto: CodigoImpuesto,
): ResultadoDesglose {
  const grupos = new Map<string, Grupo>();

  for (const linea of lineas) {
    let clave: string;
    let puntosBase = 0;
    let causa: CausaExencion | undefined;

    if (esLineaExenta(linea, ivaRateGlobal)) {
      if (!linea.causaExencion) {
        throw new Error(`La línea "${linea.concepto}" es exenta y no tiene causa de exención`);
      }
      causa = linea.causaExencion;
      clave = `X|${causa}`;
    } else {
      puntosBase = Math.round(tasaEfectiva(linea, ivaRateGlobal) * 10000);
      clave = `S1|${puntosBase}`;
    }

    const grupo = grupos.get(clave);
    if (grupo) {
      grupo.base += linea.base;
    } else {
      grupos.set(clave, { clave, tasaPuntosBase: puntosBase, causa, base: linea.base });
    }
  }

  const detalles: DetalleDesglose[] = [];
  let cuotaTotalCent = 0;
  let importeTotalCent = 0;

  for (const g of grupos.values()) {
    const baseCent = aCentimos(g.base);
    importeTotalCent += baseCent;

    if (g.causa) {
      const detalle: DetalleDesglose = {
        impuesto,
        claveRegimen: '01',
        baseImponible: formatCentimos(baseCent),
      };
      if (g.causa === 'N1' || g.causa === 'N2') detalle.calificacionOperacion = g.causa;
      else detalle.operacionExenta = g.causa;
      detalles.push(detalle);
      continue;
    }

    const cuotaCent = redondearCentimos((baseCent * g.tasaPuntosBase) / 10000);
    cuotaTotalCent += cuotaCent;
    importeTotalCent += cuotaCent;
    detalles.push({
      impuesto,
      claveRegimen: '01',
      calificacionOperacion: 'S1',
      tipoImpositivo: formatCentimos(g.tasaPuntosBase),
      baseImponible: formatCentimos(baseCent),
      cuotaRepercutida: formatCentimos(cuotaCent),
    });
  }

  return {
    detalles,
    cuotaTotal: formatCentimos(cuotaTotalCent),
    importeTotal: formatCentimos(importeTotalCent),
  };
}
