import { describe, it, expect, beforeEach } from 'vitest';
import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DemoLayoutComponent } from './demo-layout';
import { AgenteLanzadorComponent } from '../agente-ia/agente-lanzador';
import { CompanyService } from '../../core/services/company.service';
import { AuthService } from '../../auth/auth.service';
import { PermissionService } from '../../core/services/permission.service';
import { SearchService } from '../../core/services/search.service';
import { MejorarPlanHostComponent } from '../../shared/components/mejorar-plan/mejorar-plan-host';
import { NotificacionesPanelComponent } from '../../shared/components/notificaciones-panel/notificaciones-panel';
import { DemoTerminadaComponent } from '../../shared/components/demo-terminada/demo-terminada';

@Component({ selector: 'app-agente-lanzador', template: '' })
class AgenteLanzadorStub {}

@Component({ selector: 'app-notificaciones-panel', template: '' })
class NotificacionesPanelStub {}

// El host del modal de mejora usa ToastService (→ Firestore), ajeno a lo que se prueba aquí.
@Component({ selector: 'app-mejorar-plan-host', template: '' })
class MejorarPlanHostStub {}

@Component({ selector: 'app-demo-terminada', template: '<p>terminada</p>' })
class DemoTerminadaStub {}

const fakePerm = {
  userRole: () => null,
  isSuperUser: () => false,
  can: () => true,
  currentMember: () => null,
  displayRole: () => ({ label: '' }),
};
const fakeAuth = { user: signal(null), logout: async () => undefined };

function q(f: ComponentFixture<DemoLayoutComponent>, sel: string): HTMLElement | null {
  return (f.nativeElement as HTMLElement).querySelector(sel);
}

// El aviso de modo superusuario lee la empresa activa.
const fakeCompany = { modoSuperuser: () => false, activeCompany: () => null, myMemberships: () => [] };

