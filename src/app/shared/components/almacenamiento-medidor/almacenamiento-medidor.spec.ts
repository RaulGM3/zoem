import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { PlanService } from '../../../core/planes/plan.service';
import { UsoService } from '../../../core/planes/uso.service';
import { AlmacenamientoMedidorComponent } from './almacenamiento-medidor';

function montar(limite: number, usadoMB: number): HTMLElement {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [AlmacenamientoMedidorComponent],
    providers: [
      { provide: PlanService, useValue: { limite: () => limite } },
      { provide: UsoService, useValue: { usado: () => usadoMB } },
    ],
  });
  const f = TestBed.createComponent(AlmacenamientoMedidorComponent);
  f.detectChanges();
  return f.nativeElement as HTMLElement;
}

describe('AlmacenamientoMedidorComponent', () => {
  it('con límite finito muestra el medidor de almacenamiento "usados/límite MB de documentos"', () => {
    const el = montar(500, 120);
    expect(el.textContent).toContain('120/500 MB de documentos');
    expect(el.querySelector('[role="progressbar"]')).not.toBeNull();
  });

  it('por encima del cupo (tras bajar de plan) lo dice con texto: "Límite alcanzado"', () => {
    const el = montar(500, 800);
    expect(el.textContent).toContain('800/500 MB de documentos');
    expect(el.textContent).toContain('Límite alcanzado');
  });

  it('plan ilimitado: no se pinta nada', () => {
    expect(montar(Infinity, 120).querySelector('[data-estado]')).toBeNull();
  });
});
