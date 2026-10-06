import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { signal } from '@angular/core';
import { CuentasGestionComponent } from './cuentas-gestion';
import { CuentasService } from '../../../../core/services/cuentas.service';
import { ToastService } from '../../../../core/services/toast.service';
import { analizarA11y, formatearViolaciones } from '../../../../../testing/axe';

describe('CuentasGestionComponent', () => {
  const cuentas = signal([
    { id: 'c1', nombre: 'BBVA', tipo: 'banco', entidad: 'BBVA', iban: 'ES00' },
    { id: 'c2', nombre: 'Caja chica', tipo: 'caja' },
  ]);
  const loading = signal(false);
  const svc = {
    cuentas, loading,
    loadCuentas: vi.fn(), stopCuentas: vi.fn(),
    createCuenta: vi.fn(async () => 'x'), updateCuenta: vi.fn(async () => {}), deleteCuenta: vi.fn(async () => {}),
  };
  let f: ComponentFixture<CuentasGestionComponent>;
  const el = () => f.nativeElement as HTMLElement;

  async function montar(): Promise<void> {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [CuentasGestionComponent],
      providers: [
        { provide: CuentasService, useValue: svc },
        { provide: ToastService, useValue: { run: async (fn: () => unknown, o?: { onSuccess?: () => void }) => { await fn(); o?.onSuccess?.(); } } },
      ],
    });
    f = TestBed.createComponent(CuentasGestionComponent);
    await f.whenStable();
  }

  beforeEach(() => { vi.clearAllMocks(); loading.set(false); });

  it('lista las cuentas', async () => {
    await montar();
    const txt = el().textContent ?? '';
    expect(txt).toContain('BBVA');
    expect(txt).toContain('Caja chica');
  });

  it('NO arranca ni detiene el listener de cuentas (lo gestiona el host)', async () => {
    await montar();
    f.destroy();
    expect(svc.loadCuentas).not.toHaveBeenCalled();
    expect(svc.stopCuentas).not.toHaveBeenCalled();
  });

  it('crea una cuenta banco con datos recortados', async () => {
    await montar();
    const c = f.componentInstance;
    c.openNew();
    c.form.set({ nombre: '  Santander ', tipo: 'banco', entidad: ' SAN ', iban: '' });
    await c.save();
    expect(svc.createCuenta).toHaveBeenCalledWith({ nombre: 'Santander', tipo: 'banco', entidad: 'SAN', iban: undefined });
    expect(c.showForm()).toBe(false);
  });

  it('crea una caja sin entidad ni iban', async () => {
    await montar();
    const c = f.componentInstance;
    c.openNew();
    c.form.set({ nombre: 'Caja 2', tipo: 'caja', entidad: 'x', iban: 'y' });
    await c.save();
    expect(svc.createCuenta).toHaveBeenCalledWith({ nombre: 'Caja 2', tipo: 'caja', entidad: undefined, iban: undefined });
  });

  it('edita una cuenta existente', async () => {
    await montar();
    const c = f.componentInstance;
    c.openEdit(cuentas()[0] as never);
    c.form.update((x) => ({ ...x, nombre: 'BBVA 2' }));
    await c.save();
    expect(svc.updateCuenta).toHaveBeenCalledWith('c1', expect.objectContaining({ nombre: 'BBVA 2' }));
  });

  it('eliminar pide confirmación antes de borrar', async () => {
    await montar();
    const c = f.componentInstance;
    c.requestDelete('c2');
    expect(svc.deleteCuenta).not.toHaveBeenCalled();
    expect(c.confirmingDeleteId()).toBe('c2');
    await c.delete('c2');
    expect(svc.deleteCuenta).toHaveBeenCalledWith('c2');
    expect(c.confirmingDeleteId()).toBeNull();
  });

  it('no guarda con nombre vacío', async () => {
    await montar();
    const c = f.componentInstance;
    c.openNew();
    await c.save();
    expect(svc.createCuenta).not.toHaveBeenCalled();
  });

  it('pasa AXE con el formulario abierto', async () => {
    await montar();
    f.componentInstance.openNew();
    f.detectChanges();
    const v = await analizarA11y(el());
    expect(v, formatearViolaciones(v)).toEqual([]);
  });
});
