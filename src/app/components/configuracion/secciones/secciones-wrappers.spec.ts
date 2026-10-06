import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FacturacionSeccionComponent } from './facturacion/facturacion-seccion';
import { TesoreriaSeccionComponent } from './tesoreria/tesoreria-seccion';
import { UsuariosSeccionComponent } from './usuarios/usuarios-seccion';
import { FacturacionAjustesComponent } from '../../facturacion/components/facturacion-ajustes/facturacion-ajustes';
import { CuentasGestionComponent } from '../../tesoreria/components/cuentas-gestion/cuentas-gestion';
import { UsuariosComponent } from '../../usuarios/usuarios';
import { CuentasService } from '../../../core/services/cuentas.service';

@Component({ selector: 'app-facturacion-ajustes', template: '<p>ajustes</p>', changeDetection: ChangeDetectionStrategy.OnPush })
class AjustesStub {}
@Component({ selector: 'app-cuentas-gestion', template: '<p>cuentas</p>', changeDetection: ChangeDetectionStrategy.OnPush })
class GestionStub {}
@Component({ selector: 'app-usuarios', template: '<p>usuarios</p>', changeDetection: ChangeDetectionStrategy.OnPush })
class UsuariosStub { readonly embebido = input(false); }

describe('Secciones de Configuración (wrappers)', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('Facturación: h2 enfocable + FacturacionAjustesComponent', () => {
    TestBed.configureTestingModule({ imports: [FacturacionSeccionComponent] });
    TestBed.overrideComponent(FacturacionSeccionComponent, {
      remove: { imports: [FacturacionAjustesComponent] }, add: { imports: [AjustesStub] },
    });
    const f = TestBed.createComponent(FacturacionSeccionComponent);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    const h = el.querySelector('h2#config-detalle-titulo')!;
    expect(h.textContent).toContain('Facturación');
    expect(h.getAttribute('tabindex')).toBe('-1');
    expect(el.querySelector('app-facturacion-ajustes')).not.toBeNull();
  });

  describe('Tesorería', () => {
    const svc = { loadCuentas: vi.fn(), stopCuentas: vi.fn() };
    function montar() {
      TestBed.configureTestingModule({
        imports: [TesoreriaSeccionComponent],
        providers: [{ provide: CuentasService, useValue: svc }],
      });
      TestBed.overrideComponent(TesoreriaSeccionComponent, {
        remove: { imports: [CuentasGestionComponent] }, add: { imports: [GestionStub] },
      });
      const f = TestBed.createComponent(TesoreriaSeccionComponent);
      f.detectChanges();
      return f;
    }

    it('h2 enfocable + CuentasGestionComponent', () => {
      svc.loadCuentas.mockClear();
      const f = montar();
      const el = f.nativeElement as HTMLElement;
      expect(el.querySelector('h2#config-detalle-titulo')!.getAttribute('tabindex')).toBe('-1');
      expect(el.querySelector('app-cuentas-gestion')).not.toBeNull();
    });

    it('arranca el listener al iniciar y lo detiene al destruir', () => {
      svc.loadCuentas.mockClear(); svc.stopCuentas.mockClear();
      const f = montar();
      expect(svc.loadCuentas).toHaveBeenCalledTimes(1);
      expect(svc.stopCuentas).not.toHaveBeenCalled();
      f.destroy();
      expect(svc.stopCuentas).toHaveBeenCalledTimes(1);
    });
  });

  it('Usuarios: renderiza UsuariosComponent en modo embebido', () => {
    TestBed.configureTestingModule({ imports: [UsuariosSeccionComponent] });
    TestBed.overrideComponent(UsuariosSeccionComponent, {
      remove: { imports: [UsuariosComponent] }, add: { imports: [UsuariosStub] },
    });
    const f = TestBed.createComponent(UsuariosSeccionComponent);
    f.detectChanges();
    const stub = f.debugElement.query((d) => d.name === 'app-usuarios');
    expect(stub).not.toBeNull();
    expect(stub.componentInstance.embebido()).toBe(true);
  });
});
