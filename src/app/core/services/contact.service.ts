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
  arrayUnion,
  arrayRemove,
} from '@angular/fire/firestore';
import { CompanyService } from './company.service';
import { Contact } from '../../interfaces';

@Injectable({ providedIn: 'root' })
export class ContactService {
  private readonly firestore = inject(Firestore);
  private readonly companyService = inject(CompanyService);

  readonly contacts = signal<Contact[]>([]);
  readonly isLoading = signal(false);

  private get companyId(): string {
    const id = this.companyService.activeCompany()?.id;
    if (!id) throw new Error('No active company');
    return id;
  }

  async loadContacts(): Promise<void> {
    this.isLoading.set(true);
    try {
      const companyId = this.companyId;
      console.log('[ContactService.loadContacts] companyId =', companyId);
      const q = query(
        collection(this.firestore, 'contacts'),
        where('companyId', '==', companyId)
      );
      const snapshot = await getDocs(q);
      console.log('[ContactService.loadContacts] docs encontrados =', snapshot.size);
      this.contacts.set(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as Contact));
    } catch (err) {
      console.error('[ContactService.loadContacts] ERROR (esto se estaba tragando el catch):', err);
    } finally {
      this.isLoading.set(false);
    }
  }

  async getContact(id: string): Promise<Contact | null> {
    const snapshot = await getDoc(doc(this.firestore, 'contacts', id));
    return snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as Contact) : null;
  }

  async createContact(
    data: Omit<Contact, 'id' | 'companyId' | 'createdAt' | 'updatedAt'>
  ): Promise<void> {
    await addDoc(collection(this.firestore, 'contacts'), {
      ...(data as Record<string, unknown>),
      companyId: this.companyId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await this.loadContacts();
  }

  async updateContact(id: string, data: Record<string, unknown>): Promise<void> {
    await updateDoc(doc(this.firestore, 'contacts', id), {
      ...data,
      updatedAt: serverTimestamp(),
    });
    await this.loadContacts();
  }

  async deleteContact(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'contacts', id));
    this.contacts.update((list) => list.filter((c) => c.id !== id));
  }

  async addTag(contactId: string, tag: string): Promise<void> {
    await updateDoc(doc(this.firestore, 'contacts', contactId), { tags: arrayUnion(tag) });
  }

  async removeTag(contactId: string, tag: string): Promise<void> {
    await updateDoc(doc(this.firestore, 'contacts', contactId), { tags: arrayRemove(tag) });
  }
}
