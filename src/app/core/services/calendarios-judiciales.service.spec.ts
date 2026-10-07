import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Firestore } from '@angular/fire/firestore';
import { CalendariosJudicialesService } from './calendarios-judiciales.service';
import { CompanyService } from './company.service';
import { UserSyncService } from './user-sync.service';
import type { CapaAnio } from '../plazos/dias-rojos';

const m = vi.hoisted(() => ({
  getDoc: vi.fn(),
  setDoc: vi.fn().mockResolvedValue(undefined),
  doc: vi.fn((...p: unknown[]) => ({ __doc: p.slice(1).join('/') })),
  txGet: vi.fn(),
  txSet: vi.fn(),
  runTransaction: vi.fn(),
}));

vi.mock('@angular/fire/firestore', () => ({
  Firestore: class {},
  getDoc: (...a: unknown[]) => m.getDoc(...a),
  setDoc: (...a: unknown[]) => m.setDoc(...a),
  doc: (...a: unknown[]) => m.doc(...a),
  runTransaction: (...a: unknown[]) => m.runTransaction(...a),
  serverTimestamp: () => '__ts__',
}));

const snap = (data?: CapaAnio) => ({ exists: () => !!data, data: () => data });
const propuesto = { fecha: '2026-10-12', nombre: 'Fiesta Nacional', ambito: 'nacional', estado: 'propuesto', origen: 'ia' } as const;

describe('CalendariosJudicialesService', () => {
  let svc: CalendariosJudicialesService;

  beforeEach(() => {
    vi.clearAllMocks();
    m.runTransaction.mockImplementation(async (_fs: unknown, fn: (tx: unknown) => Promise<void>) =>
      fn({ get: m.txGet, set: m.txSet }));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        CalendariosJudicialesService,
        { provide: Firestore, useValue: {} },
        { provide: CompanyService, useValue: { activeCompany: signal({ id: 'c1' }) } },
        { provide: UserSyncService, useValue: { currentUser: signal({ id: 'u1' }) } },
      ],
    });
    svc = TestBed.inject(CalendariosJudicialesService);
  });

  it('obtenerCapa lee companies/{cid}/calendariosJudiciales/{capa}/anios/{anio}', async () => {
    m.getDoc.mockResolvedValue(snap({ diasRojos: [propuesto], descartados: [] }));
    const capa = await svc.obtenerCapa('ca-madrid', 2026);
    expect(m.doc).toHaveBeenCalledWith({}, 'companies', 'c1', 'calendariosJudiciales', 'ca-madrid', 'anios', '2026');
    expect(capa?.diasRojos).toHaveLength(1);
  });

  it('obtenerCapa devuelve undefined si no existe', async () => {
    m.getDoc.mockResolvedValue(snap());
    expect(await svc.obtenerCapa('ca-madrid', 2026)).toBeUndefined();
  });

  it('capasDelCalculo resuelve ids y carga cada capa por año; avisa sin_partido', async () => {
    m.getDoc.mockResolvedValue(snap({ diasRojos: [], descartados: [] }));
    const r = await svc.capasDelCalculo({}, 'madrid', [2026, 2027]);
    expect(r.capas.ca).toBe('ca-madrid');
    expect(r.capas.partido).toBeUndefined();
    expect(r.advertencias).toEqual(['sin_partido']);
    expect([...r.porAnio.keys()]).toEqual([2026, 2027]);
    expect(m.getDoc).toHaveBeenCalledTimes(2);
  });

  it('capasDelCalculo con partido carga CA y partido', async () => {
    m.getDoc.mockResolvedValue(snap());
    const r = await svc.capasDelCalculo({ partidoJudicialId: '28-21' }, 'cataluna', [2026]);
    expect(r.capas).toMatchObject({ ca: 'ca-madrid', partido: 'pj-28-21' });
    expect(r.advertencias).toEqual([]);
    expect(m.getDoc).toHaveBeenCalledTimes(2);
  });

  it('añadirManual escribe en transacción un día confirmado manual con auditoría', async () => {
    m.txGet.mockResolvedValue(snap());
    await svc.añadirManual('pj-28-21', 2026, { fecha: '2026-05-02', nombre: 'Local', ambito: 'local' });
    const [ref, data] = m.txSet.mock.calls[0];
    expect(ref).toEqual({ __doc: 'companies/c1/calendariosJudiciales/pj-28-21/anios/2026' });
    expect(data.diasRojos[0]).toMatchObject({ fecha: '2026-05-02', estado: 'confirmado', origen: 'manual', confirmadoPor: 'u1' });
    expect(data).toMatchObject({ updatedBy: 'u1', updatedAt: '__ts__' });
  });

  it('quitar elimina el día y lo pasa a descartados', async () => {
    m.txGet.mockResolvedValue(snap({ diasRojos: [propuesto], descartados: [] }));
    await svc.quitar('ca-madrid', 2026, '2026-10-12');
    const data = m.txSet.mock.calls[0][1];
    expect(data.diasRojos).toEqual([]);
    expect(data.descartados).toEqual(['2026-10-12']);
  });

  it('confirmar y confirmarTodos marcan confirmado por el usuario actual', async () => {
    m.txGet.mockResolvedValue(snap({ diasRojos: [propuesto], descartados: [] }));
    await svc.confirmar('ca-madrid', 2026, '2026-10-12');
    expect(m.txSet.mock.calls[0][1].diasRojos[0]).toMatchObject({ estado: 'confirmado', confirmadoPor: 'u1' });
    await svc.confirmarTodos('ca-madrid', 2026);
    expect(m.txSet.mock.calls[1][1].diasRojos[0]).toMatchObject({ estado: 'confirmado', confirmadoPor: 'u1' });
  });

  it('guardarFusion guarda la capa con la marca de búsqueda IA', async () => {
    const busqueda = { ejecutadaAt: 'now', ejecutadaPor: 'u1', propuestos: 3 };
    await svc.guardarFusion('ca-madrid', 2026, { diasRojos: [propuesto], descartados: [] }, busqueda);
    const [ref, data] = m.setDoc.mock.calls[0];
    expect(ref).toEqual({ __doc: 'companies/c1/calendariosJudiciales/ca-madrid/anios/2026' });
    expect(data).toMatchObject({ ultimaBusquedaIa: busqueda, updatedBy: 'u1' });
  });
});
