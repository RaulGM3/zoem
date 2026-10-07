import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error módulo .mjs sin tipos (script de repo)
import { ARCHIVOS, DIR_DESTINO, DIR_ORIGEN, transformar } from '../../../scripts/sync-plazos-functions.mjs';

describe('motor de plazos compartido con functions', () => {
  it.each(ARCHIVOS as string[])('%s no se ha desincronizado de src/app/core/plazos', (archivo) => {
    const esperado = transformar(readFileSync(join(DIR_ORIGEN, archivo), 'utf8'));
    const copia = readFileSync(join(DIR_DESTINO, archivo), 'utf8');
    expect(copia, 'ejecuta `npm run sync:plazos`').toBe(esperado);
  });

  it('cada copia lleva la cabecera de archivo generado', () => {
    for (const archivo of ARCHIVOS as string[]) {
      expect(readFileSync(join(DIR_DESTINO, archivo), 'utf8').startsWith('// GENERADO desde src/app/core/plazos')).toBe(true);
    }
  });
});
