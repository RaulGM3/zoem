import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MejoraPlanService } from '../../../core/planes/mejora-plan.service';
import { PlanService } from '../../../core/planes/plan.service';
import { AvisoPruebaComponent, CLAVE_AVISO_PRUEBA } from './aviso-prueba';

describe('AvisoPruebaComponent', () => {
  const enPrueba = signal(true);
  const dias = signal(2);
  const ahora = signal(new Date(2026, 9, 9, 12));
  const abrir = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    enPrueba.set(true);
    dias.set(2);
    abrir.mockReset();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [AvisoPruebaComponent],
      providers: [
        { provide: PlanService, useValue: { enPrueba, diasPruebaRestantes: dias, ahora } },
        { provide: MejoraPlanService, useValue: { abrir } },
      ],
    });
  });

  function render() {
    const f = TestBed.createComponent(AvisoPruebaComponent);
    f.detectChanges();
    return f;
  }
  const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;

  it('anuncia los días que quedan', () => {
    const f = render();
    const aviso = el(f).querySelector('[role="status"]');
    expect(aviso?.textContent).toContain('2 días');
  });

  it('usa singular con 1 día', () => {
    dias.set(1);
    expect(el(render()).textContent).toContain('1 día');
    expect(el(render()).textContent).not.toContain('1 días');
  });

  it('no se muestra con más de 3 días ni fuera de la prueba', () => {
    dias.set(10);
    expect(el(render()).querySelector('[role="status"]')).toBeNull();
    dias.set(2);
    enPrueba.set(false);
    expect(el(render()).querySelector('[role="status"]')).toBeNull();
  });

  it('descartar lo oculta y lo recuerda solo por hoy', () => {
    const f = render();
    (el(f).querySelector('button[aria-label="Cerrar aviso"]') as HTMLButtonElement).click();
    f.detectChanges();
    expect(el(f).querySelector('[role="status"]')).toBeNull();
    expect(localStorage.getItem(CLAVE_AVISO_PRUEBA)).toBe('2026-10-09');

    // Al día siguiente vuelve a aparecer.
    ahora.set(new Date(2026, 9, 10, 9));
    expect(el(render()).querySelector('[role="status"]')).toBeTruthy();
    ahora.set(new Date(2026, 9, 9, 12));
    expect(el(render()).querySelector('[role="status"]')).toBeNull();
  });

  it('"Mejorar plan" abre el modal de mejora', () => {
    const f = render();
    (Array.from(el(f).querySelectorAll('button')).find((b) => b.textContent?.includes('Mejorar plan')) as HTMLButtonElement).click();
    expect(abrir).toHaveBeenCalled();
  });

  it('funciona aunque localStorage falle', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('bloqueado'); });
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('bloqueado'); });
    const f = render();
    expect(el(f).querySelector('[role="status"]')).toBeTruthy();
    (el(f).querySelector('button[aria-label="Cerrar aviso"]') as HTMLButtonElement).click();
    f.detectChanges();
    expect(el(f).querySelector('[role="status"]')).toBeNull();
    spy.mockRestore();
    set.mockRestore();
  });
});
