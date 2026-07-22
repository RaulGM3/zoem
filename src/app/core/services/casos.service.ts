import { inject, Injectable, signal } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  setDoc,
  writeBatch,
  query,
  where,
  orderBy,
  serverTimestamp,
  deleteField,
  increment,
} from '@angular/fire/firestore';
import type { Observable } from 'rxjs';
import { Auth } from '@angular/fire/auth';
import { CompanyService } from './company.service';
import { PlantillasService } from './plantillas.service';
import { ActividadService } from './actividad.service';
import { stripUndefinedDeep } from '../firebase/sanitize';
import {
  Caso,
  CasoPlantilla,
  CompanyMember,
  GestoriaSlot,
  Hito,
  HitoActividad,
  HitoActividadTipo,
  HitoEstado,
  MovimientoGestoria,
  RegistroHoraHito,
  RESUMEN_FINANCIERO_VACIO,
  ResumenFinanciero,
} from '../../interfaces';

type CasoCreate = Omit<Caso, 'id' | 'companyId' | 'hitos' | 'resumenFinanciero' | 'createdAt' | 'updatedAt'> & {
  plantillaId?: string;
};

/** Datos para registrar una acción en el feed de actividad de un hito. */
export type ActividadInput = {
  hitoTitulo: string;
  tipo: HitoActividadTipo;
  autorId?: string;
  estadoAnterior?: HitoEstado;
  estadoNuevo?: HitoEstado;
};

@Injectable({ providedIn: 'root' })
export class CasosService {
  private readonly firestore = inject(Firestore);
  private readonly companyService = inject(CompanyService);
  private readonly plantillasService = inject(PlantillasService);
  private readonly auth = inject(Auth);
  private readonly actividad = inject(ActividadService);

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

  private get actividadRef() {
    return collection(this.firestore, 'companies', this.companyId, 'hito_actividad');
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
    const caso = { id: casoSnap.id, ...casoSnap.data(), hitos } as Caso;

    // Auto-sanación: los casos creados antes de que existiera `hitosResumen`
    // (denormalizado) no lo tienen nunca, salvo que un hito vuelva a mutarse.
    // Se recalcula una sola vez, de forma perezosa, cada vez que se abre el
    // detalle de un caso así — no en `loadCasos()`, que dispararía N recálculos
    // en cada carga de la lista.
    if (caso.hitosResumen === undefined) {
      await this.recalcularHitosResumen(id);
      const total = hitos.length;
      const completados = hitos.filter(h => h.estado === 'completado').length;
      caso.hitosResumen = { total, completados };
    }

    return caso;
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
      ...stripUndefinedDeep(data),
      companyId,
      resumenFinanciero: { ...RESUMEN_FINANCIERO_VACIO },
      // Todos los hitos de plantilla nacen 'pendiente': completados siempre 0 aquí.
      hitosResumen: { total: hitosToCreate.length, completados: 0 },
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
    await this.actividad.log('Casos', `Creó el caso "${data.titulo}"`, ref.id);
    return ref.id;
  }

  async updateCaso(id: string, data: Partial<Pick<Caso, 'titulo' | 'descripcion' | 'tipo' | 'estado' | 'prioridad' | 'contactoIds' | 'vencimiento'>>): Promise<void> {
    const prev = this.casos().find(c => c.id === id);
    await updateDoc(doc(this.firestore, 'companies', this.companyId, 'casos', id), {
      ...stripUndefinedDeep(data),
      updatedAt: serverTimestamp(),
    });
    this.casos.update(list =>
      list.map(c => (c.id === id ? { ...c, ...data } : c))
    );
    const titulo = data.titulo ?? prev?.titulo ?? '';
    const accion = data.estado && data.estado !== prev?.estado
      ? `Cambió el estado del caso "${titulo}" a ${data.estado}`
      : `Actualizó el caso "${titulo}"`;
    await this.actividad.log('Casos', accion, id);
  }

  async deleteCaso(id: string): Promise<void> {
    const companyId = this.companyId;
    const titulo = this.casos().find(c => c.id === id)?.titulo ?? '';
    const hitosSnap = await getDocs(query(this.hitosRef, where('casoId', '==', id)));
    const batch = writeBatch(this.firestore);
    hitosSnap.docs.forEach(d => batch.delete(d.ref));
    batch.delete(doc(this.firestore, 'companies', companyId, 'casos', id));
    await batch.commit();
    this.casos.update(list => list.filter(c => c.id !== id));
    await this.actividad.log('Casos', `Eliminó el caso "${titulo}"`, id);
  }

