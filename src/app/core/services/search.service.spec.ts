import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { SearchService } from './search.service';

describe('SearchService', () => {
  let svc: SearchService;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: Router, useValue: { navigateByUrl: () => Promise.resolve(true) } }] });
    svc = TestBed.inject(SearchService);
  });

  it('la categoría "personal" apunta a /configuracion/usuarios', () => {
    expect(svc.categories.find((c) => c.key === 'personal')?.route).toBe('/configuracion/usuarios');
  });

  it('syncToRoute detecta "personal" en /configuracion/usuarios', () => {
    svc.syncToRoute('/configuracion/usuarios');
    expect(svc.category()).toBe('personal');
  });

  it('otras secciones de Configuración no activan ninguna categoría', () => {
    svc.syncToRoute('/configuracion/usuarios');
    svc.syncToRoute('/configuracion/empresa');
    expect(svc.category()).toBeNull();
  });
});
