import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PlantillaHitosTabComponent } from './plantilla-hitos-tab';
import type { CompanyMember, HitoPlantilla } from '../../../../interfaces';

const ANA = { id: 'm1', userId: 'u1', nombre: 'Ana', apellido: 'García' } as CompanyMember;
const LUIS = { id: 'm2', userId: 'u2', nombre: 'Luis' } as CompanyMember;

function hitos(): HitoPlantilla[] {
  return [
    { id: 'h1', titulo: 'Demanda', diasDesdeInicio: 5, asignadoA: 'u1', orden: 0 },
    { id: 'h2', titulo: 'Juicio', diasDesdeInicio: 30, orden: 1 },
  ];
}

describe('PlantillaHitosTabComponent', () => {
  let fixture: ComponentFixture<PlantillaHitosTabComponent>;
  let component: PlantillaHitosTabComponent;

  const el = (): HTMLElement => fixture.nativeElement;
  const q = <T extends HTMLElement>(selector: string): T => el().querySelector<T>(selector)!;
  const filas = (): HTMLElement[] => Array.from(el().querySelectorAll<HTMLElement>('li[draggable="true"]'));
  const boton = (texto: string, raiz: HTMLElement = el()): HTMLButtonElement | undefined =>
    Array.from(raiz.querySelectorAll('button')).find(b => b.textContent?.trim() === texto);
  const dialogo = (): HTMLElement | null => el().querySelector('[role="dialog"]');
  const modelo = (): [string, number][] => component.hitos().map(h => [h.titulo, h.orden]);

  function escribir(selector: string, valor: string, evento: 'input' | 'change' = 'input'): HTMLInputElement {
    const control = q<HTMLInputElement>(selector);
    control.value = valor;
    control.dispatchEvent(new Event(evento));
    fixture.detectChanges();
    return control;
  }

  function click(target: HTMLElement | undefined | null): void {
    expect(target).toBeTruthy();
    target!.click();
    fixture.detectChanges();
  }

  function crear(members: CompanyMember[] = [ANA, LUIS], lista: HitoPlantilla[] = hitos()): void {
    fixture = TestBed.createComponent(PlantillaHitosTabComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('hitos', lista);
    fixture.componentRef.setInput('members', members);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [PlantillaHitosTabComponent] }).compileComponents();
  });

  it('lista los hitos con su posición, días y asignado', () => {
    crear();
    expect(filas().map(li => li.querySelector('p')!.textContent!.trim())).toEqual(['Demanda', 'Juicio']);
    expect(filas()[0].textContent).toContain('+5d');
    expect(filas()[0].textContent).toContain('Ana García');
    expect(filas()[1].textContent).not.toContain('·');
  });

  it('no pinta la lista si no hay hitos', () => {
    crear([ANA, LUIS], []);
    expect(el().querySelector('ul')).toBeNull();
  });

  it('muestra el userId si el asignado ya no es miembro', () => {
    crear([LUIS]);
    expect(filas()[0].textContent).toContain('u1');
  });

  it('añade un hito al modelo con el siguiente orden', () => {
    crear();
    escribir('#h-titulo', '  Sentencia  ');
    escribir('#h-dias', '60');
    escribir('#h-asignado', 'u2', 'change');
    click(boton('+ Añadir hito'));
    expect(modelo()).toEqual([['Demanda', 0], ['Juicio', 1], ['Sentencia', 2]]);
    expect(component.hitos()[2]).toMatchObject({ diasDesdeInicio: 60, asignadoA: 'u2', descripcion: undefined });
    expect(component.hitos()[2].id).toBeTruthy();
    expect(q<HTMLInputElement>('#h-titulo').value).toBe('');
  });

  it('trata los días no numéricos como 0 y "sin asignar" como indefinido', () => {
    crear();
    escribir('#h-titulo', 'Sentencia');
    escribir('#h-dias', '');
    click(boton('+ Añadir hito'));
    expect(component.hitos()[2]).toMatchObject({ diasDesdeInicio: 0, asignadoA: undefined });
  });

  it('no añade hitos sin título', () => {
    crear();
    escribir('#h-titulo', '   ');
    expect(boton('+ Añadir hito')!.disabled).toBe(true);
    q('#h-titulo').dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter' }));
    expect(component.hitos()).toHaveLength(2);
  });

  it('con un único miembro lo asigna por defecto, también tras añadir', () => {
    crear([ANA]);
    expect(el().querySelector('#h-asignado')).toBeNull();
    escribir('#h-titulo', 'Uno');
    click(boton('+ Añadir hito'));
    escribir('#h-titulo', 'Dos');
    click(boton('+ Añadir hito'));
    expect(component.hitos().slice(2).map(h => h.asignadoA)).toEqual(['u1', 'u1']);
  });

  it('elimina un hito y renumera', () => {
    crear();
    click(filas()[0].querySelector<HTMLButtonElement>('[aria-label="Eliminar hito"]'));
    expect(modelo()).toEqual([['Juicio', 0]]);
  });

  it('reordena arrastrando, resalta el destino y renumera', () => {
    crear();
    filas()[0].dispatchEvent(new Event('dragstart'));
    filas()[1].dispatchEvent(new Event('dragover', { cancelable: true }));
    fixture.detectChanges();
    expect(filas()[0].className).toContain('opacity-40');
    expect(filas()[1].className).toContain('bg-violet-50');
    filas()[1].dispatchEvent(new Event('drop', { cancelable: true }));
    fixture.detectChanges();
    expect(modelo()).toEqual([['Juicio', 0], ['Demanda', 1]]);
    expect(filas()[1].className).not.toContain('opacity-40');
  });

  it('soltar sobre la misma fila o terminar el arrastre no cambia nada', () => {
    crear();
    filas()[0].dispatchEvent(new Event('dragstart'));
    filas()[0].dispatchEvent(new Event('dragover', { cancelable: true }));
    filas()[0].dispatchEvent(new Event('drop', { cancelable: true }));
    filas()[1].dispatchEvent(new Event('dragstart'));
    filas()[1].dispatchEvent(new Event('dragend'));
    fixture.detectChanges();
    expect(modelo()).toEqual([['Demanda', 0], ['Juicio', 1]]);
    expect(filas()[1].className).not.toContain('opacity-40');
  });

  it('edita un hito desde el modal conservando id y orden', () => {
    crear();
    click(filas()[0].querySelector<HTMLButtonElement>('[aria-label="Editar hito"]'));
    expect(q<HTMLInputElement>('#eh-titulo').value).toBe('Demanda');
    escribir('#eh-titulo', ' Demanda inicial ');
    escribir('#eh-desc', ' Con poder ');
    escribir('#eh-dias', '7');
    click(boton('Confirmar', dialogo()!));
    expect(dialogo()).toBeNull();
    expect(component.hitos()[0]).toEqual({
      id: 'h1', titulo: 'Demanda inicial', descripcion: 'Con poder', diasDesdeInicio: 7, asignadoA: 'u1', orden: 0,
    });
  });

  it('el modal de edición muestra seleccionado al responsable del hito', () => {
    crear();
    click(filas()[0].querySelector<HTMLButtonElement>('[aria-label="Editar hito"]'));
    expect(q<HTMLSelectElement>('#eh-asignado').value).toBe('u1');
    click(dialogo()!.querySelector<HTMLButtonElement>('[aria-label="Cerrar"]'));

    click(filas()[1].querySelector<HTMLButtonElement>('[aria-label="Editar hito"]'));
    expect(q<HTMLSelectElement>('#eh-asignado').value).toBe('');
  });

  it('cerrar el modal descarta la edición', () => {
    crear();
    click(filas()[0].querySelector<HTMLButtonElement>('[aria-label="Editar hito"]'));
    escribir('#eh-titulo', 'Otro');
    click(dialogo()!.querySelector<HTMLButtonElement>('[aria-label="Cerrar"]'));
    expect(dialogo()).toBeNull();
    expect(component.hitos()[0].titulo).toBe('Demanda');
  });

  it('emite save al guardar y refleja el estado de guardado', () => {
    crear();
    const spy = vi.fn();
    component.save.subscribe(() => spy());
    click(boton('Guardar hitos'));
    expect(spy).toHaveBeenCalledTimes(1);

    fixture.componentRef.setInput('saving', true);
    fixture.detectChanges();
    expect(boton('Guardando...')!.disabled).toBe(true);
  });
});
