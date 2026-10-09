import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, type UrlTree } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { CompanyService } from '../core/services/company.service';
import { UserSyncService } from '../core/services/user-sync.service';
import { AuthService } from './auth.service';
import { requiereDespachoGuard, sinDespachoGuard } from './despacho.guard';

describe('guards de despacho', () => {
  const isLoading = signal(false);
  const memberships = signal<unknown[]>([]);
  const activeCompany = signal<unknown>(null);
  const isSuperUser = signal(false);
  const arbol = (url: string) => ({ url }) as unknown as UrlTree;

  beforeEach(() => {
    isLoading.set(false);
    memberships.set([]);
    activeCompany.set(null);
    isSuperUser.set(false);
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { isLoading } },
        { provide: CompanyService, useValue: { myMemberships: memberships, activeCompany } },
        { provide: UserSyncService, useValue: { isSuperUser } },
        { provide: Router, useValue: { createUrlTree: (c: string[]) => arbol(c.join('/')) } },
      ],
    });
  });

  const correr = (g: typeof requiereDespachoGuard) =>
    TestBed.runInInjectionContext(() => g({} as never, {} as never)) as unknown;

  it('requiereDespacho: sin despacho manda a /bienvenida', () => {
    expect(correr(requiereDespachoGuard)).toEqual(arbol('/bienvenida'));
  });

  it('requiereDespacho: con membresía deja pasar', () => {
    memberships.set([{ companyId: 'a' }]);
    expect(correr(requiereDespachoGuard)).toBe(true);
  });

  it('requiereDespacho: el superusuario sin membresías no es redirigido', () => {
    isSuperUser.set(true);
    expect(correr(requiereDespachoGuard)).toBe(true);
  });

  it('requiereDespacho: espera a que termine de cargar la sesión', async () => {
    isLoading.set(true);
    const r = correr(requiereDespachoGuard) as { subscribe: (f: (v: unknown) => void) => void };
    memberships.set([{ companyId: 'a' }]);
    isLoading.set(false);
    const valor = await new Promise((res) => r.subscribe(res));
    expect(valor).toBe(true);
  });

  it('sinDespacho: quien ya tiene despacho vuelve al inicio', () => {
    memberships.set([{ companyId: 'a' }]);
    expect(correr(sinDespachoGuard)).toEqual(arbol('/'));
  });

  it('sinDespacho: sin despacho puede ver el asistente', () => {
    expect(correr(sinDespachoGuard)).toBe(true);
  });
});
