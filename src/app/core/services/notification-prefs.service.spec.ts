import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Firestore } from '@angular/fire/firestore';
import { DEFAULT_PREFS, NotificationPrefsService, resolvePrefs } from './notification-prefs.service';

const h = vi.hoisted(() => ({
  getDoc: vi.fn(),
  updateDoc: vi.fn().mockResolvedValue(undefined),
  doc: vi.fn((_f: unknown, ...p: string[]) => ({ path: p.join('/') })),
}));

vi.mock('@angular/fire/firestore', () => ({
  Firestore: class MockFirestore {},
  doc: (...a: [unknown, ...string[]]) => h.doc(...a),
  getDoc: (...a: unknown[]) => h.getDoc(...a),
  updateDoc: (...a: unknown[]) => h.updateDoc(...a),
}));

describe('resolvePrefs', () => {
  it('defaults every key to true when nothing is stored', () => {
    expect(resolvePrefs(undefined)).toEqual({
      llamadas: true,
      casos: true,
      contactos: true,
      eventos: true,
      hitos: true,
      push: true,
    });
    expect(resolvePrefs(null)).toEqual(DEFAULT_PREFS);
  });

  it('keeps explicit false and fills missing keys with true', () => {
    expect(resolvePrefs({ casos: false, push: false })).toEqual({
      llamadas: true,
      casos: false,
      contactos: true,
      eventos: true,
      hitos: true,
      push: false,
    });
  });

  it('ignores unknown keys and non-boolean values', () => {
    const r = resolvePrefs({ foo: true, llamadas: 'no' } as unknown as Record<string, unknown>);
    expect(r).toEqual(DEFAULT_PREFS);
    expect('foo' in r).toBe(false);
  });
});

describe('NotificationPrefsService', () => {
  let svc: NotificationPrefsService;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: Firestore, useValue: {} }] });
    svc = TestBed.inject(NotificationPrefsService);
  });

  it('load returns stored prefs merged with defaults', async () => {
    h.getDoc.mockResolvedValue({ exists: () => true, data: () => ({ notificationPrefs: { eventos: false } }) });
    const prefs = await svc.load('u1');
    expect(h.doc).toHaveBeenCalledWith(expect.anything(), 'users', 'u1');
    expect(prefs).toEqual({ ...DEFAULT_PREFS, eventos: false });
  });

  it('load returns defaults when the user doc is missing', async () => {
    h.getDoc.mockResolvedValue({ exists: () => false, data: () => undefined });
    expect(await svc.load('u1')).toEqual(DEFAULT_PREFS);
  });

  it('load returns defaults when the user has no prefs yet', async () => {
    h.getDoc.mockResolvedValue({ exists: () => true, data: () => ({ email: 'a@b.c' }) });
    expect(await svc.load('u1')).toEqual(DEFAULT_PREFS);
  });

  it('save writes the full notificationPrefs map with updateDoc on users/{uid}', async () => {
    const prefs = { ...DEFAULT_PREFS, hitos: false };
    await svc.save('u1', prefs);
    expect(h.updateDoc).toHaveBeenCalledWith({ path: 'users/u1' }, { notificationPrefs: prefs });
  });

  it('save writes only the six known keys', async () => {
    await svc.save('u1', { ...DEFAULT_PREFS, extra: true } as never);
    const [, data] = h.updateDoc.mock.calls[0];
    expect(Object.keys((data as { notificationPrefs: object }).notificationPrefs).sort()).toEqual(
      ['casos', 'contactos', 'eventos', 'hitos', 'llamadas', 'push'],
    );
  });

  it('save propagates errors so the caller can toast', async () => {
    h.updateDoc.mockRejectedValueOnce(new Error('permission-denied'));
    await expect(svc.save('u1', DEFAULT_PREFS)).rejects.toThrow('permission-denied');
  });
});
