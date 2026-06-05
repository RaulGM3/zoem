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
  writeBatch,
  query,
  orderBy,
  serverTimestamp,
} from '@angular/fire/firestore';
import { CompanyService } from './company.service';
import { PlantillasService } from './plantillas.service';
import {
  Caso,
  Hito,
  MovimientoGestoria,
  RESUMEN_FINANCIERO_VACIO,
  ResumenFinanciero,
} from '../../interfaces';

type CasoCreate = Omit<Caso, 'id' | 'companyId' | 'hitos' | 'resumenFinanciero' | 'createdAt' | 'updatedAt'> & {
  plantillaId?: string;
};

function stripUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as Partial<T>;
}

@Injectable({ providedIn: 'root' })
export class CasosService {
  private readonly firestore = inject(Firestore);
  private readonly companyService = inject(CompanyService);
  private readonly plantillasService = inject(PlantillasService);

  readonly casos = signal<Caso[]>([]);
  readonly loading = signal(false);

  private get companyId(): string {
    const id = this.companyService.activeCompany()?.id;
    if (!id) throw new Error('No active company');
    return id;
  }

  private get casosRef() {
    return collection(this.firestore, 'companies', this.companyId, 'casos');
  }

  private hitosRef(casoId: string) {
    return collection(this.firestore, 'companies', this.companyId, 'casos', casoId, 'hitos');
  }

  async loadCasos(): Promise<void> {
    this.loading.set(true);
    try {
      const q = query(this.casosRef, orderBy('updatedAt', 'desc'));
      const snapshot = await getDocs(q);
      this.casos.set(snapshot.docs.map(d => ({ id: d.id, ...d.data(), hitos: [] as Hito[] }) as Caso));
    } finally {
      this.loading.set(false);
    }
  }

  async getCaso(id: string): Promise<Caso | null> {
    const companyId = this.companyId;
    const [casoSnap, hitosSnap] = await Promise.all([
      getDoc(doc(this.firestore, 'companies', companyId, 'casos', id)),
      getDocs(query(
        collection(this.firestore, 'companies', companyId, 'casos', id, 'hitos'),
        orderBy('orden')
      )),
    ]);
    if (!casoSnap.exists()) return null;
    const hitos = hitosSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Hito);
    return { id: casoSnap.id, ...casoSnap.data(), hitos } as Caso;
  }

  async createCaso(data: CasoCreate): Promise<string> {
    const companyId = this.companyId;
    let hitosToCreate: Omit<Hito, 'id'>[] = [];

    if (data.plantillaId) {
      const plantilla = await this.plantillasService.getPlantilla(data.plantillaId);
      if (plantilla) {
        const inicio = new Date();
        hitosToCreate = plantilla.hitos.map(h => {
          const fecha = new Date(inicio);
          fecha.setDate(fecha.getDate() + h.diasDesdeInicio);
          return {
            titulo: h.titulo,
            ...(h.descripcion ? { descripcion: h.descripcion } : {}),
            fechaEstimada: fecha.toISOString().slice(0, 10),
            ...(h.asignadoA ? { asignadoA: h.asignadoA } : {}),
            estado: 'pendiente' as const,
            orden: h.orden,
          };
        });
      }
    }

    const ref = await addDoc(collection(this.firestore, 'companies', companyId, 'casos'), {
      ...stripUndefined(data),
      companyId,
      resumenFinanciero: { ...RESUMEN_FINANCIERO_VACIO },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (hitosToCreate.length > 0) {
      const batch = writeBatch(this.firestore);
      const hitosColRef = collection(this.firestore, 'companies', companyId, 'casos', ref.id, 'hitos');
      for (const h of hitosToCreate) {
        batch.set(doc(hitosColRef), h as object);
      }
      await batch.commit();
    }

    await this.loadCasos();
    return ref.id;
  }

  async updateCaso(id: string, data: Partial<Pick<Caso, 'titulo' | 'descripcion' | 'tipo' | 'estado' | 'prioridad' | 'contactoIds' | 'vencimiento'>>): Promise<void> {
    await updateDoc(doc(this.firestore, 'companies', this.companyId, 'casos', id), {
      ...stripUndefined(data),
      updatedAt: serverTimestamp(),
    });
    this.casos.update(list =>
      list.map(c => (c.id === id ? { ...c, ...data } : c))
    );
  }

  async deleteCaso(id: string): Promise<void> {
    const companyId = this.companyId;
    const hitosSnap = await getDocs(
      collection(this.firestore, 'companies', companyId, 'casos', id, 'hitos')
    );
    const batch = writeBatch(this.firestore);
    hitosSnap.docs.forEach(d => batch.delete(d.ref));
    batch.delete(doc(this.firestore, 'companies', companyId, 'casos', id));
    await batch.commit();
    this.casos.update(list => list.filter(c => c.id !== id));
  }

  async addHito(casoId: string, data: Omit<Hito, 'id'>): Promise<Hito> {
    const ref = await addDoc(this.hitosRef(casoId), stripUndefined(data) as object);
    return { id: ref.id, ...data };
  }

  async updateHito(casoId: string, hitoId: string, data: Partial<Omit<Hito, 'id'>>): Promise<void> {
    await updateDoc(
      doc(this.firestore, 'companies', this.companyId, 'casos', casoId, 'hitos', hitoId),
      stripUndefined(data) as object
    );
  }

  async deleteHito(casoId: string, hitoId: string): Promise<void> {
    await deleteDoc(
      doc(this.firestore, 'companies', this.companyId, 'casos', casoId, 'hitos', hitoId)
    );
  }

  async recalcularResumen(casoId: string): Promise<void> {
    const companyId = this.companyId;
    const gestoriaRef = collection(this.firestore, 'companies', companyId, 'casos', casoId, 'gestoria');
    const snapshot = await getDocs(gestoriaRef);
    const movimientos = snapshot.docs.map(d => d.data() as MovimientoGestoria);

    const resumen: ResumenFinanciero = { ...RESUMEN_FINANCIERO_VACIO };
    for (const m of movimientos) {
      if (m.tipo === 'ingreso') resumen.totalIngresos += m.importe;
      else if (m.tipo === 'suplido') resumen.totalSuplidos += m.importe;
      else if (m.tipo === 'honorario') resumen.totalHonorarios += m.importe;
    }
    resumen.saldo = resumen.totalIngresos - resumen.totalSuplidos - resumen.totalHonorarios;

    await updateDoc(doc(this.firestore, 'companies', companyId, 'casos', casoId), {
      resumenFinanciero: resumen,
      updatedAt: serverTimestamp(),
    });

    this.casos.update(list =>
      list.map(c => (c.id === casoId ? { ...c, resumenFinanciero: resumen } : c))
    );
  }
}
