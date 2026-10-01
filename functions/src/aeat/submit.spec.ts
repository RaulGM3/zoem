import { describe, it, expect } from 'vitest';
import { drenarEmpresa, procesarEnvio } from './submit';
import type { EnvioDeps } from './submit';
import { endpointDe } from './submit';
import { FakeChainStore, FakeClock, FakeSender, credencialesFalsas } from './testing/fakes';
import {
  respuestaCorrecto,
  respuestaDuplicado,
  respuestaFault4104,
  respuestaHttp500Html,
  respuestaIncorrecto,
  respuestaXml,
} from './testing/respuestas';
import type { ChainHead, CompanyDoc, InvoiceDoc } from './types';

const T0 = Date.parse('2026-03-15T10:20:30Z');
const CO = 'co1';

function factura(id: string, over: Partial<InvoiceDoc> = {}): InvoiceDoc {
  return {
    id,
    companyId: CO,
    invoiceNumber: `F-${id}`,
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

interface Entorno {
  store: FakeChainStore;
  sender: FakeSender;
  clock: FakeClock;
  deps: EnvioDeps;
}

function montar(opciones: { empresa?: CompanyDoc; facturas?: InvoiceDoc[]; sinCertificado?: boolean } = {}): Entorno {
  const store = new FakeChainStore();
  store.sembrarEmpresa(CO, opciones.empresa ?? empresa());
  for (const f of opciones.facturas ?? [factura('inv1')]) store.sembrarFactura(f);
  const sender = new FakeSender();
  const clock = new FakeClock(T0);
  const deps: EnvioDeps = {
    store,
    docs: store,
    sender: sender.enviar,
    credentials: async () => {
      if (opciones.sinCertificado) throw new Error('secret no encontrado');
      return credencialesFalsas;
    },
    clock: clock.ahora,
  };
  return { store, sender, clock, deps };
}

const alta = (invoiceId: string) => ({ companyId: CO, invoiceId, tipo: 'alta' as const });

function headDe(e: Entorno): ChainHead {
  const h = e.store.head(CO);
  if (!h) throw new Error('se esperaba una cabecera');
  return h;
}

describe('endpointDe', () => {
  it('sandbox por defecto salvo que la empresa diga explícitamente false', () => {
    expect(endpointDe(empresa())).toContain('prewww1.aeat.es');
    expect(endpointDe(empresa({ verifactu: { enabled: true, sandbox: false } }))).toContain('www1.agenciatributaria.gob.es');
    expect(endpointDe({ ...empresa(), verifactu: { enabled: true } as CompanyDoc['verifactu'] })).toContain('prewww1.aeat.es');
  });
});

describe('procesarEnvio: precondiciones y desactivado (4.2)', () => {
  it('S8.4 verifactu desactivado: no se envía, no se toca la cadena ni la factura', async () => {
    const e = montar({ empresa: empresa({ verifactu: { enabled: false, sandbox: true } }) });
    const r = await procesarEnvio(e.deps, alta('inv1'));
    expect(r).toEqual({ sent: false, motivo: 'verifactu_desactivado' });
    expect(e.sender.llamadas).toHaveLength(0);
    expect(e.store.head(CO)).toBeNull();
    expect(e.store.factura(CO, 'inv1')?.verifactu).toBeUndefined();
  });

  it('verifactu ausente en la empresa equivale a desactivado', async () => {
    const { verifactu: _v, ...sinVerifactu } = empresa();
    const e = montar({ empresa: sinVerifactu });
    expect(await procesarEnvio(e.deps, alta('inv1'))).toEqual({ sent: false, motivo: 'verifactu_desactivado' });
    expect(e.sender.llamadas).toHaveLength(0);
  });

  it('S3.4 cliente sin NIF: error de precondición con mensaje de NIF; sender y cabecera intactos', async () => {
    const e = montar({ facturas: [factura('inv1', { clienteNif: '' })] });
    const r = await procesarEnvio(e.deps, alta('inv1'));
    expect(r).toMatchObject({ sent: false, motivo: 'precondicion', codigo: 'NIF_CLIENTE', estado: 'error' });
    expect(e.sender.llamadas).toHaveLength(0);
    expect(e.store.head(CO)).toBeNull();
    const v = e.store.factura(CO, 'inv1')?.verifactu;
    expect(v?.estado).toBe('error');
    expect(v?.errorKind).toBe('precondicion');
    expect(v?.errorMessage).toContain('NIF');
  });

  it('S3.5 línea exenta sin causa: el mensaje nombra la causa y no se envía', async () => {
    const lineas = [{ concepto: 'Cuota', cantidad: 1, precioUnitario: 50, base: 50, aplicaIva: false }];
    const e = montar({ facturas: [factura('inv1', { lineas })] });
    const r = await procesarEnvio(e.deps, alta('inv1'));
    expect(r).toMatchObject({ sent: false, motivo: 'precondicion', codigo: 'CAUSA_EXENCION' });
    expect(e.sender.llamadas).toHaveLength(0);
    expect(e.store.factura(CO, 'inv1')?.verifactu?.errorMessage).toContain('causa');
  });

  it('S3.7 Canarias: no soportado, la cabecera existente queda idéntica', async () => {
    const e = montar({ empresa: empresa({ ca: 'canarias' }) });
    const previa: ChainHead = { last: null, pending: null, queue: [], nextSendAt: null, drainAt: null };
    e.store.sembrarHead(CO, previa);
    const r = await procesarEnvio(e.deps, alta('inv1'));
    expect(r).toMatchObject({ sent: false, motivo: 'precondicion', codigo: 'IMPUESTO_NO_SOPORTADO' });
    expect(e.store.head(CO)).toEqual(previa);
    expect(e.sender.llamadas).toHaveLength(0);
  });

  it('S3.3 R1 sin original: error, no se envía', async () => {
    const e = montar({ facturas: [factura('inv1', { tipoFactura: 'R1', facturaRectificadaId: 'noexiste' })] });
    const r = await procesarEnvio(e.deps, alta('inv1'));
    expect(r).toMatchObject({ sent: false, motivo: 'precondicion', codigo: 'R1_SIN_ORIGINAL' });
    expect(e.sender.llamadas).toHaveLength(0);
  });

  it('R1 con original de la misma empresa: se envía el registro', async () => {
    const e = montar({ facturas: [factura('orig'), factura('inv1', { tipoFactura: 'R1', facturaRectificadaId: 'orig' })] });
    e.sender.encolar(respuestaCorrecto);
    const r = await procesarEnvio(e.deps, alta('inv1'));
    expect(r).toMatchObject({ sent: true, estado: 'enviado' });
    expect(e.sender.llamadas[0]?.xml).toContain('R1');
  });

  it('anulación: el fallo de precondición se anota dentro de `anulacion`, no en el alta', async () => {
    const { cif: _c, ...sinCif } = empresa();
    const e = montar({
      empresa: sinCif,
      facturas: [factura('inv1', { verifactu: { estado: 'enviado', tipoRegistro: 'alta', csv: 'C' } })],
    });
    const r = await procesarEnvio(e.deps, { companyId: CO, invoiceId: 'inv1', tipo: 'anulacion' });
    expect(r).toMatchObject({ sent: false, motivo: 'precondicion', codigo: 'NIF_EMISOR' });
    const v = e.store.factura(CO, 'inv1')?.verifactu;
    expect(v?.estado).toBe('enviado');
    expect(v?.anulacion?.estado).toBe('error');
  });

  it('sin certificado: error de configuración, nada se envía ni se reserva', async () => {
    const e = montar({ sinCertificado: true });
    const r = await procesarEnvio(e.deps, alta('inv1'));
    expect(r).toMatchObject({ sent: false, motivo: 'certificado', estado: 'error' });
    expect(e.sender.llamadas).toHaveLength(0);
    expect(e.store.head(CO)).toBeNull();
    expect(e.store.factura(CO, 'inv1')?.verifactu).toMatchObject({ estado: 'error', errorKind: 'configuracion' });
  });

  it('factura inexistente: factura_no_encontrada sin tocar nada', async () => {
    const e = montar();
    expect(await procesarEnvio(e.deps, alta('nope'))).toEqual({ sent: false, motivo: 'factura_no_encontrada' });
    expect(e.store.head(CO)).toBeNull();
  });
});

describe('procesarEnvio: camino feliz y concurrencia (4.3)', () => {
  it('S7.1 happy path: envía el XML reservado al endpoint sandbox con las credenciales y queda enviado con CSV', async () => {
    const e = montar();
    e.sender.encolar(respuestaCorrecto);
    const r = await procesarEnvio(e.deps, alta('inv1'));
    expect(r).toMatchObject({ sent: true, estado: 'enviado' });
    expect(e.sender.llamadas).toHaveLength(1);
    const llamada = e.sender.llamadas[0]!;
    expect(llamada.url).toBe('https://prewww1.aeat.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP');
    expect(llamada.creds).toEqual(credencialesFalsas);
    expect(llamada.xml).toContain('<sf:PrimerRegistro>S</sf:PrimerRegistro>');
    const h = headDe(e);
    expect(h.pending).toBeNull();
    expect(h.last?.numSerie).toBe('F-inv1');
    const v = e.store.factura(CO, 'inv1')?.verifactu;
    expect(v).toMatchObject({ estado: 'enviado', csv: 'A-ABCD1234EFGH5678', aceptadoConErrores: false });
    expect(v?.huella).toBe(h.last?.huella);
  });

  it('empresa con sandbox=false envía al endpoint de producción', async () => {
    const e = montar({ empresa: empresa({ verifactu: { enabled: true, sandbox: false } }) });
    e.sender.encolar(respuestaCorrecto);
    await procesarEnvio(e.deps, alta('inv1'));
    expect(e.sender.llamadas[0]?.url).toBe('https://www1.agenciatributaria.gob.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP');
  });

  it('S7.6 dos envíos paralelos: exactamente uno reserva y envía, el otro queda en_cola', async () => {
    const e = montar({ facturas: [factura('inv1'), factura('inv2')] });
    e.sender.encolar(respuestaCorrecto, respuestaCorrecto);
    const [a, b] = await Promise.all([procesarEnvio(e.deps, alta('inv1')), procesarEnvio(e.deps, alta('inv2'))]);
    expect(e.sender.llamadas).toHaveLength(1);
    const estados = [a, b].map((r) => ('estado' in r ? r.estado : undefined)).sort();
    expect(estados).toEqual(['en_cola', 'enviado']);
    expect(headDe(e).queue).toHaveLength(1);
  });

  it('segunda factura a los 30 s: en_cola sin llamar al sender; a los 61 s el drenaje la envía encadenada a la primera', async () => {
    const e = montar({ facturas: [factura('inv1'), factura('inv2')] });
    e.sender.encolar(respuestaCorrecto, respuestaCorrecto);
    await procesarEnvio(e.deps, alta('inv1'));
    const huella1 = headDe(e).last?.huella;
    e.clock.avanzarS(30);
    const r = await procesarEnvio(e.deps, alta('inv2'));
    expect(r).toMatchObject({ sent: false, estado: 'en_cola' });
    expect(e.sender.llamadas).toHaveLength(1);
    expect(e.store.factura(CO, 'inv2')?.verifactu?.estado).toBe('en_cola');

    e.clock.avanzarS(31);
    await drenarEmpresa(e.deps, CO);
    expect(e.sender.llamadas).toHaveLength(2);
    expect(e.sender.llamadas[1]?.xml).toContain(huella1);
    expect(e.store.factura(CO, 'inv2')?.verifactu?.estado).toBe('enviado');
    expect(headDe(e).queue).toEqual([]);
  });

  it('un envío repetido de una factura ya enviada no vuelve a llamar al sender', async () => {
    const e = montar();
    e.sender.encolar(respuestaCorrecto);
    await procesarEnvio(e.deps, alta('inv1'));
    e.clock.avanzarS(120);
    const r = await procesarEnvio(e.deps, alta('inv1'));
    expect(r).toMatchObject({ sent: true, estado: 'enviado' });
    expect(e.sender.llamadas).toHaveLength(1);
  });

  it('Incorrecto: la factura queda en error con rechazoPrevio, `last` no retrocede y el reintento va como alta por rechazo', async () => {
    const e = montar();
    e.sender.encolar(respuestaIncorrecto, respuestaCorrecto);
    const r = await procesarEnvio(e.deps, alta('inv1'));
    expect(r).toMatchObject({ sent: false, estado: 'error' });
    const primero = headDe(e);
    expect(primero.pending).toBeNull();
    expect(primero.last).not.toBeNull();
    expect(e.store.factura(CO, 'inv1')?.verifactu).toMatchObject({
      estado: 'error',
      errorKind: 'aeat',
      rechazoPrevio: true,
      codigoError: '1100',
    });

    e.clock.avanzarS(61);
    const reintento = await procesarEnvio(e.deps, alta('inv1'));
    expect(reintento).toMatchObject({ sent: true, estado: 'enviado' });
    const xml2 = e.sender.llamadas[1]!.xml;
    expect(xml2).toContain('<sf:Subsanacion>S</sf:Subsanacion>');
    expect(xml2).toContain(primero.last!.huella);
    expect(e.store.factura(CO, 'inv1')?.verifactu?.errorKind).toBeUndefined();
  });

  it('SOAP Fault (HTTP 500): error de configuración liquidado, sin pending atascado', async () => {
    const e = montar();
    e.sender.encolar(respuestaFault4104);
    const r = await procesarEnvio(e.deps, alta('inv1'));
    expect(r).toMatchObject({ sent: false, estado: 'error' });
    expect(headDe(e).pending).toBeNull();
    const v = e.store.factura(CO, 'inv1')?.verifactu;
    expect(v?.errorKind).toBe('configuracion');
    expect(v?.rechazoPrevio).toBeUndefined();
  });

  it('AceptadoConErrores: enviado con aviso', async () => {
    const e = montar();
    e.sender.encolar({
      status: 200,
      body: respuestaXml({
        csv: 'CSV9',
        tiempoEspera: 60,
        estadoEnvio: 'ParcialmenteCorrecto',
        estadoRegistro: 'AceptadoConErrores',
        codigoError: '2001',
        descripcionError: 'aviso',
      }),
    });
    await procesarEnvio(e.deps, alta('inv1'));
    expect(e.store.factura(CO, 'inv1')?.verifactu).toMatchObject({ estado: 'enviado', aceptadoConErrores: true, codigoError: '2001' });
  });
});

describe('procesarEnvio: transporte y reenvío (4.4)', () => {
  it('error de red: el pending se queda, la factura queda pendiente y el siguiente intento se agenda a 60 s', async () => {
    const e = montar();
    e.sender.encolar(new Error('ETIMEDOUT'));
    const r = await procesarEnvio(e.deps, alta('inv1'));
    expect(r).toMatchObject({ sent: false, estado: 'pendiente' });
    const h = headDe(e);
    expect(h.pending?.invoiceId).toBe('inv1');
    expect(h.pending?.attempts).toBe(1);
    expect(Date.parse(h.drainAt!)).toBe(T0 + 60_000);
    expect(e.store.factura(CO, 'inv1')?.verifactu?.estado).toBe('pendiente');
  });

  it('HTTP 500 con HTML se trata como transporte (pending vivo), nunca como aceptado', async () => {
    const e = montar();
    e.sender.encolar(respuestaHttp500Html);
    await procesarEnvio(e.deps, alta('inv1'));
    expect(headDe(e).pending).not.toBeNull();
    expect(e.store.factura(CO, 'inv1')?.verifactu?.estado).toBe('pendiente');
  });

  it('S7.5/S7.9 el reenvío manda el XML almacenado byte a byte aunque la factura se edite; antes del backoff no se envía', async () => {
    const e = montar();
    e.sender.encolar(new Error('ETIMEDOUT'), respuestaCorrecto);
    await procesarEnvio(e.deps, alta('inv1'));
    const xml1 = e.sender.llamadas[0]!.xml;

    e.store.sembrarFactura(factura('inv1', { total: 999, lineas: [{ concepto: 'Otro', cantidad: 1, precioUnitario: 900, base: 900, aplicaIva: true, ivaRate: 0.21 }] }));

    e.clock.avanzarS(30);
    await drenarEmpresa(e.deps, CO);
    expect(e.sender.llamadas).toHaveLength(1);

    e.clock.avanzarS(31);
    await drenarEmpresa(e.deps, CO);
    expect(e.sender.llamadas).toHaveLength(2);
    expect(e.sender.llamadas[1]?.xml).toBe(xml1);
    expect(headDe(e).pending).toBeNull();
    expect(e.store.factura(CO, 'inv1')?.verifactu?.estado).toBe('enviado');
  });

  it('S7.11 fallos sucesivos: backoff exponencial 60 s, 120 s y attempts creciente; nunca se descarta', async () => {
    const e = montar();
    e.sender.encolar(new Error('x'), new Error('x'), new Error('x'));
    await procesarEnvio(e.deps, alta('inv1'));
    e.clock.avanzarS(61);
    await drenarEmpresa(e.deps, CO);
    let h = headDe(e);
    expect(h.pending?.attempts).toBe(2);
    expect(Date.parse(h.drainAt!)).toBe(T0 + 61_000 + 120_000);
    e.clock.avanzarS(121);
    await drenarEmpresa(e.deps, CO);
    h = headDe(e);
    expect(h.pending?.attempts).toBe(3);
    expect(Date.parse(h.drainAt!)).toBe(T0 + 61_000 + 121_000 + 240_000);
    expect(e.sender.llamadas).toHaveLength(3);
  });

  it('S7.16 reenvío respondido 3000 + RegistroDuplicado Correcta: enviado sin CSV', async () => {
    const e = montar();
    e.sender.encolar(new Error('ETIMEDOUT'), respuestaDuplicado('Correcta'));
    await procesarEnvio(e.deps, alta('inv1'));
    e.clock.avanzarS(61);
    await drenarEmpresa(e.deps, CO);
    const v = e.store.factura(CO, 'inv1')?.verifactu;
    expect(v?.estado).toBe('enviado');
    expect(v?.csv).toBeUndefined();
    expect(headDe(e).pending).toBeNull();
  });

  it('S7.16 3000 en el primer intento NO es duplicado aceptado: error', async () => {
    const e = montar();
    e.sender.encolar(respuestaDuplicado('Correcta'));
    await procesarEnvio(e.deps, alta('inv1'));
    expect(e.store.factura(CO, 'inv1')?.verifactu?.estado).toBe('error');
  });

  it('S7.17 reintento manual sobre una factura pendiente fuerza el intento aunque no haya vencido el backoff', async () => {
    const e = montar();
    e.sender.encolar(new Error('x'), respuestaCorrecto);
    await procesarEnvio(e.deps, alta('inv1'));
    e.clock.avanzarS(5);
    const r = await procesarEnvio(e.deps, alta('inv1'));
    expect(r).toMatchObject({ sent: true, estado: 'enviado' });
    expect(e.sender.llamadas).toHaveLength(2);
    expect(e.sender.llamadas[1]?.xml).toBe(e.sender.llamadas[0]?.xml);
  });

  it('S7.17 reintento manual de una factura en_cola fuerza el intento de la cabeza (el pending atascado va primero)', async () => {
    const e = montar({ facturas: [factura('inv1'), factura('inv2')] });
    e.sender.encolar(new Error('x'), respuestaCorrecto);
    await procesarEnvio(e.deps, alta('inv1'));
    await procesarEnvio(e.deps, alta('inv2'));
    expect(e.store.factura(CO, 'inv2')?.verifactu?.estado).toBe('en_cola');
    const xml1 = e.sender.llamadas[0]!.xml;

    e.clock.avanzarS(2);
    await procesarEnvio(e.deps, alta('inv2'));
    expect(e.sender.llamadas).toHaveLength(2);
    expect(e.sender.llamadas[1]?.xml).toBe(xml1);
    expect(e.store.factura(CO, 'inv1')?.verifactu?.estado).toBe('enviado');
    expect(e.store.factura(CO, 'inv2')?.verifactu?.estado).toBe('en_cola');
  });
});

describe('drenarEmpresa (4.5)', () => {
  it('S7.12 cola A, B, C: se drena estrictamente en orden, un envío por tick', async () => {
    const e = montar({ facturas: [factura('inv0'), factura('A'), factura('B'), factura('C')] });
    e.sender.encolar(respuestaCorrecto, respuestaCorrecto, respuestaCorrecto, respuestaCorrecto);
    await procesarEnvio(e.deps, alta('inv0'));
    e.clock.avanzarS(1);
    await procesarEnvio(e.deps, alta('A'));
    await procesarEnvio(e.deps, alta('B'));
    await procesarEnvio(e.deps, alta('C'));
    expect(e.sender.llamadas).toHaveLength(1);

    for (const esperada of ['F-A', 'F-B', 'F-C']) {
      e.clock.avanzarS(61);
      await drenarEmpresa(e.deps, CO);
      expect(e.sender.llamadas.at(-1)?.xml).toContain(`<sf:NumSerieFactura>${esperada}</sf:NumSerieFactura>`);
    }
    expect(e.sender.llamadas).toHaveLength(4);
    expect(headDe(e).queue).toEqual([]);
    expect(headDe(e).drainAt).toBeNull();
  });

  it('S7.10 control de flujo: TiempoEsperaEnvio=90 bloquea el siguiente envío hasta t0+90 s', async () => {
    const e = montar({ facturas: [factura('inv1'), factura('inv2')] });
    e.sender.encolar(
      { status: 200, body: respuestaXml({ csv: 'C1', tiempoEspera: 90, estadoEnvio: 'Correcto', estadoRegistro: 'Correcto' }) },
      respuestaCorrecto,
    );
    await procesarEnvio(e.deps, alta('inv1'));
    e.clock.avanzarS(1);
    await procesarEnvio(e.deps, alta('inv2'));
    e.clock.avanzarS(70);
    await drenarEmpresa(e.deps, CO);
    expect(e.sender.llamadas).toHaveLength(1);
    e.clock.avanzarS(20);
    await drenarEmpresa(e.deps, CO);
    expect(e.sender.llamadas).toHaveLength(2);
  });

  it('un pending atascado bloquea a la cola: no se salta ninguna factura', async () => {
    const e = montar({ facturas: [factura('inv1'), factura('inv2')] });
    e.sender.encolar(new Error('x'), new Error('x'));
    await procesarEnvio(e.deps, alta('inv1'));
    await procesarEnvio(e.deps, alta('inv2'));
    e.clock.avanzarS(61);
    await drenarEmpresa(e.deps, CO);
    expect(e.sender.llamadas).toHaveLength(2);
    expect(e.sender.llamadas[1]?.xml).toBe(e.sender.llamadas[0]?.xml);
    expect(e.store.factura(CO, 'inv2')?.verifactu?.estado).toBe('en_cola');
  });

  it('empresa sin cabecera o desactivada: no hace nada', async () => {
    const e = montar();
    await drenarEmpresa(e.deps, CO);
    expect(e.sender.llamadas).toHaveLength(0);
    const d = montar({ empresa: empresa({ verifactu: { enabled: false, sandbox: true } }) });
    d.store.sembrarHead(CO, {
      last: null,
      pending: null,
      queue: [{ invoiceId: 'inv1', tipo: 'alta', encoladoAt: '2026-03-15T10:00:00.000Z' }],
      nextSendAt: null,
      drainAt: '2026-03-15T10:00:00.000Z',
    });
    await drenarEmpresa(d.deps, CO);
    expect(d.sender.llamadas).toHaveLength(0);
  });

  it('cabeza de cola con factura que ya no existe: se descarta para no bloquear a las demás', async () => {
    const e = montar({ facturas: [factura('inv2')] });
    e.store.sembrarHead(CO, {
      last: null,
      pending: null,
      queue: [
        { invoiceId: 'fantasma', tipo: 'alta', encoladoAt: '2026-03-15T10:00:00.000Z' },
        { invoiceId: 'inv2', tipo: 'alta', encoladoAt: '2026-03-15T10:00:01.000Z' },
      ],
      nextSendAt: null,
      drainAt: '2026-03-15T10:00:00.000Z',
    });
    e.sender.encolar(respuestaCorrecto);
    await drenarEmpresa(e.deps, CO);
    expect(e.sender.llamadas).toHaveLength(0);
    expect(headDe(e).queue.map((q) => q.invoiceId)).toEqual(['inv2']);
    await drenarEmpresa(e.deps, CO);
    expect(e.sender.llamadas).toHaveLength(1);
    expect(e.store.factura(CO, 'inv2')?.verifactu?.estado).toBe('enviado');
  });

  it('cabeza de cola que ya no cumple las precondiciones: sale de la cola con error y la siguiente avanza', async () => {
    const e = montar({ facturas: [factura('malo', { clienteNif: '' }), factura('inv2')] });
    e.store.sembrarHead(CO, {
      last: null,
      pending: null,
      queue: [
        { invoiceId: 'malo', tipo: 'alta', encoladoAt: '2026-03-15T10:00:00.000Z' },
        { invoiceId: 'inv2', tipo: 'alta', encoladoAt: '2026-03-15T10:00:01.000Z' },
      ],
      nextSendAt: null,
      drainAt: '2026-03-15T10:00:00.000Z',
    });
    await drenarEmpresa(e.deps, CO);
    expect(e.store.factura(CO, 'malo')?.verifactu).toMatchObject({ estado: 'error', errorKind: 'precondicion' });
    expect(headDe(e).queue.map((q) => q.invoiceId)).toEqual(['inv2']);
    expect(e.sender.llamadas).toHaveLength(0);
  });

  it('transporte en el drenaje de la cola: la factura reservada queda pendiente (no se pierde)', async () => {
    const e = montar({ facturas: [factura('inv1'), factura('inv2')] });
    e.sender.encolar(respuestaCorrecto, new Error('ETIMEDOUT'));
    await procesarEnvio(e.deps, alta('inv1'));
    e.clock.avanzarS(1);
    await procesarEnvio(e.deps, alta('inv2'));
    e.clock.avanzarS(61);
    await drenarEmpresa(e.deps, CO);
    expect(headDe(e).pending?.invoiceId).toBe('inv2');
    expect(e.store.factura(CO, 'inv2')?.verifactu?.estado).toBe('pendiente');
  });
});
