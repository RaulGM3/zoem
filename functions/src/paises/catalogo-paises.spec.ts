import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PAISES, paisDesdeZona, regionDesdeNombre } from './catalogo-paises';

describe('catálogo de países (copia del servidor)', () => {
  it('es byte a byte idéntico al de la app', () => {
    const app = readFileSync(resolve(__dirname, '../../../src/app/core/paises/catalogo-paises.ts'), 'utf8');
    const srv = readFileSync(resolve(__dirname, 'catalogo-paises.ts'), 'utf8');
    expect(srv).toBe(app);
  });
  it('funciona en Node', () => {
    expect(PAISES).toHaveLength(4);
    expect(regionDesdeNombre('MX', 'CDMX')).toBe('MX-CMX');
    expect(paisDesdeZona('America/Bogota')).toBe('CO');
  });
});
