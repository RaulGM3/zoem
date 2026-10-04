import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';
import { Messaging } from '@angular/fire/messaging';
import { PushNotificationService } from './push-notification.service';
import { PlatformService } from './platform.service';
import { ToastService } from './toast.service';
import { environment } from '../../../environments/environment';

/** El environment real se muta por test (vi.mock no soporta imports relativos en Angular). */
const env = environment as unknown as { vapidKey?: string; firebase: Record<string, unknown> };
const original = { vapidKey: env.vapidKey, firebase: { ...env.firebase } };

const h = vi.hoisted(() => ({
  setDoc: vi.fn().mockResolvedValue(undefined),
  deleteDoc: vi.fn().mockResolvedValue(undefined),
  getToken: vi.fn(),
  deleteToken: vi.fn().mockResolvedValue(true),
  onMessage: vi.fn(),
  unsubMessage: vi.fn(),
}));

vi.mock('@angular/fire/firestore', () => ({
  Firestore: class MockFirestore {},
  collection: vi.fn().mockReturnValue('col'),
  doc: (_c: unknown, id: string) => `ref:${id}`,
  setDoc: (...a: unknown[]) => h.setDoc(...a),
  deleteDoc: (...a: unknown[]) => h.deleteDoc(...a),
  serverTimestamp: () => '__ts__',
}));
vi.mock('@angular/fire/auth', () => ({ Auth: class MockAuth {} }));
vi.mock('@angular/fire/messaging', () => ({
  Messaging: class MockMessaging {},
  getToken: (...a: unknown[]) => h.getToken(...a),
  deleteToken: (...a: unknown[]) => h.deleteToken(...a),
  onMessage: (...a: unknown[]) => h.onMessage(...a),
}));
vi.mock('@capacitor/push-notifications', () => ({ PushNotifications: {} }));

const WEB = { isNative: false, isAndroid: false, platform: 'web' };
const IOS = { isNative: true, isAndroid: false, platform: 'ios' };

