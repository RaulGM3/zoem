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
  serverTimestamp,
} from '@angular/fire/firestore';
import { CompanyService } from './company.service';
import { stripUndefinedDeep } from '../firebase/sanitize';

export interface Document {
  id: string;
  companyId: string;
  name: string;
  docType: string;
  docStatus: string;
  fileSize?: string;
  contactId?: string;
  projectId?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

@Injectable({ providedIn: 'root' })
export class DocumentService {
  private readonly firestore = inject(Firestore);
  private readonly companyService = inject(CompanyService);

  readonly documents = signal<Document[]>([]);
  readonly isLoading = signal(false);

  private get companyId(): string {
    const id = this.companyService.activeCompany()?.id;
    if (!id) throw new Error('No active company');
    return id;
  }

  async loadDocuments(): Promise<void> {
    this.isLoading.set(true);
    try {
      const q = query(
        collection(this.firestore, 'documents'),
        where('companyId', '==', this.companyId)
      );
      const snapshot = await getDocs(q);
      this.documents.set(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Document));
    } finally {
      this.isLoading.set(false);
    }
  }

  async createDocument(data: Omit<Document, 'id' | 'companyId' | 'createdAt' | 'updatedAt'>): Promise<void> {
    await addDoc(collection(this.firestore, 'documents'), stripUndefinedDeep({
      ...data,
      companyId: this.companyId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));
    await this.loadDocuments();
  }

  async updateDocument(id: string, data: Partial<Omit<Document, 'id' | 'companyId'>>): Promise<void> {
    await updateDoc(doc(this.firestore, 'documents', id), stripUndefinedDeep({ ...data, updatedAt: serverTimestamp() }));
    await this.loadDocuments();
  }

  async deleteDocument(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'documents', id));
    this.documents.update((list) => list.filter((d) => d.id !== id));
  }
}
