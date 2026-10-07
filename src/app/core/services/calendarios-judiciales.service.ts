import { inject, Injectable } from '@angular/core';
import { doc, Firestore, getDoc, runTransaction, serverTimestamp, setDoc } from '@angular/fire/firestore';
import type { ComunidadAutonoma } from '../../interfaces/company';
import { stripUndefinedDeep } from '../firebase/sanitize';
import type { AmbitoDiaRojo, BusquedaIa, CapaAnio } from '../plazos/dias-rojos';
import { anadirDiaManual, confirmarDia, confirmarTodos, quitarDia, resolverCapas } from '../plazos/edicion-capa';
import type { CapasResueltas } from '../plazos/edicion-capa';
import { CompanyService } from './company.service';
import { UserSyncService } from './user-sync.service';

export type AdvertenciaCapas = 'sin_partido';

export interface CapasDelCalculo {
  capas: CapasResueltas;
  /** Capas cargadas por año (undefined = no existe el documento: calendario sin confirmar). */
  porAnio: Map<number, { ca?: CapaAnio; partido?: CapaAnio }>;
  advertencias: AdvertenciaCapas[];
}

const CAPA_VACIA = (): CapaAnio => ({ diasRojos: [], descartados: [] });

/**
 * Capas de días rojos por comunidad autónoma / partido judicial y año:
 * `companies/{cid}/calendariosJudiciales/{capaId}/anios/{anio}`.
 * Las mutaciones son read-modify-write en transacción para no pisar ediciones concurrentes.
 */
@Injectable({ providedIn: 'root' })
export class CalendariosJudicialesService {
  private readonly firestore = inject(Firestore);
  private readonly companyService = inject(CompanyService);
  private readonly userSync = inject(UserSyncService);

  private get companyId(): string {
    const id = this.companyService.activeCompany()?.id;
    if (!id) throw new Error('No active company');
    return id;
  }

  private get uid(): string {
    const id = this.userSync.currentUser()?.id;
    if (!id) throw new Error('No current user');
    return id;
  }

  private capaRef(capaId: string, anio: number) {
    return doc(this.firestore, 'companies', this.companyId, 'calendariosJudiciales', capaId, 'anios', String(anio));
  }

  async obtenerCapa(capaId: string, anio: number): Promise<CapaAnio | undefined> {
    const snap = await getDoc(this.capaRef(capaId, anio));
    if (!snap.exists()) return undefined;
    const d = snap.data() as Partial<CapaAnio>;
    return { ...d, diasRojos: d.diasRojos ?? [], descartados: d.descartados ?? [] };
  }

  async capasDelCalculo(
    caso: { partidoJudicialId?: string },
    companyCa: ComunidadAutonoma,
    anios: readonly number[],
  ): Promise<CapasDelCalculo> {
    const capas = resolverCapas(caso, companyCa);
    const entradas = await Promise.all(
      anios.map(async (anio) => {
        const [ca, partido] = await Promise.all([
          this.obtenerCapa(capas.ca, anio),
          capas.partido ? this.obtenerCapa(capas.partido, anio) : Promise.resolve(undefined),
        ]);
        return [anio, { ca, partido }] as const;
      }),
    );
    return { capas, porAnio: new Map(entradas), advertencias: capas.advertencias };
  }

  private async modificar(capaId: string, anio: number, fn: (capa: CapaAnio) => CapaAnio): Promise<void> {
    const ref = this.capaRef(capaId, anio);
    const uid = this.uid;
    await runTransaction(this.firestore, async (tx) => {
      const snap = await tx.get(ref);
      const d = snap.exists() ? (snap.data() as Partial<CapaAnio>) : undefined;
      const actual: CapaAnio = { ...CAPA_VACIA(), ...d, diasRojos: d?.diasRojos ?? [], descartados: d?.descartados ?? [] };
      tx.set(ref, stripUndefinedDeep({ ...fn(actual), updatedBy: uid, updatedAt: serverTimestamp() }));
    });
  }

  añadirManual(
    capaId: string,
    anio: number,
    dia: { fecha: string; nombre: string; ambito: AmbitoDiaRojo },
  ): Promise<void> {
    const uid = this.uid;
    return this.modificar(capaId, anio, (c) => anadirDiaManual(c, dia, uid, new Date().toISOString()));
  }

  /** Quita el día y lo recuerda como descartado: la IA no podrá volver a proponerlo. */
  quitar(capaId: string, anio: number, fecha: string): Promise<void> {
    return this.modificar(capaId, anio, (c) => quitarDia(c, fecha));
  }

  confirmar(capaId: string, anio: number, fecha: string): Promise<void> {
    const uid = this.uid;
    return this.modificar(capaId, anio, (c) => confirmarDia(c, fecha, uid, new Date().toISOString()));
  }

  confirmarTodos(capaId: string, anio: number): Promise<void> {
    const uid = this.uid;
    return this.modificar(capaId, anio, (c) => confirmarTodos(c, uid, new Date().toISOString()));
  }

  /** Guarda el resultado de fusionar propuestas de la IA, con la marca de la búsqueda. */
  async guardarFusion(capaId: string, anio: number, capa: CapaAnio, busqueda: BusquedaIa): Promise<void> {
    await setDoc(
      this.capaRef(capaId, anio),
      stripUndefinedDeep({ ...capa, ultimaBusquedaIa: busqueda, updatedBy: this.uid, updatedAt: serverTimestamp() }),
    );
  }
}
