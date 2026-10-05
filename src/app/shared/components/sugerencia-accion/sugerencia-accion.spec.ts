import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { SugerenciaAccionComponent } from './sugerencia-accion';

describe('SugerenciaAccionComponent', () => {
  async function montar() {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [SugerenciaAccionComponent] }).compileComponents();
    const fixture = TestBed.createComponent(SugerenciaAccionComponent);
    fixture.componentRef.setInput('hitoTitulo', 'Demanda presentada');
    fixture.detectChanges();
    return fixture;
  }

  it('es una región de estado no bloqueante con el texto de la sugerencia', async () => {
    const f = await montar();
    const root = f.nativeElement as HTMLElement;
    expect(root.querySelector('[role="status"]')).not.toBeNull();
    expect(root.textContent).toContain('¿Notificar al cliente que «Demanda presentada» está listo?');
  });

  it('emite aceptar y descartar', async () => {
    const f = await montar();
    const aceptar = vi.fn();
    const descartar = vi.fn();
    f.componentInstance.aceptar.subscribe(aceptar);
    f.componentInstance.descartar.subscribe(descartar);
    const botones = (f.nativeElement as HTMLElement).querySelectorAll('button');
    botones[0].click();
    botones[1].click();
    expect(aceptar).toHaveBeenCalled();
    expect(descartar).toHaveBeenCalled();
  });
});
