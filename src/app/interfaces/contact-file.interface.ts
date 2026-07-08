import { Timestamp } from '@angular/fire/firestore';
import type { SoftDeletable, Versioned } from './doc-lifecycle.interface';

export interface ContactFile extends SoftDeletable, Versioned {
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
  uploadedByNombre?: string;
  description?: string;
  tags?: string[];
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  /** Documento sensible: solo Admin o usuarios de la allowlist lo ven. */
  clasificado?: boolean;
  allowedUserIds?: string[];
}
