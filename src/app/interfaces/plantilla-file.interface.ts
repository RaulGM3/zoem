import { Timestamp } from '@angular/fire/firestore';

export interface PlantillaFile {
  id: string;
  plantillaId: string;
  companyId: string;
  folderId: string | null;
  name: string;
  description?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}
