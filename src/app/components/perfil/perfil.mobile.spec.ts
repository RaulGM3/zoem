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

describe('PerfilComponent — mobile', () => {
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

  it('does not add page padding on mobile (the layout already pads)', async () => {
    const el = (await setup()).nativeElement as HTMLElement;
    const root = el.firstElementChild as HTMLElement;
    expect(root.classList).toContain('sm:p-6');
    expect(root.classList).not.toContain('p-6');
  });

  it('keeps the layout grid within the viewport (no min-content blowout from the tab bar)', async () => {
    const el = (await setup()).nativeElement as HTMLElement;
    const grid = el.querySelector<HTMLElement>('[data-test="perfil-grid"]')!;
    expect(grid.classList).toContain('grid-cols-1');
    for (const child of Array.from(grid.children)) {
      expect(child.classList).toContain('min-w-0');
    }
  });

  it('stacks the header and makes the save button full width on mobile', async () => {
    const el = (await setup()).nativeElement as HTMLElement;
    const header = el.querySelector<HTMLElement>('[data-test="perfil-header"]')!;
    expect(header.classList).toContain('flex-col');
    expect(header.classList).toContain('sm:flex-row');
    const save = el.querySelector<HTMLButtonElement>('[data-test="perfil-guardar"]')!;
    expect(save.classList).toContain('w-full');
    expect(save.classList).toContain('sm:w-auto');
    expect(save.classList).toContain('tap-target');
  });

  it('renders scrollable accessible tabs with tap targets', async () => {
    const fixture = await setup();
    const el = fixture.nativeElement as HTMLElement;
    const list = el.querySelector<HTMLElement>('[role="tablist"]')!;
    expect(list.classList).toContain('overflow-x-auto');
    const tabs = Array.from(list.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    expect(tabs.map((t) => t.textContent?.trim())).toEqual([
      'Personal', 'Despacho', 'Profesional', 'Rol y permisos', 'Notificaciones',
    ]);
    for (const t of tabs) {
      expect(t.type).toBe('button');
      expect(t.classList).toContain('tap-target');
      expect(t.classList).toContain('shrink-0');
    }
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    tabs[1].click();
    fixture.detectChanges();
    expect(tabs[1].getAttribute('aria-selected')).toBe('true');
    expect(tabs[0].getAttribute('aria-selected')).toBe('false');
  });
});
