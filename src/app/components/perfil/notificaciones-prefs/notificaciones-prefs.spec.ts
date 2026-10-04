import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { NotificacionesPrefsComponent } from './notificaciones-prefs';
import { AuthService } from '../../../auth/auth.service';
import { DEFAULT_PREFS, NotificationPrefsService } from '../../../core/services/notification-prefs.service';
import { PushNotificationService } from '../../../core/services/push-notification.service';
import { ToastService } from '../../../core/services/toast.service';
import { analizarA11y, formatearViolaciones } from '../../../../testing/axe';

describe('NotificacionesPrefsComponent', () => {
  const user = signal<{ uid: string } | null>({ uid: 'u1' });
  const prefsSvc = {
    load: vi.fn(),
    save: vi.fn(),
  };
  const webSupported = signal(true);
  const webEnabled = signal(false);
  const push = {
    webSupported: () => webSupported(),
    webEnabled,
    enableWeb: vi.fn(),
  };
  const toast = {
    run: vi.fn(async (action: () => Promise<unknown>, opts?: { successMessage?: string }) => {
      const r = await action();
      if (opts?.successMessage) toast.success(opts.successMessage);
      return r;
    }),
    success: vi.fn(),
    info: vi.fn(),
  };
  let fixture: ComponentFixture<NotificacionesPrefsComponent>;

  function q<T extends HTMLElement>(sel: string): T | null {
    return (fixture.nativeElement as HTMLElement).querySelector<T>(sel);
  }
  function sw(name: string): HTMLInputElement {
    return q<HTMLInputElement>(`input#pref-${name}`)!;
  }

  async function setup(): Promise<void> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [NotificacionesPrefsComponent],
      providers: [
        { provide: AuthService, useValue: { user } },
        { provide: NotificationPrefsService, useValue: prefsSvc },
        { provide: PushNotificationService, useValue: push },
        { provide: ToastService, useValue: toast },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(NotificacionesPrefsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    vi.clearAllMocks();
    user.set({ uid: 'u1' });
    webSupported.set(true);
    webEnabled.set(false);
    prefsSvc.load.mockResolvedValue({ ...DEFAULT_PREFS });
    prefsSvc.save.mockResolvedValue(undefined);
    push.enableWeb.mockResolvedValue(true);
  });

  it('renders six labelled switches, all on by default', async () => {
    await setup();
    const labels: Record<string, string> = {
      llamadas: 'Llamadas nuevas',
      casos: 'Casos asignados',
      contactos: 'Contactos asignados',
      eventos: 'Eventos',
      hitos: 'Hitos asignados',
      push: 'Recibir notificaciones push',
    };
    for (const [name, label] of Object.entries(labels)) {
      const input = sw(name);
      expect(input.type).toBe('checkbox');
      expect(input.getAttribute('role')).toBe('switch');
      expect(input.checked).toBe(true);
      const lab = q<HTMLLabelElement>(`label[for="${input.id}"]`)!;
      expect(lab.textContent).toContain(label);
    }
  });

  it('loads stored prefs for the current user into the form', async () => {
    prefsSvc.load.mockResolvedValue({ ...DEFAULT_PREFS, casos: false, push: false });
    await setup();
    expect(prefsSvc.load).toHaveBeenCalledWith('u1');
    expect(sw('casos').checked).toBe(false);
    expect(sw('push').checked).toBe(false);
    expect(sw('llamadas').checked).toBe(true);
  });

  it('save writes the full map with the toggled values and toasts success', async () => {
    await setup();
    sw('eventos').click();
    fixture.detectChanges();
    (q('[data-test="save"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(prefsSvc.save).toHaveBeenCalledWith('u1', { ...DEFAULT_PREFS, eventos: false });
    expect(toast.success).toHaveBeenCalled();
  });

  it('delegates failures to ToastService.run (error toast) and re-enables the button', async () => {
    prefsSvc.save.mockRejectedValue(new Error('denied'));
    toast.run.mockImplementationOnce(async (action: () => Promise<unknown>) => {
      try {
        await action();
      } catch {
        return undefined;
      }
      return undefined;
    });
    await setup();
    const btn = q<HTMLButtonElement>('[data-test="save"]')!;
    btn.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(toast.success).not.toHaveBeenCalled();
    expect(btn.disabled).toBe(false);
  });

  it('does not save without a signed-in user', async () => {
    await setup();
    user.set(null);
    (q('[data-test="save"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(prefsSvc.save).not.toHaveBeenCalled();
  });

  describe('browser activation', () => {
    it('shows the button when web push is supported and not yet enabled', async () => {
      await setup();
      const btn = q<HTMLButtonElement>('[data-test="enable-web"]')!;
      expect(btn.textContent).toContain('Activar notificaciones en este navegador');
    });

    it('is a user-gesture call: clicking invokes enableWeb and toasts success', async () => {
      await setup();
      expect(push.enableWeb).not.toHaveBeenCalled();
      (q('[data-test="enable-web"]') as HTMLButtonElement).click();
      await fixture.whenStable();
      expect(push.enableWeb).toHaveBeenCalledTimes(1);
      expect(toast.success).toHaveBeenCalled();
    });

    it('explains when the browser did not grant it', async () => {
      push.enableWeb.mockResolvedValue(false);
      await setup();
      (q('[data-test="enable-web"]') as HTMLButtonElement).click();
      await fixture.whenStable();
      expect(toast.info).toHaveBeenCalled();
      expect(toast.success).not.toHaveBeenCalled();
    });

    it('hides the button when web push is unsupported (native / no VAPID / no SW)', async () => {
      webSupported.set(false);
      await setup();
      expect(q('[data-test="enable-web"]')).toBeNull();
    });

    it('replaces the button with a status line once enabled', async () => {
      webEnabled.set(true);
      await setup();
      expect(q('[data-test="enable-web"]')).toBeNull();
      expect(q('[data-test="web-enabled"]')).not.toBeNull();
    });
  });

  it('has no axe violations', async () => {
    await setup();
    const v = await analizarA11y(fixture.nativeElement as HTMLElement);
    expect(v, `\n${formatearViolaciones(v)}\n`).toEqual([]);
  });
});
