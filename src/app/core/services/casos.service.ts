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
  where,
  orderBy,
  serverTimestamp,
  deleteField,
} from '@angular/fire/firestore';
import { CompanyService } from './company.service';
import { PlantillasService } from './plantillas.service';
import {
  Caso,
  CasoPlantilla,
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

  private get hitosRef() {
    return collection(this.firestore, 'companies', this.companyId, 'hitos');
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
      getDocs(query(this.hitosRef, where('casoId', '==', id), orderBy('orden'))),
    ]);
    if (!casoSnap.exists()) return null;
    const hitos = hitosSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Hito);
    return { id: casoSnap.id, ...casoSnap.data(), hitos } as Caso;
  }

  async createCaso(data: CasoCreate): Promise<string> {
    const companyId = this.companyId;
    let hitosToCreate: Omit<Hito, 'id' | 'casoId' | 'casoTitulo'>[] = [];
    let plantilla: Awaited<ReturnType<typeof this.plantillasService.getPlantilla>> = null;

    if (data.plantillaId) {
      plantilla = await this.plantillasService.getPlantilla(data.plantillaId);
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
      for (const h of hitosToCreate) {
        batch.set(doc(this.hitosRef), { ...h, casoId: ref.id, casoTitulo: data.titulo } as object);
      }
      await batch.commit();
    }

    if (data.plantillaId) {
      await Promise.all([
        this.copyPlantillaDocStructure(companyId, ref.id, data.plantillaId),
        plantilla ? this.copyModeloCostos(companyId, ref.id, plantilla) : Promise.resolve(),
      ]);
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
    const hitosSnap = await getDocs(query(this.hitosRef, where('casoId', '==', id)));
    const batch = writeBatch(this.firestore);
    hitosSnap.docs.forEach(d => batch.delete(d.ref));
    batch.delete(doc(this.firestore, 'companies', companyId, 'casos', id));
    await batch.commit();
    this.casos.update(list => list.filter(c => c.id !== id));
  }

  async addHito(casoId: string, casoTitulo: string, data: Omit<Hito, 'id' | 'casoId' | 'casoTitulo'>): Promise<Hito> {
    const hito: Omit<Hito, 'id'> = { casoId, casoTitulo, ...data };
    const ref = await addDoc(this.hitosRef, stripUndefined(hito) as object);
    return { id: ref.id, ...hito };
  }

  async updateHito(_casoId: string, hitoId: string, data: Partial<Omit<Hito, 'id'>>): Promise<void> {
    await updateDoc(doc(this.hitosRef, hitoId), stripUndefined(data) as object);
  }

  async deleteHito(_casoId: string, hitoId: string): Promise<void> {
    await deleteDoc(doc(this.hitosRef, hitoId));
  }

  async clearHitoSchedule(hitoId: string): Promise<void> {
    await updateDoc(doc(this.hitosRef, hitoId), {
      horaAgenda: deleteField(),
      duracionAgenda: deleteField(),
    });
  }

  async getHitosParaCalendario(): Promise<Hito[]> {
    const snap = await getDocs(query(this.hitosRef, orderBy('fechaEstimada')));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }) as Hito);
  }

  private async copyPlantillaDocStructure(companyId: string, casoId: string, plantillaId: string): Promise<void> {
    const [foldersSnap, filesSnap] = await Promise.all([
      getDocs(query(
        collection(this.firestore, 'plantilla_folders'),
        where('companyId', '==', companyId),
        where('plantillaId', '==', plantillaId)
      )),
      getDocs(query(
        collection(this.firestore, 'plantilla_files'),
        where('companyId', '==', companyId),
        where('plantillaId', '==', plantillaId)
      )),
    ]);

    if (foldersSnap.empty && filesSnap.empty) return;

    const docFoldersRef = collection(this.firestore, 'companies', companyId, 'casos', casoId, 'doc_folders');
    const docSlotsRef = collection(this.firestore, 'companies', companyId, 'casos', casoId, 'doc_slots');

    // Map plantillaFolderId → new casoFolderId to remap parentId references
    const folderIdMap = new Map<string, string>();
    const batch = writeBatch(this.firestore);

    for (const f of foldersSnap.docs) {
      const newRef = doc(docFoldersRef);
      folderIdMap.set(f.id, newRef.id);
      const data = f.data();
      batch.set(newRef, {
        name: data['name'],
        parentId: null, // fixed after second pass
        plantillaFolderId: f.id,
        createdAt: serverTimestamp(),
      });
    }

    // Second pass: fix parentIds now that all folder IDs are mapped
    for (const f of foldersSnap.docs) {
      const data = f.data();
      const parentId = data['parentId'];
      if (parentId && folderIdMap.has(parentId)) {
        const newFolderRef = doc(docFoldersRef, folderIdMap.get(f.id)!);
        batch.update(newFolderRef, { parentId: folderIdMap.get(parentId)! });
      }
    }

    for (const f of filesSnap.docs) {
      const data = f.data();
      const newFolderId = data['folderId'] ? (folderIdMap.get(data['folderId']) ?? null) : null;
      batch.set(doc(docSlotsRef), {
        folderId: newFolderId,
        name: data['name'],
        ...(data['description'] ? { description: data['description'] } : {}),
        status: 'pendiente',
        plantillaFileId: f.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
  }

  private async copyModeloCostos(companyId: string, casoId: string, plantilla: CasoPlantilla): Promise<void> {
    const { honorariosBase, suplidos } = plantilla.modeloCostos;
    if (!honorariosBase && suplidos.length === 0) return;

    const slotsRef = collection(this.firestore, 'companies', companyId, 'casos', casoId, 'gestoria_slots');
    const batch = writeBatch(this.firestore);

    let slotOrden = 0;

    if (honorariosBase) {
      batch.set(doc(slotsRef), {
        nombre: 'Honorarios base',
        tipoCosto: 'honorarios_base',
        importeEstimado: honorariosBase,
        status: 'pendiente',
        orden: slotOrden++,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    for (const s of suplidos) {
      batch.set(doc(slotsRef), {
        nombre: s.nombre,
        tipoCosto: s.tipo,
        ...(s.importeEstimado !== undefined ? { importeEstimado: s.importeEstimado } : {}),
        status: 'pendiente',
        orden: slotOrden++,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
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
