import { inject, Injectable, signal } from '@angular/core';
import {
  Firestore,
  collection,
  collectionGroup,
  doc,
  onSnapshot,
  orderBy,
  query,
  where,
  writeBatch,
  serverTimestamp,
  type Unsubscribe,
} from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { CompanyService } from './company.service';
import { LineaExtracto, LineaExtractoParseada } from '../../interfaces';
import type { Match } from '../conciliacion/conciliacion';

@Injectable({ providedIn: 'root' })
export class ConciliacionService {
  private readonly firestore = inject(Firestore);
  private readonly companyService = inject(CompanyService);
  private readonly auth = inject(Auth);

  /** Todas las líneas de extracto de la empresa (todas las cuentas), en tiempo real. */
  readonly lineas = signal<LineaExtracto[]>([]);
  readonly loading = signal(false);

  private unsub: Unsubscribe | null = null;

  private get companyId(): string {
    const id = this.companyService.activeCompany()?.id;
    if (!id) throw new Error('No active company');
    return id;
  }

  private extractoRef(cuentaId: string) {
    return collection(this.firestore, 'companies', this.companyId, 'cuentas', cuentaId, 'extracto');
  }

  loadLineas(): void {
    this.unsub?.();
    this.loading.set(true);
    const q = query(
      collectionGroup(this.firestore, 'extracto'),
      where('companyId', '==', this.companyId),
      orderBy('fecha', 'desc'),
    );
    this.unsub = onSnapshot(q, snapshot => {
      this.lineas.set(snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as LineaExtracto));
      this.loading.set(false);
    });
  }

  stopLineas(): void {
    this.unsub?.();
    this.unsub = null;
  }

  /** Importa un lote de líneas parseadas, todas en estado 'pendiente'. */
  async importarExtracto(cuentaId: string, lineas: LineaExtractoParseada[]): Promise<void> {
    const companyId = this.companyId;
    const uid = this.auth.currentUser?.uid ?? '';
    const ref = this.extractoRef(cuentaId);
    const batch = writeBatch(this.firestore);
    for (const l of lineas) {
      const docRef = doc(ref);
      batch.set(docRef, {
        cuentaId,
        companyId,
        fecha: l.fecha,
        concepto: l.concepto,
        importe: l.importe,
        ...(l.saldoPosterior != null ? { saldoPosterior: l.saldoPosterior } : {}),
        estado: 'pendiente',
        importadoPor: uid,
        importadoAt: serverTimestamp(),
      });
    }
    await batch.commit();
  }

  /** Casa una línea con un movimiento de gestoría. */
  async casarLinea(cuentaId: string, lineaId: string, movimientoId: string): Promise<void> {
    const batch = writeBatch(this.firestore);
    batch.update(doc(this.extractoRef(cuentaId), lineaId), { estado: 'casado', movimientoId });
    await batch.commit();
  }

  /** Aplica en bloque los matches automáticos (lineaId → movimientoId). */
  async aplicarMatches(
    cuentaId: string,
    lineaIds: string[],
    matches: Match[],
  ): Promise<void> {
    const batch = writeBatch(this.firestore);
    for (const m of matches) {
      const lineaId = lineaIds[m.lineaIndex];
      if (!lineaId) continue;
      batch.update(doc(this.extractoRef(cuentaId), lineaId), {
        estado: 'casado',
        movimientoId: m.movimientoId,
      });
    }
    await batch.commit();
  }

  /** Devuelve una línea a 'pendiente' (deshace el casado). */
  async desconciliar(cuentaId: string, lineaId: string): Promise<void> {
    const batch = writeBatch(this.firestore);
    batch.update(doc(this.extractoRef(cuentaId), lineaId), { estado: 'pendiente', movimientoId: null });
    await batch.commit();
  }

  async ignorarLinea(cuentaId: string, lineaId: string): Promise<void> {
    const batch = writeBatch(this.firestore);
    batch.update(doc(this.extractoRef(cuentaId), lineaId), { estado: 'ignorado', movimientoId: null });
    await batch.commit();
  }
}
