import { Timestamp } from '@angular/fire/firestore';
import type { SoftDeletable } from './doc-lifecycle.interface';

export interface ContactFolder extends SoftDeletable {
  id: string;
  contactId: string;
  companyId: string;
  parentId: string | null; // null = raíz
  name: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  createdBy?: string;
}
