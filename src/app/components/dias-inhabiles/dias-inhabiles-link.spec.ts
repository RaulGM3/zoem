import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { PermissionService } from '../../core/services/permission.service';
import { DiasInhabilesLinkComponent } from './dias-inhabiles-link';
import { analizarA11y, formatearViolaciones } from '../../../testing/axe';

describe('DiasInhabilesLinkComponent', () => {
  const rol = signal<string | null>(null);
  const superUser = signal(false);

  async function montar(): Promise<HTMLElement> {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [DiasInhabilesLinkComponent],
      providers: [
        provideRouter([]),
        {
          provide: PermissionService,
          useValue: { hasRole: (...r: string[]) => rol() !== null && r.includes(rol()!), isSuperUser: superUser },
        },
      ],
    });
    const f = TestBed.createComponent(DiasInhabilesLinkComponent);
    await f.whenStable();
    return f.nativeElement as HTMLElement;
  }

  beforeEach(() => { rol.set(null); superUser.set(false); });

  it('Admin y Gestor ven el enlace a /calendario/dias-inhabiles', async () => {
    for (const r of ['Admin', 'Gestor']) {
      rol.set(r);
      const a = (await montar()).querySelector('a')!;
      expect(a.textContent).toContain('Días inhábiles');
      expect(a.getAttribute('href')).toBe('/calendario/dias-inhabiles');
    }
  });
  it('el superusuario lo ve', async () => {
    superUser.set(true);
    expect((await montar()).querySelector('a')).not.toBeNull();
  });
  it('Usuario y Viewer no lo ven', async () => {
    for (const r of ['Usuario', 'Viewer']) {
      rol.set(r);
      expect((await montar()).querySelector('a')).toBeNull();
    }
  });
  it('pasa AXE', async () => {
    rol.set('Admin');
    const el = await montar();
    const v = await analizarA11y(el);
    expect(v, formatearViolaciones(v)).toEqual([]);
  });
});
