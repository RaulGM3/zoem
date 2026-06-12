import { Timestamp } from '@angular/fire/firestore';

export interface PlantillaFolder {
  id: string;
  plantillaId: string;
  companyId: string;
  parentId: string | null;
  name: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  createdBy?: string;
}
