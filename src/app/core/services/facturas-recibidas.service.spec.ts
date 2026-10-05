import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Firestore } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Storage } from '@angular/fire/storage';
import {
  FacturaAnuladaExistenteError,
  FacturaDuplicadaError,
  FacturasRecibidasService,
  type DatosNuevaFactura,
} from './facturas-recibidas.service';
import { CompanyService } from './company.service';
import { claveFactura } from '../facturas-recibidas/clave-factura';

const { store, getDocsMock, uploadBytesMock } = vi.hoisted(() => ({
  store: new Map<string, Record<string, unknown>>(),
  getDocsMock: vi.fn(),
  uploadBytesMock: vi.fn(),
}));

interface FakeRef {
  path: string;
}

vi.mock('@angular/fire/firestore', () => ({
  Firestore: class MockFirestore {},
  serverTimestamp: () => '__serverTimestamp__',
  collection: (_fs: unknown, ...segs: string[]) => ({ path: segs.join('/') }),
  doc: (_fs: unknown, ...segs: string[]) => ({ path: segs.join('/') }),
  query: (...args: unknown[]) => ({ query: args }),
  where: (...args: unknown[]) => ({ where: args }),
  getDocs: (...args: unknown[]) => getDocsMock(...args),
  getDoc: async (ref: FakeRef) => ({
    exists: () => store.has(ref.path),
    data: () => store.get(ref.path),
  }),
  updateDoc: async (ref: FakeRef, data: Record<string, unknown>) => {
    store.set(ref.path, { ...store.get(ref.path), ...data });
  },
  runTransaction: async (_fs: unknown, fn: (tx: unknown) => Promise<unknown>) => {
    const writes: Array<() => void> = [];
    const tx = {
      get: async (ref: FakeRef) => ({ exists: () => store.has(ref.path), data: () => store.get(ref.path) }),
      set: (ref: FakeRef, data: Record<string, unknown>) => writes.push(() => store.set(ref.path, data)),
      update: (ref: FakeRef, data: Record<string, unknown>) =>
        writes.push(() => store.set(ref.path, { ...store.get(ref.path), ...data })),
    };
    const result = await fn(tx);
    writes.forEach((w) => w());
    return result;
  },
}));

vi.mock('@angular/fire/storage', () => ({
  Storage: class MockStorage {},
  ref: (_s: unknown, path: string) => ({ fullPath: path }),
  uploadBytes: (...args: unknown[]) => uploadBytesMock(...args),
}));

const CID = 'co-1';
const base = (): DatosNuevaFactura => ({
  tipoFactura: 'F1',
  proveedor: { nombre: 'Proveedor SL', nif: 'b-12345674' },
  numero: ' f-001 ',
  fechaExpedicion: '2026-04-02',
  fechaRegistro: '2026-04-05',
  periodo303: { ejercicio: 2026, trimestre: 2 },
  lineasIva: [{ base: 100, tipo: 21, cuota: 21 }],
  total: 121,
  porcentajeDeducible: 100,
  concepto: 'Material',
  extraccion: { origen: 'manual', discrepancias: [] },
});

const idFactura = (nif = 'B12345674', numero = 'F-001') => claveFactura(nif, numero);
const pathFactura = (id = idFactura()) => `companies/${CID}/facturas_recibidas/${id}`;

