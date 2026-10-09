import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { CompanyService, type Company } from '../../../core/services/company.service';
import { AvisoDemoComponent } from './aviso-demo';

describe('AvisoDemoComponent', () => {
  function render(c: Partial<Company> | null) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [AvisoDemoComponent],
      providers: [{ provide: CompanyService, useValue: { activeCompany: signal(c) } }],
    });
    const f = TestBed.createComponent(AvisoDemoComponent);
    f.detectChanges();
    return f.nativeElement as HTMLElement;
  }

  it('avisa en el despacho de ejemplo', () => {
    const el = render({ id: 'd', name: 'Demo', esDemo: true });
    expect(el.querySelector('[role="status"]')?.textContent).toContain('En el despacho de ejemplo no se envía nada');
  });

  it('también con plan demo', () => {
    const el = render({ id: 'd', name: 'Demo', suscripcion: { plan: 'demo', complementos: [], estado: 'activa', origen: 'manual' } });
    expect(el.querySelector('[role="status"]')).toBeTruthy();
  });

  it('cuenta los días que le quedan al despacho de ejemplo (14 desde su creación)', () => {
    const fin = new Date(Date.now() + 2.5 * 86_400_000);
    const el = render({ id: 'd', name: 'Demo', esDemo: true, suscripcion: { plan: 'demo', complementos: [], estado: 'activa', origen: 'manual', periodoFin: fin } });
    expect(el.querySelector('[role="status"]')?.textContent).toMatch(/quedan 3 días/i);
  });

  it('una demo antigua sin fecha no habla de días', () => {
    const el = render({ id: 'd', name: 'Demo', esDemo: true });
    expect(el.querySelector('[role="status"]')?.textContent).not.toMatch(/quedan/i);
  });

  it('no aparece en un despacho normal', () => {
    expect(render({ id: 'a', name: 'A' }).querySelector('[role="status"]')).toBeNull();
    expect(render(null).querySelector('[role="status"]')).toBeNull();
  });
});
