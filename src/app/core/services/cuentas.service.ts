import { inject, Injectable, signal } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  type Unsubscribe,
} from '@angular/fire/firestore';
import { CompanyService } from './company.service';
import { CuentaBancaria } from '../../interfaces';

type CuentaCreate = Pick<CuentaBancaria, 'nombre' | 'tipo' | 'entidad' | 'iban'>;

function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined)
  ) as Partial<T>;
}

@Injectable({ providedIn: 'root' })
export class CuentasService {
  private readonly firestore = inject(Firestore);
  private readonly companyService = inject(CompanyService);

  readonly cuentas = signal<CuentaBancaria[]>([]);
  readonly loading = signal(false);

  private unsub: Unsubscribe | null = null;

  private get companyId(): string {
    const id = this.companyService.activeCompany()?.id;
    if (!id) throw new Error('No active company');
    return id;
  }

  private cuentasRef() {
    return collection(this.firestore, 'companies', this.companyId, 'cuentas');
  }

  loadCuentas(): void {
    this.unsub?.();
    this.loading.set(true);
    const q = query(this.cuentasRef(), orderBy('createdAt', 'asc'));
    this.unsub = onSnapshot(q, snapshot => {
      this.cuentas.set(snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as CuentaBancaria));
      this.loading.set(false);
    });
  }

  stopCuentas(): void {
    this.unsub?.();
    this.unsub = null;
  }

  async createCuenta(data: CuentaCreate): Promise<void> {
    await addDoc(this.cuentasRef(), {
      ...stripUndefined(data as Record<string, unknown>),
      companyId: this.companyId,
      activa: true,
      createdAt: serverTimestamp(),
    });
  }

  async updateCuenta(id: string, data: Partial<CuentaCreate>): Promise<void> {
    await updateDoc(doc(this.cuentasRef(), id), {
      ...stripUndefined(data as Record<string, unknown>),
      updatedAt: serverTimestamp(),
    });
  }

  async deleteCuenta(id: string): Promise<void> {
    await deleteDoc(doc(this.cuentasRef(), id));
    this.cuentas.update(list => list.filter(c => c.id !== id));
  }

  async actualizarSaldo(id: string, saldo: number): Promise<void> {
    const fecha = new Date().toISOString().slice(0, 10);
    await updateDoc(doc(this.cuentasRef(), id), {
      saldoBancario: saldo,
      saldoBancarioFecha: fecha,
      updatedAt: serverTimestamp(),
    });
    this.cuentas.update(list =>
      list.map(c => c.id === id ? { ...c, saldoBancario: saldo, saldoBancarioFecha: fecha } : c)
    );
  }
}
