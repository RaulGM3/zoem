import type { MovimientoGestoria } from '../../interfaces/gestoria.interface';

/**
 * Lógica PURA de saldos de tesorería — sin Angular, sin signals, sin DI.
 * Fuente de verdad única del cálculo de saldos por cuenta (aprobado vs sistema)
 * compartida entre la pantalla de Tesorería y el Dashboard.
 */

const COTEJO_TOLERANCIA = 0.01;

/** Campos mínimos que necesita el cálculo de saldos de un movimiento. */
export type MovimientoSaldo = Pick<
  MovimientoGestoria,
  'importe' | 'esEntrada' | 'aprobado' | 'cuentaId'
>;

export interface BalanceCuenta<C extends { id: string }> {
  cuenta: C;
  /** Suma de entradas (esEntrada === true). */
  ingresos: number;
  /** Suma de salidas (esEntrada === false). */
  egresos: number;
  /** ingresos − egresos (todos los movimientos de la cuenta). */
  sistema: number;
  /** Saldo confirmado: solo movimientos aprobados, con signo. */
  proyeccion: number;
  /** Saldo bancario real (extracto importado o tecleado). null si no hay dato. */
  banco: number | null;
  /** banco − proyección. null si no hay saldo bancario. */
  diferencia: number | null;
  /** true si la diferencia está dentro de la tolerancia de cotejo. */
  conciliado: boolean;
}

/** Saldo confirmado: solo movimientos aprobados (aprobado === true), con signo. */
export function saldoAprobado(movimientos: readonly MovimientoSaldo[]): number {
  return movimientos
    .filter(m => m.aprobado === true)
    .reduce((acc, m) => acc + (m.esEntrada ? m.importe : -m.importe), 0);
}

/** Saldo de sistema: todos los movimientos, entradas suman y salidas restan. */
export function saldoSistema(movimientos: readonly MovimientoSaldo[]): number {
  return movimientos.reduce((acc, m) => acc + (m.esEntrada ? m.importe : -m.importe), 0);
}

/**
 * Balance por cuenta: ingresos, egresos, sistema y proyección (aprobados),
 * cotejados contra el saldo bancario real.
 *
 * @param saldoRealPorCuenta saldo bancario real por cuenta (p. ej. del extracto
 *   importado). Tiene prioridad sobre `cuenta.saldoBancario`.
 */
export function balancePorCuenta<C extends { id: string; saldoBancario?: number | null }>(
  cuentas: readonly C[],
  movimientos: readonly MovimientoSaldo[],
  saldoRealPorCuenta?: ReadonlyMap<string, number>,
): BalanceCuenta<C>[] {
  return cuentas.map(cuenta => {
    const movs = movimientos.filter(m => m.cuentaId === cuenta.id);
    const ingresos = movs.filter(m => m.esEntrada).reduce((a, m) => a + m.importe, 0);
    const egresos = movs.filter(m => !m.esEntrada).reduce((a, m) => a + m.importe, 0);
    const sistema = ingresos - egresos;
    const proyeccion = saldoAprobado(movs);
    const banco = saldoRealPorCuenta?.get(cuenta.id) ?? cuenta.saldoBancario ?? null;
    const diferencia = banco !== null ? banco - proyeccion : null;
    return {
      cuenta,
      ingresos,
      egresos,
      sistema,
      proyeccion,
      banco,
      diferencia,
      conciliado: diferencia !== null && Math.abs(diferencia) < COTEJO_TOLERANCIA,
    };
  });
}
