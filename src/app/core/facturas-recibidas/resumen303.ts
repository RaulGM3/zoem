/** Resumen puro del IVA soportado de un trimestre (modelo 303). Sin dependencias de framework. */

import type { EstadoFacturaRecibida, LineaIvaRecibida, PeriodoIva } from '../../interfaces/factura-recibida.interface';

export interface FacturaParaResumen {
  estado: EstadoFacturaRecibida;
  periodo303: PeriodoIva;
  lineasIva: readonly LineaIvaRecibida[];
  porcentajeDeducible: number;
}

export interface TotalPorTipo {
  tipo: number;
  base: number;
  cuota: number;
  cuotaDeducible: number;
}

export interface Resumen303 {
  porTipo: TotalPorTipo[];
  totalBase: number;
  totalCuota: number;
  totalDeducible: number;
  numFacturas: number;
}

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** Suma base, cuota y cuota deducible (`cuota × % / 100`, redondeada por línea) de las facturas `registrada` del periodo. */
export function resumen303(facturas: readonly FacturaParaResumen[], periodo: PeriodoIva): Resumen303 {
  const porTipo = new Map<number, TotalPorTipo>();
  let numFacturas = 0;

  for (const f of facturas) {
    if (f.estado !== 'registrada') continue;
    if (f.periodo303.ejercicio !== periodo.ejercicio || f.periodo303.trimestre !== periodo.trimestre) continue;
    numFacturas++;
    for (const l of f.lineasIva) {
      const acc = porTipo.get(l.tipo) ?? { tipo: l.tipo, base: 0, cuota: 0, cuotaDeducible: 0 };
      acc.base = round2(acc.base + l.base);
      acc.cuota = round2(acc.cuota + l.cuota);
      acc.cuotaDeducible = round2(acc.cuotaDeducible + round2((l.cuota * f.porcentajeDeducible) / 100));
      porTipo.set(l.tipo, acc);
    }
  }

  const lista = [...porTipo.values()].sort((a, b) => b.tipo - a.tipo);
  return {
    porTipo: lista,
    totalBase: round2(lista.reduce((s, t) => s + t.base, 0)),
    totalCuota: round2(lista.reduce((s, t) => s + t.cuota, 0)),
    totalDeducible: round2(lista.reduce((s, t) => s + t.cuotaDeducible, 0)),
    numFacturas,
  };
}