  /** Construye el documento de un evento de actividad listo para el batch. */
  private buildActividad(casoId: string, hitoId: string, input: ActividadInput): object {
    return stripUndefinedDeep({
      casoId,
      hitoId,
      hitoTitulo: input.hitoTitulo,
      tipo: input.tipo,
      autorId: input.autorId,
      estadoAnterior: input.estadoAnterior,
      estadoNuevo: input.estadoNuevo,
      createdAt: serverTimestamp(),
    });
  }

  async addHito(casoId: string, casoTitulo: string, data: Omit<Hito, 'id' | 'casoId' | 'casoTitulo'>, autorId?: string): Promise<Hito> {
    const hito: Omit<Hito, 'id'> = { casoId, casoTitulo, ...data };
    const batch = writeBatch(this.firestore);
    const hitoRef = doc(this.hitosRef);
    batch.set(hitoRef, stripUndefinedDeep(hito) as object);
    batch.set(doc(this.actividadRef), this.buildActividad(casoId, hitoRef.id, {
      hitoTitulo: data.titulo,
      tipo: 'creado',
      autorId,
    }));
    await batch.commit();
    await this.recalcularHitosResumen(casoId);
    return { id: hitoRef.id, ...hito };
  }

  /**
   * Actualiza un hito y, si se pasa `actividad`, registra el evento en el feed
   * dentro del mismo batch. `actividad` es opcional para no acoplar a los
   * consumidores que sólo mueven el hito (p.ej. el calendario al agendar).
   */
  async updateHito(casoId: string, hitoId: string, data: Partial<Omit<Hito, 'id'>>, actividad?: ActividadInput): Promise<void> {
    const batch = writeBatch(this.firestore);
    batch.update(doc(this.hitosRef, hitoId), stripUndefinedDeep(data) as object);
    if (actividad) {
      batch.set(doc(this.actividadRef), this.buildActividad(casoId, hitoId, actividad));
    }
    await batch.commit();
    // El estado es lo único que afecta al resumen denormalizado; evitamos el
    // recálculo (lectura extra de la subcolección) para el resto de ediciones.
    if (data.estado !== undefined) {
      await this.recalcularHitosResumen(casoId);
    }
  }

  async deleteHito(casoId: string, hitoId: string, info?: { hitoTitulo: string; autorId?: string }): Promise<void> {
    const batch = writeBatch(this.firestore);
    batch.delete(doc(this.hitosRef, hitoId));
    if (info) {
      batch.set(doc(this.actividadRef), this.buildActividad(casoId, hitoId, {
        hitoTitulo: info.hitoTitulo,
        tipo: 'eliminado',
        autorId: info.autorId,
      }));
    }
    await batch.commit();
    await this.recalcularHitosResumen(casoId);
  }

  /**
   * Denormaliza el conteo de hitos (total/completados) en el documento del caso,
   * igual que `recalcularResumen` hace con `gestoriaResumenSlots`. La lista de
   * casos (`loadCasos`) no trae la subcolección de hitos, así que sin este
   * campo `casos-table` siempre mostraría "—" para el progreso de hitos.
   */
  async recalcularHitosResumen(casoId: string): Promise<void> {
    const companyId = this.companyId;
    const hitosSnap = await getDocs(query(this.hitosRef, where('casoId', '==', casoId)));
    const total = hitosSnap.size;
    const completados = hitosSnap.docs.filter(d => (d.data() as Hito).estado === 'completado').length;
    const hitosResumen = { total, completados };

    await updateDoc(doc(this.firestore, 'companies', companyId, 'casos', casoId), {
      hitosResumen,
      updatedAt: serverTimestamp(),
    });

    this.casos.update(list =>
      list.map(c => (c.id === casoId ? { ...c, hitosResumen } : c))
    );
  }

