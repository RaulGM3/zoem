import { inject, Injectable } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import {
  Firestore,
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
  writeBatch,
} from '@angular/fire/firestore';
import { Storage, getDownloadURL, ref, uploadBytes } from '@angular/fire/storage';
import {
  COLECCIONES_SOLO_CREAR,
  agenteDemoId,
  construirSeedDemo,
  contarPorColeccion,
  pathsObsoletos,
  planDeEscritura,
  ultimaFacturaPorAnio,
  adaptarParaMiembro,
  esSembrableComoMiembro,
  type FacturaRecibidaSeed,
} from '../demo/seed-demo-civil';
import { CARPETAS, carpetaId, documentosDemo, type DocumentoDemo } from '../demo/documentos-demo-civil';
import { DocGenerationService } from './doc-generation.service';

export interface ProgresoSeed {
  paso: string;
  hechos: number;
  total: number;
}

export interface ResultadoSeed {
  porColeccion: Record<string, number>;
  documentos: number;
  omitidos: number;
  obsoletosBorrados: number;
  facturasRecibidasNuevas: number;
  archivosSubidos: number;
}

/** Firestore admite 500 operaciones por batch; dejamos margen. */
const TAMANIO_LOTE = 400;
const MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** Colecciones de la empresa donde se barren docs demo de cargas anteriores. */
const COLECCIONES_BARRIDO = [
  'cuentas', 'eventos', 'movimientos_generales', 'cierres_caja', 'retiros', 'actividad', 'hito_actividad',
] as const;

/**
 * Carga la empresa demo de abogado civil. Idempotente: ids deterministas.
 * - Superusuario (por defecto): las rules le dejan escribir todo, incluidas llamadas y agentMappings.
 * - `comoMiembro: true` (despacho de ejemplo del autoservicio): lo ejecuta el Admin del despacho,
 *   así que se omiten `llamadas`/`agentMappings` (solo superusuario/backend) y las acciones se firman
 *   a su nombre (ver `adaptarParaMiembro`). Recepción IA queda sin llamadas de ejemplo.
 */
@Injectable({ providedIn: 'root' })
export class DemoSeedService {
  private readonly firestore = inject(Firestore);
  private readonly storage = inject(Storage);
  private readonly auth = inject(Auth);
  private readonly docGeneration = inject(DocGenerationService);

