import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Router } from '@angular/router';
import { NotificacionesPanelComponent } from './notificaciones-panel';
import { NotificacionesService, type Notificacion } from '../../../core/services/notificaciones.service';
import { PushNotificationService } from '../../../core/services/push-notification.service';
import { analizarA11y, formatearViolaciones } from '../../../../testing/axe';

const NOW = Date.now();

function notif(id: string, leida: boolean, extra: Partial<Notificacion> = {}): Notificacion {
  return {
    id,
    userId: 'u1',
    tipo: 'casos',
    titulo: `Titulo ${id}`,
    cuerpo: `Cuerpo ${id}`,
    route: `/casos/${id}`,
    leida,
    createdAt: new Date(NOW - 5 * 60_000),
    ...extra,
  };
}

function mockViewport(mobile: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (q: string) => ({
      matches: mobile && /max-width/.test(q),
      media: q,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  });
}

describe('NotificacionesPanelComponent', () => {
  const lista = signal<Notificacion[]>([]);
  const noLeidas = signal(0);
  const canPrompt = signal(false);
  const svc = {
    notificaciones: lista,
    noLeidas,
    marcarLeida: vi.fn().mockResolvedValue(undefined),
    marcarTodasLeidas: vi.fn().mockResolvedValue(undefined),
  };
  const push = { canPromptWeb: canPrompt, enableWeb: vi.fn().mockResolvedValue(true) };
  const router = { navigateByUrl: vi.fn() };
  let fixture: ComponentFixture<NotificacionesPanelComponent>;

  function el(sel: string): HTMLElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector(sel);
  }
  function all(sel: string): HTMLElement[] {
    return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll(sel));
  }
  function bell(): HTMLButtonElement {
    return el('[data-test="bell"]') as HTMLButtonElement;
  }

  async function setup(mobile = false): Promise<void> {
    mockViewport(mobile);
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [NotificacionesPanelComponent],
      providers: [
        { provide: NotificacionesService, useValue: svc },
        { provide: PushNotificationService, useValue: push },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(NotificacionesPanelComponent);
    fixture.detectChanges();
  }

  beforeEach(() => {
    vi.clearAllMocks();
    lista.set([]);
    noLeidas.set(0);
    canPrompt.set(false);
  });

  describe('bell badge', () => {
    it('hides the badge and uses a plain label when there is nothing unread', async () => {
      await setup();
      expect(el('[data-test="badge"]')).toBeNull();
      expect(bell().getAttribute('aria-label')).toBe('Notificaciones');
    });

    it('shows the count and announces it in the aria-label', async () => {
      noLeidas.set(3);
      await setup();
      expect(el('[data-test="badge"]')!.textContent!.trim()).toBe('3');
      expect(bell().getAttribute('aria-label')).toBe('Notificaciones, 3 sin leer');
    });

    it('caps the visible count at 9+ but keeps the real number in the label', async () => {
      noLeidas.set(25);
      await setup();
      expect(el('[data-test="badge"]')!.textContent!.trim()).toBe('9+');
      expect(bell().getAttribute('aria-label')).toBe('Notificaciones, 25 sin leer');
    });

    it('exposes popup semantics on the bell', async () => {
      await setup();
      expect(bell().getAttribute('aria-haspopup')).toBe('dialog');
      expect(bell().getAttribute('aria-expanded')).toBe('false');
    });
  });

  describe('desktop dropdown', () => {
    it('opens a labelled dialog on click and closes on a second click', async () => {
      await setup();
      expect(el('[role="dialog"]')).toBeNull();
      bell().click();
      fixture.detectChanges();
      const dlg = el('[role="dialog"]')!;
      expect(dlg).not.toBeNull();
      expect(dlg.getAttribute('aria-label')).toBe('Notificaciones');
      expect(bell().getAttribute('aria-expanded')).toBe('true');
      bell().click();
      fixture.detectChanges();
      expect(el('[role="dialog"]')).toBeNull();
    });

    it('does not render the mobile drawer on desktop', async () => {
      await setup();
      bell().click();
      fixture.detectChanges();
      expect(el('app-overlay-shell')).toBeNull();
    });

    it('Escape closes it and returns focus to the bell', async () => {
      await setup();
      bell().click();
      fixture.detectChanges();
      el('[role="dialog"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      fixture.detectChanges();
      expect(el('[role="dialog"]')).toBeNull();
      expect(document.activeElement).toBe(bell());
    });

    it('closes on an outside click but not on a click inside', async () => {
      await setup();
      document.body.appendChild(fixture.nativeElement);
      bell().click();
      fixture.detectChanges();
      el('[role="dialog"]')!.click();
      fixture.detectChanges();
      expect(el('[role="dialog"]')).not.toBeNull();
      document.body.click();
      fixture.detectChanges();
      expect(el('[role="dialog"]')).toBeNull();
      (fixture.nativeElement as HTMLElement).remove();
    });

    it('moves focus into the dialog when opened', async () => {
      await setup();
      document.body.appendChild(fixture.nativeElement);
      bell().click();
      fixture.detectChanges();
      await fixture.whenStable();
      expect(el('[role="dialog"]')!.contains(document.activeElement)).toBe(true);
      (fixture.nativeElement as HTMLElement).remove();
    });
  });

  describe('mobile drawer', () => {
    it('opens app-overlay-shell titled Notificaciones instead of the dropdown', async () => {
      await setup(true);
      bell().click();
      fixture.detectChanges();
      expect(el('app-overlay-shell')).not.toBeNull();
      expect(el('[role="dialog"] h2')!.textContent).toContain('Notificaciones');
      expect(all('[role="dialog"]').length).toBe(1);
    });

    it('closes via the shell close button', async () => {
      await setup(true);
      bell().click();
      fixture.detectChanges();
      (el('button[aria-label="Cerrar"]') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(el('[role="dialog"]')).toBeNull();
    });
  });

  describe('list', () => {
    async function open(mobile = false): Promise<void> {
      await setup(mobile);
      bell().click();
      fixture.detectChanges();
    }

    it('shows the empty state', async () => {
      await open();
      expect(el('[data-test="empty"]')!.textContent).toContain('No tienes notificaciones');
    });

    it('renders title, body, relative time and a dot only for unread items', async () => {
      lista.set([notif('a', false), notif('b', true)]);
      noLeidas.set(1);
      await open();
      const items = all('[data-test="item"]');
      expect(items.length).toBe(2);
      expect(items[0].textContent).toContain('Titulo a');
      expect(items[0].textContent).toContain('Cuerpo a');
      expect(items[0].textContent).toContain('hace 5 min');
      expect(items[0].querySelector('[data-test="unread-dot"]')).not.toBeNull();
      expect(items[1].querySelector('[data-test="unread-dot"]')).toBeNull();
    });

    it('clicking an item marks it read, navigates to its route and closes', async () => {
      lista.set([notif('a', false)]);
      noLeidas.set(1);
      await open();
      (all('[data-test="item"]')[0] as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(svc.marcarLeida).toHaveBeenCalledWith('a');
      expect(router.navigateByUrl).toHaveBeenCalledWith('/casos/a');
      expect(el('[role="dialog"]')).toBeNull();
    });

    it('does not call marcarLeida for an already-read item but still navigates', async () => {
      lista.set([notif('b', true)]);
      await open();
      (all('[data-test="item"]')[0] as HTMLButtonElement).click();
      expect(svc.marcarLeida).not.toHaveBeenCalled();
      expect(router.navigateByUrl).toHaveBeenCalledWith('/casos/b');
    });

    it('still navigates when marking as read fails', async () => {
      svc.marcarLeida.mockRejectedValueOnce(new Error('denied'));
      const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      lista.set([notif('a', false)]);
      noLeidas.set(1);
      await open();
      (all('[data-test="item"]')[0] as HTMLButtonElement).click();
      await fixture.whenStable();
      expect(router.navigateByUrl).toHaveBeenCalledWith('/casos/a');
      spy.mockRestore();
    });

    it('"Marcar todas como leídas" appears only with unread items and calls the service', async () => {
      lista.set([notif('a', false)]);
      noLeidas.set(1);
      await open();
      const btn = el('[data-test="mark-all"]') as HTMLButtonElement;
      expect(btn.textContent).toContain('Marcar todas como leídas');
      btn.click();
      expect(svc.marcarTodasLeidas).toHaveBeenCalled();
    });

    it('hides "Marcar todas" when everything is read', async () => {
      lista.set([notif('b', true)]);
      await open();
      expect(el('[data-test="mark-all"]')).toBeNull();
    });
  });

  describe('browser push prompt', () => {
    it('is hidden unless web permission can be prompted', async () => {
      await setup();
      bell().click();
      fixture.detectChanges();
      expect(el('[data-test="enable-push"]')).toBeNull();
    });

    it('shows an Activar button that calls enableWeb on click', async () => {
      canPrompt.set(true);
      await setup();
      bell().click();
      fixture.detectChanges();
      const btn = el('[data-test="enable-push"]') as HTMLButtonElement;
      expect(btn.textContent).toContain('Activar');
      btn.click();
      expect(push.enableWeb).toHaveBeenCalled();
    });
  });

  describe('accessibility (axe)', () => {
    for (const mobile of [false, true]) {
      it(`no violations with items and prompt (${mobile ? 'mobile' : 'desktop'}, open)`, async () => {
        lista.set([notif('a', false), notif('b', true, { tipo: 'hitos' })]);
        noLeidas.set(1);
        canPrompt.set(true);
        await setup(mobile);
        bell().click();
        fixture.detectChanges();
        await fixture.whenStable();
        const v = await analizarA11y(fixture.nativeElement as HTMLElement);
        expect(v, `\n${formatearViolaciones(v)}\n`).toEqual([]);
      });
    }

    it('no violations when closed with a badge', async () => {
      noLeidas.set(4);
      await setup();
      const v = await analizarA11y(fixture.nativeElement as HTMLElement);
      expect(v, `\n${formatearViolaciones(v)}\n`).toEqual([]);
    });
  });
});
