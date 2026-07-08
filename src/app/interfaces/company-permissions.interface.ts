import { Timestamp } from '@angular/fire/firestore';
import type { MatrixOverride } from '../core/permissions/permissions';

/**
 * Doc `companies/{companyId}/settings/permissions`.
 * `matrix` es SPARSE: solo celdas que difieren de la matriz base `PERMISOS`.
 * Doc ausente = la empresa usa los valores por defecto.
 */
export interface CompanyPermissions {
  matrix: MatrixOverride;
  updatedAt?: Timestamp;
  updatedBy?: string;
}
