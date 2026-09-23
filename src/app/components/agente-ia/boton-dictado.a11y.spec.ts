import { describe, it, expect } from 'vitest';
import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { analizarA11y, formatearViolaciones } from '../../../testing/axe';
import {
  anuncioDictado,
  estaOcupado,
  etiquetaBotonDictado,
  type EstadoDictado,
} from '../../core/voz/dictado-estado';
import { DictadoService } from '../../core/voz/dictado.service';
import { BotonDictadoComponent } from './boton-dictado';

function fake(estadoInicial: EstadoDictado, error: string | null = null) {
  const estado = signal<EstadoDictado>(estadoInicial);
  return {
    estado,
    mensajeError: signal(error),
    grabando: computed(() => estado() === 'grabando'),
    ocupado: computed(() => estaOcupado(estado())),
    etiqueta: computed(() => etiquetaBotonDictado(estado())),
    anuncio: computed(() => anuncioDictado(estado())),
    soportado: () => true,
    alternar: async () => null,
    cancelar: () => {},
  };
}

async function montar(estado: EstadoDictado, error: string | null = null) {
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({ imports: [BotonDictadoComponent] }).compileComponents();
  TestBed.overrideComponent(BotonDictadoComponent, {
    set: { providers: [{ provide: DictadoService, useValue: fake(estado, error) }] },
  });
  const fixture = TestBed.createComponent(BotonDictadoComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

describe('BotonDictadoComponent — accesibilidad (axe)', () => {
  it('no tiene violaciones en reposo', async () => {
    const fixture = await montar('inactivo');
    const v = await analizarA11y(fixture.nativeElement);
    expect(v.length, formatearViolaciones(v)).toBe(0);
  });

  it('no tiene violaciones mientras graba', async () => {
    const fixture = await montar('grabando');
    const v = await analizarA11y(fixture.nativeElement);
    expect(v.length, formatearViolaciones(v)).toBe(0);
  });

  it('no tiene violaciones mientras transcribe', async () => {
    const fixture = await montar('transcribiendo');
    const v = await analizarA11y(fixture.nativeElement);
    expect(v.length, formatearViolaciones(v)).toBe(0);
  });

  it('no tiene violaciones mostrando un error', async () => {
    const fixture = await montar('error', 'No se ha detectado ningún micrófono conectado.');
    const v = await analizarA11y(fixture.nativeElement);
    expect(v.length, formatearViolaciones(v)).toBe(0);
  });
});
