import { effect, inject, Injectable, signal } from '@angular/core';
import { doc, Firestore, onSnapshot } from '@angular/fire/firestore';
import { CompanyService } from '../services/company.service';
import type { Limite } from './catalogo';
import { PlanService } from './plan.service';
import { claveMes, usadoDe, type UsoDoc } from './uso';

/**
 * Cuánto lleva gastado la empresa activa de cada cupo. Lee en vivo los contadores
 * `companies/{cid}/uso/total` y `uso/{yyyy-mm}`, que SOLO escriben las Functions.
 * Son eventualmente consistentes: sirven para pintar el medidor, no para decidir en exclusiva
 * (la decisión real la toman las security rules y `reservarIA`).
 */
@Injectable({ providedIn: 'root' })
export class UsoService {
  private readonly firestore = inject(Firestore);
  private readonly company = inject(CompanyService);
  private readonly plan = inject(PlanService);

  private readonly total = signal<UsoDoc>({});
  private readonly mes = signal<UsoDoc>({});

  constructor() {
    effect((onCleanup) => {
      const cid = this.company.activeCompany()?.id;
      if (!cid) return;
      const escuchar = (docId: string, destino: typeof this.total) =>
        onSnapshot(
          doc(this.firestore, 'companies', cid, 'uso', docId),
          (snap) => destino.set(snap.exists() ? (snap.data() as UsoDoc) : {}),
          // Sin permiso o sin red: el medidor se queda a 0; las rules siguen mandando.
          (err) => console.error('[uso] listener error:', err),
        );
      const bajas = [
        escuchar('total', this.total),
        escuchar(claveMes(this.plan.ahora()), this.mes),
      ];
      onCleanup(() => {
        bajas.forEach((b) => b());
        this.total.set({});
        this.mes.set({});
      });
    });
  }

  usado(limite: Limite): number {
    return usadoDe(limite, this.total(), this.mes());
  }
}
