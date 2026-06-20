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
  where,
} from '@angular/fire/firestore';
import type { LlamadaResumen } from '../../interfaces/llamada.interface';
import { CompanyService } from './company.service';
import { AgentMappingService } from './agent-mapping.service';
import { stripUndefinedDeep } from '../firebase/sanitize';

@Injectable({ providedIn: 'root' })
export class LlamadasService {
  private readonly firestore = inject(Firestore);
  private readonly companyService = inject(CompanyService);
  private readonly agentMappings = inject(AgentMappingService);

  readonly llamadas = signal<LlamadaResumen[]>([]);
  readonly loading = signal(false);

  private get llamadasRef() {
    return collection(this.firestore, 'llamadas');
  }

  async loadLlamadas(): Promise<void> {
    this.loading.set(true);
    try {
      const companyId = this.companyService.activeCompany()?.id;
      if (!companyId) {
        this.llamadas.set([]);
        return;
      }
      // Aislamiento de tenant: solo las llamadas de los agentId de esta empresa.
      // La regla de Firestore exige que la query venga acotada por agentId.
      const agentIds = await this.agentMappings.loadAgentIdsForCompany(companyId);
      if (agentIds.length === 0) {
        this.llamadas.set([]);
        return;
      }
      // `in` admite hasta 30 valores; un despacho rara vez tiene más de uno.
      if (agentIds.length > 30) {
        console.warn(`[llamadas] ${agentIds.length} agentes; solo se consultan los primeros 30.`);
      }
      const q = query(
        this.llamadasRef,
        where('agentId', 'in', agentIds.slice(0, 30)),
        orderBy('creadoEn', 'desc'),
      );
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
    await updateDoc(doc(this.llamadasRef, conversationId), stripUndefinedDeep({ descartada: true }));
    this.llamadas.update((list) => list.filter((l) => l.conversationId !== conversationId));
  }

  /** Vincula manualmente la llamada a un contacto existente. */
  async asociarContacto(conversationId: string, contactId: string): Promise<void> {
    await updateDoc(doc(this.llamadasRef, conversationId), stripUndefinedDeep({ contactId }));
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
