import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BloqueoPlanService } from '../../core/planes/bloqueo-plan.service';

let cupoContactosAgotado = false;
import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { ContactosComponent } from './contactos';
import { ImportarContactosComponent } from './components/importar-contactos/importar-contactos';
import {
  EstadoContactoDialogComponent, type CambioEstadoResult,
} from '../../shared/components/estado-contacto-dialog/estado-contacto-dialog';
import { ContactService } from '../../core/services/contact.service';
import { UsersService } from '../../core/services/users';
import { SearchService } from '../../core/services/search.service';
import { PermissionService } from '../../core/services/permission.service';
import { ToastService } from '../../core/services/toast.service';
import { SeguimientoContactoService } from '../../core/services/seguimiento-contacto.service';
import type { CompanyMember, Contact } from '../../interfaces';
import { analizarA11y, formatearViolaciones } from '../../../testing/axe';

@Component({ selector: 'app-importar-contactos', template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class ImportarStubComponent {
  readonly visible = input.required<boolean>();
  readonly closed = output<void>();
}

@Component({ selector: 'app-estado-contacto-dialog', template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class EstadoDialogStubComponent {
  readonly contacto = input.required<Contact>();
  readonly soloSeguimiento = input(false);
  readonly closed = output<void>();
  readonly saved = output<CambioEstadoResult>();
}

const ANA = {
  id: 'c1', type: 'persona_fisica', nombre: 'Ana', apellidos: 'López', nifType: 'nie', nif: 'X1234567L',
  email: 'ana@example.com', mobile: '600111222', status: 'activo', assignedTo: 'u2', totalBilled: 1000,
  activeProjects: 2, createdAt: { toMillis: () => 100 },
} as unknown as Contact;

const ACME = {
  id: 'c2', type: 'persona_juridica', razonSocial: 'Acme S.L.', cifType: 'cif', cif: 'B12345678',
  email: 'info@acme.test', mobile: '', status: 'potencial', totalBilled: 500,
  createdAt: { toMillis: () => 200 },
} as unknown as Contact;

const MEMBERS = [{ id: 'm2', userId: 'u2', nombre: 'Luis', apellido: 'Gil' }] as CompanyMember[];

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

describe('ContactosComponent — móvil', () => {
  let fixture: ComponentFixture<ContactosComponent>;
  let denegados: Set<string>;
  const el = (): HTMLElement => fixture.nativeElement;

  async function montar(mobile: boolean): Promise<void> {
    TestBed.resetTestingModule();
    mockViewport(mobile);
    const queryParams = new BehaviorSubject(convertToParamMap({}));
    TestBed.configureTestingModule({
      imports: [ContactosComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { queryParamMap: queryParams, snapshot: { get queryParamMap() { return queryParams.value; } } },
        },
        {
          provide: ContactService,
          useValue: {
            contacts: signal<Contact[]>([ANA, ACME]),
            isLoading: signal(false),
            loadContacts: vi.fn().mockResolvedValue(undefined),
            deleteContact: vi.fn().mockResolvedValue(undefined),
          },
        },
        { provide: UsersService, useValue: { members: signal(MEMBERS), loadMembers: vi.fn().mockResolvedValue(undefined) } },
        { provide: SearchService, useValue: { termFor: () => signal('') } },
        { provide: PermissionService, useValue: { can: (m: string, c: string) => !denegados.has(`${m}:${c}`) } },
        { provide: ToastService, useValue: { run: vi.fn(async (a: () => Promise<unknown>) => a()) } },
        { provide: BloqueoPlanService, useValue: { cupoAgotado: () => cupoContactosAgotado } },
        { provide: SeguimientoContactoService, useValue: {} },
      ],
    });
    TestBed.overrideComponent(ContactosComponent, {
      remove: { imports: [ImportarContactosComponent, EstadoContactoDialogComponent] },
      add: { imports: [ImportarStubComponent, EstadoDialogStubComponent] },
    });
    await TestBed.compileComponents();
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(ContactosComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function estable(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    denegados = new Set();
    TestBed.resetTestingModule();
  });

  describe('lista', () => {
    it('móvil: una tarjeta compacta por contacto', async () => {
      await montar(true);
      expect(el().querySelectorAll('ul > li')).toHaveLength(2);
      expect(el().querySelector('[role="group"][aria-label^="Ficha de"]')).toBeNull();
    });

    it('escritorio: rejilla de fichas y sin lista móvil', async () => {
      await montar(false);
      expect(el().querySelectorAll('[role="group"][aria-label^="Ficha de"]')).toHaveLength(2);
      expect(el().querySelector('ul > li')).toBeNull();
    });

    it('móvil: nombre, documento, tipo, estado y responsable', async () => {
      await montar(true);
      const ana = Array.from(el().querySelectorAll('ul > li')).find((li) => li.textContent?.includes('Ana López'))!;
      const texto = ana.textContent ?? '';
      expect(texto).toContain('X1234567L');
      expect(texto).toContain('Persona Física');
      expect(texto).toContain('Activo');
      expect(texto).toContain('Luis Gil');
    });

    it('móvil: teléfono como enlace tel: y email como mailto: con área táctil', async () => {
      await montar(true);
      const tel = el().querySelector<HTMLAnchorElement>('ul a[href="tel:600111222"]')!;
      const mail = el().querySelector<HTMLAnchorElement>('ul a[href="mailto:ana@example.com"]')!;
      expect(tel).not.toBeNull();
      expect(mail).not.toBeNull();
      expect(tel.className).toContain('tap-target');
      expect(mail.className).toContain('tap-target');
    });

    it('móvil: sin teléfono no hay enlace tel:', async () => {
      await montar(true);
      expect(el().querySelectorAll('ul a[href^="tel:"]')).toHaveLength(1);
    });

    it('móvil: la tarjeta tiene menú de acciones', async () => {
      await montar(true);
      expect(el().querySelectorAll('ul app-action-menu')).toHaveLength(2);
    });

    it('móvil: eliminar desde el menú pide confirmación en la tarjeta', async () => {
      await montar(true);
      const menu = el().querySelector<HTMLElement>('ul app-action-menu')!;
      menu.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')!.click();
      await estable();
      el().querySelector<HTMLButtonElement>('[data-action-id="delete"]')!.click();
      await estable();
      expect(el().querySelector('ul [aria-label="Confirmar eliminación"]')).not.toBeNull();
    });
  });

  describe('filtros', () => {
    it('móvil: botón Filtros sin badge cuando no hay filtros', async () => {
      await montar(true);
      expect(el().querySelector('[data-filtros-btn]')).not.toBeNull();
      expect(el().querySelector('[data-filtros-badge]')).toBeNull();
    });

    it('móvil: la hoja comparte estado con los filtros y el badge cuenta los activos', async () => {
      await montar(true);
      el().querySelector<HTMLButtonElement>('[data-filtros-btn]')!.click();
      await estable();
      const estado = el().querySelector<HTMLSelectElement>('[role="dialog"] #contactos-estado')!;
      estado.value = 'activo';
      estado.dispatchEvent(new Event('change'));
      await estable();
      expect(fixture.componentInstance.filterStatus()).toBe('activo');
      expect(el().querySelector('[data-filtros-badge]')!.textContent?.trim()).toBe('1');
      const tipo = el().querySelector<HTMLSelectElement>('[role="dialog"] #contactos-tipo')!;
      tipo.value = 'persona_fisica';
      tipo.dispatchEvent(new Event('change'));
      await estable();
      expect(el().querySelector('[data-filtros-badge]')!.textContent?.trim()).toBe('2');
      expect(el().querySelectorAll('ul > li')).toHaveLength(1);
    });

    it('móvil: Limpiar vacía los filtros', async () => {
      await montar(true);
      fixture.componentInstance.filterStatus.set('activo');
      fixture.componentInstance.filterType.set('persona_fisica');
      fixture.componentInstance.limpiarFiltros();
      await estable();
      expect(fixture.componentInstance.filtrosActivos()).toBe(0);
    });

    it('escritorio: selects en línea y sin botón Filtros', async () => {
      await montar(false);
      expect(el().querySelector('[data-filtros-btn]')).toBeNull();
      expect(el().querySelector('select[aria-label="Filtrar por estado"]')).not.toBeNull();
    });
  });

  describe('accionesContacto (misma lógica que los botones de escritorio)', () => {
    const ids = (): string[] => fixture.componentInstance.accionesContacto().map((a) => a.id);

    it('con todos los permisos: caso, editar y eliminar (peligrosa)', async () => {
      await montar(false);
      expect(ids()).toEqual(['caso', 'edit', 'delete']);
      expect(fixture.componentInstance.accionesContacto().find((a) => a.id === 'delete')?.danger).toBe(true);
    });

    it('sin permiso de edición: no hay editar', async () => {
      denegados.add('Contactos:editar');
      await montar(false);
      expect(ids()).toEqual(['caso', 'delete']);
    });

    it('sin permiso de eliminar: no hay eliminar', async () => {
      denegados.add('Contactos:eliminar');
      await montar(false);
      expect(ids()).toEqual(['caso', 'edit']);
    });

    it('sin permisos: solo abrir caso', async () => {
      denegados.add('Contactos:editar');
      denegados.add('Contactos:eliminar');
      await montar(false);
      expect(ids()).toEqual(['caso']);
    });
  });

  it('axe: sin violaciones en móvil', async () => {
    await montar(true);
    const violaciones = await analizarA11y(el());
    expect(violaciones, `\n${formatearViolaciones(violaciones)}\n`).toEqual([]);
  });

  it('axe: sin violaciones con la hoja de filtros abierta', async () => {
    await montar(true);
    el().querySelector<HTMLButtonElement>('[data-filtros-btn]')!.click();
    await estable();
    const violaciones = await analizarA11y(el());
    expect(violaciones, `\n${formatearViolaciones(violaciones)}\n`).toEqual([]);
  });
});
