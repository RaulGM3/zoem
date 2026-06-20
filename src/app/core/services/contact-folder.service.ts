import { inject, Injectable, signal } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { CompanyService } from './company.service';
import { stripUndefinedDeep } from '../firebase/sanitize';
import { ContactFolder } from '../../interfaces';

@Injectable({ providedIn: 'root' })
export class ContactFolderService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(Auth);
  private readonly companyService = inject(CompanyService);

  readonly folders = signal<ContactFolder[]>([]);
  readonly isLoading = signal(false);

  private get companyId(): string {
    const id = this.companyService.activeCompany()?.id;
    if (!id) throw new Error('No active company');
    return id;
  }

  async loadFolders(contactId: string): Promise<void> {
    this.isLoading.set(true);
    this.folders.set([]);
    try {
      const q = query(
        collection(this.firestore, 'contact_folders'),
        where('companyId', '==', this.companyId),
        where('contactId', '==', contactId),
        orderBy('name')
      );
      const snapshot = await getDocs(q);
      this.folders.set(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as ContactFolder));
    } finally {
      // El error se propaga al llamador (lo muestra ToastService).
      this.isLoading.set(false);
    }
  }

  async createFolder(data: {
    contactId: string;
    parentId: string | null;
    name: string;
  }): Promise<void> {
    await addDoc(collection(this.firestore, 'contact_folders'), stripUndefinedDeep({
      ...data,
      companyId: this.companyId,
      createdBy: this.auth.currentUser?.uid ?? '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));
    await this.loadFolders(data.contactId);
  }

  async updateFolder(id: string, data: Partial<Pick<ContactFolder, 'name'>>, contactId: string): Promise<void> {
    await updateDoc(doc(this.firestore, 'contact_folders', id), stripUndefinedDeep({
      ...data,
      updatedAt: serverTimestamp(),
    }));
    await this.loadFolders(contactId);
  }

  async deleteFolder(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'contact_folders', id));
    this.folders.update((list) => list.filter((f) => f.id !== id));
  }
}
