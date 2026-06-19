import { Timestamp } from '@angular/fire/firestore';
import type { Modulo } from '../core/permissions/permissions';

/**
 * Evento de actividad a nivel empresa: quién hizo qué y cuándo.
 * Feed transversal alimentado por los servicios de cada módulo.
 */
export interface Actividad {
  id: string;
  companyId: string;
  autorId: string;
  /** Snapshot del nombre del autor — sigue legible aunque cambie/borre el miembro. */
  autorNombre: string;
  /** Frase corta: "Creó el caso 2026-090". */
  accion: string;
  modulo: Modulo;
  /** Id de la entidad afectada (caso, contacto, etc.), si aplica. */
  entidadId?: string;
  createdAt: Timestamp;
}
