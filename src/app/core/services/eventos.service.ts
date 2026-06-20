import { inject, Injectable, signal } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  deleteField,
} from '@angular/fire/firestore';
import type { Observable } from 'rxjs';
import { CompanyService } from './company.service';
import { UserSyncService } from './user-sync.service';
import { stripUndefinedDeep } from '../firebase/sanitize';
import type { Evento, CreateEventoData } from '../../interfaces';

@Injectable({ providedIn: 'root' })
export class EventosService {
  private readonly firestore = inject(Firestore);
  private readonly companyService = inject(CompanyService);
  private readonly userSyncService = inject(UserSyncService);

  readonly eventos = signal<Evento[]>([]);
  readonly loading = signal(false);

  private get companyId(): string {
    const id = this.companyService.activeCompany()?.id;
    if (!id) throw new Error('No active company');
    return id;
  }

  private get currentUserId(): string {
    const uid = this.userSyncService.currentUser()?.id;
    if (!uid) throw new Error('No current user');
    return uid;
  }

  private get eventosRef() {
    return collection(this.firestore, 'companies', this.companyId, 'eventos');
  }

  /**
   * Stream real-time de los eventos de la empresa. A diferencia de `loadEventos`
   * (disparo único con getDocs), esto emite ante cada cambio en Firestore, así el
   * calendario refleja altas/ediciones/estados sin recargar.
   */
  eventosStream(): Observable<Evento[]> {
    const q = query(this.eventosRef, orderBy('fecha'));
    return collectionData(q, { idField: 'id' }) as Observable<Evento[]>;
  }

  async loadEventos(): Promise<void> {
    this.loading.set(true);
    try {
      const snap = await getDocs(query(this.eventosRef, orderBy('fecha')));
      this.eventos.set(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Evento));
    } finally {
      this.loading.set(false);
    }
  }

  async createEvento(data: CreateEventoData): Promise<Evento> {
    const ref = await addDoc(this.eventosRef, stripUndefinedDeep({
      ...data,
      companyId: this.companyId,
      creadoPor: this.currentUserId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }));
    const nuevo: Evento = {
      id: ref.id,
      companyId: this.companyId,
      creadoPor: this.currentUserId,
      ...data,
    } as Evento;
    this.eventos.update(list =>
      [...list, nuevo].sort((a, b) => a.fecha.localeCompare(b.fecha))
    );
    return nuevo;
  }

  async updateEvento(id: string, data: Partial<CreateEventoData>): Promise<void> {
    await updateDoc(doc(this.eventosRef, id), stripUndefinedDeep({ ...data, updatedAt: serverTimestamp() }));
    this.eventos.update(list => list.map(e => (e.id === id ? { ...e, ...data } : e)));
  }

  async deleteEvento(id: string): Promise<void> {
    await deleteDoc(doc(this.eventosRef, id));
    this.eventos.update(list => list.filter(e => e.id !== id));
  }

  async clearEventoTime(id: string): Promise<void> {
    await updateDoc(doc(this.eventosRef, id), {
      horaInicio: deleteField(),
      horaFin: deleteField(),
      todoDia: true,
      updatedAt: serverTimestamp(),
    });
    this.eventos.update(list =>
      list.map(e => e.id === id ? { ...e, horaInicio: undefined, horaFin: undefined, todoDia: true } : e)
    );
  }
}
