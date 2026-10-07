import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Firestore } from '@angular/fire/firestore';
import { PlazosService } from './plazos.service';
import { CalendariosJudicialesService } from './calendarios-judiciales.service';
import { CompanyService } from './company.service';
import { EventosService } from './eventos.service';
import { UserSyncService } from './user-sync.service';
import type { CapaAnio } from '../plazos/dias-rojos';
import type { ResultadoPlazo } from '../plazos/computo-plazo';

const m = vi.hoisted(() => ({
  getDoc: vi.fn(),
  doc: vi.fn((...p: unknown[]) => ({ __doc: p.slice(1).join('/') })),
  collection: vi.fn((...p: unknown[]) => ({ __col: p.slice(1).join('/') })),
  query: vi.fn((...p: unknown[]) => ({ __q: p })),
  where: vi.fn((f: string, op: string, v: unknown) => ({ f, op, v })),
  collectionData: vi.fn(),
}));

vi.mock('@angular/fire/firestore', () => ({
  Firestore: class {},
  getDoc: (...a: unknown[]) => m.getDoc(...a),
  doc: (...a: unknown[]) => m.doc(...a),
  collection: (...a: unknown[]) => m.collection(...a),
  query: (...a: unknown[]) => m.query(...a),
  where: (...a: [string, string, unknown]) => m.where(...a),
  collectionData: (...a: unknown[]) => m.collectionData(...a),
}));

const confirmado = (fecha: string, nombre = 'Festivo', fuenteUrl?: string) =>
  ({ fecha, nombre, ambito: 'nacional', estado: 'confirmado', origen: 'manual', ...(fuenteUrl ? { fuenteUrl } : {}) }) as const;
const capaCon = (...dias: ReturnType<typeof confirmado>[]): CapaAnio => ({ diasRojos: dias, descartados: [] });

