import { describe, it, expect } from 'vitest';
import { aplicarDecision, aplicarPatchVerifactu, backoffS, decidirEntrada, decidirLiquidacion, decidirReenvio, headVacio, reservarDesdeCola, siguienteEnCola } from './chain';
import type { EntradaCadena } from './chain';
import { huellaAlta } from './huella';
import type { Resultado } from './parseResponse';
import { FakeChainStore } from './testing/fakes';
import type { ChainHead, ChainLink, CompanyDoc, InvoiceDoc, PendingRecord } from './types';

// 2026-03-15T10:20:30Z = 11:20:30+01:00 (Madrid, invierno)
const NOW = new Date('2026-03-15T10:20:30Z');
const NOW_HUSO = '2026-03-15T11:20:30+01:00';

function factura(over: Partial<InvoiceDoc> = {}): InvoiceDoc {
  return {
    id: 'inv1',
    companyId: 'co1',
    invoiceNumber: 'F-2026-001',
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

function enlace(over: Partial<ChainLink> = {}): ChainLink {
  return {
    idEmisor: 'B76543210',
    numSerie: 'F-2026-000',
    fecha: '14-03-2026',
    huella: 'A'.repeat(64),
    fechaHoraHuso: '2026-03-14T09:00:00+01:00',
    ...over,
  };
}

function pendiente(over: Partial<PendingRecord> = {}): PendingRecord {
  return {
    invoiceId: 'invP',
    tipo: 'alta',
    xml: '<xml/>',
    huella: 'B'.repeat(64),
    link: enlace({ huella: 'B'.repeat(64), numSerie: 'F-2026-P' }),
    reservedAt: '2026-03-15T10:20:00.000Z',
    attempts: 1,
    lastAttemptAt: '2026-03-15T10:20:00.000Z',
    ...over,
  };
}

function head(over: Partial<ChainHead> = {}): ChainHead {
  return { ...headVacio(), ...over };
}

function entrada(over: Partial<EntradaCadena> = {}): EntradaCadena {
  return { invoice: factura(), company: empresa(), tipo: 'alta', ...over };
}

describe('aplicarPatchVerifactu', () => {
  it('alta: mezcla sobre el estado previo', () => {
    const r = aplicarPatchVerifactu({ estado: 'en_cola', tipoRegistro: 'alta', qrUrl: 'u' }, 'alta', {
      estado: 'pendiente',
      tipoRegistro: 'alta',
      huella: 'H',
    });
    expect(r).toEqual({ estado: 'pendiente', tipoRegistro: 'alta', qrUrl: 'u', huella: 'H' });
  });

  it('anulacion: anida en `anulacion` sin tocar los campos del alta ni usar tipoRegistro/qrUrl', () => {
    const r = aplicarPatchVerifactu({ estado: 'enviado', tipoRegistro: 'alta', qrUrl: 'u', csv: 'C' }, 'anulacion', {
      estado: 'pendiente',
      tipoRegistro: 'anulacion',
      qrUrl: 'x',
      huella: 'H2',
    });
    expect(r.estado).toBe('enviado');
    expect(r.csv).toBe('C');
    expect(r.qrUrl).toBe('u');
    expect(r.tipoRegistro).toBe('alta');
    expect(r.anulacion).toEqual({ estado: 'pendiente', huella: 'H2' });
  });
});

describe('aplicarPatchVerifactu: limpieza de errores', () => {
  it('D9 avisoMessage (pendiente sin certificado) se conserva en un parche pendiente que lo lleva', () => {
    const r = aplicarPatchVerifactu({ estado: 'pendiente', tipoRegistro: 'alta', huella: 'H' }, 'alta', {
      estado: 'pendiente',
      avisoMessage: 'Certificado AEAT no configurado para esta empresa.',
    });
    expect(r).toEqual({
      estado: 'pendiente',
      tipoRegistro: 'alta',
      huella: 'H',
      avisoMessage: 'Certificado AEAT no configurado para esta empresa.',
    });
  });

  it('D9 avisoMessage se borra con cualquier parche posterior que no lo lleve (reenvío o liquidación)', () => {
    const previo = { estado: 'pendiente', tipoRegistro: 'alta', avisoMessage: 'x' } as const;
    expect(aplicarPatchVerifactu(previo, 'alta', { estado: 'enviado', csv: 'C' })).toEqual({
      estado: 'enviado',
      tipoRegistro: 'alta',
      csv: 'C',
    });
    expect(aplicarPatchVerifactu(previo, 'alta', { estado: 'pendiente', attempts: 2 })).not.toHaveProperty('avisoMessage');
  });

  it('D9 en una anulación el aviso anida en `anulacion` y no toca el del alta', () => {
    const r = aplicarPatchVerifactu({ estado: 'enviado', tipoRegistro: 'alta' }, 'anulacion', {
      estado: 'pendiente',
      avisoMessage: 'm',
    });
    expect(r.anulacion).toEqual({ estado: 'pendiente', avisoMessage: 'm' });
    expect(r).not.toHaveProperty('avisoMessage');
  });

  it('un estado distinto de error borra los restos del error previo', () => {
    const r = aplicarPatchVerifactu(
      { estado: 'error', tipoRegistro: 'alta', errorKind: 'aeat', errorMessage: 'm', codigoError: '1100', descripcionError: 'd', rechazoPrevio: true },
      'alta',
      { estado: 'enviado', tipoRegistro: 'alta', csv: 'C', rechazoPrevio: false },
    );
    expect(r).toEqual({ estado: 'enviado', tipoRegistro: 'alta', csv: 'C', rechazoPrevio: false });
  });

  it('aceptadoConErrores conserva el código y la descripción del propio parche', () => {
    const r = aplicarPatchVerifactu(undefined, 'alta', { estado: 'enviado', tipoRegistro: 'alta', aceptadoConErrores: true, codigoError: '2001', descripcionError: 'x' });
    expect(r.codigoError).toBe('2001');
    expect(r.descripcionError).toBe('x');
  });
});

describe('decidirEntrada (3.2)', () => {
  it('S7.1 cabeza vacía: reserva con PrimerRegistro, `last` avanza al registro y queda pending', () => {
    const d = decidirEntrada(null, entrada(), NOW);
    expect(d.accion.tipo).toBe('enviar');
    expect(d.head.pending).not.toBeNull();
    expect(d.head.pending?.invoiceId).toBe('inv1');
    expect(d.head.pending?.tipo).toBe('alta');
    expect(d.head.pending?.attempts).toBe(1);
    expect(d.head.pending?.xml).toContain('<sf:PrimerRegistro>S</sf:PrimerRegistro>');
    expect(d.head.last).toEqual(d.head.pending?.link);
    expect(d.head.last?.fechaHoraHuso).toBe(NOW_HUSO);
    expect(d.head.queue).toEqual([]);
    const p = d.invoicePatches.find((x) => x.invoiceId === 'inv1');
    expect(p?.patch).toMatchObject({ estado: 'pendiente', tipoRegistro: 'alta', huella: d.head.pending?.huella, attempts: 1 });
    expect(p?.patch.qrUrl).toContain('ValidarQR');
    expect(p?.patch.qrUrl).toContain('importe=121.00');
    if (d.accion.tipo === 'enviar') expect(d.accion.pending).toEqual(d.head.pending);
  });

  it('QR coherente con el endpoint: sin flag `sandbox` en la empresa, el QR es de sandbox', () => {
    const d = decidirEntrada(null, entrada({ company: empresa({ verifactu: { enabled: true } }) }), NOW);
    const p = d.invoicePatches.find((x) => x.invoiceId === 'inv1');
    expect(p?.patch.qrUrl).toContain('https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR');
  });

  it('QR de producción solo con `sandbox: false` explícito', () => {
    const d = decidirEntrada(null, entrada({ company: empresa({ verifactu: { enabled: true, sandbox: false } }) }), NOW);
    const p = d.invoicePatches.find((x) => x.invoiceId === 'inv1');
    expect(p?.patch.qrUrl).toContain('https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR');
  });

  it('S7.2 con `last`=A y sin pending: RegistroAnterior = A y la huella usa la huella de A', () => {
    const a = enlace();
    const d = decidirEntrada(head({ last: a }), entrada(), NOW);
    expect(d.accion.tipo).toBe('enviar');
    const xml = d.head.pending?.xml ?? '';
    expect(xml).toContain('<sf:RegistroAnterior>');
    expect(xml).toContain(`<sf:Huella>${a.huella}</sf:Huella>`);
    const esperada = huellaAlta({
      idEmisor: 'B76543210',
      numSerie: 'F-2026-001',
      fecha: '15-03-2026',
      tipoFactura: 'F1',
      cuotaTotal: '21.00',
      importeTotal: '121.00',
      huellaAnterior: a.huella,
      fechaHoraHuso: NOW_HUSO,
    });
    expect(d.head.pending?.huella).toBe(esperada);
    expect(d.head.last?.huella).toBe(esperada);
  });

  it('R7.3 reserva fija nextSendAt (sello previo al envío) y drainAt de seguridad', () => {
    const d = decidirEntrada(null, entrada(), NOW);
    expect(d.head.nextSendAt).toBe(new Date(NOW.getTime() + 60_000).toISOString());
    expect(d.head.drainAt).toBe(new Date(NOW.getTime() + 60_000).toISOString());
    expect(d.head.pending?.lastAttemptAt).toBe(NOW.toISOString());
    expect(d.head.pending?.reservedAt).toBe(NOW.toISOString());
  });

  it('R7.3 factura ya en pending: no-op (idempotente)', () => {
    const h = head({ last: enlace(), pending: pendiente({ invoiceId: 'inv1' }) });
    const d = decidirEntrada(h, entrada(), NOW);
    expect(d.accion.tipo).toBe('noop');
    expect(d.head).toEqual(h);
    expect(d.invoicePatches).toEqual([]);
  });

  it('R7.3 factura ya en la cola: no-op', () => {
    const h = head({ last: enlace(), pending: pendiente(), queue: [{ invoiceId: 'inv1', tipo: 'alta', encoladoAt: 'x' }] });
    const d = decidirEntrada(h, entrada(), NOW);
    expect(d.accion.tipo).toBe('noop');
    expect(d.head).toEqual(h);
  });

  it('R7.3 factura alta ya enviada: no-op (no genera un segundo registro)', () => {
    const inv = factura({ verifactu: { estado: 'enviado', tipoRegistro: 'alta' } });
    const d = decidirEntrada(null, entrada({ invoice: inv }), NOW);
    expect(d.accion.tipo).toBe('noop');
    expect(d.head.pending).toBeNull();
  });

  it('el mismo id con otro tipo (anulación) no es el mismo trabajo', () => {
    const h = head({ last: enlace(), pending: pendiente({ invoiceId: 'inv1', tipo: 'alta' }) });
    const inv = factura({ verifactu: { estado: 'enviado', tipoRegistro: 'alta' } });
    const d = decidirEntrada(h, entrada({ invoice: inv, tipo: 'anulacion' }), NOW);
    expect(d.accion.tipo).toBe('encolado');
  });

  it('S7.4 con pending: encola (en_cola + qrUrl), sin enviar ni tocar pending/last', () => {
    const h = head({ last: enlace(), pending: pendiente() });
    const d = decidirEntrada(h, entrada(), NOW);
    expect(d.accion.tipo).toBe('encolado');
    expect(d.head.pending).toEqual(h.pending);
    expect(d.head.last).toEqual(h.last);
    expect(d.head.queue).toEqual([{ invoiceId: 'inv1', tipo: 'alta', encoladoAt: NOW.toISOString() }]);
    expect(d.invoicePatches).toHaveLength(1);
    expect(d.invoicePatches[0].patch).toMatchObject({ estado: 'en_cola', tipoRegistro: 'alta', encoladoAt: NOW.toISOString() });
    expect(d.invoicePatches[0].patch.qrUrl).toContain('ValidarQR');
    expect(d.head.drainAt).not.toBeNull();
  });

  it('R7.3 con la cola no vacía (aunque no haya pending): encola al final', () => {
    const h = head({ last: enlace(), queue: [{ invoiceId: 'invQ', tipo: 'alta', encoladoAt: 'x' }] });
    const d = decidirEntrada(h, entrada(), NOW);
    expect(d.accion.tipo).toBe('encolado');
    expect(d.head.queue.map((q) => q.invoiceId)).toEqual(['invQ', 'inv1']);
  });

  it('S7.10 control de flujo: ahora < nextSendAt encola; en nextSendAt reserva', () => {
    const nextSendAt = new Date(NOW.getTime() + 30_000).toISOString();
    const antes = decidirEntrada(head({ last: enlace(), nextSendAt }), entrada(), NOW);
    expect(antes.accion.tipo).toBe('encolado');
    expect(antes.head.drainAt).toBe(nextSendAt);

    const despues = decidirEntrada(head({ last: enlace(), nextSendAt }), entrada(), new Date(NOW.getTime() + 30_000));
    expect(despues.accion.tipo).toBe('enviar');
  });

  it('guarda de marca de tiempo: ahora < last.fechaHoraHuso no reserva, encola', () => {
    const futuro = enlace({ fechaHoraHuso: '2026-03-15T11:20:31+01:00' }); // 1 s después de NOW
    const d = decidirEntrada(head({ last: futuro }), entrada(), NOW);
    expect(d.accion.tipo).toBe('encolado');
    expect(d.head.pending).toBeNull();
    expect(d.head.last).toEqual(futuro);
    expect(d.head.drainAt).toBe(new Date(Date.parse('2026-03-15T11:20:31+01:00') + 1000).toISOString());
  });

  it('guarda de marca de tiempo: igual al segundo exacto sí reserva', () => {
    const igual = enlace({ fechaHoraHuso: NOW_HUSO });
    const d = decidirEntrada(head({ last: igual }), entrada(), NOW);
    expect(d.accion.tipo).toBe('enviar');
  });

  it('S7.18 anulación reservada: RegistroAnulacion encadenado al alta, last avanza, parche en la anulación', () => {
    const alta = enlace({ numSerie: 'F-2026-001', fecha: '15-03-2026' });
    const inv = factura({ verifactu: { estado: 'enviado', tipoRegistro: 'alta' } });
    const d = decidirEntrada(head({ last: alta }), entrada({ invoice: inv, tipo: 'anulacion' }), NOW);
    expect(d.accion.tipo).toBe('enviar');
    expect(d.head.pending?.tipo).toBe('anulacion');
    expect(d.head.pending?.xml).toContain('RegistroAnulacion');
    expect(d.head.pending?.xml).toContain('<sf:RegistroAnterior>');
    expect(d.head.last).toEqual(d.head.pending?.link);
    expect(d.invoicePatches[0]).toMatchObject({ invoiceId: 'inv1', tipo: 'anulacion' });
    expect(d.invoicePatches[0].patch.estado).toBe('pendiente');
  });

  it('R7.11 alta en `error` con rechazoPrevio: el nuevo registro lleva Subsanacion=S y RechazoPrevio=X', () => {
    const inv = factura({ verifactu: { estado: 'error', tipoRegistro: 'alta', rechazoPrevio: true } });
    const d = decidirEntrada(head({ last: enlace() }), entrada({ invoice: inv }), NOW);
    expect(d.head.pending?.xml).toContain('<sf:Subsanacion>S</sf:Subsanacion>');
    expect(d.head.pending?.xml).toContain('<sf:RechazoPrevio>X</sf:RechazoPrevio>');
  });
});

describe('transacciones con FakeChainStore (R7.8)', () => {
  it('S7.6 dos entradas concurrentes sobre cabeza vacía: una reserva, la otra queda en cola', async () => {
    const store = new FakeChainStore();
    store.sembrarFactura(factura({ id: 'invA', invoiceNumber: 'F-A' }));
    store.sembrarFactura(factura({ id: 'invB', invoiceNumber: 'F-B' }));
    const company = empresa();

    const entrar = (id: string, invoiceNumber: string) =>
      store.runTx('co1', async (tx) => {
        const h = await tx.getHead();
        const inv = factura({ id, invoiceNumber });
        const d = decidirEntrada(h, { invoice: inv, company, tipo: 'alta' }, NOW);
        await aplicarDecision(tx, d);
        return d.accion.tipo;
      });

    const acciones = await Promise.all([entrar('invA', 'F-A'), entrar('invB', 'F-B')]);

    expect(acciones.slice().sort()).toEqual(['encolado', 'enviar']);
    expect(store.conflictos).toBeGreaterThanOrEqual(1);
    const h = store.head('co1');
    expect(h?.pending).not.toBeNull();
    expect(h?.queue).toHaveLength(1);
    expect(h?.last).toEqual(h?.pending?.link);
    // Una única huella con encadenamiento "primer registro": nadie comparte hash previo.
    expect(h?.pending?.xml).toContain('PrimerRegistro');
    const estados = [store.factura('co1', 'invA')?.verifactu?.estado, store.factura('co1', 'invB')?.verifactu?.estado].sort();
    expect(estados).toEqual(['en_cola', 'pendiente']);
  });

  it('cinco entradas concurrentes nunca producen dos registros con el mismo eslabón previo', async () => {
    const store = new FakeChainStore();
    const company = empresa();
    const ids = ['i1', 'i2', 'i3', 'i4', 'i5'];
    for (const id of ids) store.sembrarFactura(factura({ id, invoiceNumber: `F-${id}` }));
    const acciones = await Promise.all(
      ids.map((id) =>
        store.runTx('co1', async (tx) => {
          const d = decidirEntrada(await tx.getHead(), { invoice: factura({ id, invoiceNumber: `F-${id}` }), company, tipo: 'alta' }, NOW);
          await aplicarDecision(tx, d);
          return d.accion.tipo;
        }),
      ),
    );
    expect(acciones.filter((a) => a === 'enviar')).toHaveLength(1);
    expect(acciones.filter((a) => a === 'encolado')).toHaveLength(4);
    expect(store.head('co1')?.queue.map((q) => q.invoiceId).sort()).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// Liquidación (3.3, 3.4, 3.5)
// ---------------------------------------------------------------------------
const HUELLA_P = 'B'.repeat(64);
const ULTIMO_ENVIO = '2026-03-15T10:20:00.000Z';

function conPendiente(over: Partial<PendingRecord> = {}, extra: Partial<ChainHead> = {}): ChainHead {
  const p = pendiente({ invoiceId: 'invP', huella: HUELLA_P, ...over });
  return head({ last: p.link, pending: p, nextSendAt: '2026-03-15T10:21:00.000Z', drainAt: '2026-03-15T10:21:00.000Z', ...extra });
}

const CORRECTO: Resultado = { tipo: 'correcto', csv: 'CSV123' };

describe('decidirLiquidacion: correcto / aceptadoConErrores (3.3)', () => {
  it('S7.1 correcto: pending limpio, `last` intacto, factura enviada con CSV', () => {
    const h = conPendiente();
    const d = decidirLiquidacion(h, HUELLA_P, CORRECTO, NOW);
    expect(d.head.pending).toBeNull();
    expect(d.head.last).toEqual(h.last);
    expect(d.invoicePatches).toHaveLength(1);
    expect(d.invoicePatches[0]).toMatchObject({ invoiceId: 'invP', tipo: 'alta' });
    expect(d.invoicePatches[0].patch).toMatchObject({ estado: 'enviado', csv: 'CSV123', enviadoAt: NOW.toISOString(), aceptadoConErrores: false, rechazoPrevio: false });
  });

  it('R7.6 nextSendAt = último envío + TiempoEsperaEnvio (por defecto 60 s; 90 s si lo manda AEAT)', () => {
    const porDefecto = decidirLiquidacion(conPendiente(), HUELLA_P, CORRECTO, NOW);
    expect(porDefecto.head.nextSendAt).toBe('2026-03-15T10:21:00.000Z');
    const con90 = decidirLiquidacion(conPendiente(), HUELLA_P, { tipo: 'correcto', csv: 'C', esperaS: 90 }, NOW);
    expect(con90.head.nextSendAt).toBe('2026-03-15T10:21:30.000Z');
  });

  it('sin cola drainAt=null; con cola drainAt=nextSendAt', () => {
    const sinCola = decidirLiquidacion(conPendiente(), HUELLA_P, CORRECTO, NOW);
    expect(sinCola.head.drainAt).toBeNull();
    const conCola = decidirLiquidacion(
      conPendiente({}, { queue: [{ invoiceId: 'q1', tipo: 'alta', encoladoAt: 'x' }] }),
      HUELLA_P,
      CORRECTO,
      NOW,
    );
    expect(conCola.head.drainAt).toBe('2026-03-15T10:21:00.000Z');
    expect(conCola.head.queue).toHaveLength(1);
  });

  it('S7.7 aceptadoConErrores: enviado + aviso, cadena intacta', () => {
    const h = conPendiente();
    const d = decidirLiquidacion(h, HUELLA_P, { tipo: 'aceptadoConErrores', csv: 'C2', codigo: '2001', descripcion: 'aviso' }, NOW);
    expect(d.head.pending).toBeNull();
    expect(d.head.last).toEqual(h.last);
    expect(d.invoicePatches[0].patch).toMatchObject({ estado: 'enviado', csv: 'C2', aceptadoConErrores: true, codigoError: '2001', descripcionError: 'aviso' });
  });

  it('liquidar con otra huella (ya liquidado o sustituido) es no-op', () => {
    const h = conPendiente();
    const d = decidirLiquidacion(h, 'C'.repeat(64), CORRECTO, NOW);
    expect(d.accion.tipo).toBe('noop');
    expect(d.head).toEqual(h);
    expect(d.invoicePatches).toEqual([]);
    const sin = decidirLiquidacion(head(), HUELLA_P, CORRECTO, NOW);
    expect(sin.accion.tipo).toBe('noop');
  });

  it('una anulación liquida dentro de `anulacion`', () => {
    const d = decidirLiquidacion(conPendiente({ tipo: 'anulacion' }), HUELLA_P, CORRECTO, NOW);
    expect(d.invoicePatches[0]).toMatchObject({ invoiceId: 'invP', tipo: 'anulacion' });
    expect(d.invoicePatches[0].patch.estado).toBe('enviado');
  });
});

describe('decidirLiquidacion: incorrecto / fault (3.3)', () => {
  const INCORRECTO: Resultado = { tipo: 'incorrecto', codigo: '1100', descripcion: 'Valor incorrecto' };

  it('S7.3 incorrecto: pending limpio, `last` NO cambia, factura en error con rechazoPrevio', () => {
    const h = conPendiente();
    const d = decidirLiquidacion(h, HUELLA_P, INCORRECTO, NOW);
    expect(d.head.pending).toBeNull();
    expect(d.head.last).toEqual(h.last);
    expect(d.invoicePatches[0].patch).toMatchObject({
      estado: 'error',
      errorKind: 'aeat',
      codigoError: '1100',
      descripcionError: 'Valor incorrecto',
      rechazoPrevio: true,
    });
    expect(d.invoicePatches[0].patch.errorMessage).toContain('1100');
    expect(d.invoicePatches[0].patch.errorMessage).toContain('Valor incorrecto');
  });

  it('el incorrecto de una anulación marca rechazoPrevio dentro de `anulacion`', () => {
    const d = decidirLiquidacion(conPendiente({ tipo: 'anulacion' }), HUELLA_P, INCORRECTO, NOW);
    expect(d.invoicePatches[0]).toMatchObject({ tipo: 'anulacion' });
    expect(d.invoicePatches[0].patch.rechazoPrevio).toBe(true);
  });

  it('S7.13 SOAP Fault: liquidado como error (configuracion), sin rechazoPrevio, `last` intacto, cola sigue', () => {
    const h = conPendiente({}, { queue: [{ invoiceId: 'q1', tipo: 'alta', encoladoAt: 'x' }] });
    const d = decidirLiquidacion(h, HUELLA_P, { tipo: 'fault', faultstring: 'Codigo[4104]. Error en cabecera' }, NOW);
    expect(d.head.pending).toBeNull();
    expect(d.head.last).toEqual(h.last);
    expect(d.head.queue).toHaveLength(1);
    expect(d.head.drainAt).not.toBeNull();
    const patch = d.invoicePatches[0].patch;
    expect(patch).toMatchObject({ estado: 'error', errorKind: 'configuracion' });
    expect(patch.errorMessage).toContain('4104');
    expect('rechazoPrevio' in patch).toBe(false);
  });
});

describe('decidirLiquidacion: transporte / unknown (3.4)', () => {
  const cases: Resultado[] = [{ tipo: 'transporte', status: 503 }, { tipo: 'unknown' }];

  it.each(cases)('R7.7 %o: pending se queda, last intacto, drainAt = ahora + 60 s en el primer fallo', (r) => {
    const h = conPendiente({ attempts: 1 });
    const d = decidirLiquidacion(h, HUELLA_P, r, NOW);
    expect(d.head.pending).toEqual(expect.objectContaining({ huella: HUELLA_P, attempts: 1 }));
    expect(d.head.last).toEqual(h.last);
    expect(d.head.drainAt).toBe(new Date(NOW.getTime() + 60_000).toISOString());
    expect(d.head.nextSendAt).toBe(h.nextSendAt);
    expect(d.invoicePatches).toEqual([]);
  });

  it('S7.11 backoff exponencial 60, 120, 240 ... con tope 3600', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 20].map(backoffS)).toEqual([60, 120, 240, 480, 960, 1920, 3600, 3600]);
    const d = decidirLiquidacion(conPendiente({ attempts: 3 }), HUELLA_P, { tipo: 'unknown' }, NOW);
    expect(d.head.drainAt).toBe(new Date(NOW.getTime() + 240_000).toISOString());
    const tope = decidirLiquidacion(conPendiente({ attempts: 30 }), HUELLA_P, { tipo: 'unknown' }, NOW);
    expect(tope.head.drainAt).toBe(new Date(NOW.getTime() + 3_600_000).toISOString());
  });

  it('el pending nunca se descarta y guarda el último error', () => {
    const d = decidirLiquidacion(conPendiente({ attempts: 50 }), HUELLA_P, { tipo: 'transporte', status: 500 }, NOW);
    expect(d.head.pending).not.toBeNull();
    expect(d.head.pending?.lastError).toContain('500');
  });

  it('la cola no se toca mientras el pending sigue atascado', () => {
    const q = [{ invoiceId: 'q1', tipo: 'alta' as const, encoladoAt: 'x' }];
    const d = decidirLiquidacion(conPendiente({}, { queue: q }), HUELLA_P, { tipo: 'unknown' }, NOW);
    expect(d.head.queue).toEqual(q);
  });
});

describe('decidirLiquidacion: duplicado (3.5)', () => {
  const dup = (estado: string, extra: Partial<Extract<Resultado, { tipo: 'incorrecto' }>> = {}): Resultado => ({
    tipo: 'incorrecto',
    codigo: '3000',
    descripcion: 'Registro de facturacion duplicado',
    duplicado: { idPeticion: 'X1', estado },
    ...extra,
  });

  it('S7.16 reenvío (attempts=2) + 3000 + Correcta -> enviado, csv vacío, sin aviso', () => {
    const d = decidirLiquidacion(conPendiente({ attempts: 2 }), HUELLA_P, dup('Correcta'), NOW);
    expect(d.head.pending).toBeNull();
    const patch = d.invoicePatches[0].patch;
    expect(patch).toMatchObject({ estado: 'enviado', aceptadoConErrores: false });
    expect(patch.csv).toBeUndefined();
  });

  it('S7.16 reenvío + 3000 + AceptadaConErrores -> enviado con aceptadoConErrores', () => {
    const d = decidirLiquidacion(conPendiente({ attempts: 3 }), HUELLA_P, dup('AceptadaConErrores'), NOW);
    expect(d.invoicePatches[0].patch).toMatchObject({ estado: 'enviado', aceptadoConErrores: true });
  });

  it('S7.16 3000 en el primer intento -> error (colisión de numeración)', () => {
    const d = decidirLiquidacion(conPendiente({ attempts: 1 }), HUELLA_P, dup('Correcta'), NOW);
    expect(d.invoicePatches[0].patch).toMatchObject({ estado: 'error', errorKind: 'aeat', rechazoPrevio: true });
  });

  it('S7.16 3000 en reenvío con estado Anulada -> error', () => {
    const d = decidirLiquidacion(conPendiente({ attempts: 2 }), HUELLA_P, dup('Anulada'), NOW);
    expect(d.invoicePatches[0].patch.estado).toBe('error');
  });

  it('otro código con duplicado Correcta en reenvío -> error', () => {
    const d = decidirLiquidacion(conPendiente({ attempts: 2 }), HUELLA_P, dup('Correcta', { codigo: '3001' }), NOW);
    expect(d.invoicePatches[0].patch.estado).toBe('error');
  });

  it('3000 en reenvío sin bloque RegistroDuplicado -> error', () => {
    const d = decidirLiquidacion(
      conPendiente({ attempts: 2 }),
      HUELLA_P,
      { tipo: 'incorrecto', codigo: '3000', descripcion: 'dup' },
      NOW,
    );
    expect(d.invoicePatches[0].patch.estado).toBe('error');
  });
});

// ---------------------------------------------------------------------------
// Drenaje FIFO y reenvío (3.6)
// ---------------------------------------------------------------------------
const T = (s: number): Date => new Date(NOW.getTime() + s * 1000);
const q = (id: string): { invoiceId: string; tipo: 'alta'; encoladoAt: string } => ({ invoiceId: id, tipo: 'alta', encoladoAt: 'x' });

describe('siguienteEnCola (3.6)', () => {
  it('sin cabeza o sin trabajo: nada', () => {
    expect(siguienteEnCola(null, NOW)).toEqual({ tipo: 'nada' });
    expect(siguienteEnCola(head(), NOW)).toEqual({ tipo: 'nada' });
  });

  it('S7.11 pending: espera hasta drainAt; vencido -> reenviar', () => {
    const h = conPendiente({}, { drainAt: T(120).toISOString(), nextSendAt: T(0).toISOString() });
    expect(siguienteEnCola(h, T(60))).toEqual({ tipo: 'esperar', hasta: T(120) });
    expect(siguienteEnCola(h, T(120))).toEqual({ tipo: 'reenviar' });
  });

  it('S7.10 el control de flujo también retiene el reenvío (max(drainAt, nextSendAt))', () => {
    const h = conPendiente({}, { drainAt: T(0).toISOString(), nextSendAt: T(90).toISOString() });
    expect(siguienteEnCola(h, T(30))).toEqual({ tipo: 'esperar', hasta: T(90) });
    expect(siguienteEnCola(h, T(90))).toEqual({ tipo: 'reenviar' });
  });

  it('S7.12 sin pending: la cabeza de la cola (FIFO) se reserva cuando vence nextSendAt', () => {
    const h = head({ last: enlace(), queue: [q('A'), q('B'), q('C')], nextSendAt: T(61).toISOString(), drainAt: T(61).toISOString() });
    expect(siguienteEnCola(h, T(60))).toEqual({ tipo: 'esperar', hasta: T(61) });
    expect(siguienteEnCola(h, T(61))).toEqual({ tipo: 'reservar', entrada: q('A') });
  });

  it('un pending atascado bloquea la cola: se reenvía el pending, no se reserva el siguiente', () => {
    const h = conPendiente({}, { queue: [q('A')], drainAt: T(0).toISOString(), nextSendAt: T(0).toISOString() });
    expect(siguienteEnCola(h, T(0))).toEqual({ tipo: 'reenviar' });
  });

  it('S7.17 reintento manual (forzar) ignora backoff y control de flujo', () => {
    const h = conPendiente({}, { drainAt: T(3000).toISOString(), nextSendAt: T(3000).toISOString() });
    expect(siguienteEnCola(h, NOW, true)).toEqual({ tipo: 'reenviar' });
    const c = head({ last: enlace(), queue: [q('A')], nextSendAt: T(3000).toISOString() });
    expect(siguienteEnCola(c, NOW, true)).toEqual({ tipo: 'reservar', entrada: q('A') });
    expect(siguienteEnCola(head(), NOW, true)).toEqual({ tipo: 'nada' });
  });
});

describe('decidirReenvio (3.6)', () => {
  it('S7.5 reenvía el XML almacenado idéntico; attempts++, sello de envío y nuevo backoff', () => {
    const h = conPendiente({ attempts: 1, xml: '<envelope>igual</envelope>' });
    const d = decidirReenvio(h, T(100));
    expect(d.accion.tipo).toBe('enviar');
    if (d.accion.tipo !== 'enviar') return;
    expect(d.accion.pending.xml).toBe('<envelope>igual</envelope>');
    expect(d.accion.pending.attempts).toBe(2);
    expect(d.accion.pending.lastAttemptAt).toBe(T(100).toISOString());
    expect(d.head.pending).toEqual(d.accion.pending);
    expect(d.head.last).toEqual(h.last);
    expect(d.head.nextSendAt).toBe(T(160).toISOString());
    expect(d.head.drainAt).toBe(T(100 + backoffS(2)).toISOString());
    expect(d.invoicePatches[0]).toMatchObject({ invoiceId: 'invP', tipo: 'alta', patch: { estado: 'pendiente', attempts: 2 } });
  });

  it('sin pending: no-op', () => {
    expect(decidirReenvio(head(), NOW).accion.tipo).toBe('noop');
    expect(decidirReenvio(null, NOW).accion.tipo).toBe('noop');
  });
});

describe('reservarDesdeCola (3.6)', () => {
  it('saca la cabeza de la cola, reserva y avanza `last`', () => {
    const a = enlace();
    const h = head({ last: a, queue: [q('inv1'), q('B')], nextSendAt: T(0).toISOString() });
    const d = reservarDesdeCola(h, entrada(), T(61));
    expect(d.accion.tipo).toBe('enviar');
    expect(d.head.queue.map((x) => x.invoiceId)).toEqual(['B']);
    expect(d.head.pending?.invoiceId).toBe('inv1');
    expect(d.head.pending?.xml).toContain(a.huella);
    expect(d.head.last).toEqual(d.head.pending?.link);
  });

  it('si la entrada no es la cabeza de la cola: no-op (FIFO estricto)', () => {
    const h = head({ last: enlace(), queue: [q('B'), q('inv1')] });
    expect(reservarDesdeCola(h, entrada(), T(61)).accion.tipo).toBe('noop');
  });

  it('guarda de marca de tiempo: sigue en cola con drainAt posterior', () => {
    const futuro = enlace({ fechaHoraHuso: '2026-03-15T11:20:40+01:00' });
    const h = head({ last: futuro, queue: [q('inv1')] });
    const d = reservarDesdeCola(h, entrada(), NOW);
    expect(d.accion.tipo).toBe('encolado');
    expect(d.head.queue).toHaveLength(1);
    expect(d.head.pending).toBeNull();
    expect(d.head.drainAt).toBe(new Date(Date.parse('2026-03-15T11:20:41+01:00')).toISOString());
  });

  it('S7.12 A, B, C tras un pending se drenan estrictamente en orden, uno por tick', () => {
    const company = empresa();
    const facturas = ['A', 'B', 'C'].map((id) => factura({ id, invoiceNumber: `F-${id}` }));
    let h: ChainHead = conPendiente({}, { drainAt: T(0).toISOString(), nextSendAt: T(0).toISOString() });
    for (const f of facturas) h = decidirEntrada(h, { invoice: f, company, tipo: 'alta' }, T(1)).head;
    expect(h.queue.map((x) => x.invoiceId)).toEqual(['A', 'B', 'C']);

    // liquidar el pending atascado
    h = decidirLiquidacion(h, HUELLA_P, CORRECTO, T(2)).head;
    const orden: string[] = [];
    let t = 2;
    for (let tick = 0; tick < 3; tick++) {
      t += 61;
      const paso = siguienteEnCola(h, T(t));
      expect(paso.tipo).toBe('reservar');
      if (paso.tipo !== 'reservar') return;
      const f = facturas.find((x) => x.id === paso.entrada.invoiceId);
      if (!f) throw new Error('factura desconocida');
      const d = reservarDesdeCola(h, { invoice: f, company, tipo: 'alta' }, T(t));
      expect(d.accion.tipo).toBe('enviar');
      orden.push(f.id);
      // en este mismo tick no hay segundo envío: pending bloquea y nextSendAt retiene
      expect(siguienteEnCola(d.head, T(t)).tipo).toBe('esperar');
      h = decidirLiquidacion(d.head, d.head.pending?.huella ?? '', CORRECTO, T(t)).head;
    }
    expect(orden).toEqual(['A', 'B', 'C']);
    expect(h.queue).toEqual([]);
    expect(h.drainAt).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Reintento tras Incorrecto: registro NUEVO encadenado a `last` (3.7)
// ---------------------------------------------------------------------------
describe('reintento tras Incorrecto (3.7)', () => {
  const company = empresa();
  const X = factura({ id: 'X', invoiceNumber: 'F-X' });
  const Y = factura({ id: 'Y', invoiceNumber: 'F-Y' });

  /** Aplica los parches de una decisión a la factura, como haría la transacción. */
  function conParches(inv: InvoiceDoc, d: { invoicePatches: { invoiceId: string; tipo: 'alta' | 'anulacion'; patch: Parameters<typeof aplicarPatchVerifactu>[2] }[] }): InvoiceDoc {
    let v = inv.verifactu;
    for (const p of d.invoicePatches.filter((x) => x.invoiceId === inv.id)) v = aplicarPatchVerifactu(v, p.tipo, p.patch);
    return { ...inv, verifactu: v };
  }

  it('S7.3 / S7.14 X Incorrecto, Y generado después, reintento de X: anterior = Y, Subsanacion=S, RechazoPrevio=X, last = X\'', () => {
    // X se reserva y AEAT lo rechaza
    const rx = decidirEntrada(null, { invoice: X, company, tipo: 'alta' }, T(0));
    const linkX = rx.head.last;
    const lx = decidirLiquidacion(rx.head, rx.head.pending?.huella ?? '', { tipo: 'incorrecto', codigo: '1100', descripcion: 'd' }, T(1));
    expect(lx.head.last).toEqual(linkX); // el rechazado sigue en la cadena
    const xError = conParches(conParches(X, rx), lx);
    expect(xError.verifactu).toMatchObject({ estado: 'error', rechazoPrevio: true });

    // Y se genera después y encadena con X (S7.3)
    const ry = decidirEntrada(lx.head, { invoice: Y, company, tipo: 'alta' }, T(70));
    expect(ry.accion.tipo).toBe('enviar');
    expect(ry.head.pending?.xml).toContain('<sf:RegistroAnterior>');
    expect(ry.head.pending?.xml).toContain(`<sf:Huella>${linkX?.huella}</sf:Huella>`);
    const linkY = ry.head.last;
    const ly = decidirLiquidacion(ry.head, ry.head.pending?.huella ?? '', CORRECTO, T(71));

    // reintento de X: registro NUEVO, anterior = Y (el `last` actual), last avanza a X'
    const rx2 = decidirEntrada(ly.head, { invoice: xError, company, tipo: 'alta' }, T(140));
    expect(rx2.accion.tipo).toBe('enviar');
    const xml = rx2.head.pending?.xml ?? '';
    expect(xml).toContain('<sf:Subsanacion>S</sf:Subsanacion>');
    expect(xml).toContain('<sf:RechazoPrevio>X</sf:RechazoPrevio>');
    expect(xml).toContain(`<sf:Huella>${linkY?.huella}</sf:Huella>`);
    expect(xml).not.toContain(`<sf:Huella>${linkX?.huella}</sf:Huella>`);
    expect(rx2.head.pending?.huella).not.toBe(linkX?.huella);
    expect(rx2.head.last).toEqual(rx2.head.pending?.link);
    expect(rx2.head.last?.huella).not.toBe(linkX?.huella);
    expect(rx2.head.last?.fechaHoraHuso).not.toBe(linkX?.fechaHoraHuso);
  });

  it('S7.15 sin nada generado entre medias: el reintento encadena al propio registro rechazado', () => {
    const rx = decidirEntrada(null, { invoice: X, company, tipo: 'alta' }, T(0));
    const linkX = rx.head.last;
    const lx = decidirLiquidacion(rx.head, rx.head.pending?.huella ?? '', { tipo: 'incorrecto', codigo: '1100' }, T(1));
    const xError = conParches(conParches(X, rx), lx);
    const rx2 = decidirEntrada(lx.head, { invoice: xError, company, tipo: 'alta' }, T(70));
    expect(rx2.head.pending?.xml).toContain(`<sf:Huella>${linkX?.huella}</sf:Huella>`);
  });

  it('S7.15 anulación rechazada: reintento con RechazoPrevio=S y sin Subsanacion', () => {
    const enviada = factura({ id: 'X', invoiceNumber: 'F-X', verifactu: { estado: 'enviado', tipoRegistro: 'alta' } });
    const ra = decidirEntrada(head({ last: enlace() }), { invoice: enviada, company, tipo: 'anulacion' }, T(0));
    const la = decidirLiquidacion(ra.head, ra.head.pending?.huella ?? '', { tipo: 'incorrecto', codigo: '1100' }, T(1));
    const rechazada = conParches(conParches(enviada, ra), la);
    expect(rechazada.verifactu?.anulacion).toMatchObject({ estado: 'error', rechazoPrevio: true });
    expect(rechazada.verifactu?.estado).toBe('enviado'); // el alta no se toca

    const rb = decidirEntrada(la.head, { invoice: rechazada, company, tipo: 'anulacion' }, T(70));
    expect(rb.accion.tipo).toBe('enviar');
    expect(rb.head.pending?.xml).toContain('<sf:RechazoPrevio>S</sf:RechazoPrevio>');
    expect(rb.head.pending?.xml).not.toContain('Subsanacion');
    expect(rb.head.last).toEqual(rb.head.pending?.link); // S7.18 / R7.9: la anulación avanza la cabeza
  });

  it('el reintento que espera en cola conserva rechazoPrevio y lo aplica al reservarse', () => {
    const rx = decidirEntrada(null, { invoice: X, company, tipo: 'alta' }, T(0));
    const lx = decidirLiquidacion(rx.head, rx.head.pending?.huella ?? '', { tipo: 'incorrecto', codigo: '1100' }, T(1));
    const xError = conParches(conParches(X, rx), lx);
    // llega Y y queda pending; el reintento de X se encola
    const ry = decidirEntrada(lx.head, { invoice: Y, company, tipo: 'alta' }, T(70));
    const rxq = decidirEntrada(ry.head, { invoice: xError, company, tipo: 'alta' }, T(71));
    expect(rxq.accion.tipo).toBe('encolado');
    const xEnCola = conParches(xError, rxq);
    expect(xEnCola.verifactu?.estado).toBe('en_cola');
    expect(xEnCola.verifactu?.rechazoPrevio).toBe(true);

    const ly = decidirLiquidacion(rxq.head, ry.head.pending?.huella ?? '', CORRECTO, T(72));
    const rx2 = reservarDesdeCola(ly.head, { invoice: xEnCola, company, tipo: 'alta' }, T(140));
    expect(rx2.accion.tipo).toBe('enviar');
    expect(rx2.head.pending?.xml).toContain('<sf:RechazoPrevio>X</sf:RechazoPrevio>');
  });

  it('tras un Fault el registro queda en la cadena pero sin rechazoPrevio', () => {
    const rx = decidirEntrada(null, { invoice: X, company, tipo: 'alta' }, T(0));
    const linkX = rx.head.last;
    const lx = decidirLiquidacion(rx.head, rx.head.pending?.huella ?? '', { tipo: 'fault', faultstring: 'Codigo[4104]' }, T(1));
    const xFault = conParches(conParches(X, rx), lx);
    expect(xFault.verifactu?.rechazoPrevio).toBeUndefined();
    const rx2 = decidirEntrada(lx.head, { invoice: xFault, company, tipo: 'alta' }, T(70));
    expect(rx2.head.pending?.xml).not.toContain('Subsanacion');
    expect(rx2.head.pending?.xml).toContain(`<sf:Huella>${linkX?.huella}</sf:Huella>`);
  });
});
