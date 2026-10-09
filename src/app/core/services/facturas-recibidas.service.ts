import { inject, Injectable, signal } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Storage, ref, uploadBytes } from '@angular/fire/storage';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { AlmacenamientoCupoService } from '../planes/almacenamiento-cupo.service';
import { CompanyService } from './company.service';
import { stripUndefinedDeep } from '../firebase/sanitize';
import { claveFactura } from '../facturas-recibidas/clave-factura';
import { normalizarNif } from '../fiscal/nif';
import { movimientoDesdeFactura } from '../facturas-recibidas/tesoreria-link';
import type {
  EstadoFacturaRecibida,
  EstadoQr,
  FacturaRecibida,
  FacturasRecibidasMeta,
} from '../../interfaces/factura-recibida.interface';

/** Datos que aporta el usuario (o la extracción) al registrar. El resto lo fija el servicio. */
export type DatosNuevaFactura = Pick<
  FacturaRecibida,
  | 'tipoFactura'
  | 'proveedor'
  | 'numero'
  | 'fechaExpedicion'
  | 'fechaRegistro'
  | 'periodo303'
  | 'lineasIva'
  | 'total'
  | 'porcentajeDeducible'
  | 'concepto'
  | 'extraccion'
> &
  Partial<Pick<FacturaRecibida, 'fechaOperacion' | 'categoria' | 'adjunto' | 'qr' | 'casoId' | 'movimientoId'>>;

/** Campos editables de una factura ya registrada (los inmutables los bloquean las rules). */
export type CambiosFactura = Partial<
  Pick<
    FacturaRecibida,
    | 'tipoFactura'
    | 'fechaExpedicion'
    | 'fechaOperacion'
    | 'fechaRegistro'
    | 'periodo303'
    | 'lineasIva'
    | 'total'
    | 'porcentajeDeducible'
    | 'concepto'
    | 'categoria'
    | 'adjunto'
    | 'qr'
    | 'extraccion'
    | 'casoId'
    | 'movimientoId'
  >
>;

export interface ResultadoRegistro {
  id: string;
  numeroRecepcion: number;
  reactivada: boolean;
  /** Movimiento de tesorería creado o vinculado, si el usuario eligió uno. */
  movimientoId?: string;
}

/** Vínculo con tesorería elegido al confirmar: crear un gasto nuevo o enlazar uno existente. */
export type VinculoMovimiento = { modo: 'crear' } | { modo: 'vincular'; id: string; casoId?: string };

export interface OpcionesRegistro {
  /** El usuario confirmó volver a registrar una factura anulada (decisión 7: reactivación). */
  reactivar?: boolean;
  /** Archivo de la factura (PDF o imagen ya validado): se sube a Storage al confirmar, nunca antes. */
  archivo?: File;
  /** Gasto de tesorería a crear o vincular; se escribe en la misma transacción que la factura. */
  movimiento?: VinculoMovimiento;
}

/** Respuesta del callable `validarQrFacturaRecibida` (el servidor la persiste además en `qrValidacion`). */
export interface ResultadoValidarQr {
  estado: Exclude<EstadoQr, 'sin_qr' | 'pendiente'>;
  urlConsulta: string;
  mensaje?: string;
}

/** Ya existe una factura registrada con el mismo NIF de emisor y número en esta empresa. */
export class FacturaDuplicadaError extends Error {
  constructor(readonly id: string) {
    super('Ya existe una factura registrada con ese NIF de emisor y ese número.');
    this.name = 'FacturaDuplicadaError';
  }
}

/** Existe una factura ANULADA con la misma clave: hay que confirmar la reactivación. */
export class FacturaAnuladaExistenteError extends Error {
  constructor(readonly id: string) {
    super('Esa factura ya estuvo registrada y está anulada. Confirma si quieres reactivarla con los datos nuevos.');
    this.name = 'FacturaAnuladaExistenteError';
  }
}

/** El movimiento a vincular no existe (borrado o de otra empresa). */
export class MovimientoNoEncontradoError extends Error {
  constructor() {
    super('El movimiento de tesorería elegido ya no existe.');
    this.name = 'MovimientoNoEncontradoError';
  }
}

/** El movimiento a vincular ya pertenece a otra factura recibida. */
export class MovimientoYaVinculadoError extends Error {
  constructor() {
    super('Ese movimiento de tesorería ya está vinculado a otra factura.');
    this.name = 'MovimientoYaVinculadoError';
  }
}

/**
 * Registro de facturas recibidas (IVA soportado). Respeta el contrato de `firestore.rules`:
 * create con createdBy/createdAt(serverTimestamp)/qrValidacion inicial y sin campos de update o anulación;
 * update con updatedBy/updatedAt; anular con anuladaPor/anuladaAt.
 */
@Injectable({ providedIn: 'root' })
export class FacturasRecibidasService {
  private readonly firestore = inject(Firestore);
  private readonly storage = inject(Storage);
  private readonly auth = inject(Auth);
  private readonly functions = inject(Functions);
  private readonly companyService = inject(CompanyService);
  private readonly cupoAlmacenamiento = inject(AlmacenamientoCupoService);