describe('PlazosService', () => {
  let svc: PlazosService;
  const calendarios = { capasDelCalculo: vi.fn() };
  const eventos = { createEvento: vi.fn(), updateEvento: vi.fn().mockResolvedValue(undefined) };

  const capasMock = (porAnio: Record<number, { ca?: CapaAnio; partido?: CapaAnio }>, advertencias: string[] = []) =>
    calendarios.capasDelCalculo.mockImplementation(async (_c: unknown, _ca: unknown, anios: number[]) => ({
      capas: { ca: 'ca-madrid', partido: undefined, advertencias },
      porAnio: new Map(anios.map((a) => [a, porAnio[a] ?? {}])),
      advertencias,
    }));

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        PlazosService,
        { provide: Firestore, useValue: {} },
        { provide: CompanyService, useValue: { activeCompany: signal({ id: 'c1', ca: 'madrid' }) } },
        { provide: UserSyncService, useValue: { currentUser: signal({ id: 'u1' }) } },
        { provide: CalendariosJudicialesService, useValue: calendarios },
        { provide: EventosService, useValue: eventos },
      ],
    });
    svc = TestBed.inject(PlazosService);
  });

  const input = {
    caso: { id: 'caso1', titulo: 'Pérez vs. Gómez' },
    fechaNotificacion: '2026-10-07', cantidad: 10, unidad: 'dias', jurisdiccion: 'civil',
  } as const;

  it('aplica solo días confirmados: 12/10 festivo alarga el plazo', async () => {
    capasMock({ 2026: { ca: capaCon(confirmado('2026-10-12', 'Fiesta Nacional')) } });
    const r = await svc.previsualizar({ ...input });
    // 10 hábiles desde el 8/10: 8,9,13,14,15,16,19,20,21,22 (10 y 11 fin de semana, 12 festivo)
    expect(r.resultado.vencimiento).toBe('2026-10-22');
    expect(r.resultado.diasInhabiles.map((d) => d.fecha)).toContain('2026-10-12');
  });

  it('expone la fuente (URL oficial) de los días rojos aplicados', async () => {
    capasMock({ 2026: { ca: capaCon(confirmado('2026-10-12', 'Fiesta Nacional', 'https://www.boe.es/x')) } });
    const r = await svc.previsualizar({ ...input });
    expect(r.fuentes).toEqual({ '2026-10-12': 'https://www.boe.es/x' });
  });

  it('un día propuesto (no confirmado) no cuenta', async () => {
    capasMock({ 2026: { ca: { diasRojos: [{ ...confirmado('2026-10-12'), estado: 'propuesto' }], descartados: [] } } });
    const r = await svc.previsualizar({ ...input });
    expect(r.resultado.vencimiento).toBe('2026-10-21');
  });

  it('respeta excluidosPorUsuario', async () => {
    capasMock({ 2026: { ca: capaCon(confirmado('2026-10-12')) } });
    const r = await svc.previsualizar({ ...input, excluidosPorUsuario: ['2026-10-12'] });
    expect(r.resultado.vencimiento).toBe('2026-10-21');
  });

  it('carga también el año siguiente si el vencimiento cruza año', async () => {
    capasMock({ 2026: { ca: capaCon(confirmado('2026-12-08')) }, 2027: { ca: capaCon(confirmado('2027-01-06', 'Reyes')) } });
    const r = await svc.previsualizar({ ...input, fechaNotificacion: '2026-12-28', cantidad: 5 });
    // 29,30 (24 y 31 dic inhábiles: 31 no), 1/1 festivo? no está confirmado; el 6/1 sí
    const aniosPedidos = calendarios.capasDelCalculo.mock.calls.map((c) => c[2] as number[]);
    expect(aniosPedidos.at(-1)).toEqual([2026, 2027]);
    expect(r.resultado.vencimiento.startsWith('2027-')).toBe(true);
  });

  it('avisa de sin_partido y de años sin calendario confirmado', async () => {
    capasMock({ 2026: {} }, ['sin_partido']);
    const r = await svc.previsualizar({ ...input });
    expect(r.advertencias.some((a) => a.includes('partido judicial'))).toBe(true);
    expect(r.advertencias).toContain('No hay días inhábiles confirmados para 2026');
    expect(r.capas.ca).toBe('ca-madrid');
  });

  it('un año con al menos un día confirmado cuenta como calendario confirmado', async () => {
    capasMock({ 2026: { ca: capaCon(confirmado('2026-12-08')) } });
    const r = await svc.previsualizar({ ...input });
    expect(r.advertencias.some((a) => a.includes('No hay días inhábiles'))).toBe(false);
  });

  const resultado: ResultadoPlazo = {
    inicio: '2026-10-08', vencimiento: '2026-10-21', diaGracia: '2026-10-22', diasInhabiles: [], advertencias: [],
  };

  it('guardar crea el evento vía EventosService con la aceptación del usuario actual', async () => {
    eventos.createEvento.mockResolvedValue({ id: 'e1' });
    const ev = await svc.guardar(
      'caso1',
      {
        fechaNotificacion: '2026-10-07', cantidad: 10, unidad: 'dias', jurisdiccion: 'civil',
        etiqueta: 'Contestación', casoTitulo: 'Pérez vs. Gómez', capas: { ca: 'ca-madrid' },
      },
      resultado,
      ['2026-10-12'],
    );
    expect(ev).toEqual({ id: 'e1' });
    const data = eventos.createEvento.mock.calls[0][0];
    expect(data).toMatchObject({ fecha: '2026-10-21', todoDia: true, prioridad: 'alta', color: 'rojo' });
    expect(data.titulo).toBe('Vence plazo: Contestación · Pérez vs. Gómez');
    expect(data.origen).toMatchObject({
      tipo: 'plazo_procesal', casoId: 'caso1', estadoPlazo: 'vigente',
      aceptacion: { aceptadoPor: 'u1', excluidosPorUsuario: ['2026-10-12'], vencimiento: '2026-10-21' },
    });
    expect(typeof data.origen.aceptacion.aceptadoAt).toBe('string');
  });

  const eventoGuardado = {
    exists: () => true,
    id: 'e1',
    data: () => ({
      fecha: '2026-10-21', titulo: 'Vence plazo: X',
      origen: {
        tipo: 'plazo_procesal', casoId: 'caso1', capas: { ca: 'ca-madrid' },
        entrada: { fechaNotificacion: '2026-10-07', cantidad: 10, unidad: 'dias', jurisdiccion: 'civil' },
        aceptacion: { diasInhabiles: [], excluidosPorUsuario: [], aceptadoPor: 'u0', aceptadoAt: 'antes', vencimiento: '2026-10-21' },
        estadoPlazo: 'requiere_revision',
        revision: { vencimientoNuevo: '2026-10-22', seAdelanta: false, detectadoAt: 'x' },
      },
    }),
  };

  it('aceptarRevision actualiza fecha y aceptación, vuelve a vigente y limpia la revisión', async () => {
    m.getDoc.mockResolvedValue(eventoGuardado);
    await svc.aceptarRevision('e1', { ...resultado, vencimiento: '2026-10-22', diaGracia: '2026-10-23' });
    const [id, data] = eventos.updateEvento.mock.calls[0];
    expect(id).toBe('e1');
    expect(data.fecha).toBe('2026-10-22');
    expect(data.origen.estadoPlazo).toBe('vigente');
    expect('revision' in data.origen).toBe(false);
    expect(data.origen.aceptacion).toMatchObject({ aceptadoPor: 'u1', vencimiento: '2026-10-22' });
    expect(data.origen.entrada.cantidad).toBe(10);
  });

  it('aceptarRevision guarda los excluidos que el usuario revisó si se informan', async () => {
    m.getDoc.mockResolvedValue(eventoGuardado);
    await svc.aceptarRevision('e1', { ...resultado, vencimiento: '2026-10-22', diaGracia: '2026-10-23' }, ['2026-10-12']);
    expect(eventos.updateEvento.mock.calls[0][1].origen.aceptacion.excluidosPorUsuario).toEqual(['2026-10-12']);
  });

  it('marcarCumplido pone estadoPlazo cumplido y el evento como completado', async () => {
    m.getDoc.mockResolvedValue(eventoGuardado);
    await svc.marcarCumplido('e1');
    const [, data] = eventos.updateEvento.mock.calls[0];
    expect(data.estado).toBe('completado');
    expect(data.origen.estadoPlazo).toBe('cumplido');
  });

  it('aceptarRevision falla si el evento no es un plazo', async () => {
    m.getDoc.mockResolvedValue({ exists: () => true, id: 'e2', data: () => ({ fecha: 'x' }) });
    await expect(svc.marcarCumplido('e2')).rejects.toThrow();
  });

  it('plazosDelCaso filtra por origen.tipo y origen.casoId dentro de la empresa', () => {
    m.collectionData.mockReturnValue('stream');
    expect(svc.plazosDelCaso('caso1')).toBe('stream');
    expect(m.collection).toHaveBeenCalledWith({}, 'companies', 'c1', 'eventos');
    expect(m.where).toHaveBeenCalledWith('origen.tipo', '==', 'plazo_procesal');
    expect(m.where).toHaveBeenCalledWith('origen.casoId', '==', 'caso1');
  });
});
