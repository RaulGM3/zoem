import { Timestamp } from '@angular/fire/firestore';
import type { SoftDeletable, Versioned } from './doc-lifecycle.interface';

// 'subido' = se subió un archivo manual. 'generado' = se rellenó una plantilla
// de documento (docTemplate) y quedó congelada en `generatedHtml`.
export type CasoDocSlotStatus = 'pendiente' | 'subido' | 'generado';

export interface CasoDocSlot extends SoftDeletable, Versioned {
  id: string;
  folderId: string | null;
  name: string;
  description?: string;
  status: CasoDocSlotStatus;
  plantillaFileId?: string;
  /**
   * Vínculo a la plantilla de documento (docTemplates) heredado del PlantillaFile.
   * Si está presente, el slot NO se sube: se rellena y se congela.
   */
  docTemplateId?: string;
  /** Snapshot HTML del documento rellenado. Congelado hasta que se regenere a mano. */
  generatedHtml?: string;
  /** Valores usados al rellenar — pre-cargan el formulario al regenerar. */
  generatedValues?: Record<string, string>;
  generatedBy?: string;
  generatedAt?: Timestamp;
  storagePath?: string;
  downloadUrl?: string;
  mimeType?: string;
  sizeBytes?: number;
  uploadedBy?: string;
  uploadedByNombre?: string;
  uploadedAt?: Timestamp;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  /** Documento sensible: solo Admin o usuarios de la allowlist lo ven. */
  clasificado?: boolean;
  allowedUserIds?: string[];
}
