import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { derechosEfectivos } from './derechos';
import type { Limite, Suscripcion } from './catalogo';
import { BloqueoPlanService } from './bloqueo-plan.service';
import { MejoraPlanService } from './mejora-plan.service';
import { PlanService } from './plan.service';
import { UsoService } from './uso.service';
import { CompanyService } from '../services/company.service';

const ahora = new Date('2026-10-09T12:00:00Z');
const denegado = Object.assign(new Error('x'), { code: 'permission-denied' });

describe('BloqueoPlanService', () => {
  const suscripcion = signal<Suscripcion>({ plan: 'free', complementos: [], estado: 'activa', origen: 'manual' });
  let usos: Partial<Record<Limite, number>>;
  let url: string;
  let mejora: MejoraPlanService;
  let svc: BloqueoPlanService;

  beforeEach(() => {
    usos = {};
    url = '/casos';
    suscripcion.set({ plan: 'free', complementos: [], estado: 'activa', origen: 'manual' });
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: PlanService,
          useValue: {
            ahora: signal(ahora), suscripcion, derechos: () => derechosEfectivos(suscripcion(), ahora), plan: () => suscripcion().plan,
          },
        },
        { provide: UsoService, useValue: { usado: (l: Limite) => usos[l] ?? 0 } },
        { provide: Router, useValue: { get url() { return url; } } },
        { provide: CompanyService, useValue: { activeCompany: () => ({ id: 'c1', zonaHoraria: 'Europe/Madrid' }) } },
      ],
    });
    mejora = TestBed.inject(MejoraPlanService);
    svc = TestBed.inject(BloqueoPlanService);
  });

  describe('manejar(error, contexto)', () => {
    it('error de cupo: abre el modal con el motivo y devuelve true (el llamador no toastea)', () => {
      usos = { casosActivos: 50 };
      expect(svc.manejar(denegado, { limite: 'casosActivos' })).toBe(true);
      expect(mejora.abierto()).toBe(true);
      expect(mejora.motivo()).toEqual({ tipo: 'cupo', recurso: 'casosActivos', usado: 50, limite: 50 });
    });
    it('error de rol (hay cupo): no abre nada y devuelve false', () => {
      expect(svc.manejar(denegado, { limite: 'casosActivos' })).toBe(false);
      expect(mejora.abierto()).toBe(false);
    });
    it('sin contexto, en una página de pago cuya función no está en el plan, infiere la función por la ruta', () => {
      url = '/tesoreria/cuentas?x=1';
      expect(svc.manejar(denegado)).toBe(true);
      expect(mejora.motivo()).toEqual({ tipo: 'funcion', recurso: 'tesoreria' });
    });
    it('demo terminada: cualquier permission-denied', () => {
      suscripcion.set({ plan: 'demo', complementos: [], estado: 'activa', origen: 'manual', periodoFin: new Date('2026-10-01T00:00:00Z') });
      expect(svc.manejar(denegado)).toBe(true);
      expect(mejora.motivo()?.tipo).toBe('demoTerminada');
    });
    it('error que no es de permisos: false', () => {
      expect(svc.manejar(new Error('red caída'))).toBe(false);
    });
  });

  describe('cupoAgotado(limite) · pre-check antes de escribir', () => {
    it('agotado: abre el modal y devuelve true', () => {
      usos = { contactos: 10 };
      suscripcion.set({ plan: 'demo', complementos: [], estado: 'activa', origen: 'manual', periodoFin: new Date('2026-10-20T00:00:00Z') });
      expect(svc.cupoAgotado('contactos')).toBe(true);
      expect(mejora.motivo()).toMatchObject({ tipo: 'cupo', recurso: 'contactos', limite: 10 });
    });
    it('con hueco: no abre nada y devuelve false', () => {
      usos = { casosActivos: 49 };
      expect(svc.cupoAgotado('casosActivos')).toBe(false);
      expect(mejora.abierto()).toBe(false);
    });
    it('ilimitado: false', () => {
      usos = { contactos: 1e6 };
      expect(svc.cupoAgotado('contactos')).toBe(false);
    });
    it('demo terminada: abre el modal de demo aunque el cupo no esté lleno', () => {
      suscripcion.set({ plan: 'demo', complementos: [], estado: 'activa', origen: 'manual', periodoFin: new Date('2026-10-01T00:00:00Z') });
      expect(svc.cupoAgotado('casosActivos')).toBe(true);
      expect(mejora.motivo()?.tipo).toBe('demoTerminada');
    });
  });

  describe('abrirCupo(limite, usado?) · cuando el componente ya sabe que está agotado', () => {
    it('abre el modal con el cupo y el uso que le pasan (mejor dato que el contador del servidor)', () => {
      svc.abrirCupo('plantillas', 7);
      expect(mejora.motivo()).toEqual({ tipo: 'cupo', recurso: 'plantillas', usado: 7, limite: 5 });
    });
    it('sin uso explícito usa el contador', () => {
      usos = { accionesMes: 15 };
      svc.abrirCupo('accionesMes');
      expect(mejora.motivo()).toMatchObject({ recurso: 'accionesMes', usado: 15, limite: 15 });
    });
  });
});
