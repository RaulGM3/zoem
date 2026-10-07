// Genera src/app/core/plazos/partidos-judiciales.data.ts a partir del JSON extraído del
// "Nomenclátor de Partidos Judiciales" (Ministerio de Justicia, 05/02/2019).
// Uso: node scripts/generar-partidos-judiciales.mjs <sedes.json>
// Entrada: [{ pj: number (nº dentro de la provincia), ine: '28005', sede: 'ALCALÁ DE HENARES' }, ...]
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const entrada = process.argv[2];
if (!entrada) {
  console.error('Uso: node scripts/generar-partidos-judiciales.mjs <sedes.json>');
  process.exit(1);
}

/** Código INE de provincia → nombre y comunidad autónoma (claves de ComunidadAutonoma). */
const PROVINCIAS = {
  '01': ['Álava', 'pais_vasco'], '02': ['Albacete', 'castilla_la_mancha'], '03': ['Alicante', 'valencia'],
  '04': ['Almería', 'andalucia'], '05': ['Ávila', 'castilla_y_leon'], '06': ['Badajoz', 'extremadura'],
  '07': ['Illes Balears', 'baleares'], '08': ['Barcelona', 'cataluna'], '09': ['Burgos', 'castilla_y_leon'],
  '10': ['Cáceres', 'extremadura'], '11': ['Cádiz', 'andalucia'], '12': ['Castellón', 'valencia'],
  '13': ['Ciudad Real', 'castilla_la_mancha'], '14': ['Córdoba', 'andalucia'], '15': ['A Coruña', 'galicia'],
  '16': ['Cuenca', 'castilla_la_mancha'], '17': ['Girona', 'cataluna'], '18': ['Granada', 'andalucia'],
  '19': ['Guadalajara', 'castilla_la_mancha'], '20': ['Gipuzkoa', 'pais_vasco'], '21': ['Huelva', 'andalucia'],
  '22': ['Huesca', 'aragon'], '23': ['Jaén', 'andalucia'], '24': ['León', 'castilla_y_leon'],
  '25': ['Lleida', 'cataluna'], '26': ['La Rioja', 'la_rioja'], '27': ['Lugo', 'galicia'],
  '28': ['Madrid', 'madrid'], '29': ['Málaga', 'andalucia'], '30': ['Murcia', 'murcia'],
  '31': ['Navarra', 'navarra'], '32': ['Ourense', 'galicia'], '33': ['Asturias', 'asturias'],
  '34': ['Palencia', 'castilla_y_leon'], '35': ['Las Palmas', 'canarias'], '36': ['Pontevedra', 'galicia'],
  '37': ['Salamanca', 'castilla_y_leon'], '38': ['Santa Cruz de Tenerife', 'canarias'], '39': ['Cantabria', 'cantabria'],
  '40': ['Segovia', 'castilla_y_leon'], '41': ['Sevilla', 'andalucia'], '42': ['Soria', 'castilla_y_leon'],
  '43': ['Tarragona', 'cataluna'], '44': ['Teruel', 'aragon'], '45': ['Toledo', 'castilla_la_mancha'],
  '46': ['Valencia', 'valencia'], '47': ['Valladolid', 'castilla_y_leon'], '48': ['Bizkaia', 'pais_vasco'],
  '49': ['Zamora', 'castilla_y_leon'], '50': ['Zaragoza', 'aragon'], '51': ['Ceuta', 'ceuta'], '52': ['Melilla', 'melilla'],
};

const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y', 'e', 'i']);

/** 'ALCALÁ DE HENARES' → 'Alcalá de Henares'; 'HUÉRCAL-OVERA' → 'Huércal-Overa'. */
function tituloEspanol(texto) {
  return texto
    .toLowerCase()
    .split(' ')
    .map((palabra, i) => {
      if (i > 0 && PARTICULAS.has(palabra)) return palabra;
      return palabra.replace(/(^|[-'’(/])(\p{L})/gu, (_, sep, letra) => sep + letra.toUpperCase());
    })
    .join(' ');
}

const sedes = JSON.parse(readFileSync(entrada, 'utf8'));
const partidos = sedes.map(({ pj, ine, sede }) => {
  const prov = String(ine).padStart(5, '0').slice(0, 2);
  const info = PROVINCIAS[prov];
  if (!info) throw new Error(`Provincia desconocida para INE ${ine}`);
  return { id: `${prov}-${pj}`, nombre: tituloEspanol(sede.trim()), ine: String(ine).padStart(5, '0'), provincia: info[0], ca: info[1] };
});

const ids = new Set(partidos.map((p) => p.id));
if (ids.size !== partidos.length) throw new Error('Ids de partido duplicados');

const salida = `// GENERADO por scripts/generar-partidos-judiciales.mjs — no editar a mano.
// Fuente: Ministerio de Justicia, "Nomenclátor de Partidos Judiciales" (05/02/2019), sedes de partido.
// Pendiente de revisar cambios posteriores (p. ej. LO 1/2025 de Tribunales de Instancia).
import type { PartidoJudicial } from './partidos-judiciales';

export const PARTIDOS_JUDICIALES: readonly PartidoJudicial[] = ${JSON.stringify(partidos, null, 2)};
`;

const destino = resolve(dirname(fileURLToPath(import.meta.url)), '../src/app/core/plazos/partidos-judiciales.data.ts');
writeFileSync(destino, salida);
console.log(`${partidos.length} partidos escritos en ${destino}`);
