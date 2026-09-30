import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PlantillaCostosTabComponent } from './plantilla-costos-tab';
import type { PartidaCosto } from '../../../../interfaces';

function suplidos(): PartidaCosto[] {
  return [
    { nombre: 'Tasa judicial', tipo: 'suplido', importeEstimado: 50 },
    { nombre: 'Procurador', tipo: 'gastos_repercutibles' },
  ];
}

describe('PlantillaCostosTabComponent', () => {
  let fixture: ComponentFixture<PlantillaCostosTabComponent>;
  let component: PlantillaCostosTabComponent;

  const el = (): HTMLElement => fixture.nativeElement;
  const q = <T extends HTMLElement>(selector: string): T => el().querySelector<T>(selector)!;
  const filas = (): HTMLElement[] => Array.from(el().querySelectorAll<HTMLElement>('li[draggable="true"]'));
  const boton = (texto: string, raiz: HTMLElement = el()): HTMLButtonElement | undefined =>
    Array.from(raiz.querySelectorAll('button')).find(b => b.textContent?.trim() === texto);
  const dialogo = (): HTMLElement | null => el().querySelector('[role="dialog"]');
  const nombres = (): string[] => component.suplidos().map(s => s.nombre);

  function escribir(selector: string, valor: string, evento: 'input' | 'change' = 'input'): void {
    const control = q<HTMLInputElement>(selector);
    control.value = valor;
    control.dispatchEvent(new Event(evento));
    fixture.detectChanges();
  }

  function click(target: HTMLElement | undefined | null): void {
    expect(target).toBeTruthy();
    target!.click();
    fixture.detectChanges();
  }

  function crear(lista: PartidaCosto[] = suplidos(), honorarios = '1500'): void {
    fixture = TestBed.createComponent(PlantillaCostosTabComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('honorarios', honorarios);
    fixture.componentRef.setInput('suplidos', lista);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [PlantillaCostosTabComponent] }).compileComponents();
  });

  it('muestra los honorarios y las partidas con su tipo e importe', () => {
    crear();
    expect(q<HTMLInputElement>('#pd-honorarios').value).toBe('1500');
    expect(filas()[0].textContent).toContain('Tasa judicial');
    expect(filas()[0].textContent).toContain('Suplido');
    expect(filas()[0].textContent).toContain('50 €');
    expect(filas()[1].textContent).toContain('Gastos repercutibles');
    expect(filas()[1].textContent).not.toContain('€');
  });

  it('no pinta la lista si no hay partidas', () => {
    crear([]);
    expect(el().querySelector('ul')).toBeNull();
  });

  it('actualiza el modelo de honorarios al escribir', () => {
    crear();
    escribir('#pd-honorarios', '2000.5');
    expect(component.honorarios()).toBe('2000.5');
  });

  it('añade una partida sin importe cuando no se indica', () => {
    crear();
    escribir('#s-nombre', '  Peritaje  ');
    escribir('#s-tipo', 'costas_judiciales', 'change');
    click(boton('+ Añadir partida'));
    expect(component.suplidos()[2]).toEqual({ nombre: 'Peritaje', tipo: 'costas_judiciales' });
    expect(q<HTMLInputElement>('#s-nombre').value).toBe('');
    expect(q<HTMLSelectElement>('#s-tipo').value).toBe('');
  });

  it('añade una partida con su importe estimado', () => {
    crear();
    escribir('#s-nombre', 'Peritaje');
    escribir('#s-tipo', 'costas_judiciales', 'change');
    escribir('#s-importe', '120.5');
    click(boton('+ Añadir partida'));
    expect(component.suplidos()[2]).toEqual({ nombre: 'Peritaje', tipo: 'costas_judiciales', importeEstimado: 120.5 });
  });

  it('no añade partidas sin nombre o sin tipo', () => {
    crear();
    expect(boton('+ Añadir partida')!.disabled).toBe(true);
    escribir('#s-nombre', 'Peritaje');
    expect(boton('+ Añadir partida')!.disabled).toBe(true);
  });

  it('elimina una partida', () => {
    crear();
    click(filas()[0].querySelector<HTMLButtonElement>('[aria-label="Eliminar partida"]'));
    expect(nombres()).toEqual(['Procurador']);
  });

  it('reordena arrastrando y resalta el destino', () => {
    crear();
    filas()[1].dispatchEvent(new Event('dragstart'));
    filas()[0].dispatchEvent(new Event('dragover', { cancelable: true }));
    fixture.detectChanges();
    expect(filas()[1].className).toContain('opacity-40');
    expect(filas()[0].className).toContain('bg-violet-50');
    filas()[0].dispatchEvent(new Event('drop', { cancelable: true }));
    fixture.detectChanges();
    expect(nombres()).toEqual(['Procurador', 'Tasa judicial']);
  });

  it('terminar el arrastre sin soltar no cambia nada', () => {
    crear();
    filas()[1].dispatchEvent(new Event('dragstart'));
    filas()[1].dispatchEvent(new Event('dragend'));
    fixture.detectChanges();
    expect(nombres()).toEqual(['Tasa judicial', 'Procurador']);
    expect(filas()[1].className).not.toContain('opacity-40');
  });

  it('edita una partida desde el modal', () => {
    crear();
    click(filas()[0].querySelector<HTMLButtonElement>('[aria-label="Editar partida"]'));
    expect(q<HTMLInputElement>('#es-nombre').value).toBe('Tasa judicial');
    expect(q<HTMLSelectElement>('#es-tipo').value).toBe('suplido');
    expect(q<HTMLInputElement>('#es-importe').value).toBe('50');
    escribir('#es-nombre', ' Tasa 696 ');
    escribir('#es-importe', '75');
    click(boton('Confirmar', dialogo()!));
    expect(dialogo()).toBeNull();
    expect(component.suplidos()[0]).toEqual({ nombre: 'Tasa 696', tipo: 'suplido', importeEstimado: 75 });
  });

  it('no confirma la edición sin nombre y cerrar la descarta', () => {
    crear();
    click(filas()[0].querySelector<HTMLButtonElement>('[aria-label="Editar partida"]'));
    escribir('#es-nombre', '  ');
    expect(boton('Confirmar', dialogo()!)!.disabled).toBe(true);
    click(dialogo()!.querySelector<HTMLButtonElement>('[aria-label="Cerrar"]'));
    expect(dialogo()).toBeNull();
    expect(nombres()).toEqual(['Tasa judicial', 'Procurador']);
  });

  it('emite save al guardar y refleja el estado de guardado', () => {
    crear();
    const spy = vi.fn();
    component.save.subscribe(() => spy());
    click(boton('Guardar costos'));
    expect(spy).toHaveBeenCalledTimes(1);

    fixture.componentRef.setInput('saving', true);
    fixture.detectChanges();
    expect(boton('Guardando...')!.disabled).toBe(true);
  });
});
