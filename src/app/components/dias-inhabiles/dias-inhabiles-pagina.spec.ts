import { describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Component } from '@angular/core';
import { DiasInhabilesSeccionComponent } from './dias-inhabiles-seccion';
import { DiasInhabilesPaginaComponent } from './dias-inhabiles-pagina';

@Component({ selector: 'app-dias-inhabiles-seccion', template: '<h2>sección</h2>' })
class SeccionStub {}

describe('DiasInhabilesPaginaComponent', () => {
  it('envuelve la sección con un h1 y un enlace para volver al calendario', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [DiasInhabilesPaginaComponent], providers: [provideRouter([])] });
    TestBed.overrideComponent(DiasInhabilesPaginaComponent, {
      remove: { imports: [DiasInhabilesSeccionComponent] },
      add: { imports: [SeccionStub] },
    });
    const f = TestBed.createComponent(DiasInhabilesPaginaComponent);
    await f.whenStable();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toContain('Días inhábiles');
    expect(el.querySelector('app-dias-inhabiles-seccion')).not.toBeNull();
    expect(el.querySelector('a')?.getAttribute('href')).toBe('/calendario');
    vi.restoreAllMocks();
  });
});
