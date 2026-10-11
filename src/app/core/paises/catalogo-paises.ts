/**
 * Catálogo de países — DATOS y funciones puras, sin Angular ni DI.
 * Fuente única de país, región, moneda, zona e impuestos del despacho.
 *
 * Se copia BYTE A BYTE a `functions/src/paises/catalogo-paises.ts` (igual que `planes/catalogo.ts`).
 * Por eso no importa nada: si lo editas, copia el archivo al otro lado.
 * Un spec comprueba que ambas copias son idénticas.
 */

export type CodigoPais = 'ES' | 'CO' | 'CL' | 'MX';

export interface Region {
  /** ES: slug de la comunidad autónoma (`madrid`). Resto: ISO 3166-2 (`CO-ANT`). */
  codigo: string;
  nombre: string;
  /** Otros nombres con los que aparece (Google Places, nombres oficiales). Se comparan sin acentos ni mayúsculas. */
  alias: readonly string[];
  /** Zona IANA cuando difiere de la del país. */
  zona?: string;
}

export interface Pais {
  codigo: CodigoPais;
  nombre: string;
  locale: string;
  moneda: string;
  decimales: number;
  /** La local primero. Fuera de España también USD. */
  monedasPermitidas: readonly string[];
  /** 'Comunidad autónoma' | 'Departamento' | 'Región' | 'Estado' */
  etiquetaRegion: string;
  regiones: readonly Region[];
  /** Región que usa la demo (la capital). */
  regionCapital: string;
  zonaPorDefecto: string;
  tiposIva: readonly number[];
  ivaPorDefecto: number;
  /** 'NIF/CIF' | 'NIT' | 'RUT' | 'RFC' */
  etiquetaIdFiscal: string;
  /** Comprobación básica de forma (longitud y caracteres), no de dígito verificador. */
  patronIdFiscal: RegExp;
  /** Dígitos del código postal. */
  digitosCodigoPostal: number;
}

const r = (codigo: string, nombre: string, alias: readonly string[] = [], zona?: string): Region => ({
  codigo,
  nombre,
  alias,
  ...(zona ? { zona } : {}),
});

const REGIONES_ES: readonly Region[] = [
  r('andalucia', 'Andalucía'),
  r('aragon', 'Aragón'),
  r('asturias', 'Asturias', ['Principado de Asturias']),
  r('baleares', 'Islas Baleares', ['Illes Balears', 'Baleares']),
  r('canarias', 'Canarias', ['Islas Canarias'], 'Atlantic/Canary'),
  r('cantabria', 'Cantabria'),
  r('castilla_la_mancha', 'Castilla-La Mancha', ['Castilla La Mancha']),
  r('castilla_y_leon', 'Castilla y León'),
  r('cataluna', 'Cataluña', ['Catalunya']),
  r('extremadura', 'Extremadura'),
  r('galicia', 'Galicia'),
  r('la_rioja', 'La Rioja'),
  r('madrid', 'Comunidad de Madrid', ['Madrid']),
  r('murcia', 'Región de Murcia', ['Murcia']),
  r('navarra', 'Comunidad Foral de Navarra', ['Navarra', 'Nafarroa']),
  r('pais_vasco', 'País Vasco', ['Euskadi']),
  r('valencia', 'Comunitat Valenciana', ['Comunidad Valenciana', 'Valencia']),
  r('ceuta', 'Ceuta', ['Ciudad de Ceuta']),
  r('melilla', 'Melilla', ['Ciudad de Melilla']),
];

/** 32 departamentos + Bogotá D.C. */
const REGIONES_CO: readonly Region[] = [
  r('CO-AMA', 'Amazonas'),
  r('CO-ANT', 'Antioquia'),
  r('CO-ARA', 'Arauca'),
  r('CO-ATL', 'Atlántico'),
  r('CO-BOL', 'Bolívar'),
  r('CO-BOY', 'Boyacá'),
  r('CO-CAL', 'Caldas'),
  r('CO-CAQ', 'Caquetá'),
  r('CO-CAS', 'Casanare'),
  r('CO-CAU', 'Cauca'),
  r('CO-CES', 'Cesar'),
  r('CO-CHO', 'Chocó'),
  r('CO-COR', 'Córdoba'),
  r('CO-CUN', 'Cundinamarca'),
  r('CO-DC', 'Bogotá D.C.', ['Bogotá', 'Bogota', 'Bogotá, D.C.', 'Distrito Capital', 'Distrito Capital de Bogotá']),
  r('CO-GUA', 'Guainía'),
  r('CO-GUV', 'Guaviare'),
  r('CO-HUI', 'Huila'),
  r('CO-LAG', 'La Guajira', ['Guajira']),
  r('CO-MAG', 'Magdalena'),
  r('CO-MET', 'Meta'),
  r('CO-NAR', 'Nariño'),
  r('CO-NSA', 'Norte de Santander'),
  r('CO-PUT', 'Putumayo'),
  r('CO-QUI', 'Quindío'),
  r('CO-RIS', 'Risaralda'),
  r('CO-SAP', 'San Andrés y Providencia', ['Archipiélago de San Andrés, Providencia y Santa Catalina', 'San Andrés, Providencia y Santa Catalina']),
  r('CO-SAN', 'Santander'),
  r('CO-SUC', 'Sucre'),
  r('CO-TOL', 'Tolima'),
  r('CO-VAC', 'Valle del Cauca'),
  r('CO-VAU', 'Vaupés'),
  r('CO-VID', 'Vichada'),
];