describe('DemoLayoutComponent (mobile)', () => {
  let fixture: ComponentFixture<DemoLayoutComponent>;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [DemoLayoutComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: fakeAuth },
        { provide: CompanyService, useValue: fakeCompany },
        { provide: PermissionService, useValue: fakePerm },
      ],
    });
    TestBed.overrideComponent(DemoLayoutComponent, {
      remove: { imports: [AgenteLanzadorComponent, NotificacionesPanelComponent, MejorarPlanHostComponent] },
      add: { imports: [AgenteLanzadorStub, NotificacionesPanelStub, MejorarPlanHostStub] },
    });
    await TestBed.compileComponents();
    fixture = TestBed.createComponent(DemoLayoutComponent);
    fixture.detectChanges();
  });

  it('uses dynamic viewport height minus the safe-area insets on the shell', () => {
    const root = (fixture.nativeElement as HTMLElement).firstElementChild as HTMLElement;
    // body already carries the safe-area padding; a plain h-dvh would overflow on notched devices
    expect(
      root.classList.contains('h-[calc(100dvh-var(--safe-area-top)-var(--safe-area-bottom))]'),
    ).toBe(true);
    expect(root.classList.contains('h-screen')).toBe(false);
  });

  it('hosts the notifications panel in the header instead of a static bell button', () => {
    const header = q(fixture, 'header')!;
    expect(header.querySelector('app-notificaciones-panel')).not.toBeNull();
    expect(header.querySelector('button[aria-label="Notificaciones"]')).toBeNull();
  });

  it('drawer is absent until opened', () => {
    expect(q(fixture, '[data-test="mobile-drawer"]')).toBeNull();
  });

  it('drawer exposes role=dialog, aria-modal and a label when open', () => {
    fixture.componentInstance.sidebarOpen.set(true);
    fixture.detectChanges();
    const d = q(fixture, '[data-test="mobile-drawer"]')!;
    expect(d.getAttribute('role')).toBe('dialog');
    expect(d.getAttribute('aria-modal')).toBe('true');
    expect(d.getAttribute('aria-label')).toBeTruthy();
  });

  it('Escape closes the drawer', () => {
    fixture.componentInstance.sidebarOpen.set(true);
    fixture.detectChanges();
    const d = q(fixture, '[data-test="mobile-drawer"]')!;
    d.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(fixture.componentInstance.sidebarOpen()).toBe(false);
    expect(q(fixture, '[data-test="mobile-drawer"]')).toBeNull();
  });

  it('mobile search toggle is labelled, md:hidden and opens the input row', () => {
    const btn = q(fixture, '[data-test="mobile-search-toggle"]')!;
    expect(btn.getAttribute('aria-label')).toBe('Buscar');
    expect(btn.classList.contains('md:hidden')).toBe(true);
    expect(btn.classList.contains('tap-target')).toBe(true);
    expect(q(fixture, '[data-test="mobile-search-input"]')).toBeNull();
    btn.click();
    fixture.detectChanges();
    expect(q(fixture, '[data-test="mobile-search-input"]')).not.toBeNull();
    expect(btn.getAttribute('aria-expanded')).toBe('true');
  });

  it('mobile search input reuses the shared search term', () => {
    q(fixture, '[data-test="mobile-search-toggle"]')!.click();
    fixture.detectChanges();
    const input = q(fixture, '[data-test="mobile-search-input"]') as HTMLInputElement;
    input.value = 'garcia';
    input.dispatchEvent(new Event('input'));
    expect(TestBed.inject(SearchService).term()).toBe('garcia');
  });

  it('Escape closes the mobile search and clears the term', () => {
    q(fixture, '[data-test="mobile-search-toggle"]')!.click();
    fixture.detectChanges();
    const svc = TestBed.inject(SearchService);
    svc.setTerm('x');
    const input = q(fixture, '[data-test="mobile-search-input"]')!;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(q(fixture, '[data-test="mobile-search-input"]')).toBeNull();
    expect(svc.term()).toBe('');
  });

  it('nav links no longer use inline mouseenter style hacks', () => {
    const html = (fixture.nativeElement as HTMLElement).innerHTML;
    expect(html).not.toContain('mouseenter');
    const link = q(fixture, 'aside nav a') ;
    if (link) expect(link.className).toContain('hover:bg-[var(--surface-2)]');
  });
});

describe('DemoLayoutComponent (menú Configuración)', () => {
  function montar(puede: (modulo: string) => boolean): DemoLayoutComponent {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [DemoLayoutComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: fakeAuth },
        { provide: CompanyService, useValue: fakeCompany },
        { provide: PermissionService, useValue: { ...fakePerm, can: (m: string) => puede(m) } },
      ],
    });
    TestBed.overrideComponent(DemoLayoutComponent, {
      remove: { imports: [AgenteLanzadorComponent, NotificacionesPanelComponent, MejorarPlanHostComponent] },
      add: { imports: [AgenteLanzadorStub, NotificacionesPanelStub, MejorarPlanHostStub] },
    });
    return TestBed.createComponent(DemoLayoutComponent).componentInstance;
  }
  const items = (c: DemoLayoutComponent) => c.visibleCategories().flatMap((cat) => cat.items);

  it('muestra "Configuración" (/configuracion) a quien puede ver el módulo', () => {
    const it_ = items(montar(() => true)).find((i) => i.name === 'Configuración');
    expect(it_?.href).toBe('/configuracion');
  });

  it('ya no lista "Usuarios y Permisos" por separado', () => {
    expect(items(montar(() => true)).some((i) => i.name === 'Usuarios y Permisos' || i.href === '/usuarios')).toBe(false);
  });

  it('oculta "Configuración" a quien no puede ver el módulo', () => {
    const c = montar((m) => m !== 'Configuración');
    expect(items(c).some((i) => i.href === '/configuracion')).toBe(false);
  });
});