  async cargar(
    companyId: string,
    opts: { documentos: boolean; comoMiembro?: boolean },
    onProgreso: (p: ProgresoSeed) => void = () => {},
  ): Promise<ResultadoSeed> {
    const uid = this.auth.currentUser?.uid;
    if (!uid) throw new Error('Sesión no iniciada');

    onProgreso({ paso: 'Leyendo la empresa', hechos: 0, total: 1 });
    const [empresaSnap, miembrosSnap, facturasSnap, agentesSnap] = await Promise.all([
      getDoc(doc(this.firestore, 'companies', companyId)),
      getDocs(query(collection(this.firestore, 'companies', companyId, 'members'), where('estado', '==', 'activo'))),
      getDocs(query(collection(this.firestore, 'invoices'), where('companyId', '==', companyId))),
      getDocs(query(collection(this.firestore, 'agentMappings'), where('companyId', '==', companyId))),
    ]);
    if (!empresaSnap.exists()) throw new Error(`No existe la empresa ${companyId}`);
    const miembros = miembrosSnap.docs.map((d) => {
      const m = d.data();
      return {
        uid: d.id,
        role: String(m['role'] ?? ''),
        nombre: [m['nombre'], m['apellido']].filter(Boolean).join(' ') || String(m['email'] ?? 'Miembro'),
      };
    });
    // Si la empresa ya tiene agente de Recepción IA, las llamadas demo se cuelgan de él.
    const agenteReal = agentesSnap.docs.find((d) => d.id !== agenteDemoId(companyId));
    const agente = agenteReal ? { agentId: agenteReal.id, crear: false } : { agentId: agenteDemoId(companyId), crear: true };

    const hoy = new Date();
    const seed = construirSeedDemo({
      companyId,
      miembros,
      hoy,
      agente,
      ultimaFacturaPorAnio: ultimaFacturaPorAnio(
        facturasSnap.docs.map((d) => ({ id: d.id, invoiceNumber: d.data()['invoiceNumber'] as string | undefined })),
        companyId,
      ),
    });

    const comoMiembro = opts.comoMiembro === true;
    if (comoMiembro) seed.docs = adaptarParaMiembro(seed.docs.filter(esSembrableComoMiembro), uid, serverTimestamp());

    onProgreso({ paso: 'Buscando datos demo de cargas anteriores', hechos: 0, total: 1 });
    const obsoletos = pathsObsoletos(await this.pathsDemoExistentes(companyId, agente.agentId, comoMiembro), seed.docs);

    const existentes = new Set<string>();
    // Como miembro, `acciones` exige conservar createdAt: un reintento no puede reescribirlas.
    const soloCrear: readonly string[] = comoMiembro ? [...COLECCIONES_SOLO_CREAR, 'acciones'] : COLECCIONES_SOLO_CREAR;
    for (const col of soloCrear) {
      const snap = await getDocs(collection(this.firestore, 'companies', companyId, col));
      snap.docs.forEach((d) => existentes.add(d.ref.path));
    }
    const { lotes, omitidos } = planDeEscritura(seed.docs, existentes, TAMANIO_LOTE);
    const docsCasos = opts.documentos ? documentosDemo(String(empresaSnap.data()['name'] ?? 'El despacho'), hoy) : [];

    const lotesBorrado = Math.ceil(obsoletos.length / TAMANIO_LOTE);
    const total = lotesBorrado + lotes.length + seed.facturasRecibidas.length + docsCasos.length;
    let hechos = 0;

    for (let i = 0; i < obsoletos.length; i += TAMANIO_LOTE) {
      onProgreso({ paso: 'Borrando datos demo obsoletos', hechos, total });
      const batch = writeBatch(this.firestore);
      for (const p of obsoletos.slice(i, i + TAMANIO_LOTE)) batch.delete(doc(this.firestore, p));
      await batch.commit();
      hechos++;
    }

    for (const lote of lotes) {
      onProgreso({ paso: 'Escribiendo datos', hechos, total });
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
    await this.anularRecibidasHuerfanas(companyId, uid, new Set(seed.facturasRecibidas.map((fr) => fr.id)));

    let archivosSubidos = 0;
    if (docsCasos.length) {
      await this.crearCarpetas(companyId, docsCasos);
      for (const d of docsCasos) {
        onProgreso({ paso: `Generando documento: ${d.nombre}`, hechos, total });
        if (await this.subirDocumento(companyId, uid, d)) archivosSubidos++;
        hechos++;
      }
    }
    onProgreso({ paso: 'Listo', hechos: total, total });

    return {
      porColeccion: contarPorColeccion(seed.docs),
      documentos: seed.docs.length,
      omitidos,
      obsoletosBorrados: obsoletos.length,
      facturasRecibidasNuevas,
      archivosSubidos,
    };
  }

  /** Paths de docs demo ya presentes en las colecciones que el seed gestiona por completo. */
  private async pathsDemoExistentes(companyId: string, agentId: string, comoMiembro: boolean): Promise<string[]> {
    const paths: string[] = [];
    const snaps = await Promise.all([
      ...COLECCIONES_BARRIDO.map((col) => getDocs(collection(this.firestore, 'companies', companyId, col))),
      // `llamadas` se lista por agentId: las rules solo lo permiten al superusuario (callMapped usa resource).
      ...(comoMiembro ? [] : [getDocs(query(collection(this.firestore, 'llamadas'), where('agentId', '==', agentId)))]),
      getDocs(query(collection(this.firestore, 'iaContacts'), where('companyId', '==', companyId))),
    ]);
    for (const snap of snaps) snap.docs.forEach((d) => paths.push(d.ref.path));
    // Extractos de las cuentas demo (también los de cuentas que ya no existen en el seed).
    const cuentasDemo = paths.filter((p) => /\/cuentas\/demo-[^/]+$/.test(p));
    const extractos = await Promise.all(cuentasDemo.map((p) => getDocs(collection(this.firestore, `${p}/extracto`))));
    for (const snap of extractos) snap.docs.forEach((d) => paths.push(d.ref.path));
    return paths;
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

  /**
   * Facturas recibidas demo de cargas anteriores cuyo movimiento ya no existe.
   * Las rules prohíben borrarlas: se anulan, como haría un usuario.
   */
  private async anularRecibidasHuerfanas(companyId: string, uid: string, vigentes: ReadonlySet<string>): Promise<void> {
    const snap = await getDocs(query(
      collection(this.firestore, 'companies', companyId, 'facturas_recibidas'),
      where('estado', '==', 'registrada'),
    ));
    const huerfanas = snap.docs.filter((d) =>
      !vigentes.has(d.id) && String(d.data()['movimientoId'] ?? '').startsWith('demo-mg-'));
    for (const d of huerfanas) {
      const batch = writeBatch(this.firestore);
      batch.update(d.ref, {
        estado: 'anulada', anuladaPor: uid, anuladaAt: serverTimestamp(), updatedBy: uid, updatedAt: serverTimestamp(),
      });
      await batch.commit();
    }
  }

  private async crearCarpetas(companyId: string, docs: DocumentoDemo[]): Promise<void> {
    const batch = writeBatch(this.firestore);
    const vistas = new Set<string>();
    for (const d of docs) {
      const key = `${d.casoId}/${d.carpeta}`;
      if (vistas.has(key)) continue;
      vistas.add(key);
      batch.set(doc(this.firestore, 'companies', companyId, 'casos', d.casoId, 'doc_folders', carpetaId(d.carpeta)), {
        parentId: null, name: CARPETAS[d.carpeta], deleted: false, createdAt: serverTimestamp(),
      });
    }
    await batch.commit();
  }

  /** Genera el .docx y lo sube como archivo libre del caso. Si ya existe, no lo duplica. */
  private async subirDocumento(companyId: string, uid: string, d: DocumentoDemo): Promise<boolean> {
    const fileRef = doc(this.firestore, 'companies', companyId, 'casos', d.casoId, 'doc_files', d.id);
    if ((await getDoc(fileRef)).exists()) return false;

    const blob = await this.docGeneration.generateDocxBlob(d.html, d.nombre);
    const folderId = carpetaId(d.carpeta);
    const storagePath = `companies/${companyId}/casos/${d.casoId}/docs/${folderId}/${d.id}.docx`;
    const storageRef = ref(this.storage, storagePath);
    await uploadBytes(storageRef, blob, { contentType: MIME_DOCX });
    const downloadUrl = await getDownloadURL(storageRef);

    const subidoEn = new Date();
    subidoEn.setDate(subidoEn.getDate() - d.hace);
    const meta = {
      name: d.nombre, storagePath, downloadUrl, mimeType: MIME_DOCX, sizeBytes: blob.size,
      uploadedBy: uid, uploadedByNombre: 'Despacho', uploadedAt: Timestamp.fromDate(subidoEn),
    };
    const batch = writeBatch(this.firestore);
    batch.set(fileRef, {
      folderId, ...meta, version: 1, versions: [{ ...meta, version: 1 }],
      deleted: false, clasificado: false, allowedUserIds: [], createdAt: Timestamp.fromDate(subidoEn),
    });
    await batch.commit();
    return true;
  }
}
