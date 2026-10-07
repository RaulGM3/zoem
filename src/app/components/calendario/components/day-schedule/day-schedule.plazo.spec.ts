import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DayScheduleComponent } from './day-schedule';
import { ToastService } from '../../../../core/services/toast.service';
import { grupos, plazo } from '../../testing/calendario-fixtures';

describe('DayScheduleComponent — plazo procesal', () => {
  let fixture: ComponentFixture<DayScheduleComponent>;

  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [DayScheduleComponent],
      providers: [{ provide: ToastService, useValue: { info: vi.fn() } }, provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(DayScheduleComponent);
    fixture.componentRef.setInput('hasSelectedDates', true);
    fixture.componentRef.setInput('members', []);
    fixture.componentRef.setInput('groupedEvents', grupos(plazo({ plazo: { requiereRevision: true } })));
    fixture.detectChanges();
  });

  it('un plazo sin hora aparece como chip con Gavel y aviso de revisión', () => {
    const chip = (fixture.nativeElement as HTMLElement).querySelector('[data-plazo-chip]')!;
    expect(chip).not.toBeNull();
    expect(chip.getAttribute('aria-label')).toContain('Plazo');
    expect(chip.textContent).toContain('Requiere revisión');
  });

  it('pulsar el chip de un plazo abre su detalle y NO lo programa en el horario', () => {
    const emitidos = vi.fn();
    fixture.componentInstance.itemTimeChanged.subscribe(emitidos);
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('[data-plazo-chip]')!.click();
    fixture.detectChanges();
    expect(emitidos).not.toHaveBeenCalled();
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-plazo]')?.textContent).toContain('Plazo procesal');
  });

  describe('plazo con hora en el grid (bloqueado)', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('groupedEvents', grupos(plazo({ horaInicio: '10:00', duracionMinutos: 60 })));
      fixture.detectChanges();
    });

    it('no ofrece handle de resize ni botón para quitarlo del horario', () => {
      const el = fixture.nativeElement as HTMLElement;
      expect(el.querySelector('[data-agenda-block]')).not.toBeNull();
      expect(el.querySelector('.resize-handle')).toBeNull();
      expect(el.querySelector('button[aria-label^="Quitar"]')).toBeNull();
    });

    it('un pointerdown sobre el bloque no inicia drag', () => {
      const bloque = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('[data-agenda-block]')!;
      bloque.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse', clientY: 100 }));
      expect(fixture.componentInstance.dragging()).toBeNull();
    });

    it('scheduleItem, unscheduleItem y resize por teclado no emiten cambios', () => {
      const emitidos = vi.fn();
      fixture.componentInstance.itemTimeChanged.subscribe(emitidos);
      const p = plazo({ horaInicio: '10:00', duracionMinutos: 60 });
      fixture.componentInstance.scheduleItem(p);
      fixture.componentInstance.unscheduleItem(new MouseEvent('click'), p);
      fixture.componentInstance.onResizeKeydown(new KeyboardEvent('keydown', { key: 'ArrowDown' }), p);
      expect(emitidos).not.toHaveBeenCalled();
    });
  });
});
