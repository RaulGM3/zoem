import { inject, Injectable, signal } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
} from '@angular/fire/firestore';
import { CompanyService } from './company.service';
import { CasosService } from './casos.service';
import { MovimientoGestoria, MovimientoTipo } from '../../interfaces';
import { Auth } from '@angular/fire/auth';

type MovimientoCreate = Pick<MovimientoGestoria, 'tipo' | 'concepto' | 'importe' | 'esEntrada' | 'fecha' | 'notas'>;

@Injectable({ providedIn: 'root' })
export class GestoriaService {
  private readonly firestore = inject(Firestore);
  private readonly companyService = inject(CompanyService);
  private readonly casosService = inject(CasosService);
  private readonly auth = inject(Auth);

  readonly movimientos = signal<MovimientoGestoria[]>([]);
  readonly loading = signal(false);

  private get companyId(): string {
    const id = this.companyService.activeCompany()?.id;
    if (!id) throw new Error('No active company');
    return id;
  }

  private gestoriaRef(casoId: string) {
    return collection(this.firestore, 'companies', this.companyId, 'casos', casoId, 'gestoria');
  }

  async loadMovimientos(casoId: string): Promise<void> {
    this.loading.set(true);
    try {
      const q = query(this.gestoriaRef(casoId), orderBy('fecha', 'desc'));
      const snapshot = await getDocs(q);
      this.movimientos.set(snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as MovimientoGestoria));
    } finally {
      this.loading.set(false);
    }
  }

  async addMovimiento(casoId: string, data: MovimientoCreate): Promise<void> {
    const companyId = this.companyId;
    await addDoc(this.gestoriaRef(casoId), {
      ...data,
      casoId,
      companyId,
      createdBy: this.auth.currentUser?.uid ?? '',
      createdAt: serverTimestamp(),
    });
    await Promise.all([
      this.loadMovimientos(casoId),
      this.casosService.recalcularResumen(casoId),
    ]);
  }

  async updateMovimiento(casoId: string, id: string, data: Partial<MovimientoCreate>): Promise<void> {
    await updateDoc(
      doc(this.firestore, 'companies', this.companyId, 'casos', casoId, 'gestoria', id),
      data
    );
    await Promise.all([
      this.loadMovimientos(casoId),
      this.casosService.recalcularResumen(casoId),
    ]);
  }

  async deleteMovimiento(casoId: string, id: string): Promise<void> {
    await deleteDoc(
      doc(this.firestore, 'companies', this.companyId, 'casos', casoId, 'gestoria', id)
    );
    await Promise.all([
      this.loadMovimientos(casoId),
      this.casosService.recalcularResumen(casoId),
    ]);
  }
}