describe('PushNotificationService (web)', () => {
  const registration = { scope: '/' } as unknown as ServiceWorkerRegistration;
  const register = vi.fn();
  const toast = { info: vi.fn(), fromError: vi.fn() };
  const messaging = { name: 'messaging' };
  let permission: NotificationPermission;
  const requestPermission = vi.fn();

  function setup(opts: { platform?: typeof WEB; withMessaging?: boolean } = {}): PushNotificationService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: PlatformService, useValue: opts.platform ?? WEB },
        { provide: Auth, useValue: { currentUser: { uid: 'u1' } } },
        { provide: Firestore, useValue: {} },
        { provide: Router, useValue: { navigateByUrl: vi.fn() } },
        { provide: ToastService, useValue: toast },
        ...(opts.withMessaging === false ? [] : [{ provide: Messaging, useValue: messaging }]),
      ],
    });
    return TestBed.inject(PushNotificationService);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    env.vapidKey = 'VAPID';
    delete env.firebase['vapidKey'];
    permission = 'default';
    register.mockResolvedValue(registration);
    requestPermission.mockImplementation(async () => {
      permission = 'granted';
      return permission;
    });
    h.getToken.mockResolvedValue('web-tok');
    h.onMessage.mockReturnValue(h.unsubMessage);
    vi.stubGlobal('Notification', {
      get permission() {
        return permission;
      },
      requestPermission,
    });
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { register } });
  });

  afterEach(() => {
    env.vapidKey = original.vapidKey;
    env.firebase = { ...original.firebase };
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'serviceWorker');
  });

  describe('webSupported', () => {
    it('is true on web with Messaging, serviceWorker, Notification and a vapid key', () => {
      expect(setup().webSupported()).toBe(true);
    });

    it('is false on native', () => {
      expect(setup({ platform: IOS }).webSupported()).toBe(false);
    });

    it('is false without the Messaging provider (SSR/tests)', () => {
      expect(setup({ withMessaging: false }).webSupported()).toBe(false);
    });

    it('is false (no throw) when the Messaging provider fails to initialize', () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          { provide: PlatformService, useValue: WEB },
          { provide: Auth, useValue: { currentUser: { uid: 'u1' } } },
          { provide: Firestore, useValue: {} },
          { provide: Router, useValue: { navigateByUrl: vi.fn() } },
          { provide: ToastService, useValue: toast },
          {
            provide: Messaging,
            useFactory: () => {
              throw new Error('messaging/unsupported-browser');
            },
          },
        ],
      });
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      expect(TestBed.inject(PushNotificationService).webSupported()).toBe(false);
      warn.mockRestore();
    });

    it('is false without serviceWorker support', () => {
      Reflect.deleteProperty(navigator, 'serviceWorker');
      expect(setup().webSupported()).toBe(false);
    });

    it('is false without the Notification API', () => {
      vi.stubGlobal('Notification', undefined);
      expect(setup().webSupported()).toBe(false);
    });

    it('is false and logs once when the vapid key is missing', () => {
      env.vapidKey = '';
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const s = setup();
      expect(s.webSupported()).toBe(false);
      expect(s.webSupported()).toBe(false);
      expect(warn).toHaveBeenCalledTimes(1);
      warn.mockRestore();
    });

    it('accepts the vapid key from environment.firebase.vapidKey first', () => {
      env.vapidKey = '';
      env.firebase['vapidKey'] = 'FROM_FIREBASE';
      expect(setup().webSupported()).toBe(true);
    });
  });

  describe('canPromptWeb', () => {
    it('is true only while permission is default', async () => {
      const s = setup();
      expect(s.canPromptWeb()).toBe(true);
      await s.enableWeb();
      expect(s.canPromptWeb()).toBe(false);
    });

    it('is false when unsupported', () => {
      expect(setup({ withMessaging: false }).canPromptWeb()).toBe(false);
    });
  });

  describe('init on web', () => {
    it('never requests permission on load', async () => {
      await setup().init();
      expect(requestPermission).not.toHaveBeenCalled();
      expect(h.getToken).not.toHaveBeenCalled();
    });

    it('silently refreshes the token when permission was already granted', async () => {
      permission = 'granted';
      await setup().init();
      expect(requestPermission).not.toHaveBeenCalled();
      expect(h.getToken).toHaveBeenCalled();
      expect(h.setDoc).toHaveBeenCalled();
    });
  });

  describe('enableWeb', () => {
    it('requests permission, registers the SW with the firebase config and saves a web token', async () => {
      const s = setup();
      await expect(s.enableWeb()).resolves.toBe(true);
      expect(requestPermission).toHaveBeenCalledTimes(1);
      const url = register.mock.calls[0][0] as string;
      expect(url.startsWith('/firebase-messaging-sw.js?')).toBe(true);
      const params = new URLSearchParams(url.split('?')[1]);
      expect(params.get('projectId')).toBe(original.firebase['projectId']);
      expect(params.get('messagingSenderId')).toBe(original.firebase['messagingSenderId']);
      expect(params.has('databaseId')).toBe(false);
      expect(h.getToken).toHaveBeenCalledWith(messaging, {
        vapidKey: 'VAPID',
        serviceWorkerRegistration: registration,
      });
      const [ref, data, options] = h.setDoc.mock.calls[0];
      expect(ref).toBe('ref:web-tok');
      expect(data).toMatchObject({ token: 'web-tok', platform: 'web', lastSeenAt: '__ts__' });
      expect(options).toEqual({ merge: true });
      expect(s.webEnabled()).toBe(true);
    });

    it('does not ask again when permission is already granted', async () => {
      permission = 'granted';
      await setup().enableWeb();
      expect(requestPermission).not.toHaveBeenCalled();
      expect(h.getToken).toHaveBeenCalled();
    });

    it('returns false and saves nothing when the user denies', async () => {
      requestPermission.mockImplementation(async () => {
        permission = 'denied';
        return permission;
      });
      const s = setup();
      await expect(s.enableWeb()).resolves.toBe(false);
      expect(h.getToken).not.toHaveBeenCalled();
      expect(h.setDoc).not.toHaveBeenCalled();
      expect(s.webEnabled()).toBe(false);
    });

    it('does not even prompt when permission is already denied', async () => {
      permission = 'denied';
      await expect(setup().enableWeb()).resolves.toBe(false);
      expect(requestPermission).not.toHaveBeenCalled();
    });

    it('returns false without touching anything when unsupported', async () => {
      await expect(setup({ withMessaging: false }).enableWeb()).resolves.toBe(false);
      expect(requestPermission).not.toHaveBeenCalled();
    });

    it('returns false and reports an error toast when getToken fails', async () => {
      h.getToken.mockRejectedValueOnce(new Error('boom'));
      const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      await expect(setup().enableWeb()).resolves.toBe(false);
      expect(toast.fromError).toHaveBeenCalled();
      expect(h.setDoc).not.toHaveBeenCalled();
      err.mockRestore();
    });

    it('returns false when no token is returned', async () => {
      h.getToken.mockResolvedValueOnce('');
      await expect(setup().enableWeb()).resolves.toBe(false);
      expect(h.setDoc).not.toHaveBeenCalled();
    });

    it('registers the foreground listener once even if enabled twice', async () => {
      const s = setup();
      await s.enableWeb();
      await s.enableWeb();
      expect(h.onMessage).toHaveBeenCalledTimes(1);
    });
  });

  describe('foreground messages', () => {
    it('shows a toast with title and body', async () => {
      await setup().enableWeb();
      const cb = h.onMessage.mock.calls[0][1] as (p: unknown) => void;
      cb({ notification: { title: 'Nuevo caso', body: 'Te asignaron X' } });
      expect(toast.info).toHaveBeenCalledWith('Te asignaron X', 'Nuevo caso');
    });

    it('falls back to a default title', async () => {
      await setup().enableWeb();
      const cb = h.onMessage.mock.calls[0][1] as (p: unknown) => void;
      cb({});
      expect(toast.info).toHaveBeenCalledWith('', 'Nueva notificación');
    });
  });

  describe('unregister', () => {
    it('deletes the web token (FCM + Firestore) and stops the foreground listener', async () => {
      const s = setup();
      await s.enableWeb();
      await s.unregister();
      expect(h.deleteToken).toHaveBeenCalledWith(messaging);
      expect(h.deleteDoc).toHaveBeenCalledWith('ref:web-tok');
      expect(h.unsubMessage).toHaveBeenCalled();
      expect(s.webEnabled()).toBe(false);
    });

    it('still deletes the Firestore doc if deleteToken fails', async () => {
      const s = setup();
      await s.enableWeb();
      h.deleteToken.mockRejectedValueOnce(new Error('offline'));
      const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      await expect(s.unregister()).resolves.toBeUndefined();
      expect(h.deleteDoc).toHaveBeenCalledWith('ref:web-tok');
      err.mockRestore();
    });

    it('can re-enable after unregister (re-login)', async () => {
      const s = setup();
      await s.enableWeb();
      await s.unregister();
      await s.enableWeb();
      expect(h.onMessage).toHaveBeenCalledTimes(2);
    });

    it('does not call deleteToken if web was never enabled', async () => {
      await setup().unregister();
      expect(h.deleteToken).not.toHaveBeenCalled();
    });
  });
});
