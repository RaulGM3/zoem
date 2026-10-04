import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { DayScheduleComponent } from './day-schedule';
import { ToastService } from '../../../../core/services/toast.service';
import { MEMBERS, evento, grupos, hito, registro } from '../../testing/calendario-fixtures';
import type { CalendarItem } from '../../calendario.types';
import { analizarA11y, formatearViolaciones } from '../../../../../testing/axe';

function mockViewport(mobile: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (q: string) => ({
      matches: mobile && /max-width/.test(q),
      media: q,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  });
}

function setup(mobile: boolean, ...items: CalendarItem[]): ComponentFixture<DayScheduleComponent> {
  mockViewport(mobile);
  TestBed.configureTestingModule({
    imports: [DayScheduleComponent],
    providers: [{ provide: ToastService, useValue: { info: vi.fn() } }],
  });
  const fixture = TestBed.createComponent(DayScheduleComponent);
  fixture.componentRef.setInput('hasSelectedDates', true);
  fixture.componentRef.setInput('members', MEMBERS);
  fixture.componentRef.setInput('groupedEvents', grupos(...items));
  fixture.detectChanges();
  return fixture;
}

function pointerDown(target: HTMLElement, pointerType = 'mouse'): void {
  target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, clientY: 700, pointerType }));
}

describe('DayScheduleComponent — móvil', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    HTMLElement.prototype.setPointerCapture = vi.fn();
  });

  const bloque = (f: ComponentFixture<DayScheduleComponent>, label: string): HTMLElement =>
    Array.from((f.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('[data-agenda-block]'))
      .find(b => b.textContent?.includes(label))!;
  const detalle = (f: ComponentFixture<DayScheduleComponent>): HTMLElement | null =>
    (f.nativeElement as HTMLElement).querySelector('app-item-detalle-dialog');

  describe('drag and drop', () => {
    it('en móvil pointerdown sobre un evento no inicia drag', () => {
      const f = setup(true, evento());
      pointerDown(bloque(f, 'Reunión inicial'), 'touch');
      expect(f.componentInstance.dragging()).toBeNull();
    });

    it('en escritorio pointerdown con ratón inicia drag', () => {
      const f = setup(false, evento());
      pointerDown(bloque(f, 'Reunión inicial'));
      expect(f.componentInstance.dragging()).not.toBeNull();
    });

    it('en escritorio un puntero táctil tampoco arrastra (no rompe el scroll)', () => {
      const f = setup(false, evento());
      pointerDown(bloque(f, 'Reunión inicial'), 'touch');
      expect(f.componentInstance.dragging()).toBeNull();
    });

    it('en móvil pointerdown sobre un segmento de hito no inicia drag', () => {
      const f = setup(true, hito({ registrosHoras: [registro()] }));
      pointerDown(bloque(f, 'Presentar demanda'), 'touch');
      expect(f.componentInstance.draggingReg()).toBeNull();
    });

    it('en escritorio pointerdown sobre un segmento de hito inicia drag', () => {
      const f = setup(false, hito({ registrosHoras: [registro()] }));
      pointerDown(bloque(f, 'Presentar demanda'));
      expect(f.componentInstance.draggingReg()).not.toBeNull();
    });

    it('en móvil no se pintan los tiradores de resize; en escritorio sí', () => {
      const movil = setup(true, evento());
      expect((movil.nativeElement as HTMLElement).querySelector('.resize-handle')).toBeNull();
      TestBed.resetTestingModule();
      const escritorio = setup(false, evento());
      expect((escritorio.nativeElement as HTMLElement).querySelector('.resize-handle')).not.toBeNull();
    });
  });

  describe('tap abre el detalle', () => {
    it('un tap (click) sobre un evento abre el detalle en móvil', () => {
      const f = setup(true, evento());
      expect(detalle(f)).toBeNull();
      pointerDown(bloque(f, 'Reunión inicial'), 'touch');
      bloque(f, 'Reunión inicial').click();
      f.detectChanges();
      expect(detalle(f)).not.toBeNull();
    });

    it('un tap sobre un segmento de hito abre el detalle en móvil', () => {
      const f = setup(true, hito({ registrosHoras: [registro()] }));
      bloque(f, 'Presentar demanda').click();
      f.detectChanges();
      expect(detalle(f)).not.toBeNull();
    });

    it('en escritorio un click suelto no abre el detalle (lo abre el drag sin movimiento)', () => {
      const f = setup(false, evento());
      bloque(f, 'Reunión inicial').click();
      f.detectChanges();
      expect(detalle(f)).toBeNull();
    });

    it('en escritorio soltar sin mover abre el detalle (comportamiento intacto)', () => {
      const f = setup(false, evento());
      pointerDown(bloque(f, 'Reunión inicial'));
      f.componentInstance.onSchedulePointerUp(new PointerEvent('pointerup'));
      f.detectChanges();
      expect(detalle(f)).not.toBeNull();
    });
  });

  describe('contención y estilo', () => {
    it('el área de la agenda contiene el scroll horizontal', () => {
      const f = setup(true, evento());
      const area = (f.nativeElement as HTMLElement).querySelector<HTMLElement>('div.overflow-x-auto')!;
      expect(area.className).toContain('overflow-y-auto');
    });

    it('los botones de quitar del horario usan hover de Tailwind y son más grandes en móvil', () => {
      const f = setup(true, evento());
      const quitar = (f.nativeElement as HTMLElement).querySelector<HTMLElement>('[aria-label^="Quitar"]')!;
      expect(quitar.className).toContain('hover:');
      expect(quitar.className).toContain('max-sm:h-9');
    });

    it('los chips de "Sin programar" usan hover de Tailwind', () => {
      const f = setup(true, evento({ horaInicio: undefined }));
      const chip = (f.nativeElement as HTMLElement).querySelector<HTMLElement>('[aria-label^="Programar"]')!;
      expect(chip.className).toContain('hover:');
      expect(chip.className).toContain('tap-target');
    });
  });

  describe('accesibilidad', () => {
    it('sin violaciones axe con evento y hito en móvil', async () => {
      const f = setup(true, evento(), hito({ id: 'h9', registrosHoras: [registro({ horaInicio: '13:00', horaFin: '14:00' })] }));
      await f.whenStable();
      const violaciones = await analizarA11y(f.nativeElement as HTMLElement);
      expect(violaciones, `\n${formatearViolaciones(violaciones)}\n`).toEqual([]);
    });
  });
});
