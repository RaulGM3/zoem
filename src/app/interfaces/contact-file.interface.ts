import { Timestamp } from '@angular/fire/firestore';

export interface ContactFile {
  id: string;
  contactId: string;
  companyId: string;
  folderId: string | null; // null = raíz
  name: string; // nombre de visualización
  originalName: string; // nombre original del fichero
  mimeType: string;
  sizeBytes: number;
  storagePath: string; // ruta en Firebase Storage
  downloadUrl: string; // URL de descarga
  uploadedBy?: string;
  description?: string;
  tags?: string[];
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}
