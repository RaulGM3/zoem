import { inject, Injectable, signal } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  addDoc,
  deleteDoc,
  getDocs,
  updateDoc,
  serverTimestamp,
} from '@angular/fire/firestore';
import {
  Storage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from '@angular/fire/storage';
import { Auth } from '@angular/fire/auth';
import { CompanyService } from './company.service';
import { stripUndefinedDeep } from '../firebase/sanitize';
import { CasoDocFolder, CasoDocSlot, CasoDocFile } from '../../interfaces';

@Injectable({ providedIn: 'root' })
export class CasoDocService {
  private readonly firestore = inject(Firestore);
  private readonly storage = inject(Storage);
  private readonly auth = inject(Auth);
  private readonly companyService = inject(CompanyService);

  readonly folders = signal<CasoDocFolder[]>([]);
  readonly slots = signal<CasoDocSlot[]>([]);
  readonly files = signal<CasoDocFile[]>([]);
  readonly isLoading = signal(false);

  private get companyId(): string {
    const id = this.companyService.activeCompany()?.id;
    if (!id) throw new Error('No active company');
    return id;
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

  async load(casoId: string): Promise<void> {
    this.isLoading.set(true);
    this.folders.set([]);
    this.slots.set([]);
    this.files.set([]);
    try {
      const [foldersSnap, slotsSnap, filesSnap] = await Promise.all([
        getDocs(this.foldersRef(casoId)),
        getDocs(this.slotsRef(casoId)),
        getDocs(this.filesRef(casoId)),
      ]);
      this.folders.set(
        foldersSnap.docs
          .map(d => ({ id: d.id, ...d.data() }) as CasoDocFolder)
          .sort((a, b) => a.name.localeCompare(b.name))
      );
      this.slots.set(
        slotsSnap.docs
          .map(d => ({ id: d.id, ...d.data() }) as CasoDocSlot)
          .sort((a, b) => a.name.localeCompare(b.name))
      );
      this.files.set(
        filesSnap.docs
          .map(d => ({ id: d.id, ...d.data() }) as CasoDocFile)
          .sort((a, b) => a.name.localeCompare(b.name))
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
      createdAt: serverTimestamp(),
    }));
    this.folders.update(list =>
      [...list, { id: ref.id, parentId, name } as CasoDocFolder]
        .sort((a, b) => a.name.localeCompare(b.name))
    );
  }

  // Borra una carpeta y TODO su contenido recursivo: subcarpetas, slots y
  // archivos libres (incluyendo sus blobs en Storage).
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

    await deleteDoc(doc(this.foldersRef(casoId), folderId));
    this.folders.update(list => list.filter(f => f.id !== folderId));
  }

  // ── Archivos libres ────────────────────────────────────

  async uploadFile(casoId: string, folderId: string | null, file: File): Promise<void> {
    const companyId = this.companyId;
    const timestamp = Date.now();
    const storagePath = `companies/${companyId}/casos/${casoId}/docs/${folderId ?? 'root'}/${timestamp}_${file.name}`;
    const storageRef = ref(this.storage, storagePath);

    await uploadBytes(storageRef, file);
    const downloadUrl = await getDownloadURL(storageRef);

    const docRef = await addDoc(this.filesRef(casoId), stripUndefinedDeep({
      folderId,
      name: file.name,
      storagePath,
      downloadUrl,
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
      uploadedBy: this.auth.currentUser?.uid ?? '',
      uploadedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    }));

    this.files.update(list =>
      [...list, {
        id: docRef.id,
        folderId,
        name: file.name,
        storagePath,
        downloadUrl,
        mimeType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
      } as CasoDocFile].sort((a, b) => a.name.localeCompare(b.name))
    );
  }

  async deleteFile(casoId: string, file: CasoDocFile): Promise<void> {
    if (file.storagePath) {
      try {
        await deleteObject(ref(this.storage, file.storagePath));
      } catch {
        // File may not exist in Storage — continue
      }
    }
    await deleteDoc(doc(this.filesRef(casoId), file.id));
    this.files.update(list => list.filter(f => f.id !== file.id));
  }

  async uploadSlot(casoId: string, slot: CasoDocSlot, file: File): Promise<void> {
    const companyId = this.companyId;
    const timestamp = Date.now();
    const storagePath = `companies/${companyId}/casos/${casoId}/docs/${slot.folderId ?? 'root'}/${timestamp}_${file.name}`;
    const storageRef = ref(this.storage, storagePath);

    await uploadBytes(storageRef, file);
    const downloadUrl = await getDownloadURL(storageRef);

    await updateDoc(doc(this.slotsRef(casoId), slot.id), stripUndefinedDeep({
      status: 'subido',
      storagePath,
      downloadUrl,
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
      uploadedBy: this.auth.currentUser?.uid ?? '',
      uploadedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));

    this.slots.update(list =>
      list.map(s =>
        s.id === slot.id
          ? { ...s, status: 'subido' as const, storagePath, downloadUrl, mimeType: file.type, sizeBytes: file.size }
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
    const companyId = this.companyId;
    const timestamp = Date.now();
    const fileName = params.name.endsWith('.docx') ? params.name : `${params.name}.docx`;
    const storagePath = `companies/${companyId}/casos/${casoId}/docs/${params.folderId ?? 'root'}/${timestamp}_${fileName}`;
    const storageRef = ref(this.storage, storagePath);

    await uploadBytes(storageRef, docxBlob);
    const downloadUrl = await getDownloadURL(storageRef);

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
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));

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
    if (slot.storagePath) {
      try {
        await deleteObject(ref(this.storage, slot.storagePath));
      } catch {
        // File may not exist in Storage — continue
      }
    }

    await updateDoc(doc(this.slotsRef(casoId), slot.id), {
      status: 'pendiente',
      storagePath: null,
      downloadUrl: null,
      mimeType: null,
      sizeBytes: null,
      uploadedBy: null,
      uploadedAt: null,
      updatedAt: serverTimestamp(),
    });

    this.slots.update(list =>
      list.map(s =>
        s.id === slot.id
          ? { ...s, status: 'pendiente' as const, storagePath: undefined, downloadUrl: undefined }
          : s
      )
    );
  }
}
