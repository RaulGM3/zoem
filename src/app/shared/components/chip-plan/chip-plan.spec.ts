import { describe, it, expect, beforeEach } from 'vitest';
import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MejoraPlanService } from '../../../core/planes/mejora-plan.service';
import { PlanService } from '../../../core/planes/plan.service';
import { ChipPlanComponent } from './chip-plan';

const mostrar = signal(true);
const enPrueba = signal(false);
const dias = signal(0);

describe('ChipPlanComponent', () => {
  beforeEach(() => {
    mostrar.set(true);
    enPrueba.set(false);
    dias.set(0);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ChipPlanComponent],
      providers: [
        { provide: PlanService, useValue: { mostrarMejora: computed(() => mostrar()), enPrueba, diasPruebaRestantes: dias } },
      ],
    });
  });

  const montar = () => {
    const f = TestBed.createComponent(ChipPlanComponent);
    f.detectChanges();
    return f.nativeElement as HTMLElement;
  };

  it('Free: "Free · Mejorar"', () => {
    expect(montar().querySelector('button')?.textContent?.replace(/\s+/g, ' ').trim()).toBe('Free · Mejorar');
  });

  it('prueba: "Prueba · N días"', () => {
    enPrueba.set(true);
    dias.set(9);
    expect(montar().querySelector('button')?.textContent).toContain('Prueba · 9 días');
  });

  it('prueba, 1 día en singular', () => {
    enPrueba.set(true);
    dias.set(1);
    expect(montar().querySelector('button')?.textContent).toContain('Prueba · 1 día');
    expect(montar().querySelector('button')?.textContent).not.toContain('días');
  });

  it('oculto en pro/enterprise/demo', () => {
    mostrar.set(false);
    expect(montar().querySelector('button')).toBeNull();
  });

  it('al pulsar abre el modal', () => {
    const el = montar();
    el.querySelector('button')!.click();
    expect(TestBed.inject(MejoraPlanService).abierto()).toBe(true);
  });
});
