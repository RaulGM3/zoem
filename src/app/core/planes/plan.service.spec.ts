import { describe, it, expect, beforeEach } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CompanyService, type Company } from '../services/company.service';
import { PlanService } from './plan.service';
import type { Suscripcion } from './catalogo';

const AHORA = new Date('2026-10-09T12:00:00Z');
const activeCompany = signal<Company | null>(null);

const empresa = (extra: Partial<Company>): Company => ({ id: 'c1', name: 'X', slug: 'x', isActive: true, ...extra });
const sus = (p: Partial<Suscripcion>): Suscripcion => ({ plan: 'free', complementos: [], estado: 'activa', origen: 'manual', ...p });

describe('PlanService', () => {
  let svc: PlanService;

  beforeEach(() => {
    activeCompany.set(null);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: CompanyService, useValue: { activeCompany } }],
    });
    svc = TestBed.inject(PlanService);
    svc.ahora.set(AHORA);
  });

  it('empresa legada sin suscripcion ni plan: todo desbloqueado', () => {
    activeCompany.set(empresa({}));
    expect(svc.plan()).toBe('pro');
    expect(svc.tiene('tesoreria')).toBe(true);
    expect(svc.mostrarMejora()).toBe(false);
  });

  it("empresa legada con plan 'free' en el doc NO se bloquea", () => {
    activeCompany.set(empresa({ plan: 'free' }));
    expect(svc.tiene('facturacion')).toBe(true);
  });

  it('sin empresa activa no bloquea nada (aún cargando)', () => {
    expect(svc.tiene('tesoreria')).toBe(true);
  });

  it('suscripcion free bloquea funciones de pago y muestra mejora', () => {
    activeCompany.set(empresa({ suscripcion: sus({ plan: 'free' }) }));
    expect(svc.plan()).toBe('free');
    expect(svc.tiene('tesoreria')).toBe(false);
    expect(svc.tiene('contactos')).toBe(true);
    expect(svc.limite('plantillas')).toBe(5);
    expect(svc.mostrarMejora()).toBe(true);
    expect(svc.enPrueba()).toBe(false);
  });

  it('prueba vigente: pro, enPrueba y días restantes', () => {
    activeCompany.set(
      empresa({ suscripcion: sus({ estado: 'prueba', periodoFin: new Date('2026-10-23T11:00:00Z') }) }),
    );
    expect(svc.enPrueba()).toBe(true);
    expect(svc.diasPruebaRestantes()).toBe(14);
    expect(svc.tiene('tesoreria')).toBe(true);
    expect(svc.mostrarMejora()).toBe(true);
  });

  it('plan demo no muestra mejora', () => {
    activeCompany.set(empresa({ suscripcion: sus({ plan: 'demo' }) }));
    expect(svc.mostrarMejora()).toBe(false);
  });

  it('reacciona al cambiar de empresa', () => {
    activeCompany.set(empresa({ suscripcion: sus({ plan: 'free' }) }));
    expect(svc.tiene('tesoreria')).toBe(false);
    activeCompany.set(empresa({ suscripcion: sus({ plan: 'pro' }) }));
    expect(svc.tiene('tesoreria')).toBe(true);
  });

  describe('demo (14 días)', () => {
    const manana = new Date('2026-10-10T12:00:00Z');
    const ayer = new Date('2026-10-08T12:00:00Z');

    it('vigente: no está terminada y cuenta los días que quedan', () => {
      activeCompany.set(empresa({ suscripcion: sus({ plan: 'demo', periodoFin: manana }) }));
      expect(svc.demoVencida()).toBe(false);
      expect(svc.soloLectura()).toBe(false);
      expect(svc.diasDemoRestantes()).toBe(1);
    });
    it('terminada: solo lectura, sin días', () => {
      activeCompany.set(empresa({ suscripcion: sus({ plan: 'demo', periodoFin: ayer }) }));
      expect(svc.demoVencida()).toBe(true);
      expect(svc.soloLectura()).toBe(true);
      expect(svc.diasDemoRestantes()).toBe(0);
    });
    it('una empresa que no es demo nunca está en solo lectura', () => {
      activeCompany.set(empresa({ suscripcion: sus({ plan: 'free' }) }));
      expect(svc.demoVencida()).toBe(false);
      expect(svc.soloLectura()).toBe(false);
    });
  });
});
