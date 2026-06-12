import { Timestamp } from '@angular/fire/firestore';

export type CasoDocSlotStatus = 'pendiente' | 'subido';

export interface CasoDocSlot {
  id: string;
  folderId: string | null;
  name: string;
  description?: string;
  status: CasoDocSlotStatus;
  plantillaFileId?: string;
  storagePath?: string;
  downloadUrl?: string;
  mimeType?: string;
  sizeBytes?: number;
  uploadedBy?: string;
  uploadedAt?: Timestamp;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}
