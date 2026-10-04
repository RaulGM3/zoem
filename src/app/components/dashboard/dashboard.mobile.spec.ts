import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { DashboardComponent } from './dashboard';
import { PermissionService } from '../../core/services/permission.service';
import { IaContactService } from '../../core/services/ia-contact.service';
import { CasosService } from '../../core/services/casos.service';
import { GestoriaService } from '../../core/services/gestoria.service';
import { CuentasService } from '../../core/services/cuentas.service';
import { EventosService } from '../../core/services/eventos.service';
import { ActividadService } from '../../core/services/actividad.service';

async function montar(): Promise<HTMLElement> {
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    imports: [DashboardComponent],
    providers: [
      provideRouter([]),
      {
        provide: PermissionService,
        useValue: {
          can: () => true,
          currentMember: signal({ userId: 'u-yo', role: 'Usuario' }),
          userRole: signal('Usuario'),
          isSuperUser: signal(false),
        },
      },
      { provide: IaContactService, useValue: { iaContacts: signal([]), loadIaContacts: vi.fn() } },
      {
        provide: CasosService,
        useValue: { casos: signal([]), loadCasos: vi.fn(), hitosParaCalendarioStream: () => of([]) },
      },
      {
        provide: GestoriaService,
        useValue: {
          todosMovimientos: signal([]),
          loadTodosMovimientos: vi.fn(),
          stopTodosMovimientos: vi.fn(),
        },
      },
      { provide: CuentasService, useValue: { cuentas: signal([]), loadCuentas: vi.fn(), stopCuentas: vi.fn() } },
      { provide: EventosService, useValue: { eventosStream: () => of([]) } },
      { provide: ActividadService, useValue: { recentStream: () => of([]) } },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(DashboardComponent);
  await fixture.componentInstance.ngOnInit();
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture.nativeElement;
}

describe('DashboardComponent — responsive', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('no usa handlers inline de hover', async () => {
    const el = await montar();
    expect(el.innerHTML).not.toContain('mouseenter');
    expect(el.innerHTML).not.toContain('mouseleave');
  });

  it('los KPIs son una columna en móvil y se expanden con breakpoints', async () => {
    const el = await montar();
    const kpis = el.querySelector('app-stat-card')!.parentElement!;
    expect(kpis.className).toContain('grid-cols-1');
    expect(kpis.className).toContain('sm:grid-cols-2');
    expect(kpis.className).toContain('lg:grid-cols-4');
  });

  it('el layout principal es una columna en móvil con hijos que pueden encoger', async () => {
    const el = await montar();
    const layout = el.querySelector('.lg\\:grid-cols-3')!;
    expect(layout.className).toContain('grid-cols-1');
    for (const hijo of Array.from(layout.children)) {
      expect(hijo.className).toContain('min-w-0');
    }
  });

  it('la cabecera puede envolver', async () => {
    const el = await montar();
    expect(el.firstElementChild!.className).toContain('flex-wrap');
  });
});

describe('styles.css — hover táctil', () => {
  it('el lift de .kpi-card solo aplica con @media (hover: hover)', () => {
    const css = readFileSync('src/styles.css', 'utf8');
    const fuera = css.replace(/@media\s*\(hover:\s*hover\)\s*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
    expect(fuera).not.toMatch(/\.kpi-card:hover/);
    expect(css).toMatch(/@media\s*\(hover:\s*hover\)/);
    expect(css).toMatch(/\.kpi-card:hover/);
  });
});
