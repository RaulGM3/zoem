import { inject, Injectable, signal } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  orderBy,
} from '@angular/fire/firestore';
import type { LlamadaResumen } from '../../interfaces/llamada.interface';

@Injectable({ providedIn: 'root' })
export class LlamadasService {
  private readonly firestore = inject(Firestore);

  readonly llamadas = signal<LlamadaResumen[]>([]);
  readonly loading = signal(false);

  private get llamadasRef() {
    return collection(this.firestore, 'llamadas');
  }

  async loadLlamadas(): Promise<void> {
    this.loading.set(true);
    try {
      const q = query(this.llamadasRef, orderBy('creadoEn', 'desc'));
      const snap = await getDocs(q);
      this.llamadas.set(
        snap.docs
          .map((d) => ({ ...d.data(), conversationId: d.id }) as LlamadaResumen)
          .filter((l) => !l.descartada)
      );
    } finally {
      this.loading.set(false);
    }
  }

  async descartarLlamada(conversationId: string): Promise<void> {
    await updateDoc(doc(this.llamadasRef, conversationId), { descartada: true });
    this.llamadas.update((list) => list.filter((l) => l.conversationId !== conversationId));
  }

  /** Vincula manualmente la llamada a un contacto existente. */
  async asociarContacto(conversationId: string, contactId: string): Promise<void> {
    await updateDoc(doc(this.llamadasRef, conversationId), { contactId });
    this.llamadas.update((list) =>
      list.map((l) => (l.conversationId === conversationId ? { ...l, contactId } : l))
    );
  }

  async getLlamada(id: string): Promise<LlamadaResumen | null> {
    const snap = await getDoc(doc(this.llamadasRef, id));
    if (!snap.exists()) return null;
    return { ...snap.data(), conversationId: snap.id } as LlamadaResumen;
  }
}
