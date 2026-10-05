import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { PerfilPermisosComponent, type ModuloPermisos, type RolInfo } from './perfil-permisos';

const ROL: RolInfo = {
  label: 'Gestor',
  colorClass: 'bg-violet-100 text-violet-700',
  descripcion: 'Gestión de proyectos, clientes y facturación',
  baseRole: null,
};

const PERMISOS: ModuloPermisos[] = [
  { modulo: 'Casos', label: 'Casos', caps: [
    { cap: 'ver', label: 'Ver', granted: true },
    { cap: 'crear', label: 'Crear', granted: true },
    { cap: 'editar', label: 'Editar', granted: true },
    { cap: 'eliminar', label: 'Eliminar', granted: false },
  ] },
  { modulo: 'Configuración', label: 'Configuración', caps: [
    { cap: 'ver', label: 'Ver', granted: false },
    { cap: 'crear', label: 'Crear', granted: false },
    { cap: 'editar', label: 'Editar', granted: false },
    { cap: 'eliminar', label: 'Eliminar', granted: false },
  ] },
];

async function render(rol: RolInfo | null, empresa: string | null = 'Despacho Pérez') {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ imports: [PerfilPermisosComponent] });
  const fixture = TestBed.createComponent(PerfilPermisosComponent);
  fixture.componentRef.setInput('rol', rol);
  fixture.componentRef.setInput('permisos', PERMISOS);
  fixture.componentRef.setInput('empresa', empresa);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('PerfilPermisosComponent', () => {
  it('shows the role in the company with its description', async () => {
    const el = await render(ROL);
    expect(el.textContent).toContain('Despacho Pérez');
    const badge = el.querySelector<HTMLElement>('[data-test="rol-badge"]')!;
    expect(badge.textContent?.trim()).toBe('Gestor');
    expect(badge.classList).toContain('bg-violet-100');
    expect(el.textContent).toContain('Gestión de proyectos, clientes y facturación');
  });

  it('mentions the base role when the user has a custom role', async () => {
    const el = await render({ ...ROL, label: 'Procurador', baseRole: 'Usuario' });
    expect(el.querySelector('[data-test="rol-badge"]')?.textContent?.trim()).toBe('Procurador');
    expect(el.querySelector('[data-test="rol-base"]')?.textContent).toContain('Usuario');
  });

  it('lists every module with granted and denied capabilities announced to screen readers', async () => {
    const el = await render(ROL);
    const rows = el.querySelectorAll('[data-test="permiso-modulo"]');
    expect(rows.length).toBe(2);
    const casos = rows[0] as HTMLElement;
    expect(casos.textContent).toContain('Casos');
    const chips = Array.from(casos.querySelectorAll<HTMLElement>('[data-test="permiso-cap"]'));
    expect(chips.map((c) => c.dataset['granted'])).toEqual(['true', 'true', 'true', 'false']);
    expect(chips[0].textContent).toContain('permitido');
    expect(chips[3].textContent).toContain('no permitido');
  });

  it('marks modules without any access', async () => {
    const el = await render(ROL);
    const conf = el.querySelectorAll<HTMLElement>('[data-test="permiso-modulo"]')[1];
    expect(conf.textContent).toContain('Sin acceso');
  });

  it('shows a fallback when there is no role in the company', async () => {
    const el = await render(null);
    expect(el.querySelector('[data-test="rol-badge"]')).toBeNull();
    expect(el.textContent).toContain('Sin rol asignado');
  });
});
