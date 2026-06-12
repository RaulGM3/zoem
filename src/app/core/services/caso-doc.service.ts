import { inject, Injectable, signal } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
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
import { CasoDocFolder, CasoDocSlot } from '../../interfaces';

@Injectable({ providedIn: 'root' })
export class CasoDocService {
  private readonly firestore = inject(Firestore);
  private readonly storage = inject(Storage);
  private readonly auth = inject(Auth);
  private readonly companyService = inject(CompanyService);

  readonly folders = signal<CasoDocFolder[]>([]);
  readonly slots = signal<CasoDocSlot[]>([]);
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

  async load(casoId: string): Promise<void> {
    this.isLoading.set(true);
    this.folders.set([]);
    this.slots.set([]);
    try {
      const [foldersSnap, slotsSnap] = await Promise.all([
        getDocs(this.foldersRef(casoId)),
        getDocs(this.slotsRef(casoId)),
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
    } catch {
      // No active company or Firestore error
    } finally {
      this.isLoading.set(false);
    }
  }

  async uploadSlot(casoId: string, slot: CasoDocSlot, file: File): Promise<void> {
    const companyId = this.companyId;
    const timestamp = Date.now();
    const storagePath = `companies/${companyId}/casos/${casoId}/docs/${slot.folderId ?? 'root'}/${timestamp}_${file.name}`;
    const storageRef = ref(this.storage, storagePath);

    await uploadBytes(storageRef, file);
    const downloadUrl = await getDownloadURL(storageRef);

    await updateDoc(doc(this.slotsRef(casoId), slot.id), {
      status: 'subido',
      storagePath,
      downloadUrl,
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
      uploadedBy: this.auth.currentUser?.uid ?? '',
      uploadedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    this.slots.update(list =>
      list.map(s =>
        s.id === slot.id
          ? { ...s, status: 'subido' as const, storagePath, downloadUrl, mimeType: file.type, sizeBytes: file.size }
          : s
      )
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
