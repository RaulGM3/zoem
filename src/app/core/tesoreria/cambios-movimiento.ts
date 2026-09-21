import type { MovimientoGestoria } from '../../interfaces/gestoria.interface';

/**
 * Descripción PURA de los cambios de un movimiento — sin Angular, sin DI.
 * Alimenta el feed de actividad: un admin tiene que poder leer QUÉ cambió un
 * gestor sin abrir el documento, porque en tesorería un importe editado sin
 * rastro es un agujero de auditoría.
 */

/** Campos de un movimiento cuyo cambio se audita. */
export type MovimientoAuditable = Pick<
  MovimientoGestoria,
  'tipo' | 'concepto' | 'importe' | 'esEntrada' | 'fecha' | 'notas' | 'cuentaId'
>;

const VACIO = '—';

function euros(n: number): string {
  return `${n.toFixed(2).replace('.', ',')} €`;
}

function entrecomillar(v: string | undefined): string {
  return `"${v?.trim() || VACIO}"`;
}

/**
 * Campos auditados, en el orden en que se listan en el feed. Cada uno sabe
 * cómo representarse; `undefined` en el parche significa "no se tocó".
 */
const CAMPOS: readonly {
  clave: keyof MovimientoAuditable;
  etiqueta: string;
  formato: (valor: MovimientoAuditable[keyof MovimientoAuditable], nombres: ReadonlyMap<string, string>) => string;
}[] = [
  { clave: 'concepto', etiqueta: 'concepto', formato: v => entrecomillar(v as string | undefined) },
  { clave: 'tipo', etiqueta: 'tipo', formato: v => String(v) },
  { clave: 'importe', etiqueta: 'importe', formato: v => euros(v as number) },
  { clave: 'esEntrada', etiqueta: 'dirección', formato: v => (v ? 'entrada' : 'salida') },
  { clave: 'fecha', etiqueta: 'fecha', formato: v => String(v) },
  {
    clave: 'cuentaId',
    etiqueta: 'cuenta',
    formato: (v, nombres) => {
      const id = v as string | undefined;
      return id ? (nombres.get(id) ?? id) : VACIO;
    },
  },
  { clave: 'notas', etiqueta: 'notas', formato: v => entrecomillar(v as string | undefined) },
];

/**
 * Lista legible de los cambios entre el movimiento actual y el parche que se
 * va a guardar. Solo reporta los campos presentes en el parche Y distintos.
 *
 * @param nombresCuenta id de cuenta → nombre, para que el feed diga "BBVA" y no un id opaco.
 */
export function describirCambios(
  anterior: MovimientoAuditable,
  parche: Partial<MovimientoAuditable>,
  nombresCuenta: ReadonlyMap<string, string> = new Map(),
): string[] {
  const cambios: string[] = [];
  for (const { clave, etiqueta, formato } of CAMPOS) {
    if (!(clave in parche)) continue;
    const nuevo = parche[clave];
    const viejo = anterior[clave];
    if (nuevo === viejo) continue;
    // Un opcional que pasa de `undefined` a `''` (o al revés) no es un cambio real.
    if ((viejo ?? '') === (nuevo ?? '')) continue;
    cambios.push(`${etiqueta}: ${formato(viejo, nombresCuenta)} → ${formato(nuevo, nombresCuenta)}`);
  }
  return cambios;
}