/** 16 regiones. */
const REGIONES_CL: readonly Region[] = [
  r('CL-AP', 'Arica y Parinacota'),
  r('CL-TA', 'Tarapacá'),
  r('CL-AN', 'Antofagasta'),
  r('CL-AT', 'Atacama'),
  r('CL-CO', 'Coquimbo'),
  r('CL-VS', 'Valparaíso'),
  r('CL-RM', 'Metropolitana de Santiago', ['Región Metropolitana de Santiago', 'Región Metropolitana', 'Santiago', 'RM']),
  r('CL-LI', "Libertador General Bernardo O'Higgins", ["O'Higgins", 'OHiggins', "Región del Libertador General Bernardo O'Higgins"]),
  r('CL-ML', 'Maule'),
  r('CL-NB', 'Ñuble'),
  r('CL-BI', 'Biobío', ['Bío-Bío', 'Bio Bio', 'Región del Bío Bío']),
  r('CL-AR', 'La Araucanía', ['Araucanía']),
  r('CL-LR', 'Los Ríos'),
  r('CL-LL', 'Los Lagos'),
  r('CL-AI', 'Aysén', ['Aysén del General Carlos Ibáñez del Campo', 'Aisén']),
  r('CL-MA', 'Magallanes', ['Magallanes y de la Antártica Chilena', 'Magallanes y la Antártica Chilena'], 'America/Punta_Arenas'),
];

/** 32 entidades federativas. */
const REGIONES_MX: readonly Region[] = [
  r('MX-AGU', 'Aguascalientes'),
  r('MX-BCN', 'Baja California', [], 'America/Tijuana'),
  r('MX-BCS', 'Baja California Sur', [], 'America/Mazatlan'),
  r('MX-CAM', 'Campeche'),
  r('MX-CHP', 'Chiapas'),
  r('MX-CHH', 'Chihuahua', [], 'America/Chihuahua'),
  r('MX-CMX', 'Ciudad de México', ['CDMX', 'Mexico City', 'Distrito Federal', 'DF', 'Ciudad de Mexico']),
  r('MX-COA', 'Coahuila', ['Coahuila de Zaragoza']),
  r('MX-COL', 'Colima'),
  r('MX-DUR', 'Durango'),
  r('MX-GUA', 'Guanajuato'),
  r('MX-GRO', 'Guerrero'),
  r('MX-HID', 'Hidalgo'),
  r('MX-JAL', 'Jalisco'),
  r('MX-MEX', 'Estado de México', ['Edomex', 'Edo. de México', 'State of Mexico']),
  r('MX-MIC', 'Michoacán', ['Michoacán de Ocampo']),
  r('MX-MOR', 'Morelos'),
  r('MX-NAY', 'Nayarit', [], 'America/Mazatlan'),
  r('MX-NLE', 'Nuevo León'),
  r('MX-OAX', 'Oaxaca'),
  r('MX-PUE', 'Puebla'),
  r('MX-QUE', 'Querétaro', ['Querétaro de Arteaga']),
  r('MX-ROO', 'Quintana Roo', [], 'America/Cancun'),
  r('MX-SLP', 'San Luis Potosí'),
  r('MX-SIN', 'Sinaloa', [], 'America/Mazatlan'),
  r('MX-SON', 'Sonora', [], 'America/Hermosillo'),
  r('MX-TAB', 'Tabasco'),
  r('MX-TAM', 'Tamaulipas'),
  r('MX-TLA', 'Tlaxcala'),
  r('MX-VER', 'Veracruz', ['Veracruz de Ignacio de la Llave']),
  r('MX-YUC', 'Yucatán'),
  r('MX-ZAC', 'Zacatecas'),
];

