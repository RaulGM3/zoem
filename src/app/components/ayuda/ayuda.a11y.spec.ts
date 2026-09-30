import { describe, it, expect } from 'vitest';
import { analizarA11y, formatearViolaciones } from '../../../testing/axe';
import { buscarEnAyuda, montarAyuda } from './ayuda.testing';

describe('AyudaComponent — accesibilidad (axe)', () => {
  it('no tiene violaciones mostrando una guía', async () => {
    const fixture = await montarAyuda({ guia: 'casos' });

    const v = await analizarA11y(fixture.nativeElement);
    expect(v.length, formatearViolaciones(v)).toBe(0);
  });

  it('no tiene violaciones con resultados de búsqueda', async () => {
    const fixture = await montarAyuda();
    await buscarEnAyuda(fixture, 'caso');

    const v = await analizarA11y(fixture.nativeElement);
    expect(v.length, formatearViolaciones(v)).toBe(0);
  });

  it('no tiene violaciones en el aviso de guía sin acceso', async () => {
    const fixture = await montarAyuda({ guia: 'tesoreria', puede: (modulo) => modulo !== 'Tesorería' });

    const v = await analizarA11y(fixture.nativeElement);
    expect(v.length, formatearViolaciones(v)).toBe(0);
  });
});