  readonly facturas = signal<FacturaRecibida[]>([]);
  readonly cargando = signal(false);

  private get companyId(): string {
    const id = this.companyService.activeCompany()?.id;
    if (!id) throw new Error('No active company');
    return id;
  }

  private get uid(): string {
    const uid = this.auth.currentUser?.uid;
    if (!uid) throw new Error('No authenticated user');
    return uid;
  }

  private facturaRef(id: string) {
    return doc(this.firestore, `companies/${this.companyId}/facturas_recibidas/${id}`);
  }

  private movimientoRef(v: { id: string; casoId?: string }) {
    const ruta = v.casoId
      ? `companies/${this.companyId}/casos/${v.casoId}/gestoria/${v.id}`
      : `companies/${this.companyId}/movimientos_generales/${v.id}`;
    return doc(this.firestore, ruta);
  }

  private metaRef(ejercicio: number) {
    return doc(this.firestore, `companies/${this.companyId}/facturas_recibidas_meta/${ejercicio}`);
  }

  /** Carga las facturas de un ejercicio (todas las del libro, también anuladas), de la más reciente a la más antigua. */
  async cargar(ejercicio: number): Promise<void> {
    this.cargando.set(true);
    try {
      const snap = await getDocs(
        query(
          collection(this.firestore, `companies/${this.companyId}/facturas_recibidas`),
          where('periodo303.ejercicio', '==', ejercicio),
        ),
      );
      const lista = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as FacturaRecibida);
      lista.sort((a, b) => b.numeroRecepcion - a.numeroRecepcion);
      this.facturas.set(lista);
    } finally {
      this.cargando.set(false);
    }
  }

  /** Estado de la factura con esa clave (NIF + número) o `null` si no existe. */
  async estadoExistente(nif: string, numero: string): Promise<EstadoFacturaRecibida | null> {
    const snap = await getDoc(this.facturaRef(claveFactura(nif, numero)));
    if (!snap.exists()) return null;
    return (snap.data() as FacturaRecibida).estado;
  }

  /**
   * Registra la factura en una transacción: comprueba la unicidad por id determinista, incrementa el
   * contador de recepción del ejercicio y crea el documento. Una anulada se reactiva (sin tocar claves
   * inmutables ni el contador) solo si `reactivar` es `true`.
   */
  async registrar(datos: DatosNuevaFactura, opciones: OpcionesRegistro = {}): Promise<ResultadoRegistro> {
    const nif = normalizarNif(datos.proveedor.nif);
    const numero = datos.numero.trim();
    const id = claveFactura(nif, numero);
    const uid = this.uid;
    const facturaRef = this.facturaRef(id);
    const metaRef = this.metaRef(datos.periodo303.ejercicio);

    if (opciones.archivo) {
      // Pre-chequeo (design #9): un duplicado no debe dejar un blob huérfano en Storage. Si otra pestaña
      // gana la carrera entre este chequeo y la transacción, el blob queda huérfano (aceptado: sin delete de cliente).
      const estado = await this.estadoExistente(nif, numero);
      if (estado === 'registrada') throw new FacturaDuplicadaError(id);
      if (estado === 'anulada' && !opciones.reactivar) throw new FacturaAnuladaExistenteError(id);
      datos = { ...datos, adjunto: await this.subirAdjunto(opciones.archivo) };
    }

    const vinculo = opciones.movimiento;
    // El id del gasto nuevo se fija fuera de la transacción: un reintento no debe crear otro distinto.
    const movNuevoRef =
      vinculo?.modo === 'crear'
        ? doc(collection(this.firestore, `companies/${this.companyId}/movimientos_generales`))
        : null;
    const movExistenteRef = vinculo?.modo === 'vincular' ? this.movimientoRef(vinculo) : null;

    return runTransaction(this.firestore, async (tx) => {
      // Todas las lecturas antes de cualquier escritura.
      const [existente, meta, movExistente] = await Promise.all([
        tx.get(facturaRef),
        tx.get(metaRef),
        movExistenteRef ? tx.get(movExistenteRef) : null,
      ]);

      if (existente.exists()) {
        const actual = existente.data() as FacturaRecibida;
        if (actual.estado === 'registrada') throw new FacturaDuplicadaError(id);
        if (!opciones.reactivar) throw new FacturaAnuladaExistenteError(id);
      }

      // Validación y escritura del movimiento (si lo hay): si algo falla aquí no se escribe nada.
      let enlace: { movimientoId: string; casoId?: string } | null = null;
      if (movNuevoRef) {
        tx.set(
          movNuevoRef,
          stripUndefinedDeep({
            ...movimientoDesdeFactura({ ...datos, numero }, id),
            companyId: this.companyId,
            createdBy: uid,
            createdAt: serverTimestamp(),
          }),
        );
        enlace = { movimientoId: movNuevoRef.id };
      } else if (movExistenteRef && vinculo?.modo === 'vincular') {
        if (!movExistente?.exists()) throw new MovimientoNoEncontradoError();
        if ((movExistente.data() as { facturaRecibidaId?: string }).facturaRecibidaId) {
          throw new MovimientoYaVinculadoError();
        }
        tx.update(movExistenteRef, { facturaRecibidaId: id, updatedBy: uid, updatedAt: serverTimestamp() });
        enlace = { movimientoId: vinculo.id, ...(vinculo.casoId ? { casoId: vinculo.casoId } : {}) };
      }
      const camposEnlace = enlace ?? {};

      if (existente.exists()) {
        const actual = existente.data() as FacturaRecibida;
        tx.update(
          facturaRef,
          stripUndefinedDeep({
            ...this.camposEditables(datos),
            ...camposEnlace,
            // Los datos nuevos pueden traer otro QR/adjunto: la validación anterior ya no vale (rules: solo se
            // permite reiniciarla a sin_qr|pendiente al reactivar; el resultado real lo escribe el servidor).
            qrValidacion: { estado: datos.qr ? 'pendiente' : 'sin_qr' },
            estado: 'registrada',
            updatedBy: uid,
            updatedAt: serverTimestamp(),
          }),
        );
        return { id, numeroRecepcion: actual.numeroRecepcion, reactivada: true, ...(enlace ? { movimientoId: enlace.movimientoId } : {}) };
      }

      const ultimo = meta.exists() ? (meta.data() as FacturasRecibidasMeta).ultimo : 0;
      const numeroRecepcion = ultimo + 1;
      tx.set(metaRef, { ultimo: numeroRecepcion });
      tx.set(
        facturaRef,
        stripUndefinedDeep({
          ...this.camposEditables(datos),
          ...camposEnlace,
          id,
          companyId: this.companyId,
          numeroRecepcion,
          claveOperacion: '01',
          proveedor: { ...datos.proveedor, nif },
          numero,
          qrValidacion: { estado: datos.qr ? 'pendiente' : 'sin_qr' },
          estado: 'registrada',
          createdBy: uid,
          createdAt: serverTimestamp(),
        }),
      );
      return { id, numeroRecepcion, reactivada: false, ...(enlace ? { movimientoId: enlace.movimientoId } : {}) };
    });
  }

  /** Sube el archivo a `companies/{cid}/facturas_recibidas/` (la ruta que exigen las rules de Firestore y Storage). */
  private async subirAdjunto(archivo: File): Promise<NonNullable<FacturaRecibida['adjunto']>> {
    // El adjunto es un documento de la empresa: consume cupo (si no cabe, ni se sube y se abre el modal de mejora).
    this.cupoAlmacenamiento.asegurar(archivo.size);
    const nombreSeguro = archivo.name.replace(/[^A-Za-z0-9._-]/g, '_');
    const storagePath = `companies/${this.companyId}/facturas_recibidas/${Date.now()}_${nombreSeguro}`;
    await uploadBytes(ref(this.storage, storagePath), archivo, { contentType: archivo.type });
    return { storagePath, nombre: archivo.name, mimeType: archivo.type, size: archivo.size };
  }

  /** Campos mutables de una factura (excluye proveedor, número, recepción, qrValidacion: inmutables en rules). */
  private camposEditables(d: DatosNuevaFactura): CambiosFactura {
    return {
      tipoFactura: d.tipoFactura,
      fechaExpedicion: d.fechaExpedicion,
      fechaOperacion: d.fechaOperacion,
      fechaRegistro: d.fechaRegistro,
      periodo303: d.periodo303,
      lineasIva: d.lineasIva,
      total: d.total,
      porcentajeDeducible: d.porcentajeDeducible,
      concepto: d.concepto,
      categoria: d.categoria,
      adjunto: d.adjunto,
      qr: d.qr,
      extraccion: d.extraccion,
      casoId: d.casoId,
      movimientoId: d.movimientoId,
    };
  }

  /**
   * Pide al servidor que consulte ValidarQR de la AEAT con el QR guardado de la factura. El servidor es dueño de
   * `qrValidacion` (las rules lo prohíben al cliente): aquí solo se llama y se devuelve el resultado.
   * Idempotente: reintentar es volver a llamar. Los `HttpsError` se propagan.
   */
  async validarQr(facturaId: string): Promise<ResultadoValidarQr> {
    const fn = httpsCallable<{ companyId: string; facturaId: string }, ResultadoValidarQr>(
      this.functions,
      'validarQrFacturaRecibida',
    );
    const r = await fn({ companyId: this.companyId, facturaId });
    return r.data;
  }

  async actualizar(id: string, cambios: CambiosFactura): Promise<void> {
    await updateDoc(
      this.facturaRef(id),
      stripUndefinedDeep({ ...cambios, updatedBy: this.uid, updatedAt: serverTimestamp() }),
    );
  }

  /** Anula (no se borra: las rules prohíben delete). Queda constancia de quién y cuándo. */
  async anular(id: string): Promise<void> {
    await updateDoc(this.facturaRef(id), {
      estado: 'anulada',
      anuladaPor: this.uid,
      anuladaAt: serverTimestamp(),
      updatedBy: this.uid,
      updatedAt: serverTimestamp(),
    });
  }
}
