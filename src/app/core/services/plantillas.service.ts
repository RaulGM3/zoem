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
import { CasoPlantilla, HitoPlantilla, PartidaCosto } from '../../interfaces';
import { CasoTipo } from '../../interfaces/caso.interface';

type PlantillaCreate = Omit<CasoPlantilla, 'id' | 'companyId' | 'createdAt' | 'updatedAt'>;

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

  async loadPlantillas(): Promise<void> {
    this.loading.set(true);
    try {
      const q = query(this.plantillasRef, orderBy('nombre'));
      const snapshot = await getDocs(q);
      this.plantillas.set(snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as CasoPlantilla));
    } finally {
      this.loading.set(false);
    }
  }

  async getPlantilla(id: string): Promise<CasoPlantilla | null> {
    const snapshot = await getDoc(
      doc(this.firestore, 'companies', this.companyId, 'casoPlantillas', id)
    );
    return snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() }) as CasoPlantilla : null;
  }

  async createPlantilla(data: PlantillaCreate): Promise<string> {
    const companyId = this.companyId;
    const ref = await addDoc(
      collection(this.firestore, 'companies', companyId, 'casoPlantillas'),
      {
        ...data,
        companyId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
    );
    await this.loadPlantillas();
    return ref.id;
  }

  async updatePlantilla(id: string, data: Partial<PlantillaCreate>): Promise<void> {
    await updateDoc(
      doc(this.firestore, 'companies', this.companyId, 'casoPlantillas', id),
      { ...data, updatedAt: serverTimestamp() }
    );
    this.plantillas.update(list =>
      list.map(p => (p.id === id ? { ...p, ...data } : p))
    );
  }

  async deletePlantilla(id: string): Promise<void> {
    await deleteDoc(
      doc(this.firestore, 'companies', this.companyId, 'casoPlantillas', id)
    );
    this.plantillas.update(list => list.filter(p => p.id !== id));
  }
}