describe('DemoLayoutComponent (insignia de plan)', () => {
  function montar(company: unknown): ComponentFixture<DemoLayoutComponent> {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [DemoLayoutComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: fakeAuth },
        { provide: CompanyService, useValue: { modoSuperuser: () => false, activeCompany: () => company, myMemberships: () => [] } },
        { provide: PermissionService, useValue: fakePerm },
      ],
    });
    TestBed.overrideComponent(DemoLayoutComponent, {
      remove: { imports: [AgenteLanzadorComponent, NotificacionesPanelComponent, MejorarPlanHostComponent] },
      add: { imports: [AgenteLanzadorStub, NotificacionesPanelStub, MejorarPlanHostStub] },
    });
    const f = TestBed.createComponent(DemoLayoutComponent);
    f.detectChanges();
    return f;
  }
  const free = { id: 'c', suscripcion: { plan: 'free', complementos: [], estado: 'activa', origen: 'free' } };
  const items = (f: ComponentFixture<DemoLayoutComponent>) =>
    f.componentInstance.visibleCategories().flatMap((c) => c.items);

  it('plan Free: Tesorería, Facturación, Recepción IA y Agente IA salen bloqueados pero visibles', () => {
    const bloqueados = items(montar(free)).filter((i) => i.bloqueado).map((i) => i.name).sort();
    expect(bloqueados).toEqual(['Agente IA', 'Facturación', 'Recepción IA', 'Tesorería']);
  });

  it('la insignia Pro es accesible (aria-label) y el item sigue siendo enlace', () => {
    const f = montar(free);
    const link = (f.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>('a[href="/tesoreria"]')!;
    expect(link.getAttribute('aria-label')).toBe('Tesorería, disponible en plan Pro');
    expect(link.textContent).toContain('Pro');
  });

  it('empresa legada (sin suscripcion): nada bloqueado', () => {
    expect(items(montar({ id: 'c', plan: 'free' })).some((i) => i.bloqueado)).toBe(false);
  });

  it('muestra el chip "Free · Mejorar" solo en Free', () => {
    expect((montar(free).nativeElement as HTMLElement).querySelector('app-chip-plan button')?.textContent).toContain('Free · Mejorar');
    expect((montar({ id: 'c' }).nativeElement as HTMLElement).querySelector('app-chip-plan button')).toBeNull();
  });
});


describe('DemoLayoutComponent — despacho de ejemplo terminado', () => {
  const montar = async (suscripcion: Record<string, unknown>) => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [DemoLayoutComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: fakeAuth },
        { provide: CompanyService, useValue: { ...fakeCompany, activeCompany: () => ({ id: 'c1', name: 'Demo', esDemo: true, suscripcion }) } },
        { provide: PermissionService, useValue: fakePerm },
      ],
    });
    TestBed.overrideComponent(DemoLayoutComponent, {
      remove: { imports: [AgenteLanzadorComponent, NotificacionesPanelComponent, MejorarPlanHostComponent, DemoTerminadaComponent] },
      add: { imports: [AgenteLanzadorStub, NotificacionesPanelStub, MejorarPlanHostStub, DemoTerminadaStub] },
    });
    await TestBed.compileComponents();
    const f = TestBed.createComponent(DemoLayoutComponent);
    f.detectChanges();
    return f;
  };
  const demo = (periodoFin: Date) => ({ plan: 'demo', estado: 'activa', complementos: [], origen: 'manual', periodoFin });

  it('terminada: la pantalla de "terminó" sustituye al contenido', async () => {
    const f = await montar(demo(new Date(Date.now() - 86_400_000)));
    expect(q(f, 'main app-demo-terminada')).not.toBeNull();
    expect(q(f, 'main router-outlet')).toBeNull();
  });

  it('vigente: el contenido normal (router-outlet)', async () => {
    const f = await montar(demo(new Date(Date.now() + 86_400_000)));
    expect(q(f, 'main router-outlet')).not.toBeNull();
    expect(q(f, 'main app-demo-terminada')).toBeNull();
  });
});
