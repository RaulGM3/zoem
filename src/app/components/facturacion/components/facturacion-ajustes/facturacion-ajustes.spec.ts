import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Functions } from '@angular/fire/functions';
import { FacturacionAjustesComponent } from './facturacion-ajustes';
import { CompanyService } from '../../../../core/services/company.service';
import { ToastService } from '../../../../core/services/toast.service';
import { analizarA11y, formatearViolaciones } from '../../../../../testing/axe';

describe('FacturacionAjustesComponent', () => {
  const company = signal<Record<string, unknown> | null>(null);
  const updateCompany = vi.fn(async () => {});
  const run = vi.fn(async (fn: () => unknown) => fn());

  function montar() {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [FacturacionAjustesComponent],
      providers: [
        { provide: CompanyService, useValue: { activeCompany: company, updateCompany } },
        { provide: ToastService, useValue: { run } },
        { provide: Functions, useValue: {} },
      ],
    });
    const fixture = TestBed.createComponent(FacturacionAjustesComponent);
    return fixture;
  }

  beforeEach(() => {
    updateCompany.mockClear();
    run.mockClear();
    company.set({
      id: 'co', name: 'Acme SL', cif: 'B12345674', tipoPersona: 'juridica',
      verifactu: { enabled: true, sandbox: false, otro: 'x' },
    });
  });

  it('precarga el formulario desde la empresa activa', async () => {
    const f = montar();
    await f.whenStable();
    expect(f.componentInstance.configForm.getRawValue()).toEqual({
      name: 'Acme SL', cif: 'B12345674', tipoPersona: 'juridica',
      verifactuEnabled: true, verifactuSandbox: false,
    });
  });

  it('guardar llama a updateCompany con verifactu mezclado y valores recortados', async () => {
    const f = montar();
    await f.whenStable();
    f.componentInstance.configForm.patchValue({ name: '  Nuevo  ', cif: '  ', verifactuSandbox: true });
    await f.componentInstance.saveConfig();
    expect(updateCompany).toHaveBeenCalledWith('co', {
      name: 'Nuevo',
      cif: undefined,
      tipoPersona: 'juridica',
      verifactu: { enabled: true, sandbox: true, otro: 'x' },
    });
  });

  it('savingConfig es true durante el guardado y false al terminar; ignora reentradas', async () => {
    const f = montar();
    await f.whenStable();
    let liberar!: () => void;
    run.mockImplementationOnce(() => new Promise<void>((r) => { liberar = r; }));
    const p = f.componentInstance.saveConfig();
    expect(f.componentInstance.savingConfig()).toBe(true);
    await f.componentInstance.saveConfig();
    expect(run).toHaveBeenCalledTimes(1);
    liberar();
    await p;
    expect(f.componentInstance.savingConfig()).toBe(false);
  });

  it('no guarda sin empresa activa', async () => {
    company.set(null);
    const f = montar();
    await f.whenStable();
    await f.componentInstance.saveConfig();
    expect(run).not.toHaveBeenCalled();
  });

  it('renderiza la pestaña de configuración reutilizada', async () => {
    const f = montar();
    await f.whenStable();
    expect(f.nativeElement.querySelector('app-facturacion-configuracion-tab')).not.toBeNull();
  });

  it('pasa AXE', async () => {
    const f = montar();
    await f.whenStable();
    const v = await analizarA11y(f.nativeElement as HTMLElement);
    expect(v, formatearViolaciones(v)).toEqual([]);
  });
});
