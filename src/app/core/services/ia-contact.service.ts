import { inject, Injectable, signal } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  getDoc,
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

export interface IaContact {
  id: string;
  companyId: string;
  contactType: string;
  contactDate: string;
  contactTime: string;
  clientName: string;
  category: string;
  description: string;
  urgency: string;
  score: number;
  status?: string;
  clientPhone?: string;
  clientEmail?: string;
  clientCompany?: string;
  duration?: string;
  assignedToId?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

@Injectable({ providedIn: 'root' })
export class IaContactService {
  private readonly firestore = inject(Firestore);
  private readonly companyService = inject(CompanyService);

  readonly iaContacts = signal<IaContact[]>([]);
  readonly isLoading = signal(false);

  private get companyId(): string {
    const id = this.companyService.activeCompany()?.id;
    if (!id) throw new Error('No active company');
    return id;
  }

  async loadIaContacts(): Promise<void> {
    this.isLoading.set(true);
    try {
      const q = query(
        collection(this.firestore, 'iaContacts'),
        where('companyId', '==', this.companyId)
      );
      const snapshot = await getDocs(q);
      this.iaContacts.set(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as IaContact));
    } finally {
      this.isLoading.set(false);
    }
  }

  async getIaContact(id: string): Promise<IaContact | null> {
    const snapshot = await getDoc(doc(this.firestore, 'iaContacts', id));
    return snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as IaContact) : null;
  }

  async createIaContact(data: Omit<IaContact, 'id' | 'companyId' | 'createdAt' | 'updatedAt'>): Promise<void> {
    await addDoc(collection(this.firestore, 'iaContacts'), stripUndefinedDeep({
      ...data,
      companyId: this.companyId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));
    await this.loadIaContacts();
  }

  async updateStatus(id: string, status: string, assignedToId?: string): Promise<void> {
    const data: Record<string, unknown> = { status, updatedAt: serverTimestamp() };
    if (assignedToId !== undefined) data['assignedToId'] = assignedToId;
    await updateDoc(doc(this.firestore, 'iaContacts', id), stripUndefinedDeep(data));
    this.iaContacts.update((list) => list.map((c) => (c.id === id ? { ...c, status } : c)));
  }

  async deleteIaContact(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'iaContacts', id));
    this.iaContacts.update((list) => list.filter((c) => c.id !== id));
  }
}
