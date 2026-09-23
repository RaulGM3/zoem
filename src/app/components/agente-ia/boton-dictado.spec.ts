import { describe, it, expect, beforeEach, vi } from 'vitest';
import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  anuncioDictado,
  estaOcupado,
  etiquetaBotonDictado,
  type EstadoDictado,
} from '../../core/voz/dictado-estado';
import { DictadoService } from '../../core/voz/dictado.service';
import { BotonDictadoComponent } from './boton-dictado';

function fakeDictado(opts: { soportado?: boolean } = {}) {
  const estado = signal<EstadoDictado>('inactivo');
  const mensajeError = signal<string | null>(null);
  return {
    estado,
    mensajeError,
    grabando: computed(() => estado() === 'grabando'),
    ocupado: computed(() => estaOcupado(estado())),
    etiqueta: computed(() => etiquetaBotonDictado(estado())),
    anuncio: computed(() => anuncioDictado(estado())),
    soportado: () => opts.soportado ?? true,
    alternar: vi.fn(async () => null as string | null),
    cancelar: vi.fn(),
  };
}

function montar(fake: ReturnType<typeof fakeDictado>) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ imports: [BotonDictadoComponent] });
  TestBed.overrideComponent(BotonDictadoComponent, {
    set: { providers: [{ provide: DictadoService, useValue: fake }] },
  });
  const fixture = TestBed.createComponent(BotonDictadoComponent);
  fixture.detectChanges();
  return fixture;
}

const boton = (f: ReturnType<typeof montar>): HTMLButtonElement | null =>
  f.nativeElement.querySelector('button');

describe('BotonDictadoComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('no renderiza nada si el navegador no soporta el dictado', () => {
    const fixture = montar(fakeDictado({ soportado: false }));
    expect(boton(fixture)).toBeNull();
  });

  it('marca aria-pressed solo mientras graba', () => {
    const fake = fakeDictado();
    const fixture = montar(fake);
    expect(boton(fixture)!.getAttribute('aria-pressed')).toBe('false');

    fake.estado.set('grabando');
    fixture.detectChanges();
    expect(boton(fixture)!.getAttribute('aria-pressed')).toBe('true');
  });

  it('cambia el aria-label con cada estado', () => {
    const fake = fakeDictado();
    const fixture = montar(fake);
    const etiquetas = new Set<string>();

    for (const estado of ['inactivo', 'permiso', 'grabando', 'transcribiendo', 'error'] as const) {
      fake.estado.set(estado);
      fixture.detectChanges();
      etiquetas.add(boton(fixture)!.getAttribute('aria-label')!);
    }
    expect(etiquetas.size).toBe(5);
  });

  it('se anuncia ocupado y se bloquea mientras transcribe', () => {
    const fake = fakeDictado();
    const fixture = montar(fake);

    fake.estado.set('transcribiendo');
    fixture.detectChanges();

    expect(boton(fixture)!.getAttribute('aria-busy')).toBe('true');
    expect(boton(fixture)!.disabled).toBe(true);
  });

  it('la live region refleja el estado actual', () => {
    const fake = fakeDictado();
    const fixture = montar(fake);
    const region = fixture.nativeElement.querySelector('[role="status"]') as HTMLElement;

    expect(region.textContent?.trim()).toBe('');

    fake.estado.set('grabando');
    fixture.detectChanges();
    expect(region.textContent).toContain('Grabando');
  });

  it('emite el texto transcrito cuando el ciclo termina bien', async () => {
    const fake = fakeDictado();
    fake.alternar.mockResolvedValue('Busca el caso de Juan');
    const fixture = montar(fake);

    const emitidos: string[] = [];
    fixture.componentInstance.transcrito.subscribe((t: string) => emitidos.push(t));

    await fixture.componentInstance.alternar();
    expect(emitidos).toEqual(['Busca el caso de Juan']);
  });

  it('no emite nada cuando el ciclo no produce texto', async () => {
    const fake = fakeDictado();
    fake.alternar.mockResolvedValue(null);
    const fixture = montar(fake);

    const emitidos: string[] = [];
    fixture.componentInstance.transcrito.subscribe((t: string) => emitidos.push(t));

    await fixture.componentInstance.alternar();
    expect(emitidos).toEqual([]);
  });

  it('Escape cancela el dictado en curso', () => {
    const fake = fakeDictado();
    const fixture = montar(fake);

    boton(fixture)!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();

    expect(fake.cancelar).toHaveBeenCalledTimes(1);
  });

  it('muestra el error del dictado como alerta accesible', () => {
    const fake = fakeDictado();
    const fixture = montar(fake);
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();

    fake.estado.set('error');
    fake.mensajeError.set('No se ha detectado ningún micrófono conectado.');
    fixture.detectChanges();

    const alerta = fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement;
    expect(alerta.textContent).toContain('micrófono');
  });

  it('se deshabilita cuando el composer está ocupado', () => {
    const fake = fakeDictado();
    const fixture = montar(fake);

    fixture.componentRef.setInput('deshabilitado', true);
    fixture.detectChanges();

    expect(boton(fixture)!.disabled).toBe(true);
  });
});
