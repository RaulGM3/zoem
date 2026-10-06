import { describe, it, expect } from 'vitest';
import {
  construirSeedDemo, pathsObsoletos, planDeEscritura, ultimaFacturaPorAnio, type ContextoSeed, type DocSeed,
} from './seed-demo-civil';
import { claveFactura } from '../facturas-recibidas/clave-factura';

const CID = 'cid-demo';
const ctx = (over: Partial<ContextoSeed> = {}): ContextoSeed => ({
  companyId: CID,
  miembros: [
    { uid: 'u-gestor', nombre: 'Pablo Ruiz', role: 'Gestor' },
    { uid: 'u-admin', nombre: 'Laura Vidal', role: 'Admin' },
  ],
  hoy: new Date(2026, 9, 6, 9, 30),
  ultimaFacturaPorAnio: {},
  agente: { agentId: 'agente-demo', crear: true },
  ...over,
});

const RAICES = ['invoices/', 'llamadas/', 'iaContacts/', 'agentMappings/'];

const de = (docs: DocSeed[], coleccion: string) =>
  docs.filter((d) => {
    const partes = d.path.split('/');
    return partes.length % 2 === 0 && partes[partes.length - 2] === coleccion;
  });
const doc = (docs: DocSeed[], sufijo: string) => {
  const d = docs.find((x) => x.path.endsWith(sufijo));
  if (!d) throw new Error(`No hay doc ${sufijo}`);
  return d.data as Record<string, any>;
};

