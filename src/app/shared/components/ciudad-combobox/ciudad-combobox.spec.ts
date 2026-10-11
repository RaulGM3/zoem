import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { analizarA11y, formatearViolaciones } from '../../../../testing/axe';
import { PlacesService } from '../../../core/ubicacion/places.service';
import { CiudadComboboxComponent } from './ciudad-combobox';

describe('CiudadComboboxComponent', () => {
  const disponible = signal(true);
  const buscar = vi.fn();
  const elegir = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    disponible.set(true);
    buscar.mockReset();
    elegir.mockReset();
    buscar.mockResolvedValue([
      { placeId: 'p1', principal: 'Medellín', secundario: 'Antioquia, Colombia', texto: 'Medellín, Antioquia, Colombia' },
      { placeId: 'p2', principal: 'Medina', secundario: 'Cundinamarca, Colombia', texto: 'Medina, Cundinamarca, Colombia' },
    ]);
    elegir.mockResolvedValue({ placeId: 'p1', nombre: 'Medellín', lat: 6.24, lng: -75.58, regionNombre: 'Antioquia' });
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: PlacesService, useValue: { disponible, buscar, elegir } }] });
  });
  afterEach(() => vi.useRealTimers());

  function render(pais: 'CO' | 'ES' = 'CO', valor = '') {
    const fixture = TestBed.createComponent(CiudadComboboxComponent);
    fixture.componentRef.setInput('pais', pais);
    fixture.componentRef.setInput('valor', valor);
    fixture.componentRef.setInput('inputId', 'ciudad');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const input = el.querySelector('input') as HTMLInputElement;
    const elegidas: unknown[] = [];
    const textos: string[] = [];
    fixture.componentInstance.elegida.subscribe((c) => elegidas.push(c));
    fixture.componentInstance.textoCambiado.subscribe((t) => textos.push(t));
    return { fixture, el, input, elegidas, textos };
  }

  async function teclear(f: ReturnType<typeof render>, texto: string) {
    f.input.value = texto;
    f.input.dispatchEvent(new Event('input'));
    await vi.advanceTimersByTimeAsync(300);
    f.fixture.detectChanges();
  }

  function tecla(f: ReturnType<typeof render>, key: string) {
    f.input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    f.fixture.detectChanges();
  }

  it('sigue el patrón ARIA combobox y empieza cerrado', () => {
    const { input, el } = render();
    expect(input.getAttribute('role')).toBe('combobox');
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(input.getAttribute('aria-autocomplete')).toBe('list');
    expect(el.querySelector('[role="listbox"]')).toBeNull();
  });

  it('espera 300 ms antes de buscar y solo busca desde 3 caracteres', async () => {
    const f = render();
    f.input.value = 'Me';
    f.input.dispatchEvent(new Event('input'));
    await vi.advanceTimersByTimeAsync(400);
    expect(buscar).not.toHaveBeenCalled();

    f.input.value = 'Med';
    f.input.dispatchEvent(new Event('input'));
    await vi.advanceTimersByTimeAsync(299);
    expect(buscar).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(buscar).toHaveBeenCalledWith('Med', 'CO');
  });

  it('agrupa pulsaciones rápidas en una sola búsqueda', async () => {
    const f = render();
    for (const t of ['Med', 'Mede', 'Medel']) {
      f.input.value = t;
      f.input.dispatchEvent(new Event('input'));
      await vi.advanceTimersByTimeAsync(100);
    }
    await vi.advanceTimersByTimeAsync(300);
    expect(buscar).toHaveBeenCalledTimes(1);
    expect(buscar).toHaveBeenCalledWith('Medel', 'CO');
  });

  it('muestra las sugerencias en un listbox, con la atribución de Google', async () => {
    const f = render();
    await teclear(f, 'Med');
    expect(f.input.getAttribute('aria-expanded')).toBe('true');
    const lista = f.el.querySelector('[role="listbox"]')!;
    expect(f.input.getAttribute('aria-controls')).toBe(lista.id);
    const opciones = Array.from(lista.querySelectorAll('[role="option"]'));
    expect(opciones.map((o) => o.textContent?.trim())).toEqual([
      'Medellín Antioquia, Colombia',
      'Medina Cundinamarca, Colombia',
    ]);
    expect(f.el.textContent).toContain('Powered by Google');
    expect(f.el.querySelector('[role="status"]')?.textContent).toContain('2');
  });

  it('flechas + Enter eligen la sugerencia activa (aria-activedescendant)', async () => {
    const f = render();
    await teclear(f, 'Med');
    tecla(f, 'ArrowDown');
    tecla(f, 'ArrowDown');
    const opciones = f.el.querySelectorAll('[role="option"]');
    expect(f.input.getAttribute('aria-activedescendant')).toBe(opciones[1].id);
    expect(opciones[1].getAttribute('aria-selected')).toBe('true');
    tecla(f, 'ArrowUp');
    expect(f.input.getAttribute('aria-activedescendant')).toBe(opciones[0].id);

    tecla(f, 'Enter');
    await vi.advanceTimersByTimeAsync(0);
    f.fixture.detectChanges();
    expect(elegir).toHaveBeenCalledWith('p1');
    expect(f.elegidas).toEqual([{ placeId: 'p1', nombre: 'Medellín', lat: 6.24, lng: -75.58, regionNombre: 'Antioquia' }]);
    expect(f.input.value).toBe('Medellín');
    expect(f.input.getAttribute('aria-expanded')).toBe('false');
  });

  it('el clic en una opción la elige', async () => {
    const f = render();
    await teclear(f, 'Med');
    (f.el.querySelectorAll('[role="option"]')[0] as HTMLElement).click();
    await vi.advanceTimersByTimeAsync(0);
    expect(f.elegidas).toHaveLength(1);
  });

  it('Escape cierra la lista sin elegir', async () => {
    const f = render();
    await teclear(f, 'Med');
    tecla(f, 'Escape');
    expect(f.input.getAttribute('aria-expanded')).toBe('false');
    expect(f.elegidas).toHaveLength(0);
  });

  it('Enter sin opción activa no hace nada (deja enviar el formulario)', async () => {
    const f = render();
    await teclear(f, 'Med');
    const ev = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
    f.input.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
  });

  it('escribir emite el texto libre (para que el padre descarte la ubicación anterior)', async () => {
    const f = render();
    await teclear(f, 'Med');
    expect(f.textos).toEqual(['Med']);
  });

  it('sin Places disponible es un campo de texto libre: no busca ni abre nada', async () => {
    disponible.set(false);
    const f = render();
    await teclear(f, 'Medellín');
    expect(buscar).not.toHaveBeenCalled();
    expect(f.textos).toEqual(['Medellín']);
    expect(f.el.querySelector('[role="listbox"]')).toBeNull();
    expect(f.input.getAttribute('aria-expanded')).toBe('false');
  });

  it('si la búsqueda falla, cae a texto libre sin romper', async () => {
    buscar.mockRejectedValue(new Error('REQUEST_DENIED'));
    const f = render();
    await teclear(f, 'Med');
    expect(f.el.querySelector('[role="listbox"]')).toBeNull();
    expect(f.input.value).toBe('Med');
  });

  it('si falla al resolver la ciudad elegida, conserva el texto escrito como texto libre', async () => {
    elegir.mockRejectedValue(new Error('boom'));
    const f = render();
    await teclear(f, 'Med');
    (f.el.querySelectorAll('[role="option"]')[0] as HTMLElement).click();
    await vi.advanceTimersByTimeAsync(0);
    f.fixture.detectChanges();
    expect(f.elegidas).toEqual([]);
    expect(f.input.value).toBe('Medellín');
    expect(f.textos.at(-1)).toBe('Medellín');
  });

  it('no aplica una respuesta vieja si ya se escribió otra cosa', async () => {
    let resolver!: (v: unknown) => void;
    buscar.mockReturnValueOnce(new Promise((r) => (resolver = r)));
    const f = render();
    await teclear(f, 'Med');
    f.input.value = 'Me';
    f.input.dispatchEvent(new Event('input'));
    resolver([{ placeId: 'x', principal: 'Vieja', secundario: '', texto: 'Vieja' }]);
    await vi.advanceTimersByTimeAsync(400);
    f.fixture.detectChanges();
    expect(f.el.querySelector('[role="listbox"]')).toBeNull();
  });

  it('refleja el valor de entrada y cerrar al cambiar de país', async () => {
    const f = render('CO', 'Bogotá');
    expect(f.input.value).toBe('Bogotá');
    await teclear(f, 'Med');
    f.fixture.componentRef.setInput('pais', 'ES');
    f.fixture.detectChanges();
    expect(f.el.querySelector('[role="listbox"]')).toBeNull();
  });

  it('sin violaciones axe, cerrado y abierto', async () => {
    // axe usa temporizadores reales: aquí no valen los falsos.
    vi.useRealTimers();
    const f = render();
    const etiqueta = document.createElement('label');
    etiqueta.htmlFor = 'ciudad';
    etiqueta.textContent = 'Ciudad';
    f.el.prepend(etiqueta);
    document.body.appendChild(f.el);
    try {
      let v = await analizarA11y(f.el);
      expect(v.length, formatearViolaciones(v)).toBe(0);
      f.input.value = 'Med';
      f.input.dispatchEvent(new Event('input'));
      await new Promise((r) => setTimeout(r, 350));
      f.fixture.detectChanges();
      tecla(f, 'ArrowDown');
      v = await analizarA11y(f.el);
      expect(v.length, formatearViolaciones(v)).toBe(0);
    } finally {
      f.el.remove();
    }
  });
});
