import { describe, expect, it } from 'vitest';
import { CA_LABELS } from '../../interfaces/company';
import { esZonaValida } from '../planes/periodo';
import {
  PAISES,
  decimalesMoneda,
  esCodigoPais,
  monedaDeEmpresa,
  paisDeEmpresa,
  paisDesdeZona,
  paisPorCodigo,
  regionDeEmpresa,
  regionDesdeNombre,
  regionEnPais,
  zonaSugerida,
} from './catalogo-paises';

describe('PAISES', () => {
  it('tiene ES, CO, CL y MX con su moneda y decimales', () => {
    expect(PAISES.map((p) => [p.codigo, p.moneda, p.decimales])).toEqual([
      ['ES', 'EUR', 2], ['CO', 'COP', 0], ['CL', 'CLP', 0], ['MX', 'MXN', 2],
    ]);
  });

  it('cuenta las regiones: ES 19, CO 33 (con Bogotá D.C.), CL 16, MX 32 (con CDMX)', () => {
    expect(paisPorCodigo('ES').regiones).toHaveLength(19);
    expect(paisPorCodigo('CO').regiones).toHaveLength(33);
    expect(paisPorCodigo('CO').regiones.some((x) => x.codigo === 'CO-DC')).toBe(true);
    expect(paisPorCodigo('CL').regiones).toHaveLength(16);
    expect(paisPorCodigo('MX').regiones).toHaveLength(32);
    expect(paisPorCodigo('MX').regiones.some((x) => x.codigo === 'MX-CMX')).toBe(true);
  });

  it('las regiones de España son exactamente los slugs y nombres de CA_LABELS', () => {
    const es = Object.fromEntries(paisPorCodigo('ES').regiones.map((x) => [x.codigo, x.nombre]));
    expect(es).toEqual(CA_LABELS);
  });

  it('códigos de región únicos, con prefijo ISO fuera de España, y todas las zonas válidas', () => {
    for (const p of PAISES) {
      const codigos = p.regiones.map((x) => x.codigo);
      expect(new Set(codigos).size, p.codigo).toBe(codigos.length);
      if (p.codigo !== 'ES') for (const c of codigos) expect(c.startsWith(`${p.codigo}-`), c).toBe(true);
      expect(codigos).toContain(p.regionCapital);
      expect(esZonaValida(p.zonaPorDefecto), p.zonaPorDefecto).toBe(true);
      for (const x of p.regiones) if (x.zona) expect(esZonaValida(x.zona), x.zona).toBe(true);
    }
  });

  it('la moneda local va primero y fuera de España se permite USD', () => {
    expect(paisPorCodigo('ES').monedasPermitidas).toEqual(['EUR']);
    expect(paisPorCodigo('CO').monedasPermitidas).toEqual(['COP', 'USD']);
    for (const p of PAISES) expect(p.monedasPermitidas[0]).toBe(p.moneda);
  });

  it('etiquetas de región, id fiscal e IVA por país', () => {
    expect(PAISES.map((p) => [p.etiquetaRegion, p.etiquetaIdFiscal])).toEqual([
      ['Comunidad autónoma', 'NIF/CIF'], ['Departamento', 'NIT'], ['Región', 'RUT'], ['Estado', 'RFC'],
    ]);
    expect(paisPorCodigo('ES').tiposIva).toEqual([21, 10, 4, 0]);
    expect(paisPorCodigo('MX').tiposIva).toEqual([16, 8, 0]);
    expect(paisPorCodigo('CO').tiposIva).toEqual([19, 5, 0]);
    expect(paisPorCodigo('CL').tiposIva).toEqual([19, 0]);
    for (const p of PAISES) expect(p.tiposIva).toContain(p.ivaPorDefecto);
  });
});

describe('esCodigoPais', () => {
  it('solo los del catálogo', () => {
    expect(esCodigoPais('CO')).toBe(true);
    expect(esCodigoPais('AR')).toBe(false);
    expect(esCodigoPais('co')).toBe(false);
    expect(esCodigoPais(undefined)).toBe(false);
  });
});

describe('empresa sin migrar', () => {
  it('paisDeEmpresa: ES si falta o es desconocido', () => {
    expect(paisDeEmpresa({})).toBe('ES');
    expect(paisDeEmpresa(undefined)).toBe('ES');
    expect(paisDeEmpresa({ pais: 'XX' })).toBe('ES');
    expect(paisDeEmpresa({ pais: 'MX' })).toBe('MX');
  });
  it('monedaDeEmpresa: la guardada o la local del país', () => {
    expect(monedaDeEmpresa({})).toBe('EUR');
    expect(monedaDeEmpresa({ pais: 'CO' })).toBe('COP');
    expect(monedaDeEmpresa({ pais: 'CO', moneda: 'USD' })).toBe('USD');
    expect(monedaDeEmpresa({ pais: 'CO', moneda: '' })).toBe('COP');
  });
  it('regionDeEmpresa: ca en España, region en el resto', () => {
    expect(regionDeEmpresa({ ca: 'madrid' })).toBe('madrid');
    expect(regionDeEmpresa({ pais: 'ES', ca: 'cataluna', region: 'x' })).toBe('cataluna');
    expect(regionDeEmpresa({ pais: 'CO', region: 'CO-ANT', ca: 'madrid' })).toBe('CO-ANT');
    expect(regionDeEmpresa({ pais: 'CO' })).toBeUndefined();
  });
});

