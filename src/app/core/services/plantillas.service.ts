import { inject, Injectable, signal } from '@angular/core';
import {
  Firestore,
  CollectionReference,
  DocumentData,
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
import { CasoPlantilla, HitoPlantilla, PartidaCosto } from '../../interfaces';

type PlantillaCreate = Omit<CasoPlantilla, 'id' | 'companyId' | 'createdAt' | 'updatedAt'>;

function stripUndefined(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(stripUndefined);
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, stripUndefined(v)])
    );
  }
  return obj;
}

@Injectable({ providedIn: 'root' })
export class PlantillasService {
  private readonly firestore = inject(Firestore);
  private readonly companyService = inject(CompanyService);

  readonly plantillas = signal<CasoPlantilla[]>([]);
  readonly loading = signal(false);

  private get companyId(): string {
    const id = this.companyService.activeCompany()?.id;
    if (!id) throw new Error('No active company');
    return id;
  }

  private get plantillasRef() {
    return collection(this.firestore, 'companies', this.companyId, 'casoPlantillas');
  }

  private hitosRef(plantillaId: string) {
    return collection(this.firestore, 'companies', this.companyId, 'casoPlantillas', plantillaId, 'hitos');
  }

  private costosRef(plantillaId: string) {
    return collection(this.firestore, 'companies', this.companyId, 'casoPlantillas', plantillaId, 'modeloCostos');
  }

  async loadPlantillas(): Promise<void> {
    this.loading.set(true);
    try {
      const q = query(this.plantillasRef, orderBy('nombre'));
      const snapshot = await getDocs(q);
      this.plantillas.set(snapshot.docs.map(d => {
        const data = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          ...data,
          hitos: [] as HitoPlantilla[],
          modeloCostos: {
            honorariosBase: (data['modeloCostos'] as { honorariosBase?: number } | undefined)?.honorariosBase,
            suplidos: [] as PartidaCosto[],
          },
        } as CasoPlantilla;
      }));
    } finally {
      this.loading.set(false);
    }
  }

  async getPlantilla(id: string): Promise<CasoPlantilla | null> {
    const companyId = this.companyId;
    const [plantillaSnap, hitosSnap, costosSnap] = await Promise.all([
      getDoc(doc(this.firestore, 'companies', companyId, 'casoPlantillas', id)),
      getDocs(query(
        collection(this.firestore, 'companies', companyId, 'casoPlantillas', id, 'hitos'),
        orderBy('orden')
      )),
      getDocs(collection(this.firestore, 'companies', companyId, 'casoPlantillas', id, 'modeloCostos')),
    ]);
    if (!plantillaSnap.exists()) return null;
    const data = plantillaSnap.data() as Record<string, unknown>;
    const hitos = hitosSnap.docs.map(d => ({ id: d.id, ...d.data() }) as HitoPlantilla);
    const suplidos = costosSnap.docs
      .map(d => d.data() as PartidaCosto)
      .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
    return {
      id: plantillaSnap.id,
      ...data,
      hitos,
      modeloCostos: {
        honorariosBase: (data['modeloCostos'] as { honorariosBase?: number } | undefined)?.honorariosBase,
        suplidos,
      },
    } as CasoPlantilla;
  }

  async createPlantilla(data: PlantillaCreate): Promise<string> {
    const companyId = this.companyId;
    const { hitos, modeloCostos, ...rest } = data;

    const ref = await addDoc(
      collection(this.firestore, 'companies', companyId, 'casoPlantillas'),
      {
        ...(stripUndefined(rest) as Record<string, unknown>),
        modeloCostos: stripUndefined({ honorariosBase: modeloCostos.honorariosBase }),
        companyId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
    );

    const batch = writeBatch(this.firestore);
    const hitosColRef = this.hitosRef(ref.id);
    const costosColRef = this.costosRef(ref.id);

    for (const h of hitos) {
      const { id: _id, ...hitoData } = h;
      batch.set(doc(hitosColRef), stripUndefined(hitoData) as object);
    }
    for (const [i, s] of modeloCostos.suplidos.entries()) {
      batch.set(doc(costosColRef), stripUndefined({ ...s, orden: i }) as object);
    }
    await batch.commit();

    await this.loadPlantillas();
    return ref.id;
  }

  async updatePlantilla(id: string, data: Partial<PlantillaCreate>): Promise<void> {
    const companyId = this.companyId;
    const { hitos, modeloCostos, ...rest } = data;

    const updateData: Record<string, unknown> = {
      ...(stripUndefined(rest) as Record<string, unknown>),
      updatedAt: serverTimestamp(),
    };
    if (modeloCostos !== undefined) {
      updateData['modeloCostos'] = stripUndefined({ honorariosBase: modeloCostos.honorariosBase });
    }

    await updateDoc(
      doc(this.firestore, 'companies', companyId, 'casoPlantillas', id),
      updateData
    );

    if (hitos !== undefined) {
      await this.syncSubcollection(
        this.hitosRef(id),
        hitos.map(({ id: _id, ...h }) => stripUndefined(h) as Record<string, unknown>)
      );
    }

    if (modeloCostos?.suplidos !== undefined) {
      await this.syncSubcollection(
        this.costosRef(id),
        modeloCostos.suplidos.map((s, i) => stripUndefined({ ...s, orden: i }) as Record<string, unknown>)
      );
    }

    this.plantillas.update(list =>
      list.map(p => (p.id === id ? { ...p, ...data } : p))
    );
  }

  async deletePlantilla(id: string): Promise<void> {
    const companyId = this.companyId;
    const [hitosSnap, costosSnap] = await Promise.all([
      getDocs(this.hitosRef(id)),
      getDocs(this.costosRef(id)),
    ]);
    const batch = writeBatch(this.firestore);
    hitosSnap.docs.forEach(d => batch.delete(d.ref));
    costosSnap.docs.forEach(d => batch.delete(d.ref));
    batch.delete(doc(this.firestore, 'companies', companyId, 'casoPlantillas', id));
    await batch.commit();
    this.plantillas.update(list => list.filter(p => p.id !== id));
  }

  private async syncSubcollection(
    colRef: CollectionReference<DocumentData>,
    items: Record<string, unknown>[]
  ): Promise<void> {
    const existing = await getDocs(colRef);
    const batch = writeBatch(this.firestore);
    existing.docs.forEach(d => batch.delete(d.ref));
    for (const item of items) {
      batch.set(doc(colRef), item);
    }
    await batch.commit();
  }
}
