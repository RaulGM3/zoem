import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { UsuariosComponent } from './usuarios';
import { InviteDrawerComponent } from './components/invite-drawer/invite-drawer';
import { UserEditDrawerComponent } from './components/user-edit-drawer/user-edit-drawer';
import { RoleEditorDrawerComponent } from './components/role-editor-drawer/role-editor-drawer';
import { ActividadFeedComponent } from '../../shared/components/actividad-feed/actividad-feed';
import { UsersService } from '../../core/services/users';
import { PermissionService } from '../../core/services/permission.service';
import { CompanyPermissionsService } from '../../core/services/company-permissions.service';
import { CustomRolesService } from '../../core/services/custom-roles.service';
import { PermissionRequestService } from '../../core/services/permission-request.service';
import { InvitationService } from '../../core/services/invitation.service';
import { ToastService } from '../../core/services/toast.service';
import { CompanyService } from '../../core/services/company.service';
import { SearchService } from '../../core/services/search.service';
import { ActividadService } from '../../core/services/actividad.service';
import { CAPABILITIES, MODULOS, PERMISOS } from '../../core/permissions/permissions';
import type { CompanyMember } from '../../interfaces/member';
import type { PermissionRequest } from '../../interfaces/permission-request.interface';

@Component({ selector: 'app-invite-drawer', template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class InviteStub {
  readonly visible = input(false);
  readonly saving = input(false);
  readonly inviteLink = input<string | null>(null);
  readonly submitted = output<unknown>();
  readonly closed = output<void>();
}

@Component({ selector: 'app-role-editor-drawer', template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class RoleEditorStub {
  readonly visible = input(false);
  readonly saving = input(false);
  readonly role = input<unknown>(null);
  readonly saved = output<unknown>();
  readonly deleted = output<string>();
  readonly closed = output<void>();
}

@Component({ selector: 'app-user-edit-drawer', template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class UserEditStub {
  readonly member = input<CompanyMember | null>(null);
  readonly visible = input(false);
  readonly saving = input(false);
  readonly canDelete = input(false);
  readonly canEditOverrides = input(false);
  readonly saved = output<unknown>();
  readonly deleted = output<string>();
  readonly closed = output<void>();
}

@Component({ selector: 'app-actividad-feed', template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class FeedStub {
  readonly items = input<unknown[]>([]);
  readonly variante = input('');
}

const MEMBERS = [
  {
    id: 'm1', nombre: 'Marta Ruiz', email: 'marta@despacho.es', role: 'Admin', estado: 'activo',
    departamento: 'Civil', ultimoLogin: null, tarifaHoraria: 120,
  },
  {
    id: 'm2', nombre: 'Luis Gil', email: 'luis@despacho.es', role: 'Usuario', estado: 'pendiente',
    departamento: '', ultimoLogin: null, tarifaHoraria: null,
  },
] as unknown as CompanyMember[];

const SOLICITUD = {
  id: 'r1', userNombre: 'Luis Gil', capability: 'editar', modulo: 'Casos', motivo: 'Llevo el caso',
  createdAt: null,
} as unknown as PermissionRequest;

describe('UsuariosComponent', () => {
  let fixture: ComponentFixture<UsuariosComponent>;
  const el = (): HTMLElement => fixture.nativeElement;
  const qa = <T extends HTMLElement>(sel: string): T[] => Array.from(el().querySelectorAll<T>(sel));
  const boton = (texto: string, raiz: HTMLElement = el()): HTMLButtonElement | undefined =>
    Array.from(raiz.querySelectorAll('button')).find(b => b.textContent?.replace(/\s+/g, ' ').trim() === texto);

  function setup(mobile: boolean): void {
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

    TestBed.configureTestingModule({
      imports: [UsuariosComponent],
      providers: [
        {
          provide: UsersService,
          useValue: {
            isLoading: signal(false), activos: signal(1), pendientes: signal(1), members: signal(MEMBERS),
            getRoles: () => [], loadMembers: vi.fn(), updateMember: vi.fn(), removeMember: vi.fn(),
          },
        },
        {
          provide: PermissionService,
          useValue: {
            isAdmin: signal(true), MODULOS, CAPABILITIES, effectivePermisos: signal(PERMISOS),
            currentMember: signal(MEMBERS[0]),
            displayRole: (m: CompanyMember) => ({ label: m.role, colorClass: '' }),
          },
        },
        { provide: CompanyPermissionsService, useValue: { saveMatrix: vi.fn(), resetDefaults: vi.fn() } },
        { provide: CustomRolesService, useValue: { roles: signal([]), byId: () => undefined } },
        { provide: PermissionRequestService, useValue: { pendientes: signal([SOLICITUD]), approve: vi.fn(), reject: vi.fn() } },
        { provide: InvitationService, useValue: { getInvitationsByCompany: () => of([]) } },
        { provide: ToastService, useValue: { run: vi.fn(), fromError: vi.fn() } },
        { provide: CompanyService, useValue: { activeCompany: signal({ id: 'co1', name: 'Despacho' }) } },
        { provide: SearchService, useValue: { termFor: () => signal('') } },
        { provide: ActividadService, useValue: { recentStream: () => of([]), log: vi.fn() } },
      ],
    });
    TestBed.overrideComponent(UsuariosComponent, {
      remove: { imports: [InviteDrawerComponent, UserEditDrawerComponent, RoleEditorDrawerComponent, ActividadFeedComponent] },
      add: { imports: [InviteStub, UserEditStub, RoleEditorStub, FeedStub] },
    });
    fixture = TestBed.createComponent(UsuariosComponent);
    fixture.detectChanges();
  }

  const irATab = (nombre: string): void => {
    const tab = qa<HTMLButtonElement>('[role="tab"]').find(t => t.textContent?.includes(nombre))!;
    tab.click();
    fixture.detectChanges();
  };

  beforeEach(() => TestBed.resetTestingModule());

  it('exposes the tabs as an accessible tablist', () => {
    setup(true);
    const tabs = qa('[role="tablist"] [role="tab"]');
    expect(tabs.map(t => t.textContent?.replace(/\s+/g, ' ').trim())).toEqual(['Usuarios', 'Roles', 'Permisos', 'Solicitudes 1']);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    irATab('Roles');
    expect(qa('[role="tab"]')[1].getAttribute('aria-selected')).toBe('true');
  });

  it('renders the user table on desktop', () => {
    setup(false);
    expect(el().querySelector('table')).not.toBeNull();
    expect(qa('[data-usuario-card]')).toHaveLength(0);
  });

  it('renders one tappable card per user on mobile and opens the edit drawer', () => {
    setup(true);
    expect(el().querySelector('table')).toBeNull();
    const cards = qa<HTMLButtonElement>('button[data-usuario-card]');
    expect(cards).toHaveLength(2);
    expect(cards[0].getAttribute('aria-label')).toBe('Editar a Marta Ruiz');
    expect(cards[0].textContent).toContain('marta@despacho.es');
    expect(cards[0].textContent).toContain('Civil');
    expect(cards[0].textContent).toContain('120 €');

    cards[1].click();
    fixture.detectChanges();
    expect(fixture.componentInstance.showEditDrawer()).toBe(true);
    expect(fixture.componentInstance.editingMember()?.id).toBe('m2');
  });

  describe('permissions on mobile', () => {
    const filas = (): HTMLElement[] => qa('[data-permiso-modulo]');
    const fila = (modulo: string): HTMLElement => filas().find(f => f.dataset['permisoModulo'] === modulo)!;

    beforeEach(() => {
      setup(true);
      irATab('Permisos');
    });

    it('shows one row per module for the selected role instead of the matrix', () => {
      expect(el().querySelector('table')).toBeNull();
      const roles = qa<HTMLButtonElement>('[role="radiogroup"] [role="radio"]');
      expect(roles.map(r => r.textContent?.trim())).toEqual(['Admin', 'Gestor', 'Usuario', 'Viewer']);
      expect(roles.find(r => r.getAttribute('aria-checked') === 'true')?.textContent?.trim()).toBe('Gestor');
      expect(filas()).toHaveLength(MODULOS.length);
      expect(boton('Ver', fila('Casos'))).toBeTruthy();
      expect(boton('Borrar', fila('Casos'))).toBeTruthy();
    });

    it('toggles a capability for the selected role and reveals the save action', () => {
      expect(boton('Guardar cambios')).toBeUndefined();
      // Usuario en Casos: crear=true, eliminar=false
      boton('Usuario')!.click();
      fixture.detectChanges();
      const borrar = boton('Borrar', fila('Casos'))!;
      expect(borrar.getAttribute('aria-pressed')).toBe('false');
      borrar.click();
      fixture.detectChanges();
      expect(boton('Borrar', fila('Casos'))!.getAttribute('aria-pressed')).toBe('true');
      expect(boton('Guardar cambios')).toBeTruthy();
    });

    it('locks capabilities the role cannot be granted', () => {
      boton('Viewer')!.click();
      fixture.detectChanges();
      const crear = boton('Crear', fila('Casos'))!;
      expect(crear.disabled).toBe(true);

      boton('Admin')!.click();
      fixture.detectChanges();
      expect(boton('Ver', fila('Casos'))!.disabled).toBe(true);
    });
  });

  it('keeps the matrix table on desktop', () => {
    setup(false);
    irATab('Permisos');
    expect(el().querySelector('table')).not.toBeNull();
    expect(qa('[data-permiso-modulo]')).toHaveLength(0);
  });
});
