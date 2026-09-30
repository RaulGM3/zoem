import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CasoDocsChecklistComponent } from './caso-docs-checklist';
import type { CasoDocSlot } from '../../../../interfaces';

const slot = (id: string, status: string, docTemplateId?: string): CasoDocSlot =>
  ({ id, folderId: null, name: `Slot ${id}`, status, docTemplateId }) as unknown as CasoDocSlot;

describe('CasoDocsChecklistComponent', () => {
  let fixture: ComponentFixture<CasoDocsChecklistComponent>;
  let seleccionados: CasoDocSlot[];

  const el = (): HTMLElement => fixture.nativeElement;
  const botones = (): HTMLButtonElement[] => Array.from(el().querySelectorAll('button'));
  const texto = (): string => el().textContent?.replace(/\s+/g, ' ').trim() ?? '';

  function render(slots: CasoDocSlot[], busy = false): void {
    fixture.componentRef.setInput('slots', slots);
    fixture.componentRef.setInput('busy', busy);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({ imports: [CasoDocsChecklistComponent] }).compileComponents();
    fixture = TestBed.createComponent(CasoDocsChecklistComponent);
    seleccionados = [];
    fixture.componentInstance.slotSelected.subscribe(s => seleccionados.push(s));
  });

  it('es una región etiquetada con los slots pendientes', () => {
    render([slot('1', 'pendiente'), slot('2', 'subido'), slot('3', 'generado'), slot('4', 'pendiente', 't1')]);
    expect(el().querySelector('aside')!.getAttribute('aria-label')).toBe('Documentos pendientes');
    expect(botones().map(b => b.textContent?.trim())).toEqual(['Slot 1', 'Slot 4']);
    expect(texto()).toContain('2 pendientes');
    expect(texto()).toContain('2 completados');
  });

  it('usa el singular con un solo pendiente y un solo completado', () => {
    render([slot('1', 'pendiente'), slot('2', 'subido')]);
    expect(texto()).toContain('1 pendiente');
    expect(texto()).not.toContain('pendientes');
    expect(texto()).toContain('1 completado');
    expect(texto()).not.toContain('completados');
  });

  it('no muestra el contador de completados si no hay ninguno', () => {
    render([slot('1', 'pendiente')]);
    expect(texto()).not.toContain('completado');
  });

  it('muestra el estado completo cuando no queda nada pendiente', () => {
    render([slot('1', 'subido'), slot('2', 'generado')]);
    expect(botones()).toHaveLength(0);
    expect(texto()).toContain('✓ Completo');
    expect(texto()).toContain('Todos los documentos requeridos están completados.');
  });

  it('emite el slot elegido', () => {
    const pendiente = slot('1', 'pendiente');
    render([pendiente]);
    botones()[0].click();
    expect(seleccionados).toEqual([pendiente]);
  });

  it('se bloquea mientras hay una operación en curso', () => {
    render([slot('1', 'pendiente')], true);
    expect(botones()[0].disabled).toBe(true);
  });
});
