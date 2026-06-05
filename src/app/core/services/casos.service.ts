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
  orderBy,
  serverTimestamp,
} from '@angular/fire/firestore';
import { CompanyService } from './company.service';
import { PlantillasService } from './plantillas.service';
import {
  Caso,
  CasoEstado,
  CasoPrioridad,
  CasoTipo,
  Hito,
  MovimientoGestoria,
  RESUMEN_FINANCIERO_VACIO,
  ResumenFinanciero,
} from '../../interfaces';

type CasoCreate = Omit<Caso, 'id' | 'companyId' | 'hitos' | 'resumenFinanciero' | 'createdAt' | 'updatedAt'> & {
  plantillaId?: string;
};

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

  async loadCasos(): Promise<void> {
    this.loading.set(true);
    try {
      const q = query(this.casosRef, orderBy('updatedAt', 'desc'));
      const snapshot = await getDocs(q);
      this.casos.set(snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as Caso));
    } finally {
      this.loading.set(false);
    }
  }

  async getCaso(id: string): Promise<Caso | null> {
    const snapshot = await getDoc(doc(this.firestore, 'companies', this.companyId, 'casos', id));
    return snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() }) as Caso : null;
  }

  async createCaso(data: CasoCreate): Promise<string> {
    const companyId = this.companyId;
    let hitos: Hito[] = [];

    if (data.plantillaId) {
      const plantilla = await this.plantillasService.getPlantilla(data.plantillaId);
      if (plantilla) {
        const inicio = new Date();
        hitos = plantilla.hitos.map(h => {
          const fecha = new Date(inicio);
          fecha.setDate(fecha.getDate() + h.diasDesdeInicio);
          return {
            id: crypto.randomUUID(),
            titulo: h.titulo,
            descripcion: h.descripcion,
            fechaEstimada: fecha.toISOString().slice(0, 10),
            asignadoA: h.asignadoA,
            estado: 'pendiente' as const,
            orden: h.orden,
          };
        });
      }
    }

    const ref = await addDoc(collection(this.firestore, 'companies', companyId, 'casos'), {
      ...data,
      companyId,
      hitos,
      resumenFinanciero: { ...RESUMEN_FINANCIERO_VACIO },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await this.loadCasos();
    return ref.id;
  }

  async updateCaso(id: string, data: Partial<Pick<Caso, 'titulo' | 'descripcion' | 'tipo' | 'estado' | 'prioridad' | 'contactoIds' | 'vencimiento'>>): Promise<void> {
    await updateDoc(doc(this.firestore, 'companies', this.companyId, 'casos', id), {
      ...data,
      updatedAt: serverTimestamp(),
    });
    this.casos.update(list =>
      list.map(c => (c.id === id ? { ...c, ...data } : c))
    );
  }

  async deleteCaso(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'companies', this.companyId, 'casos', id));
    this.casos.update(list => list.filter(c => c.id !== id));
  }

  async updateHitos(casoId: string, hitos: Hito[]): Promise<void> {
    await updateDoc(doc(this.firestore, 'companies', this.companyId, 'casos', casoId), {
      hitos,
      updatedAt: serverTimestamp(),
    });
    this.casos.update(list =>
      list.map(c => (c.id === casoId ? { ...c, hitos } : c))
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
