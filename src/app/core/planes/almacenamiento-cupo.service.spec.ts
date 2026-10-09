import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PermissionService } from '../services/permission.service';
import { AlmacenamientoCupoService, CupoAlmacenamientoError } from './almacenamiento-cupo.service';
import { MejoraPlanService } from './mejora-plan.service';
import { PlanService } from './plan.service';
import { UsoService } from './uso.service';

const MB = 1_048_576;
const archivo = (bytes: number, name = 'a.pdf') => new File([new Uint8Array(bytes)], name);

describe('AlmacenamientoCupoService', () => {
  const abrirPorBloqueo = vi.fn();
  let usadoBytes = 0;
  let limite = 500;
  let soloLectura = false;
  let superUser = false;

  const svc = () => TestBed.inject(AlmacenamientoCupoService);

  beforeEach(() => {
    abrirPorBloqueo.mockReset();
    usadoBytes = 0;
    limite = 500;
    soloLectura = false;
    superUser = false;
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: MejoraPlanService, useValue: { abrirPorBloqueo } },
        { provide: PlanService, useValue: { limite: () => limite, soloLectura: () => soloLectura } },
        { provide: UsoService, useValue: { usadoBytes: () => usadoBytes } },
        { provide: PermissionService, useValue: { isSuperUser: () => superUser } },
      ],
    });
  });

  describe('asegurar(bytes): último recurso antes de subir', () => {
    it('si cabe, no hace nada', () => {
      usadoBytes = 10 * MB;
      expect(() => svc().asegurar(MB)).not.toThrow();
      expect(abrirPorBloqueo).not.toHaveBeenCalled();
    });

    it('si no cabe, abre el modal con la causa y lanza "te quedan X MB y el archivo ocupa Y MB"', () => {
      usadoBytes = 498 * MB;
      let error: unknown;
      try { svc().asegurar(5 * MB); } catch (e) { error = e; }
      expect(error).toBeInstanceOf(CupoAlmacenamientoError);
      expect((error as CupoAlmacenamientoError).message).toBe('No queda espacio: te quedan 2 MB y el archivo ocupa 5 MB.');
      expect((error as CupoAlmacenamientoError).code).toBe('cupo-almacenamiento');
      expect(abrirPorBloqueo).toHaveBeenCalledWith(expect.objectContaining({
        tipo: 'cupo', recurso: 'documentosMB', usado: 498, limite: 500, detalle: 'No queda espacio: te quedan 2 MB y el archivo ocupa 5 MB.',
      }));
    });

    it('plan ilimitado: nunca bloquea', () => {
      limite = Infinity;
      usadoBytes = 10 ** 14;
      expect(() => svc().asegurar(10 ** 9)).not.toThrow();
    });

    it('superusuario: no está sujeto al cupo (igual que en las rules)', () => {
      superUser = true;
      usadoBytes = 900 * MB;
      expect(() => svc().asegurar(50 * MB)).not.toThrow();
      expect(abrirPorBloqueo).not.toHaveBeenCalled();
    });
  });

  describe('puedeSubir(): antes de abrir el selector de archivos', () => {
    it('con espacio libre deja abrir el selector', () => {
      usadoBytes = 100 * MB;
      expect(svc().puedeSubir()).toBe(true);
      expect(abrirPorBloqueo).not.toHaveBeenCalled();
    });

    it('con el cupo agotado NO deja abrir el selector y abre el modal de mejora (documentosMB)', () => {
      usadoBytes = 500 * MB;
      expect(svc().puedeSubir()).toBe(false);
      expect(abrirPorBloqueo).toHaveBeenCalledWith({ tipo: 'cupo', recurso: 'documentosMB', usado: 500, limite: 500 });
    });

    it('por encima del cupo (tras bajar de plan) tampoco deja subir', () => {
      usadoBytes = 800 * MB;
      expect(svc().puedeSubir()).toBe(false);
      expect(abrirPorBloqueo).toHaveBeenCalledWith(expect.objectContaining({ recurso: 'documentosMB', usado: 800, limite: 500 }));
    });

    it('demo terminada (solo lectura): modal de demo terminada', () => {
      soloLectura = true;
      expect(svc().puedeSubir()).toBe(false);
      expect(abrirPorBloqueo).toHaveBeenCalledWith({ tipo: 'demoTerminada', recurso: 'demo' });
    });

    it('plan ilimitado y superusuario siempre pueden', () => {
      limite = Infinity;
      usadoBytes = 10 ** 14;
      expect(svc().puedeSubir()).toBe(true);
      limite = 500;
      superUser = true;
      usadoBytes = 900 * MB;
      expect(svc().puedeSubir()).toBe(true);
      expect(abrirPorBloqueo).not.toHaveBeenCalled();
    });
  });

  describe('admitir(archivos): al elegir los archivos', () => {
    it('todos caben: los devuelve tal cual', () => {
      usadoBytes = 10 * MB;
      const fs = [archivo(MB), archivo(2 * MB)];
      expect(svc().admitir(fs)).toEqual(fs);
      expect(abrirPorBloqueo).not.toHaveBeenCalled();
    });

    it('uno no cabe: no se sube, y el modal dice cuánto queda y cuánto ocupa', () => {
      usadoBytes = 498 * MB;
      expect(svc().admitir([archivo(5 * MB)])).toEqual([]);
      expect(abrirPorBloqueo).toHaveBeenCalledWith(expect.objectContaining({
        recurso: 'documentosMB', detalle: 'No queda espacio: te quedan 2 MB y el archivo ocupa 5 MB.',
      }));
    });

    it('varios: se acumulan y se sube solo lo que cabe en conjunto (modal una sola vez)', () => {
      usadoBytes = 495 * MB;
      const [a, b, c] = [archivo(3 * MB, 'a'), archivo(3 * MB, 'b'), archivo(MB, 'c')];
      expect(svc().admitir([a, b, c])).toEqual([a]);
      expect(abrirPorBloqueo).toHaveBeenCalledTimes(1);
    });

    it('un archivo de 0 bytes cabe con el cupo justo y superusuario admite todo', () => {
      usadoBytes = 500 * MB;
      expect(svc().admitir([archivo(0)]).length).toBe(1);
      superUser = true;
      usadoBytes = 900 * MB;
      expect(svc().admitir([archivo(50 * MB)]).length).toBe(1);
    });
  });
});
