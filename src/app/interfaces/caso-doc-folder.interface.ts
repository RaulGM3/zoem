import { Timestamp } from '@angular/fire/firestore';
import type { SoftDeletable } from './doc-lifecycle.interface';

export interface CasoDocFolder extends SoftDeletable {
  id: string;
  parentId: string | null;
  name: string;
  plantillaFolderId?: string;
  createdAt?: Timestamp;
}
