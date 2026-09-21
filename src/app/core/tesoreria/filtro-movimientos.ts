import type { MovimientoGestoria, MovimientoTipo } from '../../interfaces/gestoria.interface';

/**
 * Lógica PURA de filtrado y ordenamiento de movimientos — sin Angular, sin
 * signals, sin DI. Se comparte entre la tab de gestoría del caso y Tesorería
 * para que ambas pantallas filtren con exactamente el mismo criterio.
 */

/** Campos mínimos que necesita filtrar u ordenar un movimiento. */
export type MovimientoFiltrable = Pick<
  MovimientoGestoria,
  'tipo' | 'concepto' | 'notas' | 'importe' | 'esEntrada' | 'fecha' | 'cuentaId'
>;

export type DireccionFiltro = 'todas' | 'entradas' | 'salidas';
export type CampoOrden = 'fecha' | 'importe' | 'tipo' | 'concepto';
export type SentidoOrden = 'asc' | 'desc';

/** Valor sintético de `cuentaIds` para los movimientos que no tienen cuenta asignada. */
export const SIN_CUENTA = 'sin-cuenta';

export interface FiltroMovimientos {
  /** Búsqueda libre sobre concepto y notas. Vacío o en blanco = no filtra. */
  readonly texto: string;
  /** Tipos seleccionados (OR entre ellos). Lista vacía = todos los tipos. */
  readonly tipos: readonly MovimientoTipo[];
  readonly direccion: DireccionFiltro;
  /** Cuentas seleccionadas. Lista vacía = todas. Admite `SIN_CUENTA`. */
  readonly cuentaIds: readonly string[];
  /** Fecha ISO `YYYY-MM-DD` inclusiva. Vacío = sin límite inferior. */
  readonly desde: string;
  /** Fecha ISO `YYYY-MM-DD` inclusiva. Vacío = sin límite superior. */
  readonly hasta: string;
}

export interface OrdenMovimientos {
  readonly campo: CampoOrden;
  readonly direccion: SentidoOrden;
}

export const FILTRO_MOVIMIENTOS_VACIO: FiltroMovimientos = {
  texto: '',
  tipos: [],
  direccion: 'todas',
  cuentaIds: [],
  desde: '',
  hasta: '',
};

/** La fecha contable, de más reciente a más antigua: lo que espera ver el usuario al abrir. */
export const ORDEN_MOVIMIENTOS_DEFECTO: OrdenMovimientos = { campo: 'fecha', direccion: 'desc' };

/**
 * Normaliza para comparar: minúsculas y sin diacríticos, de forma que "Notaría"
 * y "notaria" sean la misma cadena. Imprescindible en castellano.
 */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** true si el movimiento pasa TODOS los criterios activos del filtro (AND). */
function cumple(mov: MovimientoFiltrable, filtro: FiltroMovimientos, textoNormalizado: string): boolean {
  if (textoNormalizado) {
    const heno = normalizar(`${mov.concepto} ${mov.notas ?? ''}`);
    if (!heno.includes(textoNormalizado)) return false;
  }

  if (filtro.tipos.length > 0 && !filtro.tipos.includes(mov.tipo)) return false;

  if (filtro.direccion === 'entradas' && !mov.esEntrada) return false;
  if (filtro.direccion === 'salidas' && mov.esEntrada) return false;

  if (filtro.cuentaIds.length > 0 && !filtro.cuentaIds.includes(mov.cuentaId ?? SIN_CUENTA)) return false;

  // Las fechas son ISO `YYYY-MM-DD`: el orden lexicográfico ya es el cronológico.
  if (filtro.desde && mov.fecha < filtro.desde) return false;
  if (filtro.hasta && mov.fecha > filtro.hasta) return false;

  return true;
}

/** Filtra sin mutar. Devuelve un array nuevo en el mismo orden de entrada. */
export function filtrarMovimientos<M extends MovimientoFiltrable>(
  movimientos: readonly M[],
  filtro: FiltroMovimientos,
): M[] {
  const texto = normalizar(filtro.texto.trim());
  return movimientos.filter(m => cumple(m, filtro, texto));
}

/** Comparador del campo pedido; devuelve <0, 0 o >0 en sentido ascendente. */
function comparar(a: MovimientoFiltrable, b: MovimientoFiltrable, campo: CampoOrden): number {
  switch (campo) {
    case 'importe': return a.importe - b.importe;
    case 'fecha': return a.fecha.localeCompare(b.fecha);
    case 'tipo': return a.tipo.localeCompare(b.tipo);
    case 'concepto': return normalizar(a.concepto).localeCompare(normalizar(b.concepto));
  }
}

/**
 * Ordena sin mutar. Empate resuelto siempre por fecha descendente, para que el
 * listado sea estable y previsible al ordenar por tipo o por concepto.
 */
export function ordenarMovimientos<M extends MovimientoFiltrable>(
  movimientos: readonly M[],
  orden: OrdenMovimientos,
): M[] {
  const signo = orden.direccion === 'asc' ? 1 : -1;
  return [...movimientos].sort((a, b) => {
    const principal = comparar(a, b, orden.campo) * signo;
    return principal !== 0 ? principal : b.fecha.localeCompare(a.fecha);
  });
}

/** Filtra y después ordena. Es el pipeline que consume la vista. */
export function filtrarYOrdenar<M extends MovimientoFiltrable>(
  movimientos: readonly M[],
  filtro: FiltroMovimientos,
  orden: OrdenMovimientos,
): M[] {
  return ordenarMovimientos(filtrarMovimientos(movimientos, filtro), orden);
}

/** true si algún criterio está activo: habilita el botón "Limpiar filtros". */
export function hayFiltroActivo(filtro: FiltroMovimientos): boolean {
  return (
    filtro.texto.trim().length > 0 ||
    filtro.tipos.length > 0 ||
    filtro.direccion !== 'todas' ||
    filtro.cuentaIds.length > 0 ||
    filtro.desde.length > 0 ||
    filtro.hasta.length > 0
  );
}

/** Cuántos movimientos hay de cada tipo, para mostrar el contador en cada chip. */
export function contarPorTipo(
  movimientos: readonly MovimientoFiltrable[],
): ReadonlyMap<MovimientoTipo, number> {
  const cuenta = new Map<MovimientoTipo, number>();
  for (const m of movimientos) cuenta.set(m.tipo, (cuenta.get(m.tipo) ?? 0) + 1);
  return cuenta;
}
