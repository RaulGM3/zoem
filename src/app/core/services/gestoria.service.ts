import { inject, Injectable, signal } from '@angular/core';
import {
  Firestore,
  collection,
  collectionGroup,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  where,
  serverTimestamp,
  writeBatch,
  type Unsubscribe,
} from '@angular/fire/firestore';
import { CompanyService } from './company.service';
import { CasosService } from './casos.service';
import { GestoriaSlot, MovimientoGestoria, MovimientoTipo, Retiro } from '../../interfaces';
import { Auth } from '@angular/fire/auth';

type MovimientoCreate = Pick<MovimientoGestoria, 'tipo' | 'concepto' | 'importe' | 'esEntrada' | 'fecha' | 'notas' | 'cuentaId'>;
type MovimientoOpt = Omit<MovimientoCreate, 'notas' | 'cuentaId'> & { notas?: string; cuentaId?: string };
type RetiroCreate = Pick<Retiro, 'concepto' | 'importe' | 'fecha' | 'cuentaId' | 'notas'>;

/**
 * Firestore rechaza valores `undefined`. Elimina las claves con `undefined`
 * antes de escribir (p. ej. `notas` cuando el form viene vacío).
 */
function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined)
  ) as Partial<T>;
}

@Injectable({ providedIn: 'root' })
export class GestoriaService {
  private readonly firestore = inject(Firestore);
  private readonly companyService = inject(CompanyService);
  private readonly casosService = inject(CasosService);
  private readonly auth = inject(Auth);

  readonly movimientos = signal<MovimientoGestoria[]>([]);
  readonly todosMovimientos = signal<MovimientoGestoria[]>([]);
  readonly retiros = signal<Retiro[]>([]);
  readonly slots = signal<GestoriaSlot[]>([]);
  readonly loading = signal(false);
  readonly todosLoading = signal(false);

  private movimientosUnsub: Unsubscribe | null = null;
  private todosMovimientosUnsub: Unsubscribe | null = null;
  private retirosUnsub: Unsubscribe | null = null;

  private get companyId(): string {
    const id = this.companyService.activeCompany()?.id;
    if (!id) throw new Error('No active company');
    return id;
  }

  private gestoriaRef(casoId: string) {
    return collection(this.firestore, 'companies', this.companyId, 'casos', casoId, 'gestoria');
  }

  private slotsRef(casoId: string) {
    return collection(this.firestore, 'companies', this.companyId, 'casos', casoId, 'gestoria_slots');
  }

  private retirosRef() {
    return collection(this.firestore, 'companies', this.companyId, 'retiros');
  }

