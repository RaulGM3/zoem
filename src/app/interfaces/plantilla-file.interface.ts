import { Timestamp } from '@angular/fire/firestore';
import type { FirmRole } from './member';
import type { SoftDeletable } from './doc-lifecycle.interface';

/** Visibilidad de plantillas: ausente == 'all' (docs legacy). */
export type PlantillaVisibility = 'all' | 'restricted';

export interface PlantillaFile extends SoftDeletable {
  id: string;
  plantillaId: string;
  companyId: string;
  folderId: string | null;
  name: string;
  description?: string;
  docTemplateId?: string | null;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  createdBy?: string;
  visibleTo?: PlantillaVisibility;
  visibleRoles?: FirmRole[];
  visibleUserIds?: string[];
}
