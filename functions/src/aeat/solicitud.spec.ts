import { describe, it, expect } from 'vitest';
import { HttpsError } from 'firebase-functions/v2/https';
import { manejarSolicitud, validarEntrada } from './solicitud';
import type { EnvioDeps } from './submit';
import { FakeChainStore, FakeClock, FakeSender, credencialesFalsas } from './testing/fakes';
import { respuestaCorrecto } from './testing/respuestas';
import type { CompanyDoc, InvoiceDoc } from './types';

const T0 = Date.parse('2026-03-15T10:20:30Z');

function factura(over: Partial<InvoiceDoc> = {}): InvoiceDoc {
  return {
    id: 'inv1',
    companyId: 'co1',
    invoiceNumber: 'F-001',
    total: 121,
    issueDate: '2026-03-15',
    clienteNombre: 'Cliente SL',
    clienteNif: 'B12345674',
    lineas: [{ concepto: 'Honorarios', cantidad: 1, precioUnitario: 100, base: 100, aplicaIva: true, ivaRate: 0.21 }],
    ivaRate: 0.21,
    tipoFactura: 'F1',
    ...over,
  };
}

function empresa(over: Partial<CompanyDoc> = {}): CompanyDoc {
  return { name: 'Despacho SL', cif: 'B76543210', ca: 'madrid', verifactu: { enabled: true, sandbox: true }, ...over };
}

function montar(empresaDoc: CompanyDoc = empresa()) {
  const store = new FakeChainStore();
  store.sembrarEmpresa('co1', empresaDoc);
  store.sembrarEmpresa('co2', empresa());
  store.sembrarFactura(factura());
  store.sembrarFactura(factura({ id: 'ajena', companyId: 'co2' }));
  const sender = new FakeSender(respuestaCorrecto);
  const deps: EnvioDeps = {
    store,
    docs: store,
    sender: sender.enviar,
    credentials: async () => credencialesFalsas,
    clock: new FakeClock(T0).ahora,
  };
  const autorizadas: string[] = [];
  const autorizar = async (uid: string, companyId: string) => {
    autorizadas.push(`${uid}:${companyId}`);
    if (uid !== 'user-co1' || companyId !== 'co1') throw new HttpsError('permission-denied', 'No autorizado para esta empresa');
  };
  return { store, sender, deps, autorizar, autorizadas };
}

async function codigoDe(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    if (e instanceof HttpsError) return e.code;
    throw e;
  }
  return 'no-lanzó';
}

describe('validarEntrada (R8.1)', () => {
  it('acepta {companyId, invoiceId, tipo} y devuelve solo esos tres campos', () => {
    expect(validarEntrada({ companyId: 'co1', invoiceId: 'inv1', tipo: 'anulacion', endpoint: 'http://x', sandbox: false })).toEqual({
      companyId: 'co1',
      invoiceId: 'inv1',
      tipo: 'anulacion',
    });
  });

  it.each([
    ['null', null],
    ['sin companyId', { invoiceId: 'a', tipo: 'alta' }],
    ['sin invoiceId', { companyId: 'a', tipo: 'alta' }],
    ['companyId vacío', { companyId: '', invoiceId: 'a', tipo: 'alta' }],
    ['companyId no string', { companyId: 5, invoiceId: 'a', tipo: 'alta' }],
    ['S8.5 tipo foo', { companyId: 'a', invoiceId: 'b', tipo: 'foo' }],
    ['tipo legacy baja', { companyId: 'a', invoiceId: 'b', tipo: 'baja' }],
    ['sin tipo', { companyId: 'a', invoiceId: 'b' }],
    ['forma antigua con registro', { companyId: 'a', registro: {} }],
  ])('invalid-argument: %s', (_n, data) => {
    expect(() => validarEntrada(data)).toThrowError(HttpsError);
    try {
      validarEntrada(data);
    } catch (e) {
      expect((e as HttpsError).code).toBe('invalid-argument');
    }
  });
});

