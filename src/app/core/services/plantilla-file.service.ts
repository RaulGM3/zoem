import { inject, Injectable, signal } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  serverTimestamp,
} from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { CompanyService } from './company.service';
import { DocAuditService } from './doc-audit.service';
import { PermissionService } from './permission.service';
import { stripUndefinedDeep } from '../firebase/sanitize';
import { isVisibleDoc } from '../docs/doc-versioning';
import { canSeePlantilla } from '../permissions/doc-access';
import { PlantillaFile } from '../../interfaces';
import type { FirmRole } from '../../interfaces/member';
import type { PlantillaVisibility } from '../../interfaces/plantilla-file.interface';

@Injectable({ providedIn: 'root' })
export class PlantillaFileService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(Auth);
  private readonly companyService = inject(CompanyService);
  private readonly docAudit = inject(DocAuditService);
  private readonly permissionService = inject(PermissionService);

  readonly files = signal<PlantillaFile[]>([]);
  readonly isLoading = signal(false);

  private get companyId(): string {
    const id = this.companyService.activeCompany()?.id;
    if (!id) throw new Error('No active company');
    return id;
  }

  filePath(fileId: string): string {
    return `plantilla_files/${fileId}`;
  }

  async loadFiles(plantillaId: string): Promise<void> {
    this.isLoading.set(true);
    this.files.set([]);
    try {
      const q = query(
        collection(this.firestore, 'plantilla_files'),
        where('companyId', '==', this.companyId),
        where('plantillaId', '==', plantillaId)
      );
      const snapshot = await getDocs(q);
      const uid = this.auth.currentUser?.uid ?? '';
      const role = this.permissionService.userRole();
      const isSuper = this.permissionService.isSuperUser();
      const items = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }) as PlantillaFile)
        .filter(isVisibleDoc)
        .filter((f) => canSeePlantilla(f, uid, role, isSuper))
        .sort((a, b) => a.name.localeCompare(b.name));
      this.files.set(items);
    } finally {
      // El error se propaga al llamador (lo muestra ToastService).
      this.isLoading.set(false);
    }
  }

  async addFile(plantillaId: string, folderId: string | null, name: string): Promise<void> {
    const docRef = await addDoc(collection(this.firestore, 'plantilla_files'), stripUndefinedDeep({
      plantillaId,
      companyId: this.companyId,
      folderId,
      name,
      createdBy: this.auth.currentUser?.uid ?? '',
      deleted: false,
      visibleTo: 'all',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));
    this.docAudit.log(this.filePath(docRef.id), 'create', { detail: name });
    await this.loadFiles(plantillaId);
  }

  async linkTemplate(fileId: string, docTemplateId: string | null): Promise<void> {
    await updateDoc(doc(this.firestore, 'plantilla_files', fileId), stripUndefinedDeep({
      docTemplateId,
      updatedAt: serverTimestamp(),
    }));
    this.docAudit.log(this.filePath(fileId), 'update', {
      detail: docTemplateId ? 'Plantilla de documento vinculada' : 'Plantilla de documento desvinculada',
    });
    this.files.update((list) =>
      list.map((f) => (f.id === fileId ? { ...f, docTemplateId } : f))
    );
  }

  /** Define quién puede ver esta plantilla (solo admin, enforzado en rules). */
  async setVisibility(
    fileId: string,
    visibleTo: PlantillaVisibility,
    visibleRoles: FirmRole[] = [],
    visibleUserIds: string[] = [],
  ): Promise<void> {
    await updateDoc(doc(this.firestore, 'plantilla_files', fileId), stripUndefinedDeep({
      visibleTo,
      visibleRoles,
      visibleUserIds,
      updatedAt: serverTimestamp(),
    }));
    this.docAudit.log(this.filePath(fileId), 'permission_change', {
      detail: visibleTo === 'all' ? 'Visible para todos' : 'Visibilidad restringida',
    });
    this.files.update((list) =>
      list.map((f) => (f.id === fileId ? { ...f, visibleTo, visibleRoles, visibleUserIds } : f))
    );
  }

  /** Soft delete: la plantilla deja de mostrarse pero se conserva con su rastro. */
  async deleteFile(fileId: string, plantillaId: string): Promise<void> {
    await updateDoc(doc(this.firestore, 'plantilla_files', fileId), stripUndefinedDeep({
      deleted: true,
      deletedAt: serverTimestamp(),
      deletedBy: this.auth.currentUser?.uid ?? '',
      deletedByNombre: this.permissionService.currentMember()?.nombre ?? '',
    }));
    this.docAudit.log(this.filePath(fileId), 'delete');
    this.files.update((list) => list.filter((f) => f.id !== fileId));
    void plantillaId;
  }
}
