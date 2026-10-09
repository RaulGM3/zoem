import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Functions } from '@angular/fire/functions';
import { CupoIaAgotadoError } from '../agent/errores-ia';
import { CompanyService, type Company } from '../services/company.service';
import { IaCupoService, clasificarErrorReserva } from './ia-cupo';
import { MejoraPlanService } from './mejora-plan.service';

const m = vi.hoisted(() => ({ httpsCallable: vi.fn(), llamada: vi.fn() }));
vi.mock('@angular/fire/functions', () => ({
  Functions: class MockFunctions {},
  httpsCallable: (...a: unknown[]) => {
    m.httpsCallable(...a);
    return m.llamada;
  },
}));

describe('clasificarErrorReserva', () => {
  it('resource-exhausted => agotado', () => {
    expect(clasificarErrorReserva({ code: 'functions/resource-exhausted' })).toBe('agotado');
  });
  it('fallos de infraestructura => transitorio (no se bloquea al usuario por una caída)', () => {
    for (const code of ['functions/unavailable', 'functions/deadline-exceeded', 'functions/internal']) {
      expect(clasificarErrorReserva({ code })).toBe('transitorio');
    }
    expect(clasificarErrorReserva(new TypeError('Failed to fetch'))).toBe('transitorio');
  });
  it('permisos / plan sin IA / sesión => bloqueado', () => {
    for (const code of ['functions/permission-denied', 'functions/failed-precondition', 'functions/unauthenticated']) {
      expect(clasificarErrorReserva({ code })).toBe('bloqueado');
    }
  });
});

describe('IaCupoService', () => {
  const activeCompany = signal<Company | null>(null);
  const abrir = vi.fn();
  let svc: IaCupoService;

  beforeEach(() => {
    m.httpsCallable.mockClear();
    m.llamada.mockReset();
    abrir.mockClear();
    activeCompany.set({ id: 'c1', name: 'X', slug: 'x', isActive: true });
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: Functions, useValue: {} },
        { provide: CompanyService, useValue: { activeCompany } },
        { provide: MejoraPlanService, useValue: { abrir } },
      ],
    });
    svc = TestBed.inject(IaCupoService);
  });

  it('reserva 1 por defecto contra la empresa activa', async () => {
    m.llamada.mockResolvedValue({ data: { usado: 3, limite: 30 } });
    await svc.reservar();
    expect(m.httpsCallable.mock.calls[0][1]).toBe('reservarIA');
    expect(m.llamada).toHaveBeenCalledWith({ companyId: 'c1', n: 1 });
  });

  it('cupo agotado: abre el modal de mejora y lanza CupoIaAgotadoError', async () => {
    m.llamada.mockRejectedValue({ code: 'functions/resource-exhausted' });
    await expect(svc.reservar()).rejects.toBeInstanceOf(CupoIaAgotadoError);
    expect(abrir).toHaveBeenCalledWith('ia');
  });

  it('fallo transitorio: deja pasar (fail-open) y no molesta', async () => {
    m.llamada.mockRejectedValue({ code: 'functions/unavailable' });
    await expect(svc.reservar()).resolves.toBeUndefined();
    expect(abrir).not.toHaveBeenCalled();
  });

  it('bloqueado (p. ej. plan sin IA): propaga el error', async () => {
    m.llamada.mockRejectedValue({ code: 'functions/failed-precondition' });
    await expect(svc.reservar()).rejects.toMatchObject({ code: 'functions/failed-precondition' });
  });

  it('sin empresa activa no hay nada que reservar', async () => {
    activeCompany.set(null);
    await expect(svc.reservar()).resolves.toBeUndefined();
    expect(m.llamada).not.toHaveBeenCalled();
  });
});
