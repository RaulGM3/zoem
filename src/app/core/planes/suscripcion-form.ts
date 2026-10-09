import type { ComplementoId, EstadoSuscripcion, PlanId, Suscripcion } from './catalogo';
import { aFecha } from './derechos';

/** Valores del formulario de superuser. `plan: ''` = sin suscripción (empresa legada, equivale a Pro). */
export interface SuscripcionForm {
  plan: PlanId | '';
  estado: EstadoSuscripcion;
  /** yyyy-mm-dd o vacío. */
  periodoFin: string;
  complementos: ComplementoId[];
}

export function suscripcionDesdeForm(f: SuscripcionForm, previa?: Suscripcion): Suscripcion | undefined {
  if (!f.plan) return undefined;
  const s: Suscripcion = {
    plan: f.plan,
    estado: f.estado,
    complementos: [...f.complementos],
    origen: previa?.origen ?? 'manual',
  };
  if (f.periodoFin) s.periodoFin = new Date(`${f.periodoFin}T23:59:59Z`);
  if (previa?.ajustes) s.ajustes = previa.ajustes;
  return s;
}

export function formDesdeSuscripcion(s: Suscripcion | undefined): SuscripcionForm {
  if (!s) return { plan: '', estado: 'activa', periodoFin: '', complementos: [] };
  const fin = aFecha(s.periodoFin);
  return {
    plan: s.plan,
    estado: s.estado,
    periodoFin: fin ? fin.toISOString().slice(0, 10) : '',
    complementos: [...s.complementos],
  };
}
