import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ComponentFixture } from '@angular/core/testing';
import { SuscribirseCalendarioDialogComponent } from './suscribirse-calendario-dialog';
import { CalendarFeedService } from '../../../../core/services/calendar-feed.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ErrorService } from '../../../../core/services/error.service';

const URLS = {
  feedUrl: 'https://vertey-b924b.web.app/calendarFeed?t=abc123',
  webcalUrl: 'webcal://vertey-b924b.web.app/calendarFeed?t=abc123',
};

describe('SuscribirseCalendarioDialogComponent', () => {
  let fixture: ComponentFixture<SuscribirseCalendarioDialogComponent>;
  let component: SuscribirseCalendarioDialogComponent;
  let createToken: ReturnType<typeof vi.fn>;
  let revokeToken: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    createToken = vi.fn().mockResolvedValue(URLS);
    revokeToken = vi.fn().mockResolvedValue({ revoked: 1 });

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [SuscribirseCalendarioDialogComponent],
      providers: [
        { provide: CalendarFeedService, useValue: { createToken, revokeToken } },
        { provide: ToastService, useValue: { success: vi.fn(), fromError: vi.fn(), run: vi.fn() } },
        { provide: ErrorService, useValue: { log: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SuscribirseCalendarioDialogComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('companyId', 'company-1');
  });

  it('al iniciar genera un token y muestra la URL en un input readonly', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(createToken).toHaveBeenCalledWith('company-1');
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input[readonly]');
    expect(input.value).toBe(URLS.feedUrl);
  });

  it('el enlace "Abrir en Google Calendar" usa el webcal url codificado como cid', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const link: HTMLAnchorElement = fixture.nativeElement.querySelector('a[data-testid="google-calendar-link"]');
    expect(link.href).toBe(
      `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(URLS.webcalUrl)}`,
    );
  });

  it('copiar usa el Clipboard API y muestra confirmación en una región aria-live', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    await component.copy();
    fixture.detectChanges();

    expect(writeText).toHaveBeenCalledWith(URLS.feedUrl);
    const liveRegion: HTMLElement = fixture.nativeElement.querySelector('[aria-live]');
    expect(liveRegion.textContent).toContain('portapapeles');
  });

  it('copiar usa fallback de execCommand si el Clipboard API falla', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.assign(navigator, { clipboard: { writeText } });
    const execCommand = vi.fn().mockReturnValue(true);
    Object.assign(document, { execCommand });

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    await component.copy();

    expect(execCommand).toHaveBeenCalledWith('copy');
  });

  it('Regenerar pide confirmación antes de generar un nuevo token', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    createToken.mockClear();

    component.requestRegenerate();
    expect(component.confirmingRegenerate()).toBe(true);
    expect(createToken).not.toHaveBeenCalled();

    await component.confirmRegenerate();
    expect(createToken).toHaveBeenCalledTimes(1);
    expect(component.confirmingRegenerate()).toBe(false);
  });

  it('Revocar llama al servicio y limpia la URL mostrada', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    await component.revoke();
    fixture.detectChanges();

    expect(revokeToken).toHaveBeenCalledWith('company-1');
    expect(component.urls()).toBeNull();
    const input = fixture.nativeElement.querySelector('input[readonly]');
    expect(input).toBeNull();
  });

  it('si createToken falla, muestra un estado de error en vez de romper', async () => {
    createToken.mockRejectedValueOnce(new Error('network down'));

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.error()).not.toBeNull();
    expect(fixture.nativeElement.querySelector('input[readonly]')).toBeNull();
  });

  it('el diálogo tiene role=dialog, aria-modal y focus trap', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const dialog: HTMLElement = fixture.nativeElement.querySelector('[role="dialog"]');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.hasAttribute('appFocusTrap')).toBe(true);
  });

  it('emite closed() al pulsar el botón de cerrar', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const emitSpy = vi.spyOn(component.closed, 'emit');
    const closeBtn: HTMLButtonElement = fixture.nativeElement.querySelector('[aria-label="Cerrar"]');
    closeBtn.click();
    expect(emitSpy).toHaveBeenCalled();
  });
});
