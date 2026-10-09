import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MejoraPlanService } from './mejora-plan.service';

describe('MejoraPlanService', () => {
  let svc: MejoraPlanService;
  beforeEach(() => {
    TestBed.resetTestingModule();
    svc = TestBed.inject(MejoraPlanService);
  });

  it('empieza cerrado', () => {
    expect(svc.abierto()).toBe(false);
    expect(svc.funcion()).toBeNull();
  });
  it('abre con la función que motivó el aviso', () => {
    svc.abrir('tesoreria');
    expect(svc.abierto()).toBe(true);
    expect(svc.funcion()).toBe('tesoreria');
  });
  it('abre sin función (chip del toolbar)', () => {
    svc.abrir('tesoreria');
    svc.abrir();
    expect(svc.funcion()).toBeNull();
  });
  it('abrirPorBloqueo guarda el motivo; abrir() genérico y cerrar() lo limpian', () => {
    svc.abrirPorBloqueo({ tipo: 'cupo', recurso: 'casosActivos', usado: 50, limite: 50 });
    expect(svc.abierto()).toBe(true);
    expect(svc.motivo()?.recurso).toBe('casosActivos');
    expect(svc.funcion()).toBeNull();
    svc.abrir('informes');
    expect(svc.motivo()).toBeNull();
    svc.abrirPorBloqueo({ tipo: 'funcion', recurso: 'tesoreria' });
    expect(svc.funcion()).toBe('tesoreria');
    svc.cerrar();
    expect(svc.motivo()).toBeNull();
  });
  it('cierra', () => {
    svc.abrir('informes');
    svc.cerrar();
    expect(svc.abierto()).toBe(false);
  });
});
