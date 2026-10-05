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
import { CompanyService } from './company.service';
import { stripUndefinedDeep } from '../firebase/sanitize';
import { claveFactura } from '../facturas-recibidas/clave-factura';
import { normalizarNif } from '../fiscal/nif';
import type {
  EstadoFacturaRecibida,
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
}

export interface OpcionesRegistro {
  /** El usuario confirmó volver a registrar una factura anulada (decisión 7: reactivación). */
  reactivar?: boolean;
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

/**
 * Registro de facturas recibidas (IVA soportado). Respeta el contrato de `firestore.rules`:
 * create con createdBy/createdAt(serverTimestamp)/qrValidacion inicial y sin campos de update o anulación;
 * update con updatedBy/updatedAt; anular con anuladaPor/anuladaAt.
 */
@Injectable({ providedIn: 'root' })
export class FacturasRecibidasService {
  private readonly firestore = inject(Firestore);
  private readonly auth = inject(Auth);
  private readonly companyService = inject(CompanyService);

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

    return runTransaction(this.firestore, async (tx) => {
      const [existente, meta] = await Promise.all([tx.get(facturaRef), tx.get(metaRef)]);

      if (existente.exists()) {
        const actual = existente.data() as FacturaRecibida;
        if (actual.estado === 'registrada') throw new FacturaDuplicadaError(id);
        if (!opciones.reactivar) throw new FacturaAnuladaExistenteError(id);
        tx.update(
          facturaRef,
          stripUndefinedDeep({
            ...this.camposEditables(datos),
            estado: 'registrada',
            updatedBy: uid,
            updatedAt: serverTimestamp(),
          }),
        );
        return { id, numeroRecepcion: actual.numeroRecepcion, reactivada: true };
      }

      const ultimo = meta.exists() ? (meta.data() as FacturasRecibidasMeta).ultimo : 0;
      const numeroRecepcion = ultimo + 1;
      tx.set(metaRef, { ultimo: numeroRecepcion });
      tx.set(
        facturaRef,
        stripUndefinedDeep({
          ...this.camposEditables(datos),
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
      return { id, numeroRecepcion, reactivada: false };
    });
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
