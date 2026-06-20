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

export interface CalendarEvent {
  id: string;
  companyId: string;
  title: string;
  eventType: string;
  eventDate: string;
  eventTime: string;
  status: string;
  duration?: string;
  description?: string;
  contactId?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

@Injectable({ providedIn: 'root' })
export class CalendarService {
  private readonly firestore = inject(Firestore);
  private readonly companyService = inject(CompanyService);

  readonly events = signal<CalendarEvent[]>([]);
  readonly isLoading = signal(false);

  private get companyId(): string {
    const id = this.companyService.activeCompany()?.id;
    if (!id) throw new Error('No active company');
    return id;
  }

  async loadEvents(): Promise<void> {
    this.isLoading.set(true);
    try {
      const q = query(
        collection(this.firestore, 'calendarEvents'),
        where('companyId', '==', this.companyId)
      );
      const snapshot = await getDocs(q);
      this.events.set(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as CalendarEvent));
    } finally {
      this.isLoading.set(false);
    }
  }

  async loadEventsByDate(date: string): Promise<CalendarEvent[]> {
    const q = query(
      collection(this.firestore, 'calendarEvents'),
      where('companyId', '==', this.companyId),
      where('eventDate', '==', date)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as CalendarEvent);
  }

  async createEvent(data: Omit<CalendarEvent, 'id' | 'companyId' | 'createdAt' | 'updatedAt'>): Promise<void> {
    await addDoc(collection(this.firestore, 'calendarEvents'), stripUndefinedDeep({
      ...data,
      companyId: this.companyId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));
    await this.loadEvents();
  }

  async updateEvent(id: string, data: Partial<Omit<CalendarEvent, 'id' | 'companyId'>>): Promise<void> {
    await updateDoc(doc(this.firestore, 'calendarEvents', id), stripUndefinedDeep({ ...data, updatedAt: serverTimestamp() }));
    await this.loadEvents();
  }

  async deleteEvent(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'calendarEvents', id));
    this.events.update((list) => list.filter((e) => e.id !== id));
  }
}