  async loadAllHitos(): Promise<Hito[]> {
    const snapshot = await getDocs(this.hitosRef);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as Hito);
  }

  async clearHitoSchedule(hitoId: string): Promise<void> {
    await updateDoc(doc(this.hitosRef, hitoId), {
      horaAgenda: deleteField(),
      duracionAgenda: deleteField(),
    });
  }

  /**
   * Reemplaza el array de registros de horas de un hito (cobro por horas).
   * El editor del calendario gestiona el array en cliente y persiste el set
   * completo, evitando carreras de splice sobre el documento.
   */
  async setRegistrosHoras(hitoId: string, registros: RegistroHoraHito[]): Promise<void> {
    // Los segmentos son la única fuente de la presencia del hito en el grid.
    // Migramos los campos legacy de agenda para que no resuciten un segmento
    // sintetizado tras borrar todos (ver hitoToItem en calendario.ts).
    await updateDoc(doc(this.hitosRef, hitoId), {
      registrosHoras: registros,
      horaAgenda: deleteField(),
      duracionAgenda: deleteField(),
    });
  }

  /**
   * Convierte las horas declaradas (no facturadas) de un hito en movimientos de
   * gestoría tipo `honorario`, agrupando por miembro y aplicando su `tarifaHoraria`.
   * El importe queda congelado en el movimiento (snapshot de tarifa). Marca cada
   * registro como `facturado` enlazando su `movimientoId`. Los miembros sin tarifa
   * (o tarifa 0) se omiten. Recalcula el resumen al final.
   *
   * Escribe el movimiento directamente (sin GestoriaService) para evitar la
   * dependencia circular: GestoriaService ya inyecta CasosService.
   */
  async facturarHorasHito(casoId: string, hito: Hito, members: CompanyMember[]): Promise<{ facturados: number; omitidos: number }> {
    const registros = hito.registrosHoras ?? [];
    const pendientes = registros.filter(r => !r.facturado);
    if (pendientes.length === 0) return { facturados: 0, omitidos: 0 };

    const porUsuario = new Map<string, RegistroHoraHito[]>();
    for (const r of pendientes) {
      const arr = porUsuario.get(r.userId) ?? [];
      arr.push(r);
      porUsuario.set(r.userId, arr);
    }

    const companyId = this.companyId;
    const gestoriaRef = collection(this.firestore, 'companies', companyId, 'casos', casoId, 'gestoria');
    const createdBy = this.auth.currentUser?.uid ?? '';
    const fecha = new Date().toISOString().slice(0, 10);

    const registrosActualizados = [...registros];
    let facturados = 0;
    let omitidos = 0;

    for (const [userId, regs] of porUsuario) {
      const member = members.find(m => m.userId === userId);
      const tarifa = member?.tarifaHoraria;
      if (!tarifa || tarifa <= 0) { omitidos += regs.length; continue; }

      const minutos = regs.reduce((s, r) => s + r.minutos, 0);
      const horas = Math.round((minutos / 60) * 100) / 100;
      const importe = Math.round(horas * tarifa * 100) / 100;
      const nombre = member?.nombre ?? 'Miembro';

      const movRef = await addDoc(gestoriaRef, {
        tipo: 'honorario',
        concepto: `Horas ${nombre} (${horas}h × ${tarifa}€) — ${hito.titulo}`,
        importe,
        esEntrada: false,
        fecha,
        casoId,
        companyId,
        createdBy,
        createdAt: serverTimestamp(),
      });

      for (const r of regs) {
        const idx = registrosActualizados.findIndex(u => u.id === r.id);
        if (idx >= 0) registrosActualizados[idx] = { ...registrosActualizados[idx], facturado: true, movimientoId: movRef.id };
      }
      facturados++;
    }

    await updateDoc(doc(this.hitosRef, hito.id), { registrosHoras: registrosActualizados });
    await this.recalcularResumen(casoId);
    return { facturados, omitidos };
  }

  /**
   * Stream real-time de los hitos de la empresa para el calendario. Emite ante
   * cada cambio (estado, agenda, fecha) para que la vista no dependa de recargar.
   * Nota: `orderBy('fechaEstimada')` excluye hitos sin esa fecha — el calendario
   * los filtra de todos modos.
   */
  hitosParaCalendarioStream(): Observable<Hito[]> {
    const q = query(this.hitosRef, orderBy('fechaEstimada'));
    return collectionData(q, { idField: 'id' }) as Observable<Hito[]>;
  }

  /**
   * Stream real-time de los hitos de UN caso, ordenados por `orden`. Reemplaza
   * el `getDocs` de disparo único: la vista de detalle reacciona en vivo a
   * cualquier cambio (propio o de otro usuario) sin sincronizar a mano.
   */
  hitosStream(casoId: string): Observable<Hito[]> {
    const q = query(this.hitosRef, where('casoId', '==', casoId), orderBy('orden'));
    return collectionData(q, { idField: 'id' }) as Observable<Hito[]>;
  }

  /**
   * Stream real-time del feed de actividad de un caso (lo más reciente primero):
   * quién creó, editó, cambió de estado o eliminó cada hito.
   */
  actividadStream(casoId: string): Observable<HitoActividad[]> {
    const q = query(this.actividadRef, where('casoId', '==', casoId), orderBy('createdAt', 'desc'));
    return collectionData(q, { idField: 'id' }) as Observable<HitoActividad[]>;
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
        // Hereda el vínculo a la plantilla de documento: este slot se rellenará
        // y congelará en vez de subirse a mano.
        ...(data['docTemplateId'] ? { docTemplateId: data['docTemplateId'] } : {}),
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
        ivaIncluido: false,
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
        ...(s.ivaIncluido !== undefined ? { ivaIncluido: s.ivaIncluido } : {}),
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
    const slotsRef = collection(this.firestore, 'companies', companyId, 'casos', casoId, 'gestoria_slots');
    const [movSnap, slotsSnap] = await Promise.all([getDocs(gestoriaRef), getDocs(slotsRef)]);
    const movimientos = movSnap.docs.map(d => d.data() as MovimientoGestoria);

    const resumen: ResumenFinanciero = { ...RESUMEN_FINANCIERO_VACIO };
    for (const m of movimientos) {
      // Movimientos legacy sin desglose fiscal: cuota 0 (base = importe).
      const cuota = m.cuotaIva ?? 0;
      if (m.esEntrada) {
        // Honorarios cobrados al cliente van a totalHonorarios, no a totalIngresos,
        // para que la línea de factura sea unívoca y no se duplique el importe.
        if (m.tipo === 'honorario') {
          resumen.totalHonorarios += m.importe;
        } else {
          resumen.totalIngresos += m.importe;
        }
        resumen.ivaRepercutido += cuota;
      } else {
        resumen.totalEgresos += m.importe;
        resumen.ivaSoportado += cuota;
        if (m.tipo === 'suplido') resumen.totalSuplidos += m.importe;
        else if (m.tipo === 'honorario') resumen.totalHonorariosSalida += m.importe;
      }
    }
    resumen.saldo = resumen.totalIngresos + resumen.totalHonorarios - resumen.totalEgresos;

    // Denormalizamos el conteo de slots para que facturación evalúe "ejecutado"
    // leyendo sólo el doc del caso, sin abrir la subcolección por cada render.
    const gestoriaResumenSlots = {
      total: slotsSnap.size,
      registrados: slotsSnap.docs.filter(d => (d.data() as GestoriaSlot).status === 'registrado').length,
    };

    await updateDoc(doc(this.firestore, 'companies', companyId, 'casos', casoId), {
      resumenFinanciero: resumen,
      gestoriaResumenSlots,
      updatedAt: serverTimestamp(),
    });

    this.casos.update(list =>
      list.map(c => (c.id === casoId ? { ...c, resumenFinanciero: resumen, gestoriaResumenSlots } : c))
    );
  }

  /** Marca el caso como facturado, enlazando la factura generada (auditoría). */
  async marcarFacturado(casoId: string, facturaId: string): Promise<void> {
    const facturadoAt = new Date().toISOString();
    await updateDoc(doc(this.firestore, 'companies', this.companyId, 'casos', casoId), {
      facturaId,
      facturadoAt,
      updatedAt: serverTimestamp(),
    });
    this.casos.update(list =>
      list.map(c => (c.id === casoId ? { ...c, facturaId, facturadoAt } : c))
    );
  }

  /**
   * Confirma el cierre financiero de un caso: lo marca como `cerrado` y guarda el
   * snapshot del saldo bancario corroborado y la fecha de confirmación (auditoría).
   */
  async confirmarCierre(casoId: string, opts: { saldoBancario?: number }): Promise<void> {
    const companyId = this.companyId;
    const cierreConfirmadoAt = new Date().toISOString();
    const patch = stripUndefinedDeep({
      estado: 'cerrado' as const,
      cierreConfirmadoAt,
      cierreSaldoBancario: opts.saldoBancario,
    });
    await updateDoc(doc(this.firestore, 'companies', companyId, 'casos', casoId), {
      ...patch,
      updatedAt: serverTimestamp(),
    });

    // Acumular resumen financiero del caso cerrado en el documento histórico de tesorería
    const caso = this.casos().find(c => c.id === casoId);
    if (caso) {
      const rf = caso.resumenFinanciero;
      const resumenRef = doc(this.firestore, 'companies', companyId, 'tesoreria_meta', 'resumen');
      await setDoc(resumenRef, {
        totalIngresosCerrados: increment(rf.totalIngresos),
        totalSuplidosCerrados: increment(rf.totalSuplidos),
        totalHonorariosCerrados: increment(rf.totalHonorarios),
        totalEgresosCerrados: increment(rf.totalEgresos),
        saldoCerrados: increment(rf.saldo),
        casosCount: increment(1),
        ultimaActualizacion: serverTimestamp(),
      }, { merge: true });
    }

    this.casos.update(list =>
      list.map(c => (c.id === casoId ? { ...c, ...patch } as Caso : c))
    );
  }
}
