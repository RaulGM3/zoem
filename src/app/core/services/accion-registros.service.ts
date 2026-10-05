import { inject, Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  getDocs,
  setDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { CompanyService } from './company.service';
import { stripUndefinedDeep } from '../firebase/sanitize';
import type { AccionRegistro } from '../../interfaces/accion.interface';

export type AccionRegistroInput = Omit<AccionRegistro, 'id' | 'companyId' | 'createdBy' | 'createdAt'>;

/**
 * Log append-only de ejecuciones (`companies/{cid}/accion_registros`). Las
 * rules solo permiten `create`: no hay actualizar ni borrar desde cliente.
 * Requiere los índices compuestos de `firestore.indexes.json`.
 */
@Injectable({ providedIn: 'root' })
export class AccionRegistrosService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(Auth);
  private readonly companyService = inject(CompanyService);

  private get companyId(): string {
    const id = this.companyService.activeCompany()?.id;
    if (!id) throw new Error('No active company');
    return id;
  }

  private get registrosRef() {
    return collection(this.firestore, 'companies', this.companyId, 'accion_registros');
  }

  /**
   * Reserva el id del registro SIN escribir: el .docx adjunto se sube a
   * `acciones_envios/{id}.docx` antes de que exista el registro.
   */
  nuevoId(): string {
    return doc(this.registrosRef).id;
  }

  async crear(id: string, data: AccionRegistroInput): Promise<void> {
    const uid = this.auth.currentUser?.uid;
    if (!uid) throw new Error('No current user');
    await setDoc(doc(this.firestore, 'companies', this.companyId, 'accion_registros', id), {
      ...(stripUndefinedDeep(data) as object),
      companyId: this.companyId,
      createdBy: uid,
      createdAt: serverTimestamp(),
    });
  }

  /** Historial de un contacto (más reciente primero). */
  async listarPorContacto(contactoId: string): Promise<AccionRegistro[]> {
    return this.listar(where('contactoIds', 'array-contains', contactoId));
  }

  /** Historial de un caso (más reciente primero). */
  async listarPorCaso(casoId: string): Promise<AccionRegistro[]> {
    return this.listar(where('casoId', '==', casoId));
  }

  private async listar(filtro: ReturnType<typeof where>): Promise<AccionRegistro[]> {
    const snap = await getDocs(query(this.registrosRef, filtro, orderBy('createdAt', 'desc')));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AccionRegistro);
  }
}
