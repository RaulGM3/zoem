import { Timestamp } from '@angular/fire/firestore';

export interface CasoDocFolder {
  id: string;
  parentId: string | null;
  name: string;
  plantillaFolderId?: string;
  createdAt?: Timestamp;
}
