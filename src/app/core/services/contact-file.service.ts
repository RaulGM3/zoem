import { inject, Injectable, signal } from '@angular/core';
import {
  Firestore,
  Timestamp,
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from '@angular/fire/firestore';
import {
  Storage,
  ref,
  uploadBytes,
  getDownloadURL,
} from '@angular/fire/storage';
import { Auth } from '@angular/fire/auth';
import { CompanyService } from './company.service';
import { DocAuditService } from './doc-audit.service';
import { PermissionService } from './permission.service';
import { stripUndefinedDeep } from '../firebase/sanitize';
import { appendVersion, isVisibleDoc, type VersionMeta } from '../docs/doc-versioning';
import { ContactFile } from '../../interfaces';

/**
 * Archivos de contacto con el mismo ciclo de vida trazable que los de casos:
 * soft delete (nunca deleteDoc/deleteObject), versionado al resubir y
 * auditoría append-only en `contact_files/{id}/doc_audit`.
 */
@Injectable({ providedIn: 'root' })
export class ContactFileService {
  private readonly firestore = inject(Firestore);
  private readonly storage = inject(Storage);
  private readonly auth = inject(Auth);
  private readonly companyService = inject(CompanyService);
  private readonly docAudit = inject(DocAuditService);
  private readonly permissionService = inject(PermissionService);

  readonly files = signal<ContactFile[]>([]);
  readonly isLoading = signal(false);

  private get companyId(): string {
    const id = this.companyService.activeCompany()?.id;
    if (!id) throw new Error('No active company');
    return id;
  }

  filePath(fileId: string): string {
    return `contact_files/${fileId}`;
  }

  /**
   * Los Admin listan sin filtro de clasificado; el resto usa la doble query
   * demostrable ante rules (no clasificados + clasificados con allowlist).
   */
  async loadFiles(contactId: string): Promise<void> {
    this.isLoading.set(true);
    this.files.set([]);
    try {
      const base = [
        where('companyId', '==', this.companyId),
        where('contactId', '==', contactId),
      ];
      const colRef = collection(this.firestore, 'contact_files');
      let docs: ContactFile[];
      if (this.permissionService.isAdmin()) {
        const snapshot = await getDocs(query(colRef, ...base, orderBy('createdAt', 'desc')));
        docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as ContactFile);
      } else {
        const uid = this.auth.currentUser?.uid ?? '';
        const [publicSnap, mineSnap] = await Promise.all([
          getDocs(query(colRef, ...base, where('clasificado', '==', false))),
          getDocs(query(
            colRef, ...base,
            where('clasificado', '==', true),
            where('allowedUserIds', 'array-contains', uid),
          )),
        ]);
        const byId = new Map<string, ContactFile>();
        for (const d of [...publicSnap.docs, ...mineSnap.docs]) {
          byId.set(d.id, { id: d.id, ...d.data() } as ContactFile);
        }
        docs = [...byId.values()].sort(
          (a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0),
        );
      }
      this.files.set(docs.filter(isVisibleDoc));
    } finally {
      // El error se propaga al llamador (lo muestra ToastService).
      this.isLoading.set(false);
    }
  }

  /** Cambia el estado clasificado / allowlist (solo Admin, enforzado en rules). */
  async setClassification(
    file: ContactFile,
    clasificado: boolean,
    allowedUserIds: string[],
  ): Promise<void> {
    await updateDoc(doc(this.firestore, 'contact_files', file.id), stripUndefinedDeep({
      clasificado,
      allowedUserIds,
      updatedAt: serverTimestamp(),
    }));
    this.docAudit.log(this.filePath(file.id), 'permission_change', {
      detail: clasificado
        ? `Clasificado · ${allowedUserIds.length} usuario(s) con acceso`
        : 'Desclasificado',
    });
    this.files.update((list) =>
      list.map((f) => (f.id === file.id ? { ...f, clasificado, allowedUserIds } : f))
    );
  }

  /** `Timestamp.now()`: serverTimestamp() no se permite dentro de arrays. */
  private versionMeta(file: File, storagePath: string, downloadUrl: string): VersionMeta {
    return {
      name: file.name,
      storagePath,
      downloadUrl,
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
      uploadedBy: this.auth.currentUser?.uid ?? '',
      uploadedByNombre: this.permissionService.currentMember()?.nombre ?? '',
      uploadedAt: Timestamp.now(),
    };
  }

  private async uploadToStorage(
    contactId: string,
    folderId: string | null,
    file: File,
  ): Promise<{ storagePath: string; downloadUrl: string }> {
    const storagePath = `companies/${this.companyId}/contacts/${contactId}/${folderId ?? 'root'}/${Date.now()}_${file.name}`;
    const storageRef = ref(this.storage, storagePath);
    await uploadBytes(storageRef, file);
    const downloadUrl = await getDownloadURL(storageRef);
    return { storagePath, downloadUrl };
  }

  async uploadFile(contactId: string, folderId: string | null, file: File): Promise<void> {
    const { storagePath, downloadUrl } = await this.uploadToStorage(contactId, folderId, file);
    const meta = this.versionMeta(file, storagePath, downloadUrl);

    const docRef = await addDoc(collection(this.firestore, 'contact_files'), stripUndefinedDeep({
      contactId,
      companyId: this.companyId,
      folderId,
      ...meta,
      originalName: file.name,
      version: 1,
      versions: [{ ...meta, version: 1 }],
      deleted: false,
      clasificado: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));

    this.docAudit.log(this.filePath(docRef.id), 'create', { version: 1, detail: file.name });

    await this.loadFiles(contactId);
  }

  /** Resube como NUEVA versión: el blob anterior se conserva en Storage. */
  async reuploadFile(contactFile: ContactFile, newFile: File): Promise<void> {
    const { storagePath, downloadUrl } = await this.uploadToStorage(
      contactFile.contactId,
      contactFile.folderId,
      newFile,
    );
    const patch = appendVersion(contactFile, this.versionMeta(newFile, storagePath, downloadUrl));

    await updateDoc(doc(this.firestore, 'contact_files', contactFile.id), stripUndefinedDeep({
      ...patch,
      updatedAt: serverTimestamp(),
    }));

    this.docAudit.log(this.filePath(contactFile.id), 'update', {
      version: patch.version,
      detail: `Nueva versión: ${newFile.name}`,
    });

    await this.loadFiles(contactFile.contactId);
  }

  /** Soft delete: el doc y sus blobs siguen existiendo, solo dejan de verse. */
  async deleteFile(fileId: string, storagePath: string, contactId: string): Promise<void> {
    await updateDoc(doc(this.firestore, 'contact_files', fileId), stripUndefinedDeep({
      deleted: true,
      deletedAt: serverTimestamp(),
      deletedBy: this.auth.currentUser?.uid ?? '',
      deletedByNombre: this.permissionService.currentMember()?.nombre ?? '',
    }));
    this.docAudit.log(this.filePath(fileId), 'delete');
    this.files.update((list) => list.filter((f) => f.id !== fileId));
    void storagePath; // Se conserva: nada se borra de Storage.
    void contactId;
  }
}
