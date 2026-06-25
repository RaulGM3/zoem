import type { HitoEstado } from '../../interfaces';

/**
 * Fuente de verdad única (pura, sin framework) para el estado de un Hito.
 *
 * Todos los consumidores (caso-hitos-tab, calendario, hito-form-drawer) deben
 * derivar labels, colores, transiciones y lógica de aquí. NO reimplementar
 * mapas locales: si están aquí, todos coinciden.
 *
 * Los iconos (acoplados a lucide-angular) viven en `hito-estado.icons.ts` para
 * mantener este módulo de dominio libre de dependencias de framework.
 *
 * Los valores del enum (`en_progreso`, etc.) son los que viven en Firestore y
 * NO deben cambiarse — sólo se normaliza su presentación.
 */

export const HITO_ESTADOS: readonly HitoEstado[] = [
  'pendiente',
  'en_progreso',
  'completado',
  'cancelado',
];

export const HITO_ESTADO_LABEL: Record<HitoEstado, string> = {
  pendiente: 'Pendiente',
  en_progreso: 'En proceso',
  completado: 'Completado',
  cancelado: 'Cancelado',
};

/** Color de texto del icono de estado (caso-hitos-tab). */
export const HITO_ESTADO_ICON_COLOR: Record<HitoEstado, string> = {
  pendiente: 'text-slate-300',
  en_progreso: 'text-blue-500',
  completado: 'text-emerald-500',
  cancelado: 'text-slate-400',
};

/** Clases del badge de estado (calendario). Dark-mode-aware: definidas en styles.css. */
export const HITO_ESTADO_BADGE_CLASS: Record<HitoEstado, string> = {
  pendiente: 'badge-warning',
  en_progreso: 'badge-brand',
  completado: 'badge-success',
  cancelado: 'badge-muted',
};

/** Estado del hito → status genérico del CalendarItem. */
export const HITO_ESTADO_CALENDAR_STATUS: Record<HitoEstado, 'confirmada' | 'pendiente' | 'cancelada'> = {
  pendiente: 'pendiente',
  en_progreso: 'pendiente',
  completado: 'confirmada',
  cancelado: 'cancelada',
};

/** Presentación del estado "Vencido" (derivado, no es un HitoEstado real). */
export const HITO_OVERDUE_LABEL = 'Vencido';
export const HITO_OVERDUE_BADGE_CLASS = 'badge-danger';

/**
 * Ciclo de un solo botón (caso-hitos-tab): un click avanza al siguiente estado
 * y, al completar, vuelve a pendiente. Un hito cancelado se reactiva.
 */
export function cycleHitoEstado(estado: HitoEstado): HitoEstado {
  switch (estado) {
    case 'pendiente': return 'en_progreso';
    case 'en_progreso': return 'completado';
    case 'completado': return 'pendiente';
    case 'cancelado': return 'pendiente';
  }
}

/** Avance lineal (calendario): no pasa de completado. */
export function nextHitoEstado(estado: HitoEstado): HitoEstado {
  if (estado === 'pendiente') return 'en_progreso';
  if (estado === 'en_progreso') return 'completado';
  return estado;
}

/** Retroceso lineal (calendario): no baja de pendiente. */
export function prevHitoEstado(estado: HitoEstado): HitoEstado {
  if (estado === 'completado') return 'en_progreso';
  if (estado === 'en_progreso') return 'pendiente';
  return estado;
}

/** Un hito está vencido si está activo y su fecha estimada ya pasó. */
export function isHitoOverdue(
  estado: HitoEstado | undefined,
  fecha: string | undefined,
  today: string,
): boolean {
  if (!estado || !fecha) return false;
  if (estado === 'completado' || estado === 'cancelado') return false;
  return fecha < today;
}

export interface EstadoChangeStamp {
  estadoActualizadoPor?: string;
  estadoActualizadoEn: string;
}

/** Sello de auditoría: quién cambió el estado y cuándo. */
export function stampEstadoChange(userId: string | undefined): EstadoChangeStamp {
  return {
    ...(userId ? { estadoActualizadoPor: userId } : {}),
    estadoActualizadoEn: new Date().toISOString(),
  };
}
