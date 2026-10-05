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
      createChannel: vi.fn().mockResolvedValue(undefined),
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

interface FakePlatform {
  isNative: boolean;
  isAndroid: boolean;
  platform: string;
}

const IOS: FakePlatform = { isNative: true, isAndroid: false, platform: 'ios' };
const ANDROID: FakePlatform = { isNative: true, isAndroid: true, platform: 'android' };
const WEB: FakePlatform = { isNative: false, isAndroid: false, platform: 'web' };

describe('PushNotificationService', () => {
  let currentUser: { uid: string } | null;

  function setup(platform: FakePlatform = IOS): PushNotificationService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        PushNotificationService,
        { provide: PlatformService, useValue: platform },
        { provide: Auth, useValue: { get currentUser() { return currentUser; } } },
        { provide: Firestore, useValue: {} },
        { provide: Router, useValue: { navigateByUrl: vi.fn() } },
        { provide: ToastService, useValue: { info: vi.fn() } },
      ],
    });
    return TestBed.inject(PushNotificationService);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockPush.requestPermissions.mockResolvedValue({ receive: 'granted' });
    for (const k of Object.keys(listeners)) delete listeners[k];
    currentUser = { uid: 'u1' };
  });

  describe('init', () => {
    it('does nothing on web', async () => {
      await setup(WEB).init();
      expect(mockPush.requestPermissions).not.toHaveBeenCalled();
      expect(mockPush.createChannel).not.toHaveBeenCalled();
    });

    it('creates the default high-importance channel on Android', async () => {
      await setup(ANDROID).init();
      expect(mockPush.createChannel).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'general', importance: 4 }),
      );
      expect(mockPush.register).toHaveBeenCalled();
    });

    it('does not create a channel on iOS', async () => {
      await setup(IOS).init();
      expect(mockPush.createChannel).not.toHaveBeenCalled();
      expect(mockPush.register).toHaveBeenCalled();
    });

    it('does not register when permission is denied', async () => {
      mockPush.requestPermissions.mockResolvedValue({ receive: 'denied' });
      await setup(ANDROID).init();
      expect(mockPush.register).not.toHaveBeenCalled();
    });

    it('init repetido (re-login) no duplica listeners', async () => {
      const service = setup();
      await service.init();
      await service.init();
      const registrationCalls = mockPush.addListener.mock.calls.filter((c) => c[0] === 'registration');
      expect(registrationCalls).toHaveLength(1);
    });
  });

  describe('token', () => {
    let service: PushNotificationService;

    async function registerToken(): Promise<void> {
      await service.init();
      listeners['registration']({ value: 'tok-1' });
      await vi.waitFor(() => expect(mockSetDoc).toHaveBeenCalled());
    }

    beforeEach(() => {
      service = setup();
    });

    it('guarda el token con lastSeenAt usando merge', async () => {
      await registerToken();
      const [ref, data, options] = mockSetDoc.mock.calls[0];
      expect(ref).toBe('ref:tok-1');
      expect(data).toMatchObject({ token: 'tok-1', platform: 'ios', lastSeenAt: '__ts__' });
      expect(options).toEqual({ merge: true });
    });

    it('unregister borra el doc del token guardado', async () => {
      await registerToken();
      await service.unregister();
      expect(mockDeleteDoc).toHaveBeenCalledWith('ref:tok-1');
    });

    it('unregister sin token registrado no hace nada', async () => {
      await service.unregister();
      expect(mockDeleteDoc).not.toHaveBeenCalled();
    });

    it('unregister olvida el token: una segunda llamada no vuelve a borrar', async () => {
      await registerToken();
      await service.unregister();
      await service.unregister();
      expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
    });

    it('unregister no lanza si el borrado falla', async () => {
      await registerToken();
      mockDeleteDoc.mockRejectedValueOnce(new Error('offline'));
      await expect(service.unregister()).resolves.toBeUndefined();
    });
  });
});
