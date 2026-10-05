import { describe, it, expect } from 'vitest';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PerfilComponent } from './perfil';
import { NotificacionesPrefsComponent } from './notificaciones-prefs/notificaciones-prefs';
import { AuthService } from '../../auth/auth.service';
import { UserSyncService } from '../../core/services/user-sync.service';
import { ToastService } from '../../core/services/toast.service';
import { PermissionService } from '../../core/services/permission.service';
import { CompanyService } from '../../core/services/company.service';

@Component({ selector: 'app-notificaciones-prefs', template: '<p>prefs</p>' })
class PrefsStub {}

describe('PerfilComponent — pestaña Notificaciones', () => {
  async function setup() {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [PerfilComponent],
      providers: [
        { provide: AuthService, useValue: { user: signal({ uid: 'u1' }) } },
        { provide: UserSyncService, useValue: { currentUser: signal(null) } },
        { provide: ToastService, useValue: { run: async () => undefined } },
        {
          provide: PermissionService,
          useValue: {
            isSuperUser: signal(false),
            currentMember: signal({ role: 'Gestor', customRoleId: null }),
            currentCustomRole: signal(null),
            displayRole: (m: { role: string }) => ({ label: m.role, colorClass: 'bg-violet-100 text-violet-700' }),
            can: (_modulo: string, cap: string) => cap === 'ver',
          },
        },
        { provide: CompanyService, useValue: { activeCompany: signal({ name: 'Despacho Pérez' }) } },
      ],
    });
    TestBed.overrideComponent(PerfilComponent, {
      remove: { imports: [NotificacionesPrefsComponent] },
      add: { imports: [PrefsStub] },
    });
    await TestBed.compileComponents();
    const fixture = TestBed.createComponent(PerfilComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('offers a Notificaciones tab that renders the prefs section', async () => {
    const fixture = await setup();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-notificaciones-prefs')).toBeNull();
    const tab = el.querySelector<HTMLButtonElement>('[data-test="tab-notificaciones"]')!;
    expect(tab.textContent).toContain('Notificaciones');
    tab.click();
    fixture.detectChanges();
    expect(el.querySelector('app-notificaciones-prefs')).not.toBeNull();
  });

  it('shows the company role in the summary card', async () => {
    const el = (await setup()).nativeElement as HTMLElement;
    const badge = el.querySelector<HTMLElement>('[data-test="perfil-rol"]')!;
    expect(badge.textContent?.trim()).toBe('Gestor');
  });

  it('offers a Rol y permisos tab with the resolved permissions of the user', async () => {
    const fixture = await setup();
    const el = fixture.nativeElement as HTMLElement;
    el.querySelector<HTMLButtonElement>('[data-test="tab-permisos"]')!.click();
    fixture.detectChanges();
    expect(el.textContent).toContain('Despacho Pérez');
    expect(el.textContent).toContain('Gestión de proyectos, clientes y facturación');
    const rows = el.querySelectorAll('[data-test="permiso-modulo"]');
    expect(rows.length).toBe(9);
    const caps = Array.from(rows[0].querySelectorAll<HTMLElement>('[data-test="permiso-cap"]'));
    expect(caps.map((c) => c.dataset['granted'])).toEqual(['true', 'false', 'false', 'false']);
  });
});
