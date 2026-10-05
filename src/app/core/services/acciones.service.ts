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
  type QueryConstraint,
} from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { CompanyService } from './company.service';
import { stripUndefinedDeep } from '../firebase/sanitize';
import type { Accion, AccionInput, AmbitoAccion } from '../../interfaces/accion.interface';

/**
 * CRUD de `companies/{cid}/acciones`. Las consultas son solo de igualdad
 * (no requieren índices compuestos) y se ordenan por nombre en cliente: el
 * catálogo de una empresa es pequeño.
 */
@Injectable({ providedIn: 'root' })
export class AccionesService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(Auth);
  private readonly companyService = inject(CompanyService);

  readonly acciones = signal<Accion[]>([]);
  readonly loading = signal(false);

  private get companyId(): string {
    const id = this.companyService.activeCompany()?.id;
    if (!id) throw new Error('No active company');
    return id;
  }

  private get accionesRef() {
    return collection(this.firestore, 'companies', this.companyId, 'acciones');
  }

  private get userId(): string {
    const uid = this.auth.currentUser?.uid;
    if (!uid) throw new Error('No current user');
    return uid;
  }

  /** Carga todas (activas o no) en el signal `acciones`: pantalla de gestión. */
  async cargar(): Promise<void> {
    this.loading.set(true);
    try {
      this.acciones.set(await this.consultar([]));
    } finally {
      this.loading.set(false);
    }
  }

  async obtener(id: string): Promise<Accion | null> {
    const snap = await getDoc(doc(this.firestore, 'companies', this.companyId, 'acciones', id));
    return snap.exists() ? ({ id: snap.id, ...snap.data() } as Accion) : null;
  }

  async crear(data: AccionInput): Promise<string> {
    const ref = await addDoc(this.accionesRef, {
      ...(stripUndefinedDeep(data) as object),
      companyId: this.companyId,
      createdBy: this.userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  }

  async actualizar(id: string, data: Partial<AccionInput>): Promise<void> {
    await updateDoc(doc(this.firestore, 'companies', this.companyId, 'acciones', id), {
      ...(stripUndefinedDeep(data) as object),
      updatedAt: serverTimestamp(),
    });
  }

  async eliminar(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'companies', this.companyId, 'acciones', id));
  }

  /** Acciones disponibles en contactos o casos (por defecto solo las activas). */
  listarPorAmbito(ambito: AmbitoAccion, opts: { soloActivas?: boolean } = {}): Promise<Accion[]> {
    const { soloActivas = true } = opts;
    return this.consultar([
      where('ambito', '==', ambito),
      ...(soloActivas ? [where('activa', '==', true)] : []),
    ]);
  }

  /** Todas las acciones ligadas a una plantilla de caso (gestión desde la plantilla). */
  listarPorPlantilla(plantillaId: string): Promise<Accion[]> {
    return this.consultar([where('plantillaId', '==', plantillaId)]);
  }

  /** Acciones activas sugeridas al completar un hito de plantilla concreto. */
  listarPorHitoPlantilla(plantillaId: string, hitoPlantillaId: string): Promise<Accion[]> {
    return this.consultar([
      where('plantillaId', '==', plantillaId),
      where('hitoPlantillaId', '==', hitoPlantillaId),
      where('activa', '==', true),
    ]);
  }

  private async consultar(constraints: QueryConstraint[]): Promise<Accion[]> {
    const snap = await getDocs(query(this.accionesRef, ...constraints));
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as Accion)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
  }
}
