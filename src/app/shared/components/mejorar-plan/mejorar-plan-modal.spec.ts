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

  describe('con motivo de bloqueo', () => {
    async function conMotivo(motivo: unknown) {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ imports: [MejorarPlanModalComponent] });
      const f = TestBed.createComponent(MejorarPlanModalComponent);
      f.componentRef.setInput('open', true);
      f.componentRef.setInput('planActual', 'free');
      f.componentRef.setInput('motivo', motivo);
      f.componentRef.setInput('zona', 'Europe/Madrid');
      f.componentRef.setInput('ahora', new Date('2026-10-09T12:00:00Z'));
      f.detectChanges();
      await f.whenStable();
      return f;
    }
    const cupo = { tipo: 'cupo', recurso: 'casosActivos', usado: 50, limite: 50 };

    it('muestra el titular de la causa, el medidor, "Hazte PRO" y "Ahora no"', async () => {
      const f = await conMotivo(cupo);
      const el = f.nativeElement as HTMLElement;
      expect(el.querySelector('[data-testid="titular-bloqueo"]')?.textContent).toContain('Has usado tus 50 casos del plan Free');
      expect(el.querySelector('app-cupo')).not.toBeNull();
      const botones = Array.from(el.querySelectorAll('button')).map((b) => b.textContent?.trim());
      expect(botones).toContain('Hazte PRO');
      expect(botones).toContain('Ahora no');
    });
    it('el titular es enfocable (tabindex -1) y recibe el foco', async () => {
      const f = await conMotivo(cupo);
      const h = (f.nativeElement as HTMLElement).querySelector('[data-testid="titular-bloqueo"]') as HTMLElement;
      expect(h.getAttribute('tabindex')).toBe('-1');
      expect(document.activeElement).toBe(h);
    });
    it('"Hazte PRO" emite solicitar(pro) y "Ahora no" cierra', async () => {
      const f = await conMotivo(cupo);
      const el = f.nativeElement as HTMLElement;
      const eventos: string[] = [];
      f.componentInstance.solicitar.subscribe((p) => eventos.push(`solicitar:${p}`));
      f.componentInstance.closed.subscribe(() => eventos.push('closed'));
      (Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Hazte PRO') as HTMLButtonElement).click();
      (Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Ahora no') as HTMLButtonElement).click();
      expect(eventos).toEqual(['solicitar:pro', 'closed']);
    });
    it('función y demo terminada: sin medidor', async () => {
      const a = await conMotivo({ tipo: 'funcion', recurso: 'tesoreria' });
      expect((a.nativeElement as HTMLElement).querySelector('[data-testid="titular-bloqueo"]')?.textContent).toContain('Esta función está en el plan Pro');
      expect((a.nativeElement as HTMLElement).querySelector('app-cupo')).toBeNull();
      const b = await conMotivo({ tipo: 'demoTerminada', recurso: 'demo' });
      expect((b.nativeElement as HTMLElement).querySelector('[data-testid="titular-bloqueo"]')?.textContent).toContain('Tu despacho de ejemplo terminó');
    });
  });
});
