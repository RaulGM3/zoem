import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Firestore } from '@angular/fire/firestore';
import { UsoService } from './uso.service';
import { PlanService } from './plan.service';
import { CompanyService, type Company } from '../services/company.service';

const h = vi.hoisted(() => ({
  oyentes: new Map<string, { next: (s: unknown) => void; unsub: ReturnType<typeof vi.fn> }>(),
  onSnapshot: vi.fn(),
  doc: vi.fn((_f: unknown, ...p: string[]) => ({ path: p.join('/') })),
}));

vi.mock('@angular/fire/firestore', () => ({
  Firestore: class MockFirestore {},
  doc: (...a: [unknown, ...string[]]) => h.doc(...a),
  onSnapshot: (ref: { path: string }, next: (s: unknown) => void, _err?: unknown) => {
    const unsub = vi.fn();
    h.oyentes.set(ref.path, { next, unsub });
    h.onSnapshot(ref.path);
    return unsub;
  },
}));

const snapDe = (data: Record<string, number> | null) => ({ exists: () => data !== null, data: () => data ?? undefined });
const empresa = (id: string): Company => ({ id, name: id, slug: id, isActive: true });

describe('UsoService', () => {
  const activeCompany = signal<Company | null>(null);
  let svc: UsoService;

  beforeEach(() => {
    h.oyentes.clear();
    h.onSnapshot.mockClear();
    activeCompany.set(null);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: Firestore, useValue: {} },
        { provide: CompanyService, useValue: { activeCompany } },
        { provide: PlanService, useValue: { ahora: signal(new Date('2026-10-09T12:00:00Z')) } },
      ],
    });
    svc = TestBed.inject(UsoService);
  });

  it('sin empresa activa no escucha nada', () => {
    TestBed.tick();
    expect(h.onSnapshot).not.toHaveBeenCalled();
    expect(svc.usado('plantillas')).toBe(0);
  });

  it('escucha uso/total y uso/<mes> de la empresa activa y expone lo usado', () => {
    activeCompany.set(empresa('c1'));
    TestBed.tick();
    expect([...h.oyentes.keys()].sort()).toEqual(['companies/c1/uso/2026-10', 'companies/c1/uso/total']);

    h.oyentes.get('companies/c1/uso/total')!.next(snapDe({ plantillas: 4, documentosBytes: 3 * 1_048_576 }));
    h.oyentes.get('companies/c1/uso/2026-10')!.next(snapDe({ accionesMes: 12 }));
    expect(svc.usado('plantillas')).toBe(4);
    expect(svc.usado('documentosMB')).toBe(3);
    expect(svc.usado('accionesMes')).toBe(12);
    expect(svc.usado('iaMensajesMes')).toBe(0);
  });

  it('un doc que aún no existe cuenta como 0', () => {
    activeCompany.set(empresa('c1'));
    TestBed.tick();
    h.oyentes.get('companies/c1/uso/total')!.next(snapDe({ plantillas: 4 }));
    h.oyentes.get('companies/c1/uso/total')!.next(snapDe(null));
    expect(svc.usado('plantillas')).toBe(0);
  });

  it('al cambiar de empresa cierra las escuchas y vacía los contadores', () => {
    activeCompany.set(empresa('c1'));
    TestBed.tick();
    const primeras = [...h.oyentes.values()];
    primeras[0].next(snapDe({ plantillas: 4 }));
    activeCompany.set(empresa('c2'));
    TestBed.tick();
    for (const o of primeras) expect(o.unsub).toHaveBeenCalled();
    expect(svc.usado('plantillas')).toBe(0);
    expect(h.oyentes.has('companies/c2/uso/total')).toBe(true);
  });
});