describe('FacturasRecibidasService', () => {
  let svc: FacturasRecibidasService;

  beforeEach(() => {
    store.clear();
    getDocsMock.mockReset();
    uploadBytesMock.mockReset();
    uploadBytesMock.mockResolvedValue({});
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        FacturasRecibidasService,
        { provide: Firestore, useValue: {} },
        { provide: Storage, useValue: {} },
        { provide: Auth, useValue: { currentUser: { uid: 'u1' } } },
        { provide: CompanyService, useValue: { activeCompany: signal({ id: CID, name: 'X' }) } },
      ],
    });
    svc = TestBed.inject(FacturasRecibidasService);
  });

  describe('registrar (creación)', () => {
    it('crea con id determinista, campos de auditoría y qrValidacion sin_qr (contrato de rules)', async () => {
      const r = await svc.registrar(base());
      expect(r).toEqual({ id: idFactura(), numeroRecepcion: 1, reactivada: false });
      const doc = store.get(pathFactura())!;
      expect(doc).toMatchObject({
        id: idFactura(),
        companyId: CID,
        numeroRecepcion: 1,
        claveOperacion: '01',
        tipoFactura: 'F1',
        estado: 'registrada',
        createdBy: 'u1',
        createdAt: '__serverTimestamp__',
        qrValidacion: { estado: 'sin_qr' },
        proveedor: { nombre: 'Proveedor SL', nif: 'B12345674' },
        numero: 'f-001',
      });
      for (const prohibida of ['anuladaPor', 'anuladaAt', 'updatedBy', 'updatedAt']) {
        expect(doc).not.toHaveProperty(prohibida);
      }
    });

    it('con QR el estado inicial es pendiente', async () => {
      const qr = { url: 'https://x', nif: 'B12345674', numserie: 'F-001', fecha: '02-04-2026', importe: 121 };
      await svc.registrar({ ...base(), qr });
      expect(store.get(pathFactura())!['qrValidacion']).toEqual({ estado: 'pendiente' });
      expect(store.get(pathFactura())!['qr']).toEqual(qr);
    });

    it('no escribe claves undefined ni fuera de la whitelist de rules', async () => {
      await svc.registrar({ ...base(), categoria: undefined });
      const doc = store.get(pathFactura())!;
      expect(Object.values(doc)).not.toContain(undefined);
      const permitidas = [
        'id', 'companyId', 'numeroRecepcion', 'tipoFactura', 'claveOperacion', 'proveedor', 'numero',
        'fechaExpedicion', 'fechaOperacion', 'fechaRegistro', 'periodo303', 'lineasIva', 'total',
        'porcentajeDeducible', 'concepto', 'categoria', 'adjunto', 'qr', 'qrValidacion', 'extraccion',
        'movimientoId', 'casoId', 'estado', 'anuladaPor', 'anuladaAt', 'createdBy', 'createdAt', 'updatedBy',
        'updatedAt',
      ];
      expect(Object.keys(doc).filter((k) => !permitidas.includes(k))).toEqual([]);
    });

    it('el número de recepción es correlativo por ejercicio y reinicia en otro', async () => {
      await svc.registrar(base());
      const r2 = await svc.registrar({ ...base(), numero: 'F-002' });
      expect(r2.numeroRecepcion).toBe(2);
      expect(store.get(`companies/${CID}/facturas_recibidas_meta/2026`)).toEqual({ ultimo: 2 });
      const r3 = await svc.registrar({ ...base(), numero: 'F-003', periodo303: { ejercicio: 2027, trimestre: 1 } });
      expect(r3.numeroRecepcion).toBe(1);
      expect(store.get(`companies/${CID}/facturas_recibidas_meta/2027`)).toEqual({ ultimo: 1 });
    });

    it('rechaza un duplicado (mismo NIF + número) y no escribe nada', async () => {
      await svc.registrar(base());
      const antes = new Map(store);
      await expect(svc.registrar({ ...base(), numero: 'F-001', proveedor: { nombre: 'Otro', nif: 'B12345674' } }))
        .rejects.toBeInstanceOf(FacturaDuplicadaError);
      expect(store).toEqual(antes);
    });

    it('el NIF y el número se normalizan para detectar el duplicado', async () => {
      await svc.registrar(base());
      await expect(svc.registrar({ ...base(), numero: 'F-001', proveedor: { nombre: 'P', nif: ' b 12345674 ' } }))
        .rejects.toBeInstanceOf(FacturaDuplicadaError);
    });
  });

  describe('registrar sobre una factura anulada', () => {
    beforeEach(async () => {
      await svc.registrar(base());
      await svc.anular(idFactura());
    });

    it('sin confirmación explícita lanza FacturaAnuladaExistenteError y no escribe', async () => {
      const antes = new Map(store);
      await expect(svc.registrar(base())).rejects.toBeInstanceOf(FacturaAnuladaExistenteError);
      expect(store).toEqual(antes);
    });

    it('reactivar conserva historial, número de recepción y contador; actualiza datos editables', async () => {
      const nuevo = { ...base(), concepto: 'Corregido', total: 242, lineasIva: [{ base: 200, tipo: 21, cuota: 42 }] };
      const r = await svc.registrar(nuevo, { reactivar: true });
      expect(r).toEqual({ id: idFactura(), numeroRecepcion: 1, reactivada: true });
      const doc = store.get(pathFactura())!;
      expect(doc).toMatchObject({
        estado: 'registrada',
        concepto: 'Corregido',
        total: 242,
        anuladaPor: 'u1',
        anuladaAt: '__serverTimestamp__',
        updatedBy: 'u1',
        updatedAt: '__serverTimestamp__',
        createdBy: 'u1',
        numeroRecepcion: 1,
        qrValidacion: { estado: 'sin_qr' },
      });
      expect(store.get(`companies/${CID}/facturas_recibidas_meta/2026`)).toEqual({ ultimo: 1 });
    });

    it('reactivar no toca claves inmutables (proveedor, numero, qrValidacion)', async () => {
      const antes = store.get(pathFactura())!;
      await svc.registrar({ ...base(), proveedor: { nombre: 'Nombre nuevo', nif: 'B12345674' } }, { reactivar: true });
      const doc = store.get(pathFactura())!;
      expect(doc['proveedor']).toEqual(antes['proveedor']);
      expect(doc['numero']).toBe(antes['numero']);
    });
  });

  describe('anular', () => {
    it('marca anulada con anuladaPor/anuladaAt y updatedBy/updatedAt', async () => {
      await svc.registrar(base());
      await svc.anular(idFactura());
      expect(store.get(pathFactura())).toMatchObject({
        estado: 'anulada',
        anuladaPor: 'u1',
        anuladaAt: '__serverTimestamp__',
        updatedBy: 'u1',
        updatedAt: '__serverTimestamp__',
      });
    });
  });

  describe('estadoExistente', () => {
    it('devuelve null, registrada o anulada', async () => {
      expect(await svc.estadoExistente('B12345674', 'F-001')).toBeNull();
      await svc.registrar(base());
      expect(await svc.estadoExistente('b12345674', ' f-001')).toBe('registrada');
      await svc.anular(idFactura());
      expect(await svc.estadoExistente('B12345674', 'F-001')).toBe('anulada');
    });
  });

  describe('cargar', () => {
    it('consulta por ejercicio y publica la lista ordenada por número de recepción descendente', async () => {
      getDocsMock.mockResolvedValue({
        docs: [
          { id: 'a', data: () => ({ numeroRecepcion: 1 }) },
          { id: 'b', data: () => ({ numeroRecepcion: 3 }) },
        ],
      });
      await svc.cargar(2026);
      expect(svc.facturas().map((f) => f.id)).toEqual(['b', 'a']);
      expect(svc.cargando()).toBe(false);
    });
  });

  describe('actualizar', () => {
    it('escribe solo los cambios más updatedBy/updatedAt', async () => {
      await svc.registrar(base());
      await svc.actualizar(idFactura(), { concepto: 'Nuevo', porcentajeDeducible: 50 });
      expect(store.get(pathFactura())).toMatchObject({
        concepto: 'Nuevo',
        porcentajeDeducible: 50,
        updatedBy: 'u1',
        updatedAt: '__serverTimestamp__',
      });
    });
  });

  describe('registrar con archivo adjunto', () => {
    const pdf = () => new File([new Uint8Array(20)], 'Factura 1 (copia).pdf', { type: 'application/pdf' });

    it('sube el archivo bajo companies/{cid}/facturas_recibidas/ y guarda el adjunto en el doc', async () => {
      await svc.registrar(base(), { archivo: pdf() });
      expect(uploadBytesMock).toHaveBeenCalledTimes(1);
      const [refArg, fileArg, meta] = uploadBytesMock.mock.calls[0] as [{ fullPath: string }, File, { contentType: string }];
      expect(refArg.fullPath).toMatch(new RegExp(`^companies/${CID}/facturas_recibidas/\\d+_Factura_1__copia_.pdf$`));
      expect(fileArg.name).toBe('Factura 1 (copia).pdf');
      expect(meta).toEqual({ contentType: 'application/pdf' });
      expect(store.get(pathFactura())!['adjunto']).toEqual({
        storagePath: refArg.fullPath,
        nombre: 'Factura 1 (copia).pdf',
        mimeType: 'application/pdf',
        size: 20,
      });
    });

    it('un duplicado se detecta ANTES de subir: no se sube nada', async () => {
      await svc.registrar(base());
      await expect(svc.registrar(base(), { archivo: pdf() })).rejects.toBeInstanceOf(FacturaDuplicadaError);
      expect(uploadBytesMock).not.toHaveBeenCalled();
    });

    it('una anulada sin confirmar reactivación no sube nada; confirmada sí y actualiza el adjunto', async () => {
      await svc.registrar(base());
      await svc.anular(idFactura());
      await expect(svc.registrar(base(), { archivo: pdf() })).rejects.toBeInstanceOf(FacturaAnuladaExistenteError);
      expect(uploadBytesMock).not.toHaveBeenCalled();
      await svc.registrar(base(), { archivo: pdf(), reactivar: true });
      expect(uploadBytesMock).toHaveBeenCalledTimes(1);
      expect((store.get(pathFactura())!['adjunto'] as { nombre: string }).nombre).toBe('Factura 1 (copia).pdf');
    });

    it('si falla la subida no se escribe nada en Firestore', async () => {
      uploadBytesMock.mockRejectedValue(new Error('storage/unauthorized'));
      await expect(svc.registrar(base(), { archivo: pdf() })).rejects.toThrow('storage/unauthorized');
      expect(store.size).toBe(0);
    });

    it('sin archivo no toca Storage', async () => {
      await svc.registrar(base());
      expect(uploadBytesMock).not.toHaveBeenCalled();
    });
  });
});
