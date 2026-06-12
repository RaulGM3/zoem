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
