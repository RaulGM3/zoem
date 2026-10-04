/// <reference types="node" />
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(process.cwd(), 'src/app/components/caso-detail');

function plantillas(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) return plantillas(ruta);
    return ruta.endsWith('.html') ? [ruta] : [];
  });
}

describe('caso-detail — hover', () => {
  it('ninguna plantilla muta estilos en (mouseenter)/(mouseleave); se usan clases hover: de Tailwind', () => {
    const conHandlers = plantillas(RAIZ).filter((f) => /\((mouseenter|mouseleave)\)="[^"]*\.style\./.test(readFileSync(f, 'utf8')));
    expect(conHandlers.map((f) => f.replace(RAIZ, ''))).toEqual([]);
  });
});
