import { Timestamp } from '@angular/fire/firestore';

export interface ContactFolder {
  id: string;
  contactId: string;
  companyId: string;
  parentId: string | null; // null = raíz
  name: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  createdBy?: string;
}
