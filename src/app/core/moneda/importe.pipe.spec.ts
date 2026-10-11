import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { CompanyService } from '../services/company.service';
import { ImportePipe } from './importe.pipe';
import { MonedaEmpresaService } from './moneda-empresa.service';

const norm = (s: string) => s.replace(/[  ]/g, ' ');

function montar(empresa: Record<string, unknown> | null) {
  const activeCompany = signal(empresa);
  TestBed.configureTestingModule({ providers: [{ provide: CompanyService, useValue: { activeCompany } }] });
  return { activeCompany, pipe: TestBed.runInInjectionContext(() => new ImportePipe()), svc: TestBed.inject(MonedaEmpresaService) };
}

describe('MonedaEmpresaService', () => {
  it('empresa sin moneda: EUR, símbolo € y step 0.01', () => {
    const { svc } = montar({ name: 'Antiguo' });
    expect(svc.moneda()).toBe('EUR');
    expect(svc.simbolo()).toBe('€');
    expect(svc.step()).toBe('0.01');
  });

  it('despacho colombiano: COP, 0 decimales, step 1', () => {
    const { svc } = montar({ pais: 'CO', moneda: 'COP' });
    expect(svc.decimales()).toBe(0);
    expect(svc.step()).toBe('1');
    expect(norm(svc.formatear(1500))).toBe('$ 1.500');
  });
});

describe('ImportePipe', () => {
  it('formato completo y entero', () => {
    const { pipe } = montar({ pais: 'ES', moneda: 'EUR' });
    expect(norm(pipe.transform(1234.5))).toBe('1.234,50 €');
    expect(norm(pipe.transform(1234.5, 'entero'))).toBe('1.235 €');
  });

  it('null y undefined dan cadena vacía', () => {
    const { pipe } = montar(null);
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
  });

  it('sigue a la empresa activa sin que cambie el valor (por eso es impura)', () => {
    const { pipe, activeCompany } = montar({ pais: 'ES', moneda: 'EUR' });
    expect(norm(pipe.transform(1000))).toBe('1.000,00 €');
    activeCompany.set({ pais: 'CO', moneda: 'COP' });
    expect(norm(pipe.transform(1000))).toBe('$ 1.000');
  });
});
