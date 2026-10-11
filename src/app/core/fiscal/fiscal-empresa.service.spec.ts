import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { CompanyService } from '../services/company.service';
import { FiscalEmpresaService } from './fiscal-empresa.service';

function montar(empresa: Record<string, unknown> | null) {
  const activeCompany = signal(empresa);
  TestBed.configureTestingModule({ providers: [{ provide: CompanyService, useValue: { activeCompany } }] });
  return { activeCompany, svc: TestBed.inject(FiscalEmpresaService) };
}

describe('FiscalEmpresaService', () => {
  it('sin empresa o sin país: España', () => {
    for (const e of [null, { name: 'Antiguo' }]) {
      TestBed.resetTestingModule();
      const { svc } = montar(e);
      expect(svc.pais()).toBe('ES');
      expect(svc.esEspana()).toBe(true);
      expect([...svc.tiposIva()]).toEqual([21, 10, 4, 0]);
      expect(svc.ivaPorDefecto()).toBe(21);
      expect(svc.ivaLineaNueva()).toBe(0.1);
      expect(svc.etiquetaIdFiscal()).toBe('NIF/CIF');
    }
  });

  it('México: 16/8/0, RFC, no es España', () => {
    const { svc } = montar({ pais: 'MX' });
    expect(svc.esEspana()).toBe(false);
    expect([...svc.tiposIva()]).toEqual([16, 8, 0]);
    expect(svc.ivaPorDefecto()).toBe(16);
    expect(svc.ivaLineaNueva()).toBe(0.16);
    expect(svc.etiquetaIdFiscal()).toBe('RFC');
  });

  it('verifactuDisponible: España con Verifactu activado', () => {
    expect(montar({ pais: 'ES', verifactu: { enabled: true } }).svc.verifactuDisponible()).toBe(true);
  });

  it('verifactuDisponible: sin país se lee como España', () => {
    TestBed.resetTestingModule();
    expect(montar({ verifactu: { enabled: true } }).svc.verifactuDisponible()).toBe(true);
  });

  it('verifactuDisponible: false si está desactivado', () => {
    TestBed.resetTestingModule();
    expect(montar({ pais: 'ES', verifactu: { enabled: false } }).svc.verifactuDisponible()).toBe(false);
    TestBed.resetTestingModule();
    expect(montar({ pais: 'ES' }).svc.verifactuDisponible()).toBe(false);
  });

  it('verifactuDisponible: false fuera de España aunque el flag esté activo', () => {
    TestBed.resetTestingModule();
    expect(montar({ pais: 'CO', verifactu: { enabled: true } }).svc.verifactuDisponible()).toBe(false);
  });

  it('opcionesIva conserva un tipo heredado que el país no tiene', () => {
    const { svc } = montar({ pais: 'MX' });
    expect(svc.opcionesIva([21])).toEqual([21, 16, 8, 0]);
  });

  it('cambiar de despacho actualiza todo', () => {
    const { svc, activeCompany } = montar({ pais: 'ES' });
    activeCompany.set({ pais: 'CL' });
    expect([...svc.tiposIva()]).toEqual([19, 0]);
    expect(svc.etiquetaIdFiscal()).toBe('RUT');
  });
});
