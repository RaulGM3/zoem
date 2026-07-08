import { inject, Injectable, signal } from '@angular/core';
import {
  Firestore,
  Timestamp,
  collection,
  doc,
  addDoc,
  getDocs,
  query,
  updateDoc,
  serverTimestamp,
  where,
  type CollectionReference,
  type DocumentData,
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
import { appendVersion, isVisibleDoc, currentVersion, type VersionMeta } from '../docs/doc-versioning';
import { CasoDocFolder, CasoDocSlot, CasoDocFile } from '../../interfaces';

/**
 * Documentos de caso con trazabilidad total: nada se borra de Firestore ni de
 * Storage (soft delete), nada se sobreescribe (resubir versiona) y toda acción
 * queda en la subcolección `doc_audit` de cada documento.
 */
@Injectable({ providedIn: 'root' })
export class CasoDocService {
  private readonly firestore = inject(Firestore);
  private readonly storage = inject(Storage);
  private readonly auth = inject(Auth);
  private readonly companyService = inject(CompanyService);
  private readonly docAudit = inject(DocAuditService);
  private readonly permissionService = inject(PermissionService);

  readonly folders = signal<CasoDocFolder[]>([]);
  readonly slots = signal<CasoDocSlot[]>([]);
  readonly files = signal<CasoDocFile[]>([]);
  readonly isLoading = signal(false);

  private get companyId(): string {
    const id = this.companyService.activeCompany()?.id;
    if (!id) throw new Error('No active company');
    return id;
  }

  private get uploaderNombre(): string {
    return this.permissionService.currentMember()?.nombre ?? '';
  }

  private foldersRef(casoId: string) {
    return collection(this.firestore, 'companies', this.companyId, 'casos', casoId, 'doc_folders');
  }

  private slotsRef(casoId: string) {
    return collection(this.firestore, 'companies', this.companyId, 'casos', casoId, 'doc_slots');
  }

  private filesRef(casoId: string) {
    return collection(this.firestore, 'companies', this.companyId, 'casos', casoId, 'doc_files');
  }

  /** Path del doc, para la subcolección doc_audit. */
  filePath(casoId: string, fileId: string): string {
    return `companies/${this.companyId}/casos/${casoId}/doc_files/${fileId}`;
  }

  slotPath(casoId: string, slotId: string): string {
    return `companies/${this.companyId}/casos/${casoId}/doc_slots/${slotId}`;
  }

  /**
   * Los Admin (y superuser) listan sin filtros. Para el resto, las rules solo
   * dejan pasar queries DEMOSTRABLES: dos queries (no clasificados + clasificados
   * donde estoy en la allowlist) fusionadas en cliente. Los docs legacy sin el
   * campo `clasificado` requieren el backfill de `scripts/backfill-doc-flags.mjs`.
   */
  private async fetchClassifiedAware<T extends { id: string }>(
    colRef: CollectionReference<DocumentData>,
  ): Promise<T[]> {
    if (this.permissionService.isAdmin()) {
      const snap = await getDocs(colRef);
      return snap.docs.map(d => ({ id: d.id, ...d.data() }) as T);
    }
    const uid = this.auth.currentUser?.uid ?? '';
    const [publicSnap, mineSnap] = await Promise.all([
      getDocs(query(colRef, where('clasificado', '==', false))),
      getDocs(query(
        colRef,
        where('clasificado', '==', true),
        where('allowedUserIds', 'array-contains', uid),
      )),
    ]);
    const byId = new Map<string, T>();
    for (const d of [...publicSnap.docs, ...mineSnap.docs]) {
      byId.set(d.id, { id: d.id, ...d.data() } as T);
    }
    return [...byId.values()];
  }

  async load(casoId: string): Promise<void> {
    this.isLoading.set(true);
    this.folders.set([]);
    this.slots.set([]);
    this.files.set([]);
    try {
      const [foldersSnap, slotDocs, fileDocs] = await Promise.all([
        getDocs(this.foldersRef(casoId)),
        this.fetchClassifiedAware<CasoDocSlot>(this.slotsRef(casoId)),
        this.fetchClassifiedAware<CasoDocFile>(this.filesRef(casoId)),
      ]);
      // Soft delete: se filtra en cliente (los docs legacy no tienen el campo).
      this.folders.set(
        foldersSnap.docs
          .map(d => ({ id: d.id, ...d.data() }) as CasoDocFolder)
          .filter(isVisibleDoc)
          .sort((a, b) => a.name.localeCompare(b.name))
      );
      this.slots.set(
        slotDocs.filter(isVisibleDoc).sort((a, b) => a.name.localeCompare(b.name))
      );
      this.files.set(
        fileDocs.filter(isVisibleDoc).sort((a, b) => a.name.localeCompare(b.name))
      );
    } finally {
      // El error se propaga al llamador (lo muestra ToastService).
      this.isLoading.set(false);
    }
  }

  // ── Carpetas ───────────────────────────────────────────

  async createFolder(casoId: string, parentId: string | null, name: string): Promise<void> {
    const ref = await addDoc(this.foldersRef(casoId), stripUndefinedDeep({
      parentId,
      name,
      deleted: false,
      createdAt: serverTimestamp(),
    }));
    this.folders.update(list =>
      [...list, { id: ref.id, parentId, name } as CasoDocFolder]
        .sort((a, b) => a.name.localeCompare(b.name))
    );
  }

  // "Borra" una carpeta y TODO su contenido recursivo con soft delete: nada
  // desaparece de Firestore ni de Storage, solo deja de mostrarse.
  async deleteFolder(casoId: string, folderId: string): Promise<void> {
    const childFolders = this.folders().filter(f => f.parentId === folderId);
    for (const child of childFolders) {
      await this.deleteFolder(casoId, child.id);
    }

    const filesInFolder = this.files().filter(f => f.folderId === folderId);
    for (const file of filesInFolder) {
      await this.deleteFile(casoId, file);
    }

    // Los slots requeridos no se borran: vuelven a "pendiente" y se desligan
    // de la carpeta para no perder el checklist de la plantilla.
    const slotsInFolder = this.slots().filter(s => s.folderId === folderId);
    for (const slot of slotsInFolder) {
      if (slot.status === 'subido') await this.removeUpload(casoId, slot);
    }

    await updateDoc(doc(this.foldersRef(casoId), folderId), this.softDeletePatch());
    this.folders.update(list => list.filter(f => f.id !== folderId));
  }

  private softDeletePatch() {
    return stripUndefinedDeep({
      deleted: true,
      deletedAt: serverTimestamp(),
      deletedBy: this.auth.currentUser?.uid ?? '',
      deletedByNombre: this.uploaderNombre,
    });
  }

  private async uploadToStorage(
    casoId: string,
    folderId: string | null,
    file: File | Blob,
    fileName: string,
  ): Promise<{ storagePath: string; downloadUrl: string }> {
    const storagePath = `companies/${this.companyId}/casos/${casoId}/docs/${folderId ?? 'root'}/${Date.now()}_${fileName}`;
    const storageRef = ref(this.storage, storagePath);
    await uploadBytes(storageRef, file);
    const downloadUrl = await getDownloadURL(storageRef);
    return { storagePath, downloadUrl };
  }

  /** Metadatos de la versión que se acaba de subir. `Timestamp.now()` porque
   *  serverTimestamp() no está permitido dentro de arrays de Firestore. */
  private versionMeta(file: File, storagePath: string, downloadUrl: string): VersionMeta {
    return {
      name: file.name,
      storagePath,
      downloadUrl,
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
      uploadedBy: this.auth.currentUser?.uid ?? '',
      uploadedByNombre: this.uploaderNombre,
      uploadedAt: Timestamp.now(),
    };
  }

  // ── Archivos libres ────────────────────────────────────

  async uploadFile(
    casoId: string,
    folderId: string | null,
    file: File,
    opts: { clasificado?: boolean } = {},
  ): Promise<void> {
    const clasificado = opts.clasificado === true;
    const { storagePath, downloadUrl } = await this.uploadToStorage(casoId, folderId, file, file.name);
    // Los clasificados NO almacenan downloadUrl: las token-URLs de Firebase
    // saltan las Storage rules. Se sirven vía callable con URL firmada de 5 min.
    const meta = this.versionMeta(file, storagePath, clasificado ? '' : downloadUrl);
    // El creador siempre entra en la allowlist de su propio clasificado.
    const allowedUserIds = clasificado ? [this.auth.currentUser?.uid ?? ''] : [];

    const docRef = await addDoc(this.filesRef(casoId), stripUndefinedDeep({
      folderId,
      ...meta,
      version: 1,
      versions: [{ ...meta, version: 1 }],
      deleted: false,
      clasificado,
      allowedUserIds,
      createdAt: serverTimestamp(),
    }));

    this.docAudit.log(this.filePath(casoId, docRef.id), 'create', {
      version: 1,
      detail: clasificado ? `${file.name} (clasificado)` : file.name,
    });

    this.files.update(list =>
      [...list, {
        id: docRef.id,
        folderId,
        ...meta,
        version: 1,
        versions: [{ ...meta, version: 1 }],
        clasificado,
        allowedUserIds,
      } as CasoDocFile].sort((a, b) => a.name.localeCompare(b.name))
    );
  }

  /**
   * URL a persistir según el estado clasificado: los clasificados no guardan
   * downloadUrl (las token-URLs saltan las Storage rules); al desclasificar se
   * regenera desde el storagePath.
   */
  private async resolveDownloadUrl(
    clasificado: boolean,
    current: string | undefined,
    storagePath: string | undefined,
  ): Promise<string> {
    if (clasificado) return '';
    if (current) return current;
    if (!storagePath) return '';
    return getDownloadURL(ref(this.storage, storagePath));
  }

  /** Cambia el estado clasificado / allowlist de un archivo (solo Admin, enforzado en rules). */
  async setFileClassification(
    casoId: string,
    fileId: string,
    clasificado: boolean,
    allowedUserIds: string[],
  ): Promise<void> {
    const file = this.files().find(f => f.id === fileId);
    const downloadUrl = await this.resolveDownloadUrl(clasificado, file?.downloadUrl, file?.storagePath);
    await updateDoc(doc(this.filesRef(casoId), fileId), stripUndefinedDeep({
      clasificado,
      allowedUserIds,
      downloadUrl,
      updatedAt: serverTimestamp(),
    }));
    this.docAudit.log(this.filePath(casoId, fileId), 'permission_change', {
      detail: clasificado
        ? `Clasificado · ${allowedUserIds.length} usuario(s) con acceso`
        : 'Desclasificado',
    });
    this.files.update(list =>
      list.map(f => (f.id === fileId ? { ...f, clasificado, allowedUserIds, downloadUrl } : f))
    );
  }

  /** Cambia el estado clasificado / allowlist de un slot (solo Admin, enforzado en rules). */
  async setSlotClassification(
    casoId: string,
    slotId: string,
    clasificado: boolean,
    allowedUserIds: string[],
  ): Promise<void> {
    const slot = this.slots().find(s => s.id === slotId);
    const downloadUrl = slot?.storagePath
      ? await this.resolveDownloadUrl(clasificado, slot.downloadUrl, slot.storagePath)
      : (slot?.downloadUrl ?? '');
    await updateDoc(doc(this.slotsRef(casoId), slotId), stripUndefinedDeep({
      clasificado,
      allowedUserIds,
      ...(slot?.storagePath ? { downloadUrl } : {}),
      updatedAt: serverTimestamp(),
    }));
    this.docAudit.log(this.slotPath(casoId, slotId), 'permission_change', {
      detail: clasificado
        ? `Clasificado · ${allowedUserIds.length} usuario(s) con acceso`
        : 'Desclasificado',
    });
    this.slots.update(list =>
      list.map(s => (s.id === slotId ? { ...s, clasificado, allowedUserIds, ...(s.storagePath ? { downloadUrl } : {}) } : s))
    );
  }

  /** Resube un archivo como NUEVA versión: el blob anterior queda en Storage
   *  y el historial crece — nunca se sobreescribe. */
  async reuploadFile(casoId: string, file: CasoDocFile, newFile: File): Promise<void> {
    const { storagePath, downloadUrl } = await this.uploadToStorage(casoId, file.folderId, newFile, newFile.name);
    const patch = appendVersion(
      file,
      this.versionMeta(newFile, storagePath, file.clasificado === true ? '' : downloadUrl),
    );

    await updateDoc(doc(this.filesRef(casoId), file.id), stripUndefinedDeep({
      ...patch,
      updatedAt: serverTimestamp(),
    }));

    this.docAudit.log(this.filePath(casoId, file.id), 'update', {
      version: patch.version,
      detail: `Nueva versión: ${newFile.name}`,
    });

    this.files.update(list =>
      list.map(f => (f.id === file.id ? { ...f, ...patch } : f))
        .sort((a, b) => a.name.localeCompare(b.name))
    );
  }

  async deleteFile(casoId: string, file: CasoDocFile): Promise<void> {
    // Soft delete: el doc y todos sus blobs de Storage se conservan.
    await updateDoc(doc(this.filesRef(casoId), file.id), this.softDeletePatch());
    this.docAudit.log(this.filePath(casoId, file.id), 'delete', { detail: file.name });
    this.files.update(list => list.filter(f => f.id !== file.id));
  }

  async uploadSlot(casoId: string, slot: CasoDocSlot, file: File): Promise<void> {
    const { storagePath, downloadUrl } = await this.uploadToStorage(casoId, slot.folderId, file, file.name);
    // Los slots clasificados tampoco almacenan downloadUrl (URL firmada vía callable).
    const meta = this.versionMeta(file, storagePath, slot.clasificado === true ? '' : downloadUrl);

    // Si el slot ya tuvo un archivo (aunque esté "pendiente" tras retirarlo),
    // la subida versiona; si es la primera, arranca el historial en v1.
    const hasHistory = (slot.versions?.length ?? 0) > 0 || !!slot.storagePath;
    const versionPatch = hasHistory
      ? appendVersion(slot, meta)
      : { ...meta, version: 1, versions: [{ ...meta, version: 1 }] };

    await updateDoc(doc(this.slotsRef(casoId), slot.id), stripUndefinedDeep({
      status: 'subido',
      ...versionPatch,
      // El slot conserva su nombre de checklist; el del archivo va al historial.
      name: slot.name,
      deleted: false,
      clasificado: slot.clasificado ?? false,
      updatedAt: serverTimestamp(),
    }));

    this.docAudit.log(this.slotPath(casoId, slot.id), versionPatch.version === 1 ? 'create' : 'update', {
      version: versionPatch.version,
      detail: file.name,
    });

    this.slots.update(list =>
      list.map(s =>
        s.id === slot.id
          ? { ...s, ...versionPatch, name: s.name, status: 'subido' as const }
          : s
      )
    );
  }

  /**
   * Congela un documento rellenado a partir de su plantilla (docTemplate).
   * Guarda el HTML interpolado y los valores usados — el documento queda fijo
   * para vistas futuras hasta que se regenere a mano. No toca Storage: el
   * snapshot vive inline en el slot (límite 1MB de Firestore; los docs legales
   * típicos quedan muy por debajo).
   */
  async saveGeneratedDoc(
    casoId: string,
    slot: CasoDocSlot,
    html: string,
    values: Record<string, string>
  ): Promise<void> {
    await updateDoc(doc(this.slotsRef(casoId), slot.id), stripUndefinedDeep({
      status: 'generado',
      generatedHtml: html,
      generatedValues: values,
      generatedBy: this.auth.currentUser?.uid ?? '',
      generatedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));

    this.docAudit.log(this.slotPath(casoId, slot.id),
      slot.status === 'generado' ? 'update' : 'create',
      { detail: 'Documento generado desde plantilla' });

    this.slots.update(list =>
      list.map(s =>
        s.id === slot.id
          ? { ...s, status: 'generado' as const, generatedHtml: html, generatedValues: values }
          : s
      )
    );
  }

  async getFolders(casoId: string): Promise<CasoDocFolder[]> {
    const snap = await getDocs(this.foldersRef(casoId));
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() }) as CasoDocFolder)
      .filter(isVisibleDoc)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Ancla una plantilla de documento rellenada a un caso: sube el .docx a Storage
   * y crea un doc_slot con status='generado', el HTML congelado y los valores
   * usados — aparece en la tab Documentos del caso listo para ver/editar.
   */
  async anclarPlantilla(
    casoId: string,
    params: {
      name: string;
      docTemplateId: string;
      folderId: string | null;
      generatedHtml: string;
      generatedValues: Record<string, string>;
    },
    docxBlob: Blob
  ): Promise<void> {
    const fileName = params.name.endsWith('.docx') ? params.name : `${params.name}.docx`;
    const { storagePath, downloadUrl } = await this.uploadToStorage(casoId, params.folderId, docxBlob, fileName);

    const slotRef = await addDoc(this.slotsRef(casoId), stripUndefinedDeep({
      folderId: params.folderId,
      name: params.name,
      status: 'generado',
      docTemplateId: params.docTemplateId,
      generatedHtml: params.generatedHtml,
      generatedValues: params.generatedValues,
      storagePath,
      downloadUrl,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      sizeBytes: docxBlob.size,
      generatedBy: this.auth.currentUser?.uid ?? '',
      generatedAt: serverTimestamp(),
      deleted: false,
      clasificado: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));

    this.docAudit.log(this.slotPath(casoId, slotRef.id), 'create', { detail: params.name });

    this.slots.update(list =>
      [...list, {
        id: slotRef.id,
        folderId: params.folderId,
        name: params.name,
        status: 'generado' as const,
        docTemplateId: params.docTemplateId,
        generatedHtml: params.generatedHtml,
        generatedValues: params.generatedValues,
        storagePath,
        downloadUrl,
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        sizeBytes: docxBlob.size,
      } as CasoDocSlot].sort((a, b) => a.name.localeCompare(b.name))
    );
  }

  async removeUpload(casoId: string, slot: CasoDocSlot): Promise<void> {
    // El blob se CONSERVA en Storage: el historial del slot sigue siendo
    // descargable desde el panel de versiones aunque el slot vuelva a pendiente.
    const versions =
      slot.versions && slot.versions.length > 0
        ? slot.versions
        : slot.storagePath
          ? [{
              version: currentVersion(slot),
              name: slot.name,
              storagePath: slot.storagePath,
              downloadUrl: slot.downloadUrl ?? '',
              mimeType: slot.mimeType ?? '',
              sizeBytes: slot.sizeBytes ?? 0,
              ...(slot.uploadedBy ? { uploadedBy: slot.uploadedBy } : {}),
              ...(slot.uploadedAt ? { uploadedAt: slot.uploadedAt } : {}),
            }]
          : [];

    await updateDoc(doc(this.slotsRef(casoId), slot.id), {
      status: 'pendiente',
      storagePath: null,
      downloadUrl: null,
      mimeType: null,
      sizeBytes: null,
      uploadedBy: null,
      uploadedAt: null,
      versions,
      updatedAt: serverTimestamp(),
    });

    this.docAudit.log(this.slotPath(casoId, slot.id), 'delete', {
      detail: 'Archivo retirado del slot (conservado en el historial)',
    });

    this.slots.update(list =>
      list.map(s =>
        s.id === slot.id
          ? { ...s, status: 'pendiente' as const, storagePath: undefined, downloadUrl: undefined, versions }
          : s
      )
    );
  }
}
