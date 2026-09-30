import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CasoCostosPrevistosComponent } from './caso-costos-previstos';
import type { GestoriaSlot } from '../../../../interfaces';

const SLOTS = [
  { id: 's1', nombre: 'Tasa judicial', tipoCosto: 'suplido', importeEstimado: 50, status: 'pendiente' },
  { id: 's2', nombre: 'Procurador', tipoCosto: 'gastos', status: 'pendiente' },
  { id: 's3', nombre: 'Notaría', tipoCosto: 'suplido', importeEstimado: 100, importeReal: 120.5, status: 'registrado' },
] as unknown as GestoriaSlot[];

describe('CasoCostosPrevistosComponent', () => {
  let fixture: ComponentFixture<CasoCostosPrevistosComponent>;
  let component: CasoCostosPrevistosComponent;

  const el = (): HTMLElement => fixture.nativeElement;
  const q = <T extends HTMLElement>(selector: string, raiz: HTMLElement = el()): T => {
    const found = raiz.querySelector<T>(selector);
    expect(found, selector).toBeTruthy();
    return found!;
  };
  const qa = <T extends HTMLElement>(selector: string, raiz: HTMLElement = el()): T[] =>
    Array.from(raiz.querySelectorAll<T>(selector));
  const texto = (e: Element): string => e.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const boton = (etiqueta: string, raiz: HTMLElement = el()): HTMLButtonElement | undefined =>
    qa<HTMLButtonElement>('button', raiz).find(b => texto(b) === etiqueta);

  function set(inputs: Record<string, unknown>): void {
    for (const [nombre, valor] of Object.entries(inputs)) fixture.componentRef.setInput(nombre, valor);
    fixture.detectChanges();
  }

  function click(target: HTMLElement | undefined | null): void {
    expect(target).toBeTruthy();
    target!.click();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [CasoCostosPrevistosComponent] }).compileComponents();
    fixture = TestBed.createComponent(CasoCostosPrevistosComponent);
    component = fixture.componentInstance;
    set({ slots: SLOTS });
  });

  const tarjeta = (): HTMLElement | null =>
    qa('h3').find(h => texto(h) === 'Costos previstos por plantilla')?.closest<HTMLElement>('.rounded-xl') ?? null;
  const filas = (): HTMLElement[] => qa('[draggable="true"]', tarjeta()!);
  const nombres = (): string[] => filas().map(f => texto(q('p', f)));
  const fila = (nombre: string): HTMLElement => filas().find(f => texto(q('p', f)) === nombre)!;

  it('muestra el progreso y oculta los registrados hasta que se piden', () => {
    expect(tarjeta()!.textContent).toContain('1 de 3 registrados');
    expect(nombres()).toEqual(['Tasa judicial', 'Procurador']);
    click(boton('Ver 1 registrado', tarjeta()!));
    expect(nombres()).toEqual(['Tasa judicial', 'Procurador', 'Notaría']);
    click(boton('Ocultar registrados', tarjeta()!));
    expect(nombres()).toHaveLength(2);
  });

  it('pluraliza el botón y lo omite si no hay registrados', () => {
    set({ slots: SLOTS.map(s => ({ ...s, status: 'registrado' })) });
    expect(boton('Ver 3 registrados', tarjeta()!)).toBeTruthy();
    set({ slots: SLOTS.map(s => ({ ...s, status: 'pendiente' })) });
    expect(qa('button', tarjeta()!).some(b => texto(b).startsWith('Ver '))).toBe(false);
  });

  it('un costo pendiente muestra su estimación y se puede registrar', () => {
    const emitidos: GestoriaSlot[] = [];
    component.registerSlot.subscribe(s => emitidos.push(s));
    expect(texto(fila('Tasa judicial'))).toContain('Suplido');
    expect(texto(fila('Tasa judicial'))).toContain('est. 50.00 €');
    expect(texto(fila('Procurador'))).not.toContain('€');
    click(boton('Registrar', fila('Tasa judicial')));
    expect(emitidos).toEqual([SLOTS[0]]);
  });

  it('un costo registrado muestra estimado y real, y su movimiento se elimina tras confirmar', () => {
    const emitidos: GestoriaSlot[] = [];
    component.unregisterSlot.subscribe(s => emitidos.push(s));
    click(boton('Ver 1 registrado', tarjeta()!));
    expect(texto(fila('Notaría'))).toContain('100.00 €');
    expect(texto(fila('Notaría'))).not.toContain('est.');
    expect(texto(fila('Notaría'))).toContain('120.50 €');
    click(q('[aria-label="Eliminar movimiento registrado"]', fila('Notaría')));
    expect(texto(fila('Notaría'))).toContain('¿Eliminar el movimiento?');
    click(q('[aria-label="Cancelar"]', fila('Notaría')));
    expect(emitidos).toHaveLength(0);
    click(q('[aria-label="Eliminar movimiento registrado"]', fila('Notaría')));
    click(q('[aria-label="Confirmar eliminación del movimiento"]', fila('Notaría')));
    expect(emitidos).toEqual([SLOTS[2]]);
    expect(fila('Notaría').querySelector('[aria-label="Confirmar eliminación del movimiento"]')).toBeNull();
  });

  it('respeta los permisos de edición y borrado', () => {
    set({ canEdit: false, canDelete: false });
    click(boton('Ver 1 registrado', tarjeta()!));
    expect(boton('Registrar', tarjeta()!)).toBeUndefined();
    expect(tarjeta()!.querySelector('[aria-label="Eliminar movimiento registrado"]')).toBeNull();
  });

  it('reordena arrastrando y avisa del nuevo orden', () => {
    const emitidos: GestoriaSlot[][] = [];
    component.reorderSlots.subscribe(s => emitidos.push(s));
    filas()[0].dispatchEvent(new Event('dragstart'));
    filas()[1].dispatchEvent(new Event('dragover', { cancelable: true }));
    fixture.detectChanges();
    expect(filas()[0].style.opacity).toBe('0.5');
    filas()[1].dispatchEvent(new Event('drop', { cancelable: true }));
    fixture.detectChanges();
    expect(nombres()).toEqual(['Procurador', 'Tasa judicial']);
    expect(emitidos).toEqual([[SLOTS[1], SLOTS[0], SLOTS[2]]]);
    expect(filas()[1].style.opacity).toBe('1');
  });

  it('soltar en el mismo sitio o cancelar el arrastre no reordena', () => {
    const emitidos: GestoriaSlot[][] = [];
    component.reorderSlots.subscribe(s => emitidos.push(s));
    filas()[0].dispatchEvent(new Event('dragstart'));
    filas()[0].dispatchEvent(new Event('dragover', { cancelable: true }));
    filas()[0].dispatchEvent(new Event('drop', { cancelable: true }));
    filas()[1].dispatchEvent(new Event('dragstart'));
    filas()[1].dispatchEvent(new Event('dragend'));
    fixture.detectChanges();
    expect(emitidos).toHaveLength(0);
    expect(filas()[1].style.opacity).toBe('1');
  });

  it('se resincroniza con el orden que llega del padre', () => {
    set({ slots: [SLOTS[1], SLOTS[0]] });
    expect(nombres()).toEqual(['Procurador', 'Tasa judicial']);
  });
});
