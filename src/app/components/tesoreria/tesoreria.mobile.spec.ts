import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Firestore } from '@angular/fire/firestore';
import { TesoreriaComponent } from './tesoreria';
import { CasosService } from '../../core/services/casos.service';
import { CompanyService } from '../../core/services/company.service';
import { GestoriaService } from '../../core/services/gestoria.service';
import { CuentasService } from '../../core/services/cuentas.service';
import { CierreCajaService } from '../../core/services/cierre-caja.service';
import { ConciliacionService } from '../../core/services/conciliacion.service';
import { ToastService } from '../../core/services/toast.service';
import { UsersService } from '../../core/services/users';
import { PermissionService } from '../../core/services/permission.service';
import { analizarA11y, formatearViolaciones } from '../../../testing/axe';

function mockViewport(mobile: boolean): void {
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
}

describe('TesoreriaComponent — móvil', () => {
  let fixture: ComponentFixture<TesoreriaComponent>;
  const el = (): HTMLElement => fixture.nativeElement;

  async function montar(mobile: boolean, puede: (accion: string) => boolean = () => true): Promise<void> {
    TestBed.resetTestingModule();
    mockViewport(mobile);
    await TestBed.configureTestingModule({
      imports: [TesoreriaComponent],
      providers: [
        { provide: CasosService, useValue: { casos: signal([]), loading: signal(false), loadCasos: vi.fn(async () => undefined) } },
        { provide: CompanyService, useValue: { activeCompany: signal(null) } },
        {
          provide: GestoriaService,
          useValue: {
            todosMovimientos: signal([]), todosLoading: signal(false),
            loadTodosMovimientos: vi.fn(), stopTodosMovimientos: vi.fn(),
            slots: signal([]), movimientos: signal([]), loading: signal(false), stopMovimientos: vi.fn(),
          },
        },
        { provide: CuentasService, useValue: { cuentas: signal([]), loading: signal(false), loadCuentas: vi.fn(), stopCuentas: vi.fn() } },
        { provide: CierreCajaService, useValue: { cierres: signal([]), loadCierres: vi.fn(), stopCierres: vi.fn() } },
        { provide: ConciliacionService, useValue: { lineas: signal([]), loadLineas: vi.fn(), stopLineas: vi.fn() } },
        { provide: ToastService, useValue: { run: vi.fn() } },
        { provide: Firestore, useValue: {} },
        { provide: UsersService, useValue: { members: signal([]), loadMembers: vi.fn() } },
        { provide: PermissionService, useValue: { can: (_m: string, a: string) => puede(a) } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(TesoreriaComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => TestBed.resetTestingModule());

  it('móvil: las pestañas se sustituyen por un select de sección con las 5 secciones', async () => {
    await montar(true);
    expect(el().querySelector('[data-tab]')).toBeNull();
    const select = el().querySelector<HTMLSelectElement>('select#tesoreria-seccion')!;
    expect(select).not.toBeNull();
    expect(Array.from(select.options).map((o) => o.value))
      .toEqual(['resumen', 'movimientos', 'conciliacion', 'reportes', 'casos']);
    expect(el().querySelector('label[for="tesoreria-seccion"]')).not.toBeNull();
  });

  it('móvil: cambiar el select cambia la sección activa', async () => {
    await montar(true);
    const select = el().querySelector<HTMLSelectElement>('select#tesoreria-seccion')!;
    select.value = 'reportes';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(fixture.componentInstance.activeTab()).toBe('reportes');
    expect(el().querySelector('app-reportes-tab')).not.toBeNull();
  });

  it('escritorio: pestañas y sin select de sección', async () => {
    await montar(false);
    expect(el().querySelectorAll('[data-tab]')).toHaveLength(5);
    expect(el().querySelector('select#tesoreria-seccion')).toBeNull();
  });

  it('móvil: cabecera con "Cierre de caja" visible y el resto en el menú ⋯', async () => {
    await montar(true);
    expect(el().querySelector('[data-cierre-caja]')).not.toBeNull();
    expect(el().querySelector('[data-header-secundario]')).toBeNull();
    expect(el().querySelector('app-action-menu')).not.toBeNull();
  });

  it('escritorio: botones de cabecera visibles y sin menú ⋯', async () => {
    await montar(false);
    expect(el().querySelectorAll('[data-header-secundario]')).toHaveLength(2);
    expect(el().querySelector('app-action-menu')).toBeNull();
  });

  describe('accionesCabecera', () => {
    it('con todos los permisos: cuentas y movimiento general', async () => {
      await montar(true);
      expect(fixture.componentInstance.accionesCabecera().map((a) => a.id)).toEqual(['cuentas', 'movimiento-general']);
    });

    it('solo crear: movimiento general', async () => {
      await montar(true, (a) => a === 'crear');
      expect(fixture.componentInstance.accionesCabecera().map((a) => a.id)).toEqual(['movimiento-general']);
    });

    it('sin permisos: sin menú', async () => {
      await montar(true, () => false);
      expect(fixture.componentInstance.accionesCabecera()).toEqual([]);
      expect(el().querySelector('app-action-menu')).toBeNull();
    });

    it('ejecutar abre el drawer correspondiente', async () => {
      await montar(true);
      const c = fixture.componentInstance;
      c.ejecutarAccionCabecera('cuentas');
      expect(c.showCuentasDrawer()).toBe(true);
      c.ejecutarAccionCabecera('movimiento-general');
      expect(c.showMovimientoGeneralDrawer()).toBe(true);
      expect(c.editandoMovimientoGeneral()).toBeNull();
    });
  });

  it('móvil: sin padding propio (el layout ya aporta el margen lateral)', async () => {
    await montar(true);
    const raiz = el().firstElementChild as HTMLElement;
    expect(raiz.className).toContain('sm:p-6');
    expect(raiz.classList.contains('p-6')).toBe(false);
  });

  it('móvil: sin violaciones de accesibilidad', async () => {
    await montar(true);
    const v = await analizarA11y(el());
    expect(v, formatearViolaciones(v)).toEqual([]);
  });
});
