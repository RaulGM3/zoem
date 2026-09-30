import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ItemDetalleDialogComponent } from './item-detalle-dialog';
import { ToastService } from '../../../../core/services/toast.service';
import type { CalendarItem } from '../../calendario.types';
import { MEMBERS, evento, hito, registro } from '../../testing/calendario-fixtures';

describe('ItemDetalleDialogComponent', () => {
  let fixture: ComponentFixture<ItemDetalleDialogComponent>;
  let component: ItemDetalleDialogComponent;
  let cerrado: ReturnType<typeof vi.fn<() => void>>;

  const el = (): HTMLElement => fixture.nativeElement;
  const dialogo = (): HTMLElement => el().querySelector('[role="dialog"][aria-label^="Detalle de"]')!;
  const confirmacion = (): HTMLElement | null =>
    el().querySelector('[role="dialog"][aria-label="Confirmar eliminación de evento"]');
  const boton = (texto: string, raiz: HTMLElement = el()): HTMLButtonElement | undefined =>
    Array.from(raiz.querySelectorAll('button')).find(b => b.textContent?.trim() === texto);
  const porLabel = <T extends HTMLElement>(label: string): T[] =>
    Array.from(el().querySelectorAll<T>(`[aria-label="${label}"]`));

  function render(item: CalendarItem): void {
    fixture.componentRef.setInput('item', item);
    fixture.detectChanges();
  }

  function click(target: HTMLElement | undefined | null): void {
    expect(target).toBeTruthy();
    target!.click();
    fixture.detectChanges();
  }

  function escribirAnotacion(texto: string): HTMLInputElement {
    const input = el().querySelector<HTMLInputElement>('input[aria-label="Añadir anotación"]')!;
    input.value = texto;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    return input;
  }

  beforeEach(async () => {
    cerrado = vi.fn<() => void>();
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [ItemDetalleDialogComponent],
      providers: [{ provide: ToastService, useValue: { info: vi.fn() } }],
    }).compileComponents();

    fixture = TestBed.createComponent(ItemDetalleDialogComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('members', MEMBERS);
    component.closed.subscribe(() => cerrado());
  });

  describe('cabecera', () => {
    it('muestra título, horario, tipo y cliente', () => {
      render(evento());
      const texto = dialogo().textContent ?? '';
      expect(dialogo().getAttribute('aria-label')).toBe('Detalle de Reunión inicial');
      expect(dialogo().getAttribute('aria-modal')).toBe('true');
      expect(texto).toContain('Reunión inicial');
      expect(texto).toContain('10:00 – 11:00');
      expect(texto).toContain('Reunión');
      expect(texto).toContain('Acme');
    });

    it('etiqueta los hitos como "Hito"', () => {
      render(hito());
      expect(dialogo().querySelector('h2')!.nextElementSibling!.textContent).toContain('Hito');
    });

    it('pinta el punto con el color efectivo del item', () => {
      render(evento({ color: 'red' }));
      expect(dialogo().querySelector('.rounded-full')!.className).toContain('bg-red-500');
      render(evento({ color: undefined }));
      expect(dialogo().querySelector('.rounded-full')!.className).toContain('bg-violet-500');
    });
  });

  describe('cierre', () => {
    it('emite closed con el botón Cerrar', () => {
      render(evento());
      click(porLabel<HTMLButtonElement>('Cerrar')[0]);
      expect(cerrado).toHaveBeenCalledTimes(1);
    });

    it('emite closed al pulsar el fondo pero no al pulsar dentro', () => {
      render(evento());
      click(dialogo().querySelector('h2'));
      expect(cerrado).not.toHaveBeenCalled();
      click(dialogo());
      expect(cerrado).toHaveBeenCalledTimes(1);
    });

    it('emite closed con Escape', () => {
      render(evento());
      dialogo().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(cerrado).toHaveBeenCalledTimes(1);
    });
  });

  describe('estado', () => {
    it('emite hitoStatusChanged al elegir un estado de hito', () => {
      const spy = vi.fn();
      component.hitoStatusChanged.subscribe(e => spy(e));
      render(hito());
      click(boton('Completado'));
      expect(spy).toHaveBeenCalledWith({ id: 'h1', casoId: 'c1', estado: 'completado' });
    });

    it('no emite hitoStatusChanged si el hito no tiene caso', () => {
      const spy = vi.fn();
      component.hitoStatusChanged.subscribe(e => spy(e));
      render(hito({ casoId: undefined }));
      click(boton('Completado'));
      expect(spy).not.toHaveBeenCalled();
    });

    it('emite eventoStatusChanged al elegir un estado de evento', () => {
      const spy = vi.fn();
      component.eventoStatusChanged.subscribe(e => spy(e));
      render(evento());
      click(boton('Completado'));
      expect(spy).toHaveBeenCalledWith({ id: 'ev1', estado: 'completado' });
    });

    it('resalta el estado activo', () => {
      render(evento({ eventoEstado: 'completado' }));
      expect(boton('Completado')!.className).toContain('ring-2');
      expect(boton('Cancelado')!.className).not.toContain('ring-2');
    });
  });

  describe('horas trabajadas', () => {
    it('solo los hitos tienen sección de horas', () => {
      render(evento());
      expect(el().querySelector('app-horas-editor')).toBeNull();
      render(hito());
      expect(el().querySelector('app-horas-editor')).not.toBeNull();
    });

    it('reenvía registrosChanged del editor de horas', () => {
      const spy = vi.fn();
      component.registrosChanged.subscribe(e => spy(e));
      render(hito({ registrosHoras: [registro()] }));
      click(boton('Editar horas'));
      click(boton('Guardar horas'));
      expect(spy).toHaveBeenCalledWith({ hitoId: 'h1', casoId: 'c1', registros: [registro()] });
    });
  });

  describe('anotaciones', () => {
    it('el botón de añadir está deshabilitado con el campo vacío o en blanco', () => {
      render(evento());
      const btn = el().querySelector<HTMLButtonElement>('button[aria-label="Añadir anotación"]')!;
      expect(btn.disabled).toBe(true);
      escribirAnotacion('   ');
      expect(btn.disabled).toBe(true);
    });

    it('emite annotationAdded con el texto recortado y limpia el campo', () => {
      const spy = vi.fn();
      component.annotationAdded.subscribe(e => spy(e));
      render(hito());
      const input = escribirAnotacion('  Llamar al procurador  ');
      click(el().querySelector<HTMLButtonElement>('button[aria-label="Añadir anotación"]'));
      expect(spy).toHaveBeenCalledWith({ itemId: 'h1', casoId: 'c1', texto: 'Llamar al procurador' });
      expect(input.value).toBe('');
    });

    it('añade la anotación con Enter pero no con Shift+Enter', () => {
      const spy = vi.fn();
      component.annotationAdded.subscribe(e => spy(e));
      render(evento());
      const input = escribirAnotacion('Nota');
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true }));
      expect(spy).not.toHaveBeenCalled();
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      expect(spy).toHaveBeenCalledWith({ itemId: 'ev1', casoId: undefined, texto: 'Nota' });
    });

    it('lista las anotaciones con su contador y fecha, y emite annotationDeleted', () => {
      const spy = vi.fn();
      component.annotationDeleted.subscribe(e => spy(e));
      render(hito({ anotaciones: [{ id: 'a1', texto: 'Primera nota', creadaEn: new Date().toISOString() }] }));
      const texto = dialogo().textContent ?? '';
      expect(texto).toContain('Primera nota');
      expect(texto).toContain('Hoy');
      expect(texto).not.toContain('Sin anotaciones todavía');
      click(porLabel<HTMLButtonElement>('Eliminar anotación: Primera nota')[0]);
      expect(spy).toHaveBeenCalledWith({ itemId: 'h1', casoId: 'c1', anotacionId: 'a1' });
    });

    it('muestra el estado vacío cuando no hay anotaciones', () => {
      render(evento());
      expect(dialogo().textContent).toContain('Sin anotaciones todavía');
    });
  });

  describe('color', () => {
    it('emite itemColorChanged con el color elegido', () => {
      const spy = vi.fn();
      component.itemColorChanged.subscribe(e => spy(e));
      render(evento());
      click(porLabel<HTMLButtonElement>('Color green')[0]);
      expect(spy).toHaveBeenCalledWith({ id: 'ev1', color: 'green' });
    });

    it('emite color null al volver al color automático', () => {
      const spy = vi.fn();
      component.itemColorChanged.subscribe(e => spy(e));
      render(evento({ color: 'red' }));
      click(porLabel<HTMLButtonElement>('Color automático según tipo')[0]);
      expect(spy).toHaveBeenCalledWith({ id: 'ev1', color: null });
    });

    it('marca como activo el color del item, o el automático si no tiene', () => {
      render(evento({ color: 'red' }));
      expect(porLabel('Color red')[0].className).toContain('ring-2');
      expect(porLabel('Color green')[0].className).not.toContain('ring-2');
      expect(porLabel('Color automático según tipo')[0].className).not.toContain('ring-2');
      render(evento({ color: undefined }));
      expect(porLabel('Color automático según tipo')[0].className).toContain('ring-2');
    });
  });

  describe('eliminar evento', () => {
    let borrado: ReturnType<typeof vi.fn<(e: { id: string }) => void>>;

    beforeEach(() => {
      borrado = vi.fn<(e: { id: string }) => void>();
      component.eventoDeleted.subscribe(e => borrado(e));
    });

    it('los hitos no ofrecen eliminar', () => {
      render(hito());
      expect(porLabel('Eliminar evento')).toHaveLength(0);
    });

    it('pide confirmación antes de eliminar', () => {
      render(evento());
      expect(confirmacion()).toBeNull();
      click(porLabel<HTMLButtonElement>('Eliminar evento')[0]);
      expect(confirmacion()).not.toBeNull();
      expect(borrado).not.toHaveBeenCalled();
    });

    it('al cancelar cierra solo la confirmación', () => {
      render(evento());
      click(porLabel<HTMLButtonElement>('Eliminar evento')[0]);
      click(boton('Cancelar', confirmacion()!));
      expect(confirmacion()).toBeNull();
      expect(borrado).not.toHaveBeenCalled();
      expect(cerrado).not.toHaveBeenCalled();
    });

    it('al confirmar emite eventoDeleted y closed', () => {
      render(evento());
      click(porLabel<HTMLButtonElement>('Eliminar evento')[0]);
      click(boton('Eliminar', confirmacion()!));
      expect(borrado).toHaveBeenCalledWith({ id: 'ev1' });
      expect(cerrado).toHaveBeenCalledTimes(1);
    });
  });
});
