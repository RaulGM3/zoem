import { inject, Injectable } from '@angular/core';
import {
  collection,
  collectionData,
  deleteDoc,
  doc,
  Firestore,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { stripUndefinedDeep } from '../firebase/sanitize';
import { AgentMapping } from '../../interfaces/agent-mapping.interface';

/**
 * ABM del mapeo agentId → company.
 *
 * Escritura: solo superusuario (las security rules lo imponen; acá solo el
 * cliente). Lectura: superusuario (getAll) o miembros de la empresa
 * (getByCompany / loadAgentIdsForCompany), para poder filtrar sus llamadas.
 */
@Injectable({ providedIn: 'root' })
export class AgentMappingService {
  private readonly firestore = inject(Firestore);
  private readonly col = collection(this.firestore, 'agentMappings');

  /** Todos los mapeos — uso superuser. */
  getAll(): Observable<AgentMapping[]> {
    return collectionData(this.col, { idField: 'agentId' }) as Observable<AgentMapping[]>;
  }

  /** Mapeos de una empresa — uso cliente (miembros). */
  getByCompany(companyId: string): Observable<AgentMapping[]> {
    const q = query(this.col, where('companyId', '==', companyId));
    return collectionData(q, { idField: 'agentId' }) as Observable<AgentMapping[]>;
  }

  /** agentIds registrados para una empresa (para acotar la query de llamadas). */
  async loadAgentIdsForCompany(companyId: string): Promise<string[]> {
    const snap = await getDocs(query(this.col, where('companyId', '==', companyId)));
    return snap.docs.map((d) => d.id);
  }

  /**
   * Crea o actualiza un mapeo. doc id == agentId, así que setDoc cubre ambos.
   * Solo superusuario (rules).
   */
  async set(mapping: Pick<AgentMapping, 'agentId' | 'companyId' | 'companyName' | 'label'>): Promise<void> {
    const ref = doc(this.firestore, 'agentMappings', mapping.agentId);
    await setDoc(
      ref,
      stripUndefinedDeep({
        agentId: mapping.agentId,
        companyId: mapping.companyId,
        companyName: mapping.companyName ?? null,
        label: mapping.label ?? null,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      }),
      { merge: true },
    );
  }

  /** Elimina un mapeo. Solo superusuario (rules). */
  async remove(agentId: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'agentMappings', agentId));
  }
}
