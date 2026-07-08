import type {
  DocVersionEntry,
  SoftDeletable,
  Versioned,
} from '../../interfaces/doc-lifecycle.interface';

/**
 * Lógica PURA de versionado y soft delete — sin Angular, sin Firestore.
 * Los servicios de documentos la usan para construir los patches de update.
 */

/** Campos del doc que describen el archivo actual (lo que versiona). */
export interface VersionMeta {
  name: string;
  storagePath: string;
  downloadUrl: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy?: string;
  uploadedByNombre?: string;
  uploadedAt?: DocVersionEntry['uploadedAt'];
}

export type VersionedFile = Partial<VersionMeta> & Versioned;

export function currentVersion(file: Versioned): number {
  return file.version ?? 1;
}

/**
 * Patch de update para una resubida: los top-level pasan a la versión nueva y
 * el historial crece. Si el doc es legacy (sin `versions`), la primera
 * resubida sintetiza la entry v1 desde sus campos actuales — así no hace
 * falta migrar nada.
 */
export function appendVersion(
  file: VersionedFile,
  meta: VersionMeta,
): VersionMeta & Required<Versioned> {
  const previous: DocVersionEntry[] =
    file.versions && file.versions.length > 0
      ? [...file.versions]
      : [
          {
            version: 1,
            name: file.name ?? '',
            storagePath: file.storagePath ?? '',
            downloadUrl: file.downloadUrl ?? '',
            mimeType: file.mimeType ?? '',
            sizeBytes: file.sizeBytes ?? 0,
            ...(file.uploadedBy !== undefined ? { uploadedBy: file.uploadedBy } : {}),
            ...(file.uploadedByNombre !== undefined
              ? { uploadedByNombre: file.uploadedByNombre }
              : {}),
            ...(file.uploadedAt !== undefined ? { uploadedAt: file.uploadedAt } : {}),
          },
        ];
  const version = currentVersion(file) + 1;
  return {
    ...meta,
    version,
    versions: [...previous, { ...meta, version }],
  };
}

/** Filtro de soft delete: docs legacy sin el campo cuentan como visibles. */
export function isVisibleDoc(doc: SoftDeletable): boolean {
  return doc.deleted !== true;
}
