import { Timestamp } from '@angular/fire/firestore';

/**
 * Ciclo de vida de documentos con trazabilidad total:
 * - Nada se borra de verdad: `deleted: true` lo oculta pero el doc y sus
 *   blobs de Storage siguen existiendo (las rules prohíben el delete real).
 * - Nada se sobreescribe: resubir crea una nueva entrada en `versions` y los
 *   campos top-level pasan a apuntar a la versión actual.
 * - Cada acción queda en la subcolección `doc_audit` (append-only por rules).
 */
export interface SoftDeletable {
  /** Ausente en docs legacy == no borrado. */
  deleted?: boolean;
  deletedAt?: Timestamp;
  deletedBy?: string;
  deletedByNombre?: string;
}

export interface DocVersionEntry {
  version: number;
  name: string;
  storagePath: string;
  downloadUrl: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy?: string;
  uploadedByNombre?: string;
  uploadedAt?: Timestamp;
}

export interface Versioned {
  /** Versión actual; ausente == 1 (doc legacy sin historial). */
  version?: number;
  /** Historial completo, incluida la versión actual. */
  versions?: DocVersionEntry[];
}

export type DocAuditAction =
  | 'create'
  | 'view'
  | 'download'
  | 'update'
  | 'delete'
  | 'restore'
  | 'permission_change';

/** Evento de auditoría en `.../{doc}/doc_audit/{eventId}`. Inmutable por rules. */
export interface DocAuditEvent {
  id?: string;
  companyId: string;
  action: DocAuditAction;
  userId: string;
  userNombre: string;
  version?: number;
  detail?: string;
  at: Timestamp;
}