describe('zonaSugerida', () => {
  it('la del país, salvo que la región tenga la suya', () => {
    expect(zonaSugerida('CO', 'CO-ANT')).toBe('America/Bogota');
    expect(zonaSugerida('CO')).toBe('America/Bogota');
    expect(zonaSugerida('ES', 'canarias')).toBe('Atlantic/Canary');
    expect(zonaSugerida('ES', 'madrid')).toBe('Europe/Madrid');
    expect(zonaSugerida('CL', 'CL-MA')).toBe('America/Punta_Arenas');
    expect(zonaSugerida('MX', 'MX-ROO')).toBe('America/Cancun');
    expect(zonaSugerida('MX', 'MX-BCN')).toBe('America/Tijuana');
    expect(zonaSugerida('MX', 'MX-SON')).toBe('America/Hermosillo');
    expect(zonaSugerida('MX', 'MX-CHH')).toBe('America/Chihuahua');
    for (const c of ['MX-BCS', 'MX-SIN', 'MX-NAY']) expect(zonaSugerida('MX', c)).toBe('America/Mazatlan');
    expect(zonaSugerida('MX', 'MX-JAL')).toBe('America/Mexico_City');
    expect(zonaSugerida('MX', 'CO-ANT')).toBe('America/Mexico_City');
  });
});

describe('regionDesdeNombre', () => {
  it.each([
    ['ES', 'Comunidad de Madrid', 'madrid'],
    ['ES', 'Catalunya', 'cataluna'],
    ['ES', 'Cataluña', 'cataluna'],
    ['ES', 'Comunitat Valenciana', 'valencia'],
    ['ES', 'Euskadi', 'pais_vasco'],
    ['ES', 'Principado de Asturias', 'asturias'],
    ['ES', 'Illes Balears', 'baleares'],
    ['CO', 'Bogotá', 'CO-DC'],
    ['CO', 'Bogotá D.C.', 'CO-DC'],
    ['CO', 'BOGOTA', 'CO-DC'],
    ['CO', 'Antioquia', 'CO-ANT'],
    ['CO', 'Departamento de Antioquia', 'CO-ANT'],
    ['CO', 'Archipiélago de San Andrés, Providencia y Santa Catalina', 'CO-SAP'],
    ['CL', 'Región Metropolitana de Santiago', 'CL-RM'],
    ['CL', 'Región de Valparaíso', 'CL-VS'],
    ['CL', 'Región del Biobío', 'CL-BI'],
    ['CL', 'Región de Ñuble', 'CL-NB'],
    ['CL', "Región del Libertador General Bernardo O'Higgins", 'CL-LI'],
    ['CL', 'Región de Magallanes y de la Antártica Chilena', 'CL-MA'],
    ['MX', 'Ciudad de México', 'MX-CMX'],
    ['MX', 'CDMX', 'MX-CMX'],
    ['MX', 'Estado de México', 'MX-MEX'],
    ['MX', 'Jalisco', 'MX-JAL'],
    ['MX', 'Nuevo León', 'MX-NLE'],
    ['MX', 'Coahuila de Zaragoza', 'MX-COA'],
    ['MX', 'Yucatán', 'MX-YUC'],
  ] as const)('%s: "%s" -> %s', (pais, texto, esperado) => {
    expect(regionDesdeNombre(pais, texto)).toBe(esperado);
  });

  it('undefined si no hay coincidencia, es de otro país o está vacío', () => {
    expect(regionDesdeNombre('CO', 'Narnia')).toBeUndefined();
    expect(regionDesdeNombre('CO', 'Jalisco')).toBeUndefined();
    expect(regionDesdeNombre('CO', '')).toBeUndefined();
    expect(regionDesdeNombre('CO', null)).toBeUndefined();
  });

  it('todo nombre y alias del catálogo resuelve a su propia región', () => {
    for (const p of PAISES) {
      for (const x of p.regiones) {
        for (const t of [x.nombre, ...x.alias]) expect(regionDesdeNombre(p.codigo, t), `${p.codigo} ${t}`).toBe(x.codigo);
      }
    }
  });
});

describe('regionEnPais', () => {
  it('comprueba pertenencia', () => {
    expect(regionEnPais('CO', 'CO-ANT')).toBe(true);
    expect(regionEnPais('CO', 'MX-JAL')).toBe(false);
    expect(regionEnPais('ES', 'madrid')).toBe(true);
    expect(regionEnPais('ES', 5)).toBe(false);
  });
});

describe('paisDesdeZona', () => {
  it('deduce el país de la zona del navegador', () => {
    expect(paisDesdeZona('Europe/Madrid')).toBe('ES');
    expect(paisDesdeZona('Atlantic/Canary')).toBe('ES');
    expect(paisDesdeZona('America/Bogota')).toBe('CO');
    expect(paisDesdeZona('America/Santiago')).toBe('CL');
    expect(paisDesdeZona('America/Punta_Arenas')).toBe('CL');
    expect(paisDesdeZona('America/Mexico_City')).toBe('MX');
    expect(paisDesdeZona('America/Cancun')).toBe('MX');
    expect(paisDesdeZona('America/Tijuana')).toBe('MX');
  });
  it('undefined si no es de un país soportado', () => {
    expect(paisDesdeZona('America/Lima')).toBeUndefined();
    expect(paisDesdeZona('')).toBeUndefined();
    expect(paisDesdeZona(undefined)).toBeUndefined();
  });
});

describe('decimalesMoneda', () => {
  it('COP y CLP sin decimales; el resto 2', () => {
    expect(decimalesMoneda('COP')).toBe(0);
    expect(decimalesMoneda('CLP')).toBe(0);
    expect(decimalesMoneda('USD')).toBe(2);
    expect(decimalesMoneda('EUR')).toBe(2);
  });
});
