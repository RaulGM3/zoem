import { inject, Injectable, signal } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  getDocs,
  addDoc,
  deleteDoc,
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
  deleteObject,
} from '@angular/fire/storage';
import { Auth } from '@angular/fire/auth';
import { CompanyService } from './company.service';
import { stripUndefinedDeep } from '../firebase/sanitize';
import { ContactFile } from '../../interfaces';

@Injectable({ providedIn: 'root' })
export class ContactFileService {
  private readonly firestore = inject(Firestore);
  private readonly storage = inject(Storage);
  private readonly auth = inject(Auth);
  private readonly companyService = inject(CompanyService);

  readonly files = signal<ContactFile[]>([]);
  readonly isLoading = signal(false);

  private get companyId(): string {
    const id = this.companyService.activeCompany()?.id;
    if (!id) throw new Error('No active company');
    return id;
  }

  async loadFiles(contactId: string): Promise<void> {
    this.isLoading.set(true);
    this.files.set([]);
    try {
      const q = query(
        collection(this.firestore, 'contact_files'),
        where('companyId', '==', this.companyId),
        where('contactId', '==', contactId),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      this.files.set(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as ContactFile));
    } finally {
      // El error se propaga al llamador (lo muestra ToastService).
      this.isLoading.set(false);
    }
  }

  async uploadFile(contactId: string, folderId: string | null, file: File): Promise<void> {
    const timestamp = Date.now();
    const storagePath = `companies/${this.companyId}/contacts/${contactId}/${folderId ?? 'root'}/${timestamp}_${file.name}`;
    const storageRef = ref(this.storage, storagePath);

    await uploadBytes(storageRef, file);
    const downloadUrl = await getDownloadURL(storageRef);

    await addDoc(collection(this.firestore, 'contact_files'), stripUndefinedDeep({
      contactId,
      companyId: this.companyId,
      folderId,
      name: file.name,
      originalName: file.name,
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
      storagePath,
      downloadUrl,
      uploadedBy: this.auth.currentUser?.uid ?? '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));

    await this.loadFiles(contactId);
  }

  async deleteFile(fileId: string, storagePath: string, contactId: string): Promise<void> {
    try {
      await deleteObject(ref(this.storage, storagePath));
    } catch {
      // File may not exist in Storage — continue to delete metadata
    }
    await deleteDoc(doc(this.firestore, 'contact_files', fileId));
    this.files.update((list) => list.filter((f) => f.id !== fileId));
    void contactId; // Used by caller to reload if needed
  }
}
