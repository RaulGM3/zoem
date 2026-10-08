import { describe, it, expect } from 'vitest';
import type { Guia } from './guia';
import { guiaDeRuta } from './guia-de-ruta';

const guia = (id: string, ruta: string, otrasRutas?: string[]): Guia =>
  ({ id, titulo: id, modulo: null, ruta, otrasRutas, resumen: '', paraQue: '', tareas: [], claves: [] }) as unknown as Guia;

const GUIAS: readonly Guia[] = [
  guia('general', '/'),
  guia('dashboard', '/'),
  guia('casos', '/casos', ['/plantillas']),
  guia('configuracion', '/configuracion'),
  guia('acciones', '/acciones'),
];

const id = (url: string) => guiaDeRuta(GUIAS, url)?.id;

describe('guiaDeRuta', () => {
  it('la raíz es el dashboard, no la guía general', () => {
    expect(id('/')).toBe('dashboard');
  });

  it('encuentra la guía de la pantalla exacta', () => {
    expect(id('/casos')).toBe('casos');
    expect(id('/acciones')).toBe('acciones');
  });

  it('las subpantallas heredan la guía de su pantalla', () => {
    expect(id('/casos/abc123')).toBe('casos');
    expect(id('/configuracion/usuarios')).toBe('configuracion');
  });

  it('usa las otras rutas que declara una guía', () => {
    expect(id('/plantillas')).toBe('casos');
    expect(id('/plantillas/xyz')).toBe('casos');
  });

  it('ignora query string y fragmento', () => {
    expect(id('/casos/1?tab=hitos')).toBe('casos');
    expect(id('/acciones#lista')).toBe('acciones');
  });

  it('compara por segmentos, no por prefijo de texto', () => {
    expect(id('/casosx')).toBe('general');
  });

  it('sin pantalla documentada cae en la guía general', () => {
    expect(id('/llamadas')).toBe('general');
  });

  it('sin guía general ni coincidencia devuelve undefined', () => {
    expect(guiaDeRuta(GUIAS.filter(g => g.id !== 'general'), '/llamadas')).toBeUndefined();
  });
});
