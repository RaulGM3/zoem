import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DayScheduleComponent } from './day-schedule';
import { ToastService } from '../../../../core/services/toast.service';
import type { CalendarItem } from '../../calendario.types';
import { MEMBERS, evento, grupos, hito, registro } from '../../testing/calendario-fixtures';

/**
 * Integración del grid con el detalle del item. El comportamiento fino del
 * modal y del editor de horas vive en los specs de esos componentes; aquí se
 * comprueba que se abre/cierra, que recibe el item fresco y que cada output
 * llega hasta el consumidor de `app-day-schedule`.
 */
describe('DayScheduleComponent — detalle del item', () => {
  let fixture: ComponentFixture<DayScheduleComponent>;
  let component: DayScheduleComponent;
  let toastInfo: ReturnType<typeof vi.fn>;

  const el = (): HTMLElement => fixture.nativeElement;
  const dialogo = (): HTMLElement | null =>
    Array.from(el().querySelectorAll<HTMLElement>('[role="dialog"]'))
      .find(d => d.querySelector('h2')?.textContent?.trim().startsWith('Detalle de')) ?? null;
  const boton = (texto: string): HTMLButtonElement | undefined =>
    Array.from(el().querySelectorAll('button')).find(b => b.textContent?.trim() === texto);
  const porLabel = <T extends HTMLElement>(label: string): T[] =>
    Array.from(el().querySelectorAll<T>(`[aria-label="${label}"]`));

  function render(items: CalendarItem[]): void {
    fixture.componentRef.setInput('groupedEvents', grupos(...items));
    fixture.detectChanges();
  }

  function abrir(item: CalendarItem): void {
    render([item]);
    component.openItem(item);
    fixture.detectChanges();
  }

  function cambiar(control: HTMLInputElement | HTMLSelectElement, valor: string): void {
    control.value = valor;
    control.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  function click(target: HTMLElement | undefined | null): void {
    expect(target).toBeTruthy();
    target!.click();
    fixture.detectChanges();
  }

  function escribirAnotacion(texto: string): void {
    const input = el().querySelector<HTMLInputElement>('input[aria-label="Añadir anotación"]')!;
    input.value = texto;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  beforeEach(async () => {
    toastInfo = vi.fn();
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [DayScheduleComponent],
      providers: [{ provide: ToastService, useValue: { info: toastInfo } }],
    }).compileComponents();

    fixture = TestBed.createComponent(DayScheduleComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('hasSelectedDates', true);
    fixture.componentRef.setInput('members', MEMBERS);
  });

  describe('apertura y cierre', () => {
    it('no muestra el diálogo hasta que se abre un item', () => {
      render([evento()]);
      expect(dialogo()).toBeNull();
    });

    it('muestra el detalle del item abierto', () => {
      abrir(evento());
      expect(dialogo()!.querySelector('h2')!.textContent).toContain('Detalle de Reunión inicial');
      expect(dialogo()!.textContent).toContain('10:00 – 11:00');
    });

    it('se abre con Enter sobre el bloque del grid', () => {
      render([evento()]);
      const bloque = el().querySelector<HTMLElement>('[role="button"][aria-label^="Reunión inicial"]')!;
      bloque.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      fixture.detectChanges();
      expect(dialogo()).not.toBeNull();
    });

    it('se cierra con el botón Cerrar', () => {
      abrir(evento());
      click(porLabel<HTMLButtonElement>('Cerrar')[0]);
      expect(dialogo()).toBeNull();
    });

    it('se cierra al pulsar el fondo y con Escape', () => {
      abrir(evento());
      click(el().querySelector<HTMLElement>('[data-overlay-backdrop]'));
      expect(dialogo()).toBeNull();

      component.openItem(evento());
      fixture.detectChanges();
      dialogo()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      fixture.detectChanges();
      expect(dialogo()).toBeNull();
    });

    it('refleja los cambios del item que llegan mientras está abierto', () => {
      abrir(evento());
      render([evento({ title: 'Reunión movida' })]);
      expect(dialogo()!.querySelector('h2')!.textContent).toContain('Reunión movida');
    });

    it('se cierra si el item desaparece de la agenda', () => {
      abrir(evento());
      render([]);
      expect(dialogo()).toBeNull();
    });

    it('descarta el borrador de anotación al cerrar y reabrir', () => {
      const item = evento();
      abrir(item);
      escribirAnotacion('Borrador');
      click(porLabel<HTMLButtonElement>('Cerrar')[0]);
      component.openItem(item);
      fixture.detectChanges();
      expect(el().querySelector<HTMLInputElement>('input[aria-label="Añadir anotación"]')!.value).toBe('');
    });

    it('descarta la copia de trabajo de horas al cerrar y reabrir', () => {
      const item = hito({ registrosHoras: [registro()] });
      abrir(item);
      click(boton('Editar horas'));
      click(porLabel<HTMLButtonElement>('Cerrar')[0]);
      component.openItem(item);
      fixture.detectChanges();
      expect(boton('Guardar horas')).toBeUndefined();
      expect(boton('Editar horas')).toBeTruthy();
    });
  });

  describe('reenvío de outputs', () => {
    it('hitoStatusChanged', () => {
      const spy = vi.fn();
      component.hitoStatusChanged.subscribe(e => spy(e));
      abrir(hito());
      click(boton('Completado'));
      expect(spy).toHaveBeenCalledWith({ id: 'h1', casoId: 'c1', estado: 'completado' });
    });

    it('eventoStatusChanged', () => {
      const spy = vi.fn();
      component.eventoStatusChanged.subscribe(e => spy(e));
      abrir(evento());
      click(boton('Completado'));
      expect(spy).toHaveBeenCalledWith({ id: 'ev1', estado: 'completado' });
    });

    it('annotationAdded', () => {
      const spy = vi.fn();
      component.annotationAdded.subscribe(e => spy(e));
      abrir(hito());
      escribirAnotacion('Llamar al procurador');
      click(el().querySelector<HTMLButtonElement>('button[aria-label="Añadir anotación"]'));
      expect(spy).toHaveBeenCalledWith({ itemId: 'h1', casoId: 'c1', texto: 'Llamar al procurador' });
    });

    it('annotationDeleted', () => {
      const spy = vi.fn();
      component.annotationDeleted.subscribe(e => spy(e));
      abrir(hito({ anotaciones: [{ id: 'a1', texto: 'Primera nota', creadaEn: '2026-03-01T10:00:00.000Z' }] }));
      click(porLabel<HTMLButtonElement>('Eliminar anotación: Primera nota')[0]);
      expect(spy).toHaveBeenCalledWith({ itemId: 'h1', casoId: 'c1', anotacionId: 'a1' });
    });

    it('itemColorChanged', () => {
      const spy = vi.fn();
      component.itemColorChanged.subscribe(e => spy(e));
      abrir(evento());
      click(porLabel<HTMLButtonElement>('Color green')[0]);
      expect(spy).toHaveBeenCalledWith({ id: 'ev1', color: 'green' });
    });

    it('eventoDeleted, y cierra el detalle', () => {
      const spy = vi.fn();
      component.eventoDeleted.subscribe(e => spy(e));
      abrir(evento());
      click(porLabel<HTMLButtonElement>('Eliminar evento')[0]);
      click(boton('Eliminar'));
      expect(spy).toHaveBeenCalledWith({ id: 'ev1' });
      expect(el().querySelector('[role="dialog"]')).toBeNull();
    });

    it('registrosChanged', () => {
      const spy = vi.fn();
      component.registrosChanged.subscribe(e => spy(e));
      abrir(hito({ registrosHoras: [registro()] }));
      click(boton('Editar horas'));
      cambiar(porLabel<HTMLInputElement>('Hora fin')[0], '11:30');
      click(boton('Guardar horas'));
      expect(spy).toHaveBeenCalledWith({
        hitoId: 'h1', casoId: 'c1', registros: [registro({ horaFin: '11:30', minutos: 150 })],
      });
    });
  });

  describe('edición concurrente de horas', () => {
    it('fusiona contra el hito más reciente que llega por groupedEvents', () => {
      const spy = vi.fn();
      component.registrosChanged.subscribe(e => spy(e));
      abrir(hito({ registrosHoras: [registro()] }));
      click(boton('Editar horas'));
      cambiar(porLabel<HTMLInputElement>('Hora fin')[0], '11:00');
      const remoto = registro({ horaFin: '12:00', minutos: 180 });
      const ajeno = registro({ id: 'r9', userId: 'u2', horaInicio: '15:00', horaFin: '16:00' });
      render([hito({ registrosHoras: [remoto, ajeno] })]);
      click(boton('Guardar horas'));
      expect(spy).toHaveBeenCalledWith({ hitoId: 'h1', casoId: 'c1', registros: [remoto, ajeno] });
      expect(toastInfo).toHaveBeenCalledTimes(1);
      expect(toastInfo.mock.calls[0][1]).toBe('Edición concurrente detectada');
    });
  });
});
