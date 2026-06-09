import { inject, Injectable, signal } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
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
        snap.docs.map((d) => ({ ...d.data(), conversationId: d.id }) as LlamadaResumen)
      );
    } finally {
      this.loading.set(false);
    }
  }

  async getLlamada(id: string): Promise<LlamadaResumen | null> {
    const snap = await getDoc(doc(this.llamadasRef, id));
    if (!snap.exists()) return null;
    return { ...snap.data(), conversationId: snap.id } as LlamadaResumen;
  }
}
