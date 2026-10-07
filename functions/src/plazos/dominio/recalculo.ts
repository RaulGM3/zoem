// GENERADO desde src/app/core/plazos — no editar; ejecutar `npm run sync:plazos`
import { calcularVencimiento } from './computo-plazo';
import type { EntradaPlazo } from './computo-plazo';
import type { DiaRojo } from './dias-rojos';

export interface ResultadoRecalculo {
  cambia: boolean;
  vencimientoAnterior: string;
  vencimientoNuevo: string;
  /** true si el nuevo vencimiento es anterior al aceptado (caso crítico: riesgo de presentar tarde). */
  seAdelanta: boolean;
}

/** Recalcula un plazo ya aceptado con nuevos días rojos, sin modificar nada: solo informa. */
export function evaluarRecalculo(
  entrada: Omit<EntradaPlazo, 'diasRojos'>,
  vencimientoAceptado: string,
  nuevosDiasRojos: ReadonlyMap<string, DiaRojo>,
): ResultadoRecalculo {
  const vencimientoNuevo = calcularVencimiento({ ...entrada, diasRojos: nuevosDiasRojos }).vencimiento;
  return {
    cambia: vencimientoNuevo !== vencimientoAceptado,
    vencimientoAnterior: vencimientoAceptado,
    vencimientoNuevo,
    seAdelanta: vencimientoNuevo < vencimientoAceptado,
  };
}
