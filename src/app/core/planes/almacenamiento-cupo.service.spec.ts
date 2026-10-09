import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AlmacenamientoCupoService, CupoAlmacenamientoError } from './almacenamiento-cupo.service';
import { MejoraPlanService } from './mejora-plan.service';
import { PlanService } from './plan.service';
import { UsoService } from './uso.service';

const MB = 1_048_576;

describe('AlmacenamientoCupoService', () => {
  const abrir = vi.fn();
  let usadoBytes = 0;
  let limite = 500;

  beforeEach(() => {
    abrir.mockReset();
    usadoBytes = 0;
    limite = 500;
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: MejoraPlanService, useValue: { abrir } },
        { provide: PlanService, useValue: { limite: () => limite } },
        { provide: UsoService, useValue: { usadoBytes: () => usadoBytes } },
      ],
    });
  });

  it('si cabe, no hace nada', () => {
    usadoBytes = 10 * MB;
    expect(() => TestBed.inject(AlmacenamientoCupoService).asegurar(MB)).not.toThrow();
    expect(abrir).not.toHaveBeenCalled();
  });

  it('si no cabe, abre el modal de mejora (documentos) y lanza con el mensaje de lo que queda', () => {
    usadoBytes = 498 * MB;
    const svc = TestBed.inject(AlmacenamientoCupoService);
    let error: unknown;
    try { svc.asegurar(5 * MB); } catch (e) { error = e; }
    expect(error).toBeInstanceOf(CupoAlmacenamientoError);
    expect((error as CupoAlmacenamientoError).message).toBe('No queda espacio: te quedan 2 MB.');
    expect((error as CupoAlmacenamientoError).code).toBe('cupo-almacenamiento');
    expect(abrir).toHaveBeenCalledWith('documentos');
  });

  it('plan ilimitado: nunca bloquea', () => {
    limite = Infinity;
    usadoBytes = 10 ** 14;
    expect(() => TestBed.inject(AlmacenamientoCupoService).asegurar(10 ** 9)).not.toThrow();
  });
});
