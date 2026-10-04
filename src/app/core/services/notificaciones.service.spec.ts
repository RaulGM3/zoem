import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Firestore } from '@angular/fire/firestore';
import { NotificacionesService } from './notificaciones.service';
import { AuthService } from '../../auth/auth.service';
import { CompanyService } from './company.service';

const h = vi.hoisted(() => {
  const state: {
    next: ((snap: unknown) => void) | null;
    error: ((e: unknown) => void) | null;
    unsub: ReturnType<typeof vi.fn>;
  } = { next: null, error: null, unsub: vi.fn() };
  const batch = { update: vi.fn(), commit: vi.fn().mockResolvedValue(undefined) };
  return {
    state,
    batch,
    onSnapshot: vi.fn(),
    updateDoc: vi.fn().mockResolvedValue(undefined),
    where: vi.fn((...a: unknown[]) => ({ where: a })),
    orderBy: vi.fn((...a: unknown[]) => ({ orderBy: a })),
    limit: vi.fn((n: number) => ({ limit: n })),
    query: vi.fn((...a: unknown[]) => ({ query: a })),
    collection: vi.fn((_f: unknown, ...p: string[]) => ({ path: p.join('/') })),
    doc: vi.fn((_f: unknown, ...p: string[]) => ({ path: p.join('/') })),
    writeBatch: vi.fn(() => batch),
  };
});

vi.mock('@angular/fire/firestore', () => ({
  Firestore: class MockFirestore {},
  onSnapshot: (...a: unknown[]) => h.onSnapshot(...a),
  updateDoc: (...a: unknown[]) => h.updateDoc(...a),
  where: (...a: unknown[]) => h.where(...a),
  orderBy: (...a: unknown[]) => h.orderBy(...a),
  limit: (n: number) => h.limit(n),
  query: (...a: unknown[]) => h.query(...a),
  collection: (...a: [unknown, ...string[]]) => h.collection(...a),
  doc: (...a: [unknown, ...string[]]) => h.doc(...a),
  writeBatch: () => h.writeBatch(),
}));

function snap(items: Record<string, unknown>[]) {
  return {
    docs: items.map((d) => ({
      id: d['id'] as string,
      data: () => {
        const { id: _id, ...rest } = d;
        return rest;
      },
    })),
  };
}

function item(id: string, leida: boolean, createdAt: unknown = null): Record<string, unknown> {
  return { id, userId: 'u1', tipo: 'casos', titulo: 't' + id, cuerpo: 'b' + id, route: '/casos/' + id, leida, createdAt };
}

const ts = (ms: number) => ({ toDate: () => new Date(ms) });

describe('NotificacionesService', () => {
  const user = signal<{ uid: string } | null>(null);
  const company = signal<{ id: string } | null>(null);

  function setup(): NotificacionesService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: Firestore, useValue: {} },
        { provide: AuthService, useValue: { user } },
        { provide: CompanyService, useValue: { activeCompany: company } },
      ],
    });
    const svc = TestBed.inject(NotificacionesService);
    TestBed.tick();
    return svc;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    h.state.next = null;
    h.state.error = null;
    h.state.unsub = vi.fn();
    h.onSnapshot.mockImplementation((_q: unknown, next: (s: unknown) => void, error?: (e: unknown) => void) => {
      h.state.next = next;
      h.state.error = error ?? null;
      return h.state.unsub;
    });
    user.set(null);
    company.set(null);
  });

  function login(): void {
    user.set({ uid: 'u1' });
    company.set({ id: 'c1' });
  }

  it('does not subscribe without user or company', () => {
    const svc = setup();
    expect(h.onSnapshot).not.toHaveBeenCalled();
    expect(svc.notificaciones()).toEqual([]);
    expect(svc.noLeidas()).toBe(0);
  });

  it('does not subscribe with a user but no company', () => {
    user.set({ uid: 'u1' });
    setup();
    expect(h.onSnapshot).not.toHaveBeenCalled();
  });

  it('subscribes to the company collection filtered by uid, newest first, limit 50', () => {
    login();
    setup();
    expect(h.collection).toHaveBeenCalledWith(expect.anything(), 'companies', 'c1', 'notificaciones');
    expect(h.where).toHaveBeenCalledWith('userId', '==', 'u1');
    expect(h.orderBy).toHaveBeenCalledWith('createdAt', 'desc');
    expect(h.limit).toHaveBeenCalledWith(50);
    expect(h.onSnapshot).toHaveBeenCalledTimes(1);
  });

  it('maps docs into notificaciones and counts unread', () => {
    login();
    const svc = setup();
    h.state.next!(snap([item('a', false, ts(1000)), item('b', true)]));
    expect(svc.notificaciones().map((n) => n.id)).toEqual(['a', 'b']);
    expect(svc.notificaciones()[0].createdAt).toEqual(new Date(1000));
    expect(svc.notificaciones()[1].createdAt).toBeNull();
    expect(svc.noLeidas()).toBe(1);
  });

  it('unsubscribes and clears on logout', () => {
    login();
    const svc = setup();
    h.state.next!(snap([item('a', false)]));
    const unsub = h.state.unsub;
    user.set(null);
    TestBed.tick();
    expect(unsub).toHaveBeenCalled();
    expect(svc.notificaciones()).toEqual([]);
    expect(svc.noLeidas()).toBe(0);
  });

  it('resubscribes (closing the old one) when the company changes', () => {
    login();
    setup();
    const first = h.state.unsub;
    company.set({ id: 'c2' });
    TestBed.tick();
    expect(first).toHaveBeenCalled();
    expect(h.onSnapshot).toHaveBeenCalledTimes(2);
    expect(h.collection).toHaveBeenLastCalledWith(expect.anything(), 'companies', 'c2', 'notificaciones');
  });

  it('keeps the list empty (no throw) when the listener errors', () => {
    login();
    const svc = setup();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    h.state.error!(new Error('boom'));
    expect(svc.notificaciones()).toEqual([]);
    spy.mockRestore();
  });

  it('marcarLeida updates only leida:true on the doc', async () => {
    login();
    const svc = setup();
    await svc.marcarLeida('n1');
    expect(h.doc).toHaveBeenCalledWith(expect.anything(), 'companies', 'c1', 'notificaciones', 'n1');
    expect(h.updateDoc).toHaveBeenCalledWith({ path: 'companies/c1/notificaciones/n1' }, { leida: true });
  });

  it('marcarLeida is a no-op without active company', async () => {
    const svc = setup();
    await svc.marcarLeida('n1');
    expect(h.updateDoc).not.toHaveBeenCalled();
  });

  it('marcarTodasLeidas batches only the unread ones', async () => {
    login();
    const svc = setup();
    h.state.next!(snap([item('a', false), item('b', true), item('c', false)]));
    await svc.marcarTodasLeidas();
    expect(h.batch.update).toHaveBeenCalledTimes(2);
    expect(h.batch.update).toHaveBeenCalledWith({ path: 'companies/c1/notificaciones/a' }, { leida: true });
    expect(h.batch.update).toHaveBeenCalledWith({ path: 'companies/c1/notificaciones/c' }, { leida: true });
    expect(h.batch.commit).toHaveBeenCalledTimes(1);
  });

  it('marcarTodasLeidas does nothing when everything is read', async () => {
    login();
    const svc = setup();
    h.state.next!(snap([item('a', true)]));
    await svc.marcarTodasLeidas();
    expect(h.writeBatch).not.toHaveBeenCalled();
  });
});
