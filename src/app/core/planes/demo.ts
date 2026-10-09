import type { Suscripcion } from './catalogo';

/** Despacho de ejemplo: no debe producir efectos externos (espejo de functions/src/autoservicio/suscripcion.ts). */
export function esEmpresaDemo(
  empresa: { esDemo?: boolean; suscripcion?: Pick<Suscripcion, 'plan'> | Suscripcion } | null | undefined,
): boolean {
  return empresa?.esDemo === true || empresa?.suscripcion?.plan === 'demo';
}

export const AVISO_DEMO_SIN_ENVIOS = 'En el despacho de ejemplo no se envía nada.';