describe('construirSeedDemo', () => {
  it('genera el volumen de una empresa movida', () => {
    const { docs } = construirSeedDemo(ctx());
    expect(de(docs, 'contactos').length).toBeGreaterThanOrEqual(12);
    expect(de(docs, 'casoPlantillas')).toHaveLength(5);
    expect(de(docs, 'casos')).toHaveLength(10);
    expect(de(docs, 'hitos').length).toBeGreaterThan(60);
    expect(de(docs, 'invoices').length).toBeGreaterThanOrEqual(6);
    expect(de(docs, 'extracto').length).toBeGreaterThan(20);
    expect(de(docs, 'movimientos_generales').length).toBeGreaterThan(40);
    expect(de(docs, 'eventos').length).toBeGreaterThanOrEqual(30);
    expect(de(docs, 'acciones').length).toBeGreaterThan(3);
    expect(de(docs, 'llamadas').length).toBeGreaterThanOrEqual(8);
    expect(de(docs, 'iaContacts').length).toBeGreaterThanOrEqual(4);
    expect(de(docs, 'actividad').length).toBeGreaterThanOrEqual(40);
  });

  it('todo vive bajo la empresa salvo las colecciones raíz (facturas, llamadas, Recepción IA)', () => {
    const { docs } = construirSeedDemo(ctx());
    for (const d of docs) {
      expect(d.path.startsWith(`companies/${CID}/`) || RAICES.some((r) => d.path.startsWith(r))).toBe(true);
    }
  });

  it('ids deterministas con prefijo demo (re-ejecutar sobrescribe, no duplica)', () => {
    const a = construirSeedDemo(ctx()).docs.map((d) => d.path);
    const b = construirSeedDemo(ctx()).docs.map((d) => d.path);
    expect(a).toEqual(b);
    expect(new Set(a).size).toBe(a.length);
    expect(de(construirSeedDemo(ctx()).docs, 'casos').every((d) => d.path.split('/').pop()!.startsWith('demo-'))).toBe(true);
  });

  it('el resumen financiero replica recalcularResumen', () => {
    const { docs } = construirSeedDemo(ctx());
    const caso = doc(docs, 'casos/demo-caso-desahucio-martin');
    expect(caso['resumenFinanciero']).toEqual({
      totalIngresos: 500,
      totalSuplidos: 210,
      totalHonorarios: 544.5,
      totalHonorariosSalida: 0,
      totalEgresos: 210,
      saldo: 834.5,
      ivaRepercutido: 94.5,
      ivaSoportado: 0,
    });
    expect(caso['gestoriaResumenSlots']).toEqual({ total: 4, registrados: 3 });
  });

  it('el caso cerrado queda con saldo 0 y alimenta el histórico de tesorería', () => {
    const { docs } = construirSeedDemo(ctx());
    expect(doc(docs, 'casos/demo-caso-trafico-ortega')).toMatchObject({ estado: 'cerrado', cierreSaldoBancario: 0 });
    expect(doc(docs, 'tesoreria_meta/resumen')).toMatchObject({ casosCount: 1, saldoCerrados: 0 });
  });

  it('escribe como el asignado (actor == asignado) para no disparar notificaciones', () => {
    const { docs } = construirSeedDemo(ctx());
    for (const d of de(docs, 'casos')) expect(d.data['encargadoId']).toBe(d.data['updatedBy']);
    for (const d of de(docs, 'hitos')) expect(d.data['asignadoA']).toBe(d.data['updatedBy']);
    for (const d of de(docs, 'contactos')) expect(d.data['assignedTo']).toBe(d.data['updatedBy']);
    for (const d of de(docs, 'eventos')) expect(d.data['invitados']).toEqual([d.data['creadoPor']]);
  });

  it('el primer Admin es quien firma tesorería y acciones', () => {
    const { docs } = construirSeedDemo(ctx());
    expect(doc(docs, 'acciones/demo-accion-bienvenida')['createdBy']).toBe('u-admin');
  });

  it('numera las facturas emitidas después de la última real del año', () => {
    const { docs } = construirSeedDemo(ctx({ ultimaFacturaPorAnio: { '2026': 41 } }));
    const numeros = de(docs, 'invoices').map((d) => d.data['invoiceNumber'] as string).sort();
    expect(numeros[0]).toBe('F-2026-0042');
    expect(new Set(numeros).size).toBe(numeros.length);
  });

  it('fechas relativas a hoy', () => {
    const { docs } = construirSeedDemo(ctx());
    const vista = de(docs, 'eventos').find((d) => d.data['titulo'] === 'Vista verbal — rentas local C/ Atocha 80');
    expect(vista?.data['fecha']).toBe('2026-10-08');
  });

  it('facturas recibidas aparte: id = claveFactura y sin campos que pone el servidor', () => {
    const { facturasRecibidas, docs } = construirSeedDemo(ctx());
    expect(facturasRecibidas.length).toBeGreaterThan(2);
    for (const fr of facturasRecibidas) {
      const d = fr.data as Record<string, any>;
      expect(fr.id).toBe(claveFactura(d['proveedor'].nif, d['numero']));
      expect(d).not.toHaveProperty('numeroRecepcion');
      expect(d).not.toHaveProperty('createdBy');
      expect(d).not.toHaveProperty('createdAt');
      expect(d['qrValidacion']).toEqual({ estado: 'sin_qr' });
      const mov = doc(docs, `movimientos_generales/${d['movimientoId']}`);
      expect(mov['facturaRecibidaId']).toBe(fr.id);
    }
  });

  it('no deja undefined ni NaN en ningún documento', () => {
    const { docs, facturasRecibidas } = construirSeedDemo(ctx());
    const visitar = (v: unknown): void => {
      expect(v).not.toBeUndefined();
      if (typeof v === 'number') expect(Number.isFinite(v)).toBe(true);
      else if (Array.isArray(v)) v.forEach(visitar);
      else if (v && typeof v === 'object' && !(v instanceof Date)) Object.values(v).forEach(visitar);
    };
    [...docs, ...facturasRecibidas].forEach((d) => visitar(d.data));
  });

  describe('tesorería', () => {
    const movs = (docs: DocSeed[]) => [
      ...de(docs, 'movimientos_generales'),
      ...docs.filter((d) => d.path.includes('/gestoria/')),
    ].map((d) => d.data as Record<string, any>);

    it('dos cuentas: cuenta corriente del Banco Santander y caja', () => {
      const cuentas = de(construirSeedDemo(ctx()).docs, 'cuentas').map((d) => d.data);
      expect(cuentas).toHaveLength(2);
      expect(cuentas).toEqual(expect.arrayContaining([
        expect.objectContaining({ tipo: 'banco', entidad: 'Banco Santander', activa: true }),
        expect.objectContaining({ tipo: 'caja', activa: true }),
      ]));
    });

    it('todos los movimientos apuntan a una cuenta sembrada', () => {
      const { docs } = construirSeedDemo(ctx());
      const ids = new Set(de(docs, 'cuentas').map((d) => d.path.split('/').pop()));
      for (const m of movs(docs)) expect(ids.has(m['cuentaId'])).toBe(true);
    });

    it('hay entradas y salidas en cada uno de los últimos 6 meses (gráficos del dashboard)', () => {
      const ms = movs(construirSeedDemo(ctx()).docs);
      for (let i = 0; i < 6; i++) {
        const d = new Date(2026, 9 - i, 1);
        const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const delMes = ms.filter((m) => String(m['fecha']).startsWith(mes));
        expect(delMes.some((m) => m['esEntrada']), `entradas ${mes}`).toBe(true);
        expect(delMes.some((m) => !m['esEntrada']), `salidas ${mes}`).toBe(true);
        expect(delMes.some((m) => m['tipo'] === 'honorario'), `honorarios ${mes}`).toBe(true);
      }
    });

    it('los movimientos de los últimos días quedan pendientes de aprobar (sin campo aprobado)', () => {
      const recientes = movs(construirSeedDemo(ctx()).docs).filter((m) => m['fecha'] > '2026-10-02');
      expect(recientes.length).toBeGreaterThan(0);
      for (const m of recientes) expect(m).not.toHaveProperty('aprobado');
    });

    it('el saldo bancario de la cuenta es el último saldo del extracto', () => {
      const { docs } = construirSeedDemo(ctx());
      for (const c of de(docs, 'cuentas').filter((d) => d.data['tipo'] === 'banco')) {
        const lineas = docs
          .filter((d) => d.path.startsWith(`${c.path}/extracto/`))
          .map((d) => d.data as Record<string, any>)
          .sort((a, b) => String(a['fecha']).localeCompare(String(b['fecha'])));
        expect(lineas.length).toBeGreaterThan(0);
        expect(c.data['saldoBancario']).toBe(lineas.at(-1)!['saldoPosterior']);
      }
    });

    it('varios cierres de caja con totales que cuadran', () => {
      const cierres = de(construirSeedDemo(ctx()).docs, 'cierres_caja').map((d) => d.data as Record<string, any>);
      expect(cierres.length).toBeGreaterThanOrEqual(3);
      expect(new Set(cierres.map((c) => c['fecha'])).size).toBe(cierres.length);
      for (const c of cierres) {
        const suma = (k: string) => Math.round(c['cuentas'].reduce((s: number, x: any) => s + x[k], 0) * 100) / 100;
        expect(c['totales']).toEqual({ ingresos: suma('ingresos'), egresos: suma('egresos'), sistemaTotal: suma('sistema'), aprobadoTotal: suma('aprobado') });
        expect(c['cuentas']).toHaveLength(2);
      }
    });
  });

  describe('Recepción IA', () => {
    it('llamadas del agente de la empresa, con contactos existentes y nuevos', () => {
      const { docs } = construirSeedDemo(ctx());
      const llamadas = de(docs, 'llamadas').map((d) => d.data as Record<string, any>);
      const contactos = de(docs, 'contactos').map((d) => ({ id: d.path.split('/').pop(), ...d.data }) as Record<string, any>);
      const digitos = (s?: string) => (s ?? '').replace(/\D/g, '');
      const telefonos = new Set(contactos.flatMap((c) => [digitos(c['phone']), digitos(c['mobile'])]).filter(Boolean));

      for (const l of llamadas) {
        expect(l['agentId']).toBe('agente-demo');
        expect(l['transcripcion'].length).toBeGreaterThanOrEqual(4);
        expect(l['resumen']).toBeTruthy();
      }
      const conocidas = llamadas.filter((l) => l['contactId'] || telefonos.has(digitos(l['datosCapturados'].telefono)));
      expect(conocidas.length).toBeGreaterThanOrEqual(3);
      expect(llamadas.length - conocidas.length).toBeGreaterThanOrEqual(3);
    });

    it('crea el mapeo del agente solo si la empresa no tiene uno', () => {
      expect(de(construirSeedDemo(ctx()).docs, 'agentMappings')).toHaveLength(1);
      const sinCrear = construirSeedDemo(ctx({ agente: { agentId: 'agente-real', crear: false } })).docs;
      expect(de(sinCrear, 'agentMappings')).toHaveLength(0);
      expect(de(sinCrear, 'llamadas').every((d) => d.data['agentId'] === 'agente-real')).toBe(true);
    });

    it('leads pendientes para la tarjeta del dashboard', () => {
      const leads = de(construirSeedDemo(ctx()).docs, 'iaContacts').map((d) => d.data as Record<string, any>);
      expect(leads.every((l) => l['companyId'] === CID)).toBe(true);
      expect(leads.filter((l) => l['status'] === 'pendiente').length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('agenda', () => {
    it('eventos de casos y de empresa, pasados y futuros', () => {
      const ev = de(construirSeedDemo(ctx()).docs, 'eventos').map((d) => d.data as Record<string, any>);
      expect(ev.filter((e) => e['fecha'] < '2026-10-06').length).toBeGreaterThanOrEqual(8);
      expect(ev.filter((e) => e['fecha'] >= '2026-10-06').length).toBeGreaterThanOrEqual(15);
      expect(ev.filter((e) => e['recurrencia'] !== 'ninguna').length).toBeGreaterThanOrEqual(2);
    });

    it('seguimientos del primer Admin, alguno vencido (tarjeta "Mis seguimientos")', () => {
      const segs = de(construirSeedDemo(ctx()).docs, 'eventos')
        .map((d) => d.data as Record<string, any>)
        .filter((e) => e['origen']?.tipo === 'seguimiento_contacto' && e['responsableId'] === 'u-admin');
      expect(segs.length).toBeGreaterThanOrEqual(2);
      expect(segs.some((e) => e['fecha'] < '2026-10-06')).toBe(true);
    });
  });

  it('exige al menos un miembro activo', () => {
    expect(() => construirSeedDemo(ctx({ miembros: [] }))).toThrow();
  });
});

describe('planDeEscritura', () => {
  const d = (path: string): DocSeed => ({ path, data: {} });

  it('omite los docs append-only que ya existen (sus rules prohíben update)', () => {
    const docs = [d('companies/c/accion_registros/demo-registro-01'), d('companies/c/accion_registros/demo-registro-02'), d('companies/c/casos/x')];
    const plan = planDeEscritura(docs, new Set(['companies/c/accion_registros/demo-registro-01']), 500);
    expect(plan.omitidos).toBe(1);
    expect(plan.lotes.flat().map((x) => x.path)).toEqual(['companies/c/accion_registros/demo-registro-02', 'companies/c/casos/x']);
  });

  it('parte en lotes del tamaño máximo', () => {
    const docs = Array.from({ length: 7 }, (_, i) => d(`companies/c/hitos/${i}`));
    expect(planDeEscritura(docs, new Set(), 3).lotes.map((l) => l.length)).toEqual([3, 3, 1]);
  });
});

describe('pathsObsoletos', () => {
  it('borra docs demo de versiones anteriores que ya no están en el seed, nunca datos reales', () => {
    const seed: DocSeed[] = [{ path: 'companies/c/cuentas/demo-cuenta-santander', data: {} }];
    expect(pathsObsoletos(
      [
        'companies/c/cuentas/demo-cuenta-santander',
        'companies/c/cuentas/demo-cuenta-operativa',
        'companies/c/cuentas/demo-cuenta-operativa/extracto/demo-linea-01',
        'companies/c/cuentas/cuenta-real',
      ],
      seed,
    )).toEqual([
      'companies/c/cuentas/demo-cuenta-operativa',
      'companies/c/cuentas/demo-cuenta-operativa/extracto/demo-linea-01',
    ]);
  });
});

describe('ultimaFacturaPorAnio', () => {
  it('toma el máximo por año ignorando las facturas demo y numeraciones ajenas', () => {
    expect(
      ultimaFacturaPorAnio(
        [
          { id: 'a', invoiceNumber: 'F-2026-0007' },
          { id: 'b', invoiceNumber: 'F-2026-0012' },
          { id: 'c', invoiceNumber: 'F-2025-0099' },
          { id: 'd', invoiceNumber: 'R-2026-0050' },
          { id: 'e', invoiceNumber: 'manual-1' },
          { id: `demo-${CID}-x`, invoiceNumber: 'F-2026-0500' },
        ],
        CID,
      ),
    ).toEqual({ '2026': 12, '2025': 99 });
  });
});
