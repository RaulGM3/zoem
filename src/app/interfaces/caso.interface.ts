import { Timestamp } from '@angular/fire/firestore';

export type CasoTipo = 'Legal' | 'Fiscal' | 'Laboral' | 'Mercantil' | 'Civil';
export type CasoEstado = 'pendiente' | 'en_proceso' | 'cerrado' | 'urgente' | 'archivado';
export type CasoPrioridad = 'alta' | 'media' | 'baja';
export type HitoEstado = 'pendiente' | 'en_progreso' | 'completado' | 'cancelado';

export interface Hito {
  id: string;
  casoId: string;
  casoTitulo: string;
  titulo: string;
  descripcion?: string;
  fechaEstimada?: string;
  fechaReal?: string;
  asignadoA?: string;
  estado: HitoEstado;
  orden: number;
  horaAgenda?: string;   // HH:mm — slot asignado en la agenda
  duracionAgenda?: number; // minutos
  calendarColor?: string | null;
  estadoActualizadoPor?: string; // userId de quién cambió el estado por última vez
  estadoActualizadoEn?: string;  // ISO datetime del último cambio de estado
}

/** Acciones auditables sobre un hito. */
export type HitoActividadTipo = 'creado' | 'editado' | 'estado' | 'eliminado';

/**
 * Evento del feed de actividad de un hito: deja anotado QUIÉN hizo QUÉ y cuándo.
 * Se guarda como colección plana (igual que los hitos) con `casoId` para filtrar,
 * y se consume en tiempo real. `hitoTitulo` es un snapshot para que el evento siga
 * siendo legible aunque el hito se elimine después.
 */
export interface HitoActividad {
  id: string;
  casoId: string;
  hitoId: string;
  hitoTitulo: string;
  tipo: HitoActividadTipo;
  autorId?: string;
  estadoAnterior?: HitoEstado;
  estadoNuevo?: HitoEstado;
  createdAt: Timestamp;
}

export interface ResumenFinanciero {
  totalIngresos: number;
  totalSuplidos: number;
  totalHonorarios: number;
  saldo: number;
}

export interface Caso {
  id: string;
  companyId: string;
  titulo: string;
  descripcion?: string;
  tipo: CasoTipo;
  estado: CasoEstado;
  prioridad: CasoPrioridad;
  contactoIds: string[];
  plantillaId?: string;
  hitos: Hito[];
  resumenFinanciero: ResumenFinanciero;
  vencimiento?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export const RESUMEN_FINANCIERO_VACIO: ResumenFinanciero = {
  totalIngresos: 0,
  totalSuplidos: 0,
  totalHonorarios: 0,
  saldo: 0,
};

export interface CreateCasoData {
  titulo: string;
  descripcion?: string;
  tipo: CasoTipo;
  estado: CasoEstado;
  prioridad: CasoPrioridad;
  vencimiento?: string;
  contactoIds: string[];
  plantillaId?: string;
}
