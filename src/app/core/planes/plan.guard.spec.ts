import { describe, it, expect, beforeEach } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { Route, UrlSegment } from '@angular/router';
import { AuthService } from '../../auth/auth.service';
import { PermissionService } from '../services/permission.service';
import { UsersService } from '../services/users';
import { PlanService } from './plan.service';
import { planBloqueado, rutaConPlan } from './plan.guard';
import type { Funcion } from './catalogo';

const isLoading = signal(false);
const autenticado = signal(true);
let incluidas: Funcion[] = [];
let puedeVer = true;
let cargados = 0;
const miembros = signal<unknown[]>([]);

const ejecutar = (g: ReturnType<typeof planBloqueado>) =>
  TestBed.runInInjectionContext(() => g({} as Route, [] as UrlSegment[])) as Promise<boolean>;

describe('planBloqueado (canMatch)', () => {
  beforeEach(() => {
    isLoading.set(false);
    autenticado.set(true);
    incluidas = [];
    puedeVer = true;
    cargados = 0;
    miembros.set([]);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { isLoading, isAuthenticated: autenticado } },
        { provide: PlanService, useValue: { tiene: (f: Funcion) => incluidas.includes(f) } },
        { provide: PermissionService, useValue: { canAccess: () => puedeVer } },
        { provide: UsersService, useValue: { members: miembros, loadMembers: async () => { cargados++; } } },
      ],
    });
  });

  it('coincide (muestra la vista previa) si el plan no incluye la función', async () => {
    expect(await ejecutar(planBloqueado('tesoreria', 'Tesorería'))).toBe(true);
  });

  it('no coincide si el plan sí la incluye', async () => {
    incluidas = ['tesoreria'];
    expect(await ejecutar(planBloqueado('tesoreria', 'Tesorería'))).toBe(false);
  });

  it('el candado de rol va primero: sin permiso no coincide y deja actuar a permissionGuard', async () => {
    puedeVer = false;
    expect(await ejecutar(planBloqueado('tesoreria', 'Tesorería'))).toBe(false);
  });

  it('sin módulo no consulta roles', async () => {
    puedeVer = false;
    expect(await ejecutar(planBloqueado('agenteIA'))).toBe(true);
    expect(cargados).toBe(0);
  });

  it('carga los miembros si aún no están', async () => {
    await ejecutar(planBloqueado('tesoreria', 'Tesorería'));
    expect(cargados).toBe(1);
  });

  it('no autenticado: no coincide (authGuard redirige)', async () => {
    autenticado.set(false);
    expect(await ejecutar(planBloqueado('tesoreria', 'Tesorería'))).toBe(false);
  });

  it('espera a que termine la carga de auth', async () => {
    isLoading.set(true);
    const p = ejecutar(planBloqueado('agenteIA'));
    isLoading.set(false);
    expect(await p).toBe(true);
  });
});

describe('rutaConPlan', () => {
  it('devuelve la ruta bloqueada primero y la real después, con el mismo path', () => {
    const real: Route = { path: 'tesoreria', loadComponent: async () => class {} };
    const [bloqueada, original] = rutaConPlan(real, 'tesoreria', 'Tesorería');
    expect(original).toBe(real);
    expect(bloqueada.path).toBe('tesoreria');
    expect(bloqueada.canMatch?.length).toBe(1);
    expect(bloqueada.data?.['funcion']).toBe('tesoreria');
  });
});
