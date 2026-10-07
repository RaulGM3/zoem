import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { of } from 'rxjs';
import { provideRouter } from '@angular/router';
import { CalendarioComponent } from './calendario';
import { CasosService } from '../../core/services/casos.service';
import { CompanyService } from '../../core/services/company.service';
import { EventosService } from '../../core/services/eventos.service';
import { ToastService } from '../../core/services/toast.service';
import { UserSyncService } from '../../core/services/user-sync.service';
import { UsersService } from '../../core/services/users';
import { PermissionService } from '../../core/services/permission.service';
import { analizarA11y, formatearViolaciones } from '../../../testing/axe';

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

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function setup(mobile: boolean): ComponentFixture<CalendarioComponent> {
  mockViewport(mobile);
  TestBed.configureTestingModule({
    imports: [CalendarioComponent],
    providers: [
      provideRouter([]),
      { provide: CasosService, useValue: { hitosParaCalendarioStream: () => of([]) } },
      { provide: CompanyService, useValue: { activeCompany: signal({ id: 'c1' }) } },
      { provide: EventosService, useValue: { eventosStream: () => of([]) } },
      { provide: ToastService, useValue: { info: vi.fn(), run: vi.fn() } },
      { provide: UserSyncService, useValue: { currentUser: signal(null) } },
      { provide: UsersService, useValue: { members: signal([]), loadMembers: vi.fn() } },
      { provide: PermissionService, useValue: { can: () => true, hasRole: () => true, isSuperUser: () => false } },
    ],
  });
  const fixture = TestBed.createComponent(CalendarioComponent);
  fixture.detectChanges();
  return fixture;
}

describe('CalendarioComponent — móvil', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    // jsdom no implementa Element.scrollTo.
    Element.prototype.scrollTo = vi.fn();
  });

  const hoy = localDateStr(new Date());
  const otroDia = (): string => {
    const d = new Date();
    d.setDate(d.getDate() + (d.getDate() > 20 ? -2 : 2));
    return localDateStr(d);
  };

  it('en móvil arranca con una sola jornada: el día de hoy', () => {
    const c = setup(true).componentInstance;
    expect(Array.from(c.selectedDates())).toEqual([hoy]);
    expect(c.groupedEvents().length).toBe(1);
  });

  it('en móvil seleccionar otro día sustituye la jornada visible (vista de un día)', () => {
    const c = setup(true).componentInstance;
    c.toggleDate(otroDia());
    expect(Array.from(c.selectedDates())).toEqual([otroDia()]);
    expect(c.groupedEvents().length).toBe(1);
  });

  it('en móvil volver a pulsar el día activo no deja el calendario vacío', () => {
    const c = setup(true).componentInstance;
    c.toggleDate(hoy);
    expect(Array.from(c.selectedDates())).toEqual([hoy]);
  });

  it('en escritorio se mantiene la multi-selección', () => {
    const c = setup(false).componentInstance;
    c.toggleDate(otroDia());
    expect(c.selectedDates().size).toBe(2);
  });

  it('el usuario puede cambiar de vista en móvil', () => {
    const c = setup(true).componentInstance;
    c.setViewMode('month');
    expect(c.viewMode()).toBe('month');
    c.setViewMode('week');
    expect(c.viewMode()).toBe('week');
  });

  it('goToday vuelve al día de hoy', () => {
    const c = setup(true).componentInstance;
    c.toggleDate(otroDia());
    c.prevWeek();
    c.goToday();
    expect(Array.from(c.selectedDates())).toEqual([hoy]);
  });

  it('el botón Hoy del nav lleva a hoy', () => {
    const f = setup(true);
    const c = f.componentInstance;
    c.toggleDate(otroDia());
    f.detectChanges();
    (f.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button[aria-label="Ir a hoy"]')!.click();
    expect(Array.from(c.selectedDates())).toEqual([hoy]);
  });

  it('los botones de cabecera son accesibles y táctiles en móvil', () => {
    const el: HTMLElement = setup(true).nativeElement;
    const suscribirse = el.querySelector<HTMLElement>('button[aria-label="Suscribirse"]')!;
    expect(suscribirse.className).toContain('tap-target');
    const nuevo = Array.from(el.querySelectorAll('button')).find(b => b.textContent?.includes('Nuevo evento'))!;
    expect(nuevo.className).toContain('tap-target');
    expect(nuevo.className).toContain('hover:');
  });

  it('sin violaciones axe en la vista móvil', async () => {
    const f = setup(true);
    await f.whenStable();
    const violaciones = await analizarA11y(f.nativeElement as HTMLElement);
    expect(violaciones, `\n${formatearViolaciones(violaciones)}\n`).toEqual([]);
  });
});