describe('manejarSolicitud: autenticación y tenant (R8.2, R8.3)', () => {
  it('S8.1 sin auth: unauthenticated y no se autoriza ni se envía nada', async () => {
    const m = montar();
    expect(await codigoDe(manejarSolicitud(m.deps, m.autorizar, undefined, { companyId: 'co1', invoiceId: 'inv1', tipo: 'alta' }))).toBe('unauthenticated');
    expect(m.autorizadas).toEqual([]);
    expect(m.sender.llamadas).toHaveLength(0);
  });

  it('S8.2 usuario de otra empresa: permission-denied sin llamada a AEAT ni cambios en la cadena', async () => {
    const m = montar();
    expect(await codigoDe(manejarSolicitud(m.deps, m.autorizar, 'user-co2', { companyId: 'co1', invoiceId: 'inv1', tipo: 'alta' }))).toBe('permission-denied');
    expect(m.autorizadas).toEqual(['user-co2:co1']);
    expect(m.sender.llamadas).toHaveLength(0);
    expect(m.store.head('co1')).toBeNull();
    expect(m.store.factura('co1', 'inv1')?.verifactu).toBeUndefined();
  });

  it('S8.3 factura de otra empresa: not-found, sin AEAT y sin tocar ninguna cadena', async () => {
    const m = montar();
    expect(await codigoDe(manejarSolicitud(m.deps, m.autorizar, 'user-co1', { companyId: 'co1', invoiceId: 'ajena', tipo: 'alta' }))).toBe('not-found');
    expect(m.sender.llamadas).toHaveLength(0);
    expect(m.store.head('co1')).toBeNull();
    expect(m.store.head('co2')).toBeNull();
    expect(m.store.factura('co2', 'ajena')?.verifactu).toBeUndefined();
  });

  it('factura inexistente: not-found', async () => {
    const m = montar();
    expect(await codigoDe(manejarSolicitud(m.deps, m.autorizar, 'user-co1', { companyId: 'co1', invoiceId: 'nope', tipo: 'alta' }))).toBe('not-found');
  });

  it('entrada inválida: invalid-argument (antes de tocar nada)', async () => {
    const m = montar();
    expect(await codigoDe(manejarSolicitud(m.deps, m.autorizar, 'user-co1', { companyId: 'co1', invoiceId: 'inv1', tipo: 'foo' }))).toBe('invalid-argument');
    expect(m.sender.llamadas).toHaveLength(0);
  });
});

describe('manejarSolicitud: caso autorizado', () => {
  it('envía y devuelve el resultado; el endpoint sale de la empresa, no del input (S5.2)', async () => {
    const m = montar();
    const r = await manejarSolicitud(m.deps, m.autorizar, 'user-co1', {
      companyId: 'co1',
      invoiceId: 'inv1',
      tipo: 'alta',
      endpoint: 'http://evil.example',
      sandbox: false,
    });
    expect(r).toMatchObject({ sent: true, estado: 'enviado' });
    expect(m.sender.llamadas).toHaveLength(1);
    expect(m.sender.llamadas[0]?.url).toBe('https://prewww1.aeat.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP');
  });

  it('empresa con sandbox=false usa producción aunque el input diga sandbox:true', async () => {
    const m = montar(empresa({ verifactu: { enabled: true, sandbox: false } }));
    await manejarSolicitud(m.deps, m.autorizar, 'user-co1', { companyId: 'co1', invoiceId: 'inv1', tipo: 'alta', sandbox: true });
    expect(m.sender.llamadas[0]?.url).toContain('www1.agenciatributaria.gob.es');
  });

  it('S8.4 verifactu desactivado: resuelve sent:false sin llamar a AEAT', async () => {
    const m = montar(empresa({ verifactu: { enabled: false, sandbox: true } }));
    const r = await manejarSolicitud(m.deps, m.autorizar, 'user-co1', { companyId: 'co1', invoiceId: 'inv1', tipo: 'alta' });
    expect(r).toEqual({ sent: false, motivo: 'verifactu_desactivado' });
    expect(m.sender.llamadas).toHaveLength(0);
  });
});
