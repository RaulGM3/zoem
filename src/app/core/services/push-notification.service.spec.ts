import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Auth } from '@angular/fire/auth';
import { Firestore } from '@angular/fire/firestore';
import { PushNotifications } from '@capacitor/push-notifications';
import { PushNotificationService } from './push-notification.service';
import { PlatformService } from './platform.service';
import { ToastService } from './toast.service';

vi.mock('@capacitor/push-notifications', () => ({
  PushNotifications: {
    requestPermissions: vi.fn(),
    register: vi.fn(),
    addListener: vi.fn(),
    createChannel: vi.fn(),
  },
}));

vi.mock('@angular/fire/firestore', () => ({
  Firestore: class {},
  collection: vi.fn(),
  doc: vi.fn(),
  serverTimestamp: vi.fn(),
  setDoc: vi.fn(),
}));

vi.mock('@angular/fire/auth', () => ({ Auth: class {} }));

function setup(platform: { isNative: boolean; isAndroid: boolean; platform: string }) {
  TestBed.configureTestingModule({
    providers: [
      { provide: PlatformService, useValue: platform },
      { provide: Auth, useValue: { currentUser: null } },
      { provide: Firestore, useValue: {} },
      { provide: Router, useValue: { navigateByUrl: vi.fn() } },
      { provide: ToastService, useValue: { info: vi.fn() } },
    ],
  });
  return TestBed.inject(PushNotificationService);
}

describe('PushNotificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(PushNotifications.requestPermissions).mockResolvedValue({ receive: 'granted' });
  });

  it('does nothing on web', async () => {
    const svc = setup({ isNative: false, isAndroid: false, platform: 'web' });
    await svc.init();
    expect(PushNotifications.requestPermissions).not.toHaveBeenCalled();
    expect(PushNotifications.createChannel).not.toHaveBeenCalled();
  });

  it('creates the default high-importance channel on Android', async () => {
    const svc = setup({ isNative: true, isAndroid: true, platform: 'android' });
    await svc.init();
    expect(PushNotifications.createChannel).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'general', importance: 4 }),
    );
    expect(PushNotifications.register).toHaveBeenCalled();
  });

  it('does not create a channel on iOS', async () => {
    const svc = setup({ isNative: true, isAndroid: false, platform: 'ios' });
    await svc.init();
    expect(PushNotifications.createChannel).not.toHaveBeenCalled();
    expect(PushNotifications.register).toHaveBeenCalled();
  });

  it('does not register when permission is denied', async () => {
    vi.mocked(PushNotifications.requestPermissions).mockResolvedValue({ receive: 'denied' });
    const svc = setup({ isNative: true, isAndroid: true, platform: 'android' });
    await svc.init();
    expect(PushNotifications.register).not.toHaveBeenCalled();
  });
});
