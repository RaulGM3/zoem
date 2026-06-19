import { Timestamp } from '@angular/fire/firestore';

export type CasoTipo = 'Legal' | 'Fiscal' | 'Laboral' | 'Mercantil' | 'Civil';
export type CasoEstado = 'pendiente' | 'en_proceso' | 'cerrado' | 'urgente' | 'archivado';
export type CasoPrioridad = 'alta' | 'media' | 'baja';
export type HitoEstado = 'pendiente' | 'en_progreso' | 'completado' | 'cancelado';

/**
 * Bloque de horas reales trabajadas en un hito por un miembro concreto.
 * Permite repartir un mismo hito en varios bloques y días (ej. 8–12, 14–18, y al
 * día siguiente 8–10). Es la fuente de las horas facturables.
 */
export interface RegistroHoraHito {
  id: string;
  userId: string;        // miembro que trabajó
  fecha: string;         // YYYY-MM-DD
  horaInicio: string;    // HH:mm
  horaFin: string;       // HH:mm
  minutos: number;       // derivado: horaFin - horaInicio
  facturado?: boolean;   // ya convertido a MovimientoGestoria
  movimientoId?: string; // link al movimiento de honorario generado
}

export interface Hito {
  id: string;
  casoId: string;
  casoTitulo: string;
  titulo: string;
  descripcion?: string;
  fechaEstimada?: string;
  fechaReal?: string;
  asignadoA?: string;          // legacy: un solo responsable (compat)
  asignadosA?: string[];       // multi-asignación: varios miembros pueden registrar horas
  estado: HitoEstado;
  orden: number;
  horaAgenda?: string;   // HH:mm — slot asignado en la agenda
  duracionAgenda?: number; // minutos
  registrosHoras?: RegistroHoraHito[]; // horas reales declaradas (cobro por horas)
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
  totalEgresos: number;
  saldo: number;
  /** IVA repercutido (de entradas) y soportado (de salidas). Base para el modelo 303. */
  ivaRepercutido: number;
  ivaSoportado: number;
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
  /** Conteo denormalizado de slots de gestoría para evaluar "ejecutado" sin leer subcolecciones. */
  gestoriaResumenSlots?: { total: number; registrados: number };
  /** Factura generada para este caso (id en la colección `invoices`). */
  facturaId?: string;
  /** ISO datetime en que se generó la factura. */
  facturadoAt?: string;
  /** ISO datetime en que se confirmó el cierre financiero del caso. */
  cierreConfirmadoAt?: string;
  /** Saldo bancario corroborado al cerrar (snapshot de auditoría). */
  cierreSaldoBancario?: number;
  vencimiento?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * La gestoría de un caso está "ejecutada" cuando todos sus slots de costo previsto
 * están registrados. Los casos sin slots (`total === 0`) NO califican: no hay costos
 * previstos que ejecutar, así que no pueden facturarse ni cerrarse por esta vía.
 */
export function gestoriaCompleta(c: Caso): boolean {
  const r = c.gestoriaResumenSlots;
  return !!r && r.total > 0 && r.registrados === r.total;
}

export const RESUMEN_FINANCIERO_VACIO: ResumenFinanciero = {
  totalIngresos: 0,
  totalSuplidos: 0,
  totalHonorarios: 0,
  totalEgresos: 0,
  saldo: 0,
  ivaRepercutido: 0,
  ivaSoportado: 0,
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
