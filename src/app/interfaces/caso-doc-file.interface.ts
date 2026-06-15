import { Timestamp } from '@angular/fire/firestore';

// Archivo LIBRE de un caso: documento subido que NO forma parte de la
// estructura requerida por la plantilla (los doc_slots). Vive en la misma
// jerarquía de carpetas (doc_folders) que los slots, pero es de subida libre.
export interface CasoDocFile {
  id: string;
  folderId: string | null; // null = raíz
  name: string;
  storagePath: string;
  downloadUrl: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy?: string;
  uploadedAt?: Timestamp;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}
