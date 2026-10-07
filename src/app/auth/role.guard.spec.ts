import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, type ActivatedRouteSnapshot, type RouterStateSnapshot } from '@angular/router';
import { PermissionService } from '../core/services/permission.service';
import { ToastService } from '../core/services/toast.service';
import { rolGuard } from './role.guard';

describe('rolGuard', () => {
  const hasRole = vi.fn();
  const isSuperUser = vi.fn();
  const info = vi.fn();
  const tree = {} as UrlTree;
  const createUrlTree = vi.fn().mockReturnValue(tree);

  const ejecutar = () =>
    TestBed.runInInjectionContext(() =>
      rolGuard('Admin', 'Gestor')({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot));

  beforeEach(() => {
    vi.clearAllMocks();
    hasRole.mockReturnValue(false);
    isSuperUser.mockReturnValue(false);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: PermissionService, useValue: { hasRole, isSuperUser } },
        { provide: ToastService, useValue: { info } },
        { provide: Router, useValue: { createUrlTree } },
      ],
    });
  });

  it('deja pasar a un rol permitido', () => {
    hasRole.mockReturnValue(true);
    expect(ejecutar()).toBe(true);
    expect(hasRole).toHaveBeenCalledWith('Admin', 'Gestor');
  });
  it('deja pasar al superusuario', () => {
    isSuperUser.mockReturnValue(true);
    expect(ejecutar()).toBe(true);
  });
  it('rol no permitido: avisa y redirige al calendario', () => {
    expect(ejecutar()).toBe(tree);
    expect(createUrlTree).toHaveBeenCalledWith(['/calendario']);
    expect(info).toHaveBeenCalledWith(expect.stringContaining('Admin'), 'Acceso restringido');
  });
});
