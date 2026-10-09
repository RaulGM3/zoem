import { describe, it, expect } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MejorarPlanModalComponent } from './mejorar-plan-modal';
import type { PlanId } from '../../../core/planes/catalogo';

async function montar(plan: PlanId = 'free', funcion: 'tesoreria' | null = 'tesoreria') {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ imports: [MejorarPlanModalComponent] });
  const fixture = TestBed.createComponent(MejorarPlanModalComponent);
  fixture.componentRef.setInput('open', true);
  fixture.componentRef.setInput('planActual', plan);
  fixture.componentRef.setInput('funcion', funcion);
  fixture.detectChanges();
  return fixture;
}

describe('MejorarPlanModalComponent', () => {
  it('lista free, pro y enterprise', async () => {
    const f = await montar();
    const el = f.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Free');
    expect(el.textContent).toContain('Pro');
    expect(el.textContent).toContain('Enterprise');
  });

  it('marca el plan actual y no ofrece mejorar a él', async () => {
    const f = await montar('free');
    const el = f.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Tu plan actual');
    expect(el.querySelectorAll('button[data-solicitar]').length).toBe(2);
  });

  it('menciona la función que motivó el aviso', async () => {
    const f = await montar('free', 'tesoreria');
    expect((f.nativeElement as HTMLElement).textContent).toContain('Tesorería');
  });

  it('emite el plan elegido', async () => {
    const f = await montar('free');
    const elegidos: string[] = [];
    f.componentInstance.solicitar.subscribe((p) => elegidos.push(p));
    (f.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button[data-solicitar="pro"]')!.click();
    expect(elegidos).toEqual(['pro']);
  });

  it('emite closed al cerrar', async () => {
    const f = await montar();
    let c = 0;
    f.componentInstance.closed.subscribe(() => c++);
    (f.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button[aria-label="Cerrar"]')!.click();
    expect(c).toBe(1);
  });
});
