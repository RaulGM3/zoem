import { Timestamp } from '@angular/fire/firestore';
import type { Capability, Modulo } from '../core/permissions/permissions';

export type PermissionRequestEstado = 'pendiente' | 'aprobada' | 'rechazada';

/**
 * Solicitud de permiso de un miembro al admin.
 * Colección `companies/{companyId}/permission_requests/{id}`.
 * Nunca se borra (rules): la resolución queda como registro.
 */
export interface PermissionRequest {
  id: string;
  companyId: string;
  userId: string;
  userNombre: string;
  modulo: Modulo;
  capability: Capability;
  motivo?: string;
  estado: PermissionRequestEstado;
  resolvedBy?: string;
  resolvedByNombre?: string;
  resolvedAt?: Timestamp;
  createdAt: Timestamp;
}