export const PAISES: readonly Pais[] = [
  {
    codigo: 'ES',
    nombre: 'España',
    locale: 'es-ES',
    moneda: 'EUR',
    decimales: 2,
    monedasPermitidas: ['EUR'],
    etiquetaRegion: 'Comunidad autónoma',
    regiones: REGIONES_ES,
    regionCapital: 'madrid',
    zonaPorDefecto: 'Europe/Madrid',
    tiposIva: [21, 10, 4, 0],
    ivaPorDefecto: 21,
    etiquetaIdFiscal: 'NIF/CIF',
    patronIdFiscal: /^[A-Za-z0-9]{9}$/,
    digitosCodigoPostal: 5,
  },
  {
    codigo: 'CO',
    nombre: 'Colombia',
    locale: 'es-CO',
    moneda: 'COP',
    decimales: 0,
    monedasPermitidas: ['COP', 'USD'],
    etiquetaRegion: 'Departamento',
    regiones: REGIONES_CO,
    regionCapital: 'CO-DC',
    zonaPorDefecto: 'America/Bogota',
    tiposIva: [19, 5, 0],
    ivaPorDefecto: 19,
    etiquetaIdFiscal: 'NIT',
    patronIdFiscal: /^\d{8,10}(-\d)?$/,
    digitosCodigoPostal: 6,
  },
  {
    codigo: 'CL',
    nombre: 'Chile',
    locale: 'es-CL',
    moneda: 'CLP',
    decimales: 0,
    monedasPermitidas: ['CLP', 'USD'],
    etiquetaRegion: 'Región',
    regiones: REGIONES_CL,
    regionCapital: 'CL-RM',
    zonaPorDefecto: 'America/Santiago',
    tiposIva: [19, 0],
    ivaPorDefecto: 19,
    etiquetaIdFiscal: 'RUT',
    patronIdFiscal: /^\d{1,2}\.?\d{3}\.?\d{3}-?[\dkK]$/,
    digitosCodigoPostal: 7,
  },
  {
    codigo: 'MX',
    nombre: 'México',
    locale: 'es-MX',
    moneda: 'MXN',
    decimales: 2,
    monedasPermitidas: ['MXN', 'USD'],
    etiquetaRegion: 'Estado',
    regiones: REGIONES_MX,
    regionCapital: 'MX-CMX',
    zonaPorDefecto: 'America/Mexico_City',
    tiposIva: [16, 8, 0],
    ivaPorDefecto: 16,
    etiquetaIdFiscal: 'RFC',
    patronIdFiscal: /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i,
    digitosCodigoPostal: 5,
  },
];

export const CODIGOS_PAIS: readonly CodigoPais[] = PAISES.map((p) => p.codigo);

export function esCodigoPais(valor: unknown): valor is CodigoPais {
  return typeof valor === 'string' && PAISES.some((p) => p.codigo === valor);
}

export function paisPorCodigo(codigo: CodigoPais): Pais {
  return PAISES.find((p) => p.codigo === codigo)!;
}

/** País de una empresa; `'ES'` si falta (tolerancia previa al backfill). */
export function paisDeEmpresa(c: { pais?: unknown } | null | undefined): CodigoPais {
  return esCodigoPais(c?.pais) ? c.pais : 'ES';
}

/** Moneda de una empresa; la local de su país si falta. */
export function monedaDeEmpresa(c: { pais?: unknown; moneda?: unknown } | null | undefined): string {
  const m = c?.moneda;
  return typeof m === 'string' && m.length > 0 ? m : paisPorCodigo(paisDeEmpresa(c)).moneda;
}

/** Región de una empresa: `ca` en España, `region` en el resto. */
export function regionDeEmpresa(
  c: { pais?: unknown; ca?: unknown; region?: unknown } | null | undefined,
): string | undefined {
  const v = paisDeEmpresa(c) === 'ES' ? c?.ca : c?.region;
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

export function regionEnPais(pais: CodigoPais, region: unknown): boolean {
  return typeof region === 'string' && paisPorCodigo(pais).regiones.some((x) => x.codigo === region);
}

/** Zona sugerida: la de la región si tiene una propia; si no, la del país. */
export function zonaSugerida(pais: CodigoPais, region?: string | null): string {
  const p = paisPorCodigo(pais);
  return p.regiones.find((x) => x.codigo === region)?.zona ?? p.zonaPorDefecto;
}

export function decimalesMoneda(moneda: string): number {
  return PAISES.find((p) => p.moneda === moneda)?.decimales ?? 2;
}

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[.,'’`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const PREFIJOS_GENERICOS = /^(region|departamento|provincia) (de la|de los|de las|del|de) /;

/**
 * Código de región a partir del nombre que devuelve Google Places (`administrative_area_level_1`).
 * Sin acentos ni mayúsculas. `undefined` si no hay coincidencia: la región se elige a mano.
 */
export function regionDesdeNombre(pais: CodigoPais, texto: string | null | undefined): string | undefined {
  if (!texto) return undefined;
  const buscado = normalizar(texto);
  if (!buscado) return undefined;
  const regiones = paisPorCodigo(pais).regiones;
  const candidatos = [buscado, buscado.replace(PREFIJOS_GENERICOS, '')];
  for (const c of candidatos) {
    const hit = regiones.find(
      (x) => normalizar(x.codigo) === c || normalizar(x.nombre) === c || x.alias.some((a) => normalizar(a) === c),
    );
    if (hit) return hit.codigo;
  }
  return undefined;
}

const ZONAS_EXTRA: Record<string, CodigoPais> = {
  'Africa/Ceuta': 'ES',
  'Pacific/Easter': 'CL',
};

/** Plan B de la detección de país: a partir de la zona IANA del navegador. */
export function paisDesdeZona(zona: string | null | undefined): CodigoPais | undefined {
  if (!zona) return undefined;
  for (const p of PAISES) {
    if (p.zonaPorDefecto === zona || p.regiones.some((x) => x.zona === zona)) return p.codigo;
  }
  return ZONAS_EXTRA[zona];
}
