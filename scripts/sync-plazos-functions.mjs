#!/usr/bin/env node
/**
 * Copia el motor puro de plazos (src/app/core/plazos) a functions/src/plazos/dominio.
 * Functions no puede importar src/app, así que se genera una copia con cabecera.
 * Única transformación de contenido: `ComunidadAutonoma` (tipo de la app, importa Angular
 * transitivamente) se sustituye por un alias local `string`. Los imports relativos entre
 * archivos del motor ('./x') funcionan tal cual con `module: commonjs`.
 * Uso: npm run sync:plazos
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ARCHIVOS = ['fechas-iso.ts', 'calendario-judicial.ts', 'computo-plazo.ts', 'dias-rojos.ts', 'recalculo.ts'];
export const CABECERA = '// GENERADO desde src/app/core/plazos — no editar; ejecutar `npm run sync:plazos`\n';

const IMPORT_CA = "import type { ComunidadAutonoma } from '../../interfaces/company';";
const ALIAS_CA = '/** Alias local: en functions no existe la interfaz de la app. */\ntype ComunidadAutonoma = string;';

/** Devuelve el contenido que debe tener la copia en functions para el fuente `origen`. */
export function transformar(origen) {
  let salida = origen;
  if (salida.includes(IMPORT_CA)) salida = salida.replace(IMPORT_CA, ALIAS_CA);
  if (/from '\.\.\//.test(salida)) {
    throw new Error('El motor de plazos importa algo fuera de core/plazos: añade su tratamiento al script');
  }
  return CABECERA + salida;
}

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
export const DIR_ORIGEN = join(raiz, 'src/app/core/plazos');
export const DIR_DESTINO = join(raiz, 'functions/src/plazos/dominio');

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  mkdirSync(DIR_DESTINO, { recursive: true });
  for (const archivo of ARCHIVOS) {
    writeFileSync(join(DIR_DESTINO, archivo), transformar(readFileSync(join(DIR_ORIGEN, archivo), 'utf8')));
    console.log(`sync ${archivo}`);
  }
}
