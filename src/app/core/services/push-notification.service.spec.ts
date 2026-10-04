import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';
import { PushNotificationService } from './push-notification.service';
import { PlatformService } from './platform.service';
import { ToastService } from './toast.service';

const { mockSetDoc, mockDeleteDoc, mockDoc, listeners, mockPush } = vi.hoisted(() => {
  const listeners: Record<string, (arg: unknown) => void> = {};
  return {
    mockSetDoc: vi.fn().mockResolvedValue(undefined),
    mockDeleteDoc: vi.fn().mockResolvedValue(undefined),
    mockDoc: vi.fn((_col: unknown, id: string) => `ref:${id}`),
    listeners,
    mockPush: {
      requestPermissions: vi.fn().mockResolvedValue({ receive: 'granted' }),
      register: vi.fn().mockResolvedValue(undefined),
      addListener: vi.fn((name: string, cb: (arg: unknown) => void) => {
        listeners[name] = cb;
        return Promise.resolve({ remove: vi.fn() });
      }),
    },
  };
});

vi.mock('@angular/fire/firestore', () => ({
  Firestore: class MockFirestore {},
  collection: vi.fn().mockReturnValue('col'),
  doc: (...args: [unknown, string]) => mockDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  serverTimestamp: () => '__ts__',
}));

vi.mock('@angular/fire/auth', () => ({ Auth: class MockAuth {} }));

vi.mock('@capacitor/push-notifications', () => ({ PushNotifications: mockPush }));

describe('PushNotificationService', () => {
  let service: PushNotificationService;
  let currentUser: { uid: string } | null;

  beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(listeners)) delete listeners[k];
    currentUser = { uid: 'u1' };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        PushNotificationService,
        { provide: PlatformService, useValue: { isNative: true, platform: 'ios' } },
        { provide: Auth, useValue: { get currentUser() { return currentUser; } } },
        { provide: Firestore, useValue: {} },
        { provide: Router, useValue: { navigateByUrl: vi.fn() } },
        { provide: ToastService, useValue: { info: vi.fn() } },
      ],
    });
    service = TestBed.inject(PushNotificationService);
  });

  it('guarda el token con lastSeenAt usando merge', async () => {
    await service.init();
    listeners['registration']({ value: 'tok-1' });
    await vi.waitFor(() => expect(mockSetDoc).toHaveBeenCalled());

    const [ref, data, options] = mockSetDoc.mock.calls[0];
    expect(ref).toBe('ref:tok-1');
    expect(data).toMatchObject({ token: 'tok-1', platform: 'ios', lastSeenAt: '__ts__' });
    expect(options).toEqual({ merge: true });
  });

  it('unregister borra el doc del token guardado', async () => {
    await service.init();
    listeners['registration']({ value: 'tok-1' });
    await vi.waitFor(() => expect(mockSetDoc).toHaveBeenCalled());

    await service.unregister();
    expect(mockDeleteDoc).toHaveBeenCalledWith('ref:tok-1');
  });

  it('unregister sin token registrado no hace nada', async () => {
    await service.unregister();
    expect(mockDeleteDoc).not.toHaveBeenCalled();
  });

  it('unregister olvida el token: una segunda llamada no vuelve a borrar', async () => {
    await service.init();
    listeners['registration']({ value: 'tok-1' });
    await vi.waitFor(() => expect(mockSetDoc).toHaveBeenCalled());
    await service.unregister();
    await service.unregister();
    expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
  });

  it('unregister no lanza si el borrado falla', async () => {
    await service.init();
    listeners['registration']({ value: 'tok-1' });
    await vi.waitFor(() => expect(mockSetDoc).toHaveBeenCalled());
    mockDeleteDoc.mockRejectedValueOnce(new Error('offline'));
    await expect(service.unregister()).resolves.toBeUndefined();
  });

  it('init repetido (re-login) no duplica listeners', async () => {
    await service.init();
    await service.init();
    const registrationCalls = mockPush.addListener.mock.calls.filter((c) => c[0] === 'registration');
    expect(registrationCalls).toHaveLength(1);
  });
});
