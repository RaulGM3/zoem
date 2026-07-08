import { Timestamp } from '@angular/fire/firestore';
import type { SoftDeletable } from './doc-lifecycle.interface';

export interface PlantillaFolder extends SoftDeletable {
  id: string;
  plantillaId: string;
  companyId: string;
  parentId: string | null;
  name: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  createdBy?: string;
}
