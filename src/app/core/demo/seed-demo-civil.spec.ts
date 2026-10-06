import { describe, it, expect } from 'vitest';
import { construirSeedDemo, planDeEscritura, ultimaFacturaPorAnio, type ContextoSeed, type DocSeed } from './seed-demo-civil';
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
  ...over,
});

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
    expect(de(docs, 'contactos')).toHaveLength(10);
    expect(de(docs, 'casoPlantillas')).toHaveLength(5);
    expect(de(docs, 'casos')).toHaveLength(10);
    expect(de(docs, 'hitos').length).toBeGreaterThan(60);
    expect(de(docs, 'invoices').length).toBeGreaterThanOrEqual(6);
    expect(de(docs, 'cuentas')).toHaveLength(3);
    expect(de(docs, 'extracto').length).toBeGreaterThan(5);
    expect(de(docs, 'movimientos_generales').length).toBeGreaterThan(5);
    expect(de(docs, 'eventos').length).toBeGreaterThan(10);
    expect(de(docs, 'acciones').length).toBeGreaterThan(3);
  });

  it('todo vive bajo la empresa salvo las facturas emitidas (colección raíz)', () => {
    const { docs } = construirSeedDemo(ctx());
    for (const d of docs) {
      expect(d.path.startsWith(`companies/${CID}/`) || d.path.startsWith('invoices/')).toBe(true);
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
