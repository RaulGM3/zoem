import { inject, Injectable, signal } from '@angular/core';
import {
  Firestore,
  collection,
  addDoc,
  onSnapshot,
  orderBy,
  query,
  limit,
  serverTimestamp,
  type Timestamp,
  type Unsubscribe,
} from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { CompanyService } from './company.service';
import { stripUndefinedDeep } from '../firebase/sanitize';
import type { CierreCaja, CierreCuenta } from '../../interfaces';

/** Fecha local (no UTC) en formato YYYY-MM-DD — evita el desfase de `toISOString().slice(0, 10)`. */
function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

@Injectable({ providedIn: 'root' })
export class CierreCajaService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(Auth);
  private readonly companyService = inject(CompanyService);

  readonly cierres = signal<CierreCaja[]>([]);
  private unsub: Unsubscribe | null = null;

  private get companyId(): string {
    const id = this.companyService.activeCompany()?.id;
    if (!id) throw new Error('No active company');
    return id;
  }

  private cierresRef() {
    return collection(this.firestore, 'companies', this.companyId, 'cierres_caja');
  }

  loadCierres(): void {
    this.unsub?.();
    const q = query(this.cierresRef(), orderBy('fecha', 'desc'), limit(30));
    this.unsub = onSnapshot(q, snap => {
      this.cierres.set(snap.docs.map(d => ({ id: d.id, ...d.data() }) as CierreCaja));
    });
  }

  stopCierres(): void {
    this.unsub?.();
    this.unsub = null;
  }

  async crearCierre(cuentas: CierreCuenta[], notas?: string): Promise<void> {
    const fecha = localDateStr(new Date());
    const totales = {
      ingresos: cuentas.reduce((a, c) => a + c.ingresos, 0),
      egresos: cuentas.reduce((a, c) => a + c.egresos, 0),
      sistemaTotal: cuentas.reduce((a, c) => a + c.sistema, 0),
      aprobadoTotal: cuentas.reduce((a, c) => a + c.aprobado, 0),
    };

    const data: Omit<CierreCaja, 'id'> = {
      fecha,
      companyId: this.companyId,
      creadoPor: this.auth.currentUser?.uid ?? '',
      // serverTimestamp() devuelve un FieldValue centinela que Firestore resuelve
      // a Timestamp en el server; el cast vía unknown preserva el tipo de lectura.
      creadoAt: serverTimestamp() as unknown as Timestamp,
      cuentas,
      totales,
      ...(notas?.trim() ? { notas: notas.trim() } : {}),
    };

    await addDoc(this.cierresRef(), stripUndefinedDeep(data));
  }
}
