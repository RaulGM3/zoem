import { describe, it, expect, beforeEach } from 'vitest';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { PartidoJudicialComboboxComponent } from './partido-judicial-combobox';
import { CompanyService } from '../../../core/services/company.service';
import type { ComunidadAutonoma } from '../../../interfaces/company';

const activeCompany = signal<{ id: string; ca?: ComunidadAutonoma } | null>({ id: 'c1', ca: 'madrid' });

async function montar(value?: string): Promise<{ f: ComponentFixture<PartidoJudicialComboboxComponent>; raiz: HTMLElement; emitidos: (string | undefined)[] }> {
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    imports: [PartidoJudicialComboboxComponent],
    providers: [{ provide: CompanyService, useValue: { activeCompany } }],
  }).compileComponents();
  const f = TestBed.createComponent(PartidoJudicialComboboxComponent);
  f.componentRef.setInput('inputId', 'pj');
  if (value) f.componentRef.setInput('value', value);
  const emitidos: (string | undefined)[] = [];
  f.componentInstance.cambio.subscribe((v) => emitidos.push(v));
  f.detectChanges();
  return { f, raiz: f.nativeElement as HTMLElement, emitidos };
}

const escribir = (f: ComponentFixture<PartidoJudicialComboboxComponent>, raiz: HTMLElement, texto: string): HTMLInputElement => {
  const input = raiz.querySelector<HTMLInputElement>('input[role="combobox"]')!;
  input.value = texto;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  f.detectChanges();
  return input;
};
const tecla = (f: ComponentFixture<PartidoJudicialComboboxComponent>, input: HTMLInputElement, key: string): void => {
  input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  f.detectChanges();
};

describe('PartidoJudicialComboboxComponent', () => {
  beforeEach(() => activeCompany.set({ id: 'c1', ca: 'madrid' }));

  it('expone el patrón ARIA combobox', async () => {
    const { f, raiz } = await montar();
    const input = escribir(f, raiz, 'alcala');
    expect(input.id).toBe('pj');
    expect(input.getAttribute('aria-expanded')).toBe('true');
    const lista = raiz.querySelector('[role="listbox"]')!;
    expect(input.getAttribute('aria-controls')).toBe(lista.id);
    expect(input.getAttribute('aria-autocomplete')).toBe('list');
    expect(lista.querySelectorAll('[role="option"]').length).toBeGreaterThan(1);
  });

  it('prioriza la CA de la empresa y muestra "Nombre (Provincia)"', async () => {
    const { f, raiz } = await montar();
    escribir(f, raiz, 'alcala');
    const primera = raiz.querySelector('[role="option"]')!;
    expect(primera.textContent?.trim()).toBe('Alcalá de Henares (Madrid)');
  });

  it('máximo 20 opciones', async () => {
    const { f, raiz } = await montar();
    escribir(f, raiz, 'a');
    expect(raiz.querySelectorAll('[role="option"]').length).toBeLessThanOrEqual(20);
  });

  it('flechas mueven aria-activedescendant y Enter selecciona y emite el id', async () => {
    const { f, raiz, emitidos } = await montar();
    const input = escribir(f, raiz, 'alcala');
    tecla(f, input, 'ArrowDown');
    const opciones = Array.from(raiz.querySelectorAll('[role="option"]'));
    expect(input.getAttribute('aria-activedescendant')).toBe(opciones[0].id);
    expect(opciones[0].getAttribute('aria-selected')).toBe('true');
    tecla(f, input, 'ArrowDown');
    expect(input.getAttribute('aria-activedescendant')).toBe(opciones[1].id);
    tecla(f, input, 'ArrowUp');
    tecla(f, input, 'Enter');
    expect(emitidos).toEqual(['28-4']);
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(input.value).toBe('Alcalá de Henares (Madrid)');
  });

  it('Escape cierra la lista sin emitir', async () => {
    const { f, raiz, emitidos } = await montar();
    const input = escribir(f, raiz, 'alcala');
    tecla(f, input, 'Escape');
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(raiz.querySelector('[role="listbox"]')).toBeNull();
    expect(emitidos).toEqual([]);
  });

  it('clic en una opción la selecciona', async () => {
    const { f, raiz, emitidos } = await montar();
    escribir(f, raiz, 'alcala');
    raiz.querySelectorAll<HTMLElement>('[role="option"]')[0].dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    f.detectChanges();
    expect(emitidos).toEqual(['28-4']);
  });

  it('muestra el valor inicial como "Nombre (Provincia)"', async () => {
    const { raiz } = await montar('28-4');
    expect(raiz.querySelector<HTMLInputElement>('input')!.value).toBe('Alcalá de Henares (Madrid)');
  });

  it('vaciar el texto limpia la selección (emite undefined)', async () => {
    const { f, raiz, emitidos } = await montar('28-4');
    escribir(f, raiz, '');
    expect(emitidos).toEqual([undefined]);
  });

  it('sin resultados lo anuncia', async () => {
    const { f, raiz } = await montar();
    escribir(f, raiz, 'zzzzqq');
    expect(raiz.querySelector('[role="status"]')?.textContent).toContain('Sin resultados');
  });

  it('disabled deshabilita el input', async () => {
    const { f, raiz } = await montar();
    f.componentRef.setInput('disabled', true);
    f.detectChanges();
    expect(raiz.querySelector('input')!.disabled).toBe(true);
  });
});
