import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CompanyService } from '../../../core/services/company.service';
import { MejoraPlanService } from '../../../core/planes/mejora-plan.service';
import { DemoTerminadaComponent } from './demo-terminada';

describe('DemoTerminadaComponent', () => {
  const abrir = vi.fn();
  const cambiarEmpresa = vi.fn();
  const myMemberships = signal<{ companyId: string; company?: Record<string, unknown> }[]>([]);
  const activeCompany = signal({ id: 'demo1', esDemo: true });

  function montar() {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [DemoTerminadaComponent],
      providers: [
        { provide: CompanyService, useValue: { myMemberships, activeCompany, cambiarEmpresa } },
        { provide: MejoraPlanService, useValue: { abrir } },
      ],
    });
    const f = TestBed.createComponent(DemoTerminadaComponent);
    f.detectChanges();
    return f;
  }
  const botones = (f: ReturnType<typeof montar>) => Array.from((f.nativeElement as HTMLElement).querySelectorAll('button'));

  beforeEach(() => {
    abrir.mockClear();
    cambiarEmpresa.mockClear();
    myMemberships.set([{ companyId: 'demo1', company: { esDemo: true } }]);
  });

  it('explica que terminó, que los datos se conservan y no se pueden cambiar', () => {
    const f = montar();
    const t = (f.nativeElement as HTMLElement).textContent!;
    expect(t).toMatch(/despacho de ejemplo terminó/i);
    expect(t).toMatch(/se conservan/i);
    expect((f.nativeElement as HTMLElement).querySelector('h1')).not.toBeNull();
  });

  it('"Ver planes" abre el modal de mejora', () => {
    const f = montar();
    botones(f).find((b) => /ver planes/i.test(b.textContent!))!.click();
    expect(abrir).toHaveBeenCalledTimes(1);
  });

  it('sin despacho real no ofrece cambiar de despacho', () => {
    const f = montar();
    expect(botones(f).some((b) => /mi despacho/i.test(b.textContent!))).toBe(false);
  });

  it('con un despacho real ofrece ir a él', () => {
    myMemberships.set([{ companyId: 'demo1', company: { esDemo: true } }, { companyId: 'real1', company: { name: 'García' } }]);
    const f = montar();
    const b = botones(f).find((x) => /garcía/i.test(x.textContent!))!;
    b.click();
    expect(cambiarEmpresa).toHaveBeenCalledWith('real1');
  });
});
