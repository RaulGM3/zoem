import { inject, Injectable } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import {
  Firestore,
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
  writeBatch,
} from '@angular/fire/firestore';
import {
  COLECCIONES_SOLO_CREAR,
  construirSeedDemo,
  contarPorColeccion,
  planDeEscritura,
  ultimaFacturaPorAnio,
  type FacturaRecibidaSeed,
} from '../demo/seed-demo-civil';

export interface ProgresoSeed {
  paso: string;
  hechos: number;
  total: number;
}

export interface ResultadoSeed {
  porColeccion: Record<string, number>;
  documentos: number;
  omitidos: number;
  facturasRecibidasNuevas: number;
}

/** Firestore admite 500 operaciones por batch; dejamos margen. */
const TAMANIO_LOTE = 400;

/**
 * Carga la empresa demo de abogado civil (solo superusuario: las rules dejan a
 * `isSuper()` escribir en cualquier empresa). Idempotente: ids deterministas.
 */
@Injectable({ providedIn: 'root' })
export class DemoSeedService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(Auth);

  async cargar(companyId: string, onProgreso: (p: ProgresoSeed) => void = () => {}): Promise<ResultadoSeed> {
    const uid = this.auth.currentUser?.uid;
    if (!uid) throw new Error('Sesión no iniciada');

    onProgreso({ paso: 'Leyendo miembros y facturas existentes', hechos: 0, total: 1 });
    const [miembrosSnap, facturasSnap] = await Promise.all([
      getDocs(query(collection(this.firestore, 'companies', companyId, 'members'), where('estado', '==', 'activo'))),
      getDocs(query(collection(this.firestore, 'invoices'), where('companyId', '==', companyId))),
    ]);
    const miembros = miembrosSnap.docs.map((d) => {
      const m = d.data();
      return {
        uid: d.id,
        role: String(m['role'] ?? ''),
        nombre: [m['nombre'], m['apellido']].filter(Boolean).join(' ') || String(m['email'] ?? 'Miembro'),
      };
    });

    const seed = construirSeedDemo({
      companyId,
      miembros,
      hoy: new Date(),
      ultimaFacturaPorAnio: ultimaFacturaPorAnio(
        facturasSnap.docs.map((d) => ({ id: d.id, invoiceNumber: d.data()['invoiceNumber'] as string | undefined })),
        companyId,
      ),
    });

    const existentes = new Set<string>();
    for (const col of COLECCIONES_SOLO_CREAR) {
      const snap = await getDocs(collection(this.firestore, 'companies', companyId, col));
      snap.docs.forEach((d) => existentes.add(d.ref.path));
    }
    const { lotes, omitidos } = planDeEscritura(seed.docs, existentes, TAMANIO_LOTE);

    const total = lotes.length + seed.facturasRecibidas.length;
    let hechos = 0;
    for (const lote of lotes) {
      onProgreso({ paso: 'Escribiendo documentos', hechos, total });
      const batch = writeBatch(this.firestore);
      for (const { path, data } of lote) batch.set(doc(this.firestore, path), data);
      await batch.commit();
      hechos++;
    }

    let facturasRecibidasNuevas = 0;
    for (const fr of seed.facturasRecibidas) {
      onProgreso({ paso: 'Registrando facturas recibidas', hechos, total });
      if (await this.crearFacturaRecibida(companyId, uid, fr)) facturasRecibidasNuevas++;
      hechos++;
    }
    onProgreso({ paso: 'Listo', hechos: total, total });

    return {
      porColeccion: contarPorColeccion(seed.docs),
      documentos: seed.docs.length,
      omitidos,
      facturasRecibidasNuevas,
    };
  }

  /**
   * Igual que el registro manual: transacción con el contador correlativo del
   * ejercicio (las rules solo lo dejan crear con 1 y subir de 1 en 1). Si la
   * factura ya existe no se toca (su update exige otro flujo).
   */
  private crearFacturaRecibida(companyId: string, uid: string, fr: FacturaRecibidaSeed): Promise<boolean> {
    const frRef = doc(this.firestore, 'companies', companyId, 'facturas_recibidas', fr.id);
    const metaRef = doc(this.firestore, 'companies', companyId, 'facturas_recibidas_meta', String(fr.ejercicio));
    return runTransaction(this.firestore, async (tx) => {
      if ((await tx.get(frRef)).exists()) return false;
      const meta = await tx.get(metaRef);
      const numeroRecepcion = meta.exists() ? Number(meta.data()['ultimo']) + 1 : 1;
      tx.set(metaRef, { ultimo: numeroRecepcion });
      tx.set(frRef, { ...fr.data, numeroRecepcion, createdBy: uid, createdAt: serverTimestamp() });
      return true;
    });
  }
}
