import { describe, it, expect } from 'vitest';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PerfilComponent } from './perfil';
import { NotificacionesPrefsComponent } from './notificaciones-prefs/notificaciones-prefs';
import { AuthService } from '../../auth/auth.service';
import { UserSyncService } from '../../core/services/user-sync.service';
import { ToastService } from '../../core/services/toast.service';

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
});
