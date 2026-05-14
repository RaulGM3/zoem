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

export interface Invoice {
  id: string;
  companyId: string;
  invoiceNumber: string;
  amount: number;
  vat: number;
  total: number;
  status: string;
  issueDate: string;
  dueDate: string;
  paidDate?: string;
  contactId?: string;
  projectId?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

@Injectable({ providedIn: 'root' })
export class InvoiceService {
  private readonly firestore = inject(Firestore);
  private readonly companyService = inject(CompanyService);

  readonly invoices = signal<Invoice[]>([]);
  readonly isLoading = signal(false);

  private get companyId(): string {
    const id = this.companyService.activeCompany()?.id;
    if (!id) throw new Error('No active company');
    return id;
  }

  async loadInvoices(): Promise<void> {
    this.isLoading.set(true);
    try {
      const q = query(
        collection(this.firestore, 'invoices'),
        where('companyId', '==', this.companyId)
      );
      const snapshot = await getDocs(q);
      this.invoices.set(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Invoice));
    } finally {
      this.isLoading.set(false);
    }
  }

  async getInvoice(id: string): Promise<Invoice | null> {
    const snapshot = await getDoc(doc(this.firestore, 'invoices', id));
    return snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as Invoice) : null;
  }

  async createInvoice(data: Omit<Invoice, 'id' | 'companyId' | 'createdAt' | 'updatedAt'>): Promise<void> {
    await addDoc(collection(this.firestore, 'invoices'), {
      ...data,
      companyId: this.companyId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await this.loadInvoices();
  }

  async updateInvoice(id: string, data: Partial<Omit<Invoice, 'id' | 'companyId'>>): Promise<void> {
    await updateDoc(doc(this.firestore, 'invoices', id), { ...data, updatedAt: serverTimestamp() });
    await this.loadInvoices();
  }

  async deleteInvoice(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'invoices', id));
    this.invoices.update((list) => list.filter((i) => i.id !== id));
  }
}