  async loadSlots(casoId: string): Promise<void> {
    try {
      const snapshot = await getDocs(this.slotsRef(casoId));
      this.slots.set(
        snapshot.docs
          .map(d => ({ id: d.id, ...d.data() }) as GestoriaSlot)
          .sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999) || a.nombre.localeCompare(b.nombre))
      );
    } catch {
      // No active company or Firestore error
    }
  }

  /**
   * Persiste el nuevo orden de los slots dentro del caso. Cada slot recibe
   * un `orden` según su posición en la lista recibida (ya reordenada).
   */
  async reorderSlots(casoId: string, orderedSlots: GestoriaSlot[]): Promise<void> {
    const batch = writeBatch(this.firestore);
    orderedSlots.forEach((slot, index) => {
      batch.update(doc(this.slotsRef(casoId), slot.id), {
        orden: index,
        updatedAt: serverTimestamp(),
      });
    });
    await batch.commit();

    const ordenById = new Map(orderedSlots.map((s, i) => [s.id, i]));
    this.slots.update(list =>
      [...list]
        .map(s => (ordenById.has(s.id) ? { ...s, orden: ordenById.get(s.id)! } : s))
        .sort((a, b) => (a.orden ?? 999) - (b.orden ?? 999) || a.nombre.localeCompare(b.nombre))
    );
  }

  async registerSlot(casoId: string, slot: GestoriaSlot, movData: MovimientoOpt): Promise<void> {
    const companyId = this.companyId;
    const movRef = await addDoc(this.gestoriaRef(casoId), {
      ...stripUndefined(movData),
      casoId,
      companyId,
      createdBy: this.auth.currentUser?.uid ?? '',
      createdAt: serverTimestamp(),
    });

    await updateDoc(doc(this.slotsRef(casoId), slot.id), {
      status: 'registrado',
      movimientoId: movRef.id,
      importeReal: movData.importe,
      fechaRegistro: movData.fecha,
      updatedAt: serverTimestamp(),
    });

    this.slots.update(list =>
      list.map(s =>
        s.id === slot.id
          ? { ...s, status: 'registrado' as const, movimientoId: movRef.id, importeReal: movData.importe, fechaRegistro: movData.fecha }
          : s
      )
    );

    await Promise.all([
      this.loadMovimientos(casoId),
      this.casosService.recalcularResumen(casoId),
    ]);
  }

  async unregisterSlot(casoId: string, slot: GestoriaSlot): Promise<void> {
    if (slot.movimientoId) {
      await deleteDoc(doc(this.gestoriaRef(casoId), slot.movimientoId));
    }

    await updateDoc(doc(this.slotsRef(casoId), slot.id), {
      status: 'pendiente',
      movimientoId: null,
      importeReal: null,
      fechaRegistro: null,
      updatedAt: serverTimestamp(),
    });

    this.slots.update(list =>
      list.map(s =>
        s.id === slot.id
          ? { ...s, status: 'pendiente' as const, movimientoId: undefined, importeReal: undefined, fechaRegistro: undefined }
          : s
      )
    );

    // Al des-registrar también desaparece su movimiento asociado del cálculo, por lo
    // que hay que recalcular el resumen y el conteo de slots (igual que registerSlot).
    await this.casosService.recalcularResumen(casoId);
  }

  loadMovimientos(casoId: string): void {
    this.movimientosUnsub?.();
    this.loading.set(true);
    const q = query(this.gestoriaRef(casoId), orderBy('fecha', 'desc'));
    this.movimientosUnsub = onSnapshot(q, snapshot => {
      this.movimientos.set(snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as MovimientoGestoria));
      this.loading.set(false);
    });
  }

  stopMovimientos(): void {
    this.movimientosUnsub?.();
    this.movimientosUnsub = null;
  }

  async addMovimiento(casoId: string, data: MovimientoCreate): Promise<void> {
    const companyId = this.companyId;
    await addDoc(this.gestoriaRef(casoId), {
      ...stripUndefined(data),
      casoId,
      companyId,
      createdBy: this.auth.currentUser?.uid ?? '',
      createdAt: serverTimestamp(),
    });
    await this.casosService.recalcularResumen(casoId);
  }

  async updateMovimiento(casoId: string, id: string, data: Partial<MovimientoCreate>): Promise<void> {
    await updateDoc(
      doc(this.firestore, 'companies', this.companyId, 'casos', casoId, 'gestoria', id),
      stripUndefined(data)
    );
    await this.casosService.recalcularResumen(casoId);
  }

  async deleteMovimiento(casoId: string, id: string): Promise<void> {
    await deleteDoc(
      doc(this.firestore, 'companies', this.companyId, 'casos', casoId, 'gestoria', id)
    );
    await this.casosService.recalcularResumen(casoId);
  }

  loadTodosMovimientos(): void {
    this.todosMovimientosUnsub?.();
    this.todosLoading.set(true);
    const companyId = this.companyId;
    const q = query(
      collectionGroup(this.firestore, 'gestoria'),
      where('companyId', '==', companyId),
      orderBy('fecha', 'desc'),
    );
    this.todosMovimientosUnsub = onSnapshot(q, snapshot => {
      this.todosMovimientos.set(
        snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as MovimientoGestoria)
      );
      this.todosLoading.set(false);
    });
  }

  stopTodosMovimientos(): void {
    this.todosMovimientosUnsub?.();
    this.todosMovimientosUnsub = null;
  }

  async aprobarMovimiento(casoId: string, movId: string, aprobado: boolean): Promise<void> {
    const uid = this.auth.currentUser?.uid ?? '';
    const docRef = doc(this.firestore, 'companies', this.companyId, 'casos', casoId, 'gestoria', movId);
    await updateDoc(docRef, {
      aprobado,
      aprobadoAt: aprobado ? serverTimestamp() : null,
      aprobadoPor: aprobado ? uid : null,
    });
    this.todosMovimientos.update(list =>
      list.map(m => m.id === movId ? { ...m, aprobado } : m)
    );
  }

  async aprobarTodos(movimientos: MovimientoGestoria[]): Promise<void> {
    const uid = this.auth.currentUser?.uid ?? '';
    const companyId = this.companyId;
    const batch = writeBatch(this.firestore);
    for (const mov of movimientos) {
      const docRef = doc(this.firestore, 'companies', companyId, 'casos', mov.casoId, 'gestoria', mov.id);
      batch.update(docRef, { aprobado: true, aprobadoAt: serverTimestamp(), aprobadoPor: uid });
    }
    await batch.commit();
    const ids = new Set(movimientos.map(m => m.id));
    this.todosMovimientos.update(list =>
      list.map(m => ids.has(m.id) ? { ...m, aprobado: true } : m)
    );
  }

  loadRetiros(): void {
    this.retirosUnsub?.();
    const q = query(this.retirosRef(), orderBy('fecha', 'desc'));
    this.retirosUnsub = onSnapshot(q, snapshot => {
      this.retiros.set(snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as Retiro));
    });
  }

  stopRetiros(): void {
    this.retirosUnsub?.();
    this.retirosUnsub = null;
  }

  async addRetiro(data: RetiroCreate): Promise<void> {
    await addDoc(this.retirosRef(), {
      ...stripUndefined(data as Record<string, unknown>),
      companyId: this.companyId,
      createdBy: this.auth.currentUser?.uid ?? '',
      createdAt: serverTimestamp(),
    });
  }

  async deleteRetiro(id: string): Promise<void> {
    await deleteDoc(doc(this.retirosRef(), id));
    this.retiros.update(list => list.filter(r => r.id !== id));
  }
}
