import { describe, expect, it } from 'vitest';
import { autorizadoParaAutoservicio, generarSlug, validarAlta, validarAltaDemo } from './validar';

const valida = { nombre: '  García & Asociados ', tipoPersona: 'juridica', pais: 'ES', region: 'madrid', moneda: 'EUR' };
const colombia = { nombre: 'Pérez Abogados', tipoPersona: 'fisica', pais: 'CO', region: 'CO-ANT', moneda: 'COP' };

describe('validarAlta', () => {
  it('normaliza nombre y aplica rubro por defecto', () => {
    const r = validarAlta(valida);
    expect(r).toEqual({
      ok: true,
      valor: { nombre: 'García & Asociados', tipoPersona: 'juridica', pais: 'ES', region: 'madrid', moneda: 'EUR', rubro: 'abogados', zonaHoraria: 'Europe/Madrid' },
    });
  });

  it('un cliente anterior (sin pais ni moneda, con `ca`) sigue valiendo como España/EUR', () => {
    const r = validarAlta({ nombre: 'García', tipoPersona: 'fisica', ca: 'madrid' });
    expect(r.ok && [r.valor.pais, r.valor.moneda, r.valor.region]).toEqual(['ES', 'EUR', 'madrid']);
  });

  it('Colombia: región ISO del país, moneda local o USD, zona por defecto del país', () => {
    const r = validarAlta(colombia);
    expect(r).toEqual({
      ok: true,
      valor: { nombre: 'Pérez Abogados', tipoPersona: 'fisica', pais: 'CO', region: 'CO-ANT', moneda: 'COP', rubro: 'abogados', zonaHoraria: 'America/Bogota' },
    });
    const usd = validarAlta({ ...colombia, moneda: 'USD' });
    expect(usd.ok && usd.valor.moneda).toBe('USD');
  });

  it('moneda ausente: la local del país', () => {
    const { moneda: _m, ...sin } = colombia;
    const r = validarAlta(sin);
    expect(r.ok && r.valor.moneda).toBe('COP');
  });

  it('ciudad opcional (se recorta) y ubicación con forma válida', () => {
    const r = validarAlta({ ...colombia, ciudad: '  Medellín ', ubicacion: { placeId: 'ChIJabc', lat: 6.24, lng: -75.58 } });
    expect(r.ok && r.valor.ciudad).toBe('Medellín');
    expect(r.ok && r.valor.ubicacion).toEqual({ placeId: 'ChIJabc', lat: 6.24, lng: -75.58 });
    const vacia = validarAlta({ ...colombia, ciudad: '', ubicacion: null });
    expect(vacia.ok && vacia.valor.ciudad).toBeUndefined();
    expect(vacia.ok && vacia.valor.ubicacion).toBeUndefined();
  });

  it('zonaHoraria: usa la indicada si es IANA válida, Europe/Madrid si falta', () => {
    const r = validarAlta({ ...valida, zonaHoraria: 'America/Bogota' });
    expect(r.ok && r.valor.zonaHoraria).toBe('America/Bogota');
    const sin = validarAlta({ ...valida, zonaHoraria: '' });
    expect(sin.ok && sin.valor.zonaHoraria).toBe('Europe/Madrid');
    const nula = validarAlta({ ...valida, zonaHoraria: null });
    expect(nula.ok && nula.valor.zonaHoraria).toBe('Europe/Madrid');
  });

  it('acepta la lista completa de especialidades del asistente', () => {
    const todas = 'Civil, Penal, Laboral, Mercantil, Familia, Administrativo, Fiscal, Sucesiones, Seguros';
    const r = validarAlta({ ...valida, especialidad: todas });
    expect(r.ok && r.valor.especialidad).toBe(todas);
  });

  it('acepta especialidad libre y la recorta', () => {
    const r = validarAlta({ ...valida, especialidad: '  Civil ' });
    expect(r.ok && r.valor.especialidad).toBe('Civil');
  });

  it.each([
    [{ ...valida, nombre: '' }, 'nombre'],
    [{ ...valida, nombre: 'a' }, 'nombre'],
    [{ ...valida, nombre: 'x'.repeat(121) }, 'nombre'],
    [{ ...valida, tipoPersona: 'otra' }, 'tipoPersona'],
    [{ ...valida, region: 'narnia' }, 'region'],
    [{ ...valida, region: undefined }, 'region'],
    [{ ...valida, pais: 'AR', region: 'madrid' }, 'pais'],
    [{ ...valida, pais: 'co' }, 'pais'],
    [{ ...colombia, region: 'MX-JAL' }, 'region'],
    [{ ...colombia, region: 'madrid' }, 'region'],
    [{ ...colombia, moneda: 'EUR' }, 'moneda'],
    [{ ...valida, moneda: 'USD' }, 'moneda'],
    [{ ...colombia, moneda: 42 }, 'moneda'],
    [{ ...colombia, ciudad: 'x'.repeat(121) }, 'ciudad'],
    [{ ...colombia, ciudad: 7 }, 'ciudad'],
    [{ ...colombia, ubicacion: 'x' }, 'ubicacion'],
    [{ ...colombia, ubicacion: { placeId: '', lat: 1, lng: 1 } }, 'ubicacion'],
    [{ ...colombia, ubicacion: { placeId: 'a', lat: 91, lng: 1 } }, 'ubicacion'],
    [{ ...colombia, ubicacion: { placeId: 'a', lat: 1, lng: 181 } }, 'ubicacion'],
    [{ ...colombia, ubicacion: { placeId: 'a', lat: '1', lng: 1 } }, 'ubicacion'],
    [{ ...colombia, ubicacion: { placeId: 'a', lat: NaN, lng: 1 } }, 'ubicacion'],
    [{ ...valida, especialidad: 'x'.repeat(121) }, 'especialidad'],
    [{ ...valida, zonaHoraria: 'Mars/Olympus' }, 'zonaHoraria'],
    [{ ...valida, zonaHoraria: '+01:00' }, 'zonaHoraria'],
    [{ ...valida, zonaHoraria: 42 }, 'zonaHoraria'],
    [null, 'nombre'],
    ['texto', 'nombre'],
  ])('rechaza %j por %s', (data, campo) => {
    const r = validarAlta(data);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.campos).toContain(campo);
  });
});

describe('validarAltaDemo', () => {
  it('solo exige un nombre de despacho (España/EUR por defecto)', () => {
    expect(validarAltaDemo({ nombre: ' Mi Despacho ' })).toEqual({
      ok: true,
      valor: { nombre: 'Mi Despacho', pais: 'ES', moneda: 'EUR', zonaHoraria: 'Europe/Madrid' },
    });
    expect(validarAltaDemo({ nombre: '' }).ok).toBe(false);
  });
  it('toma país y moneda del usuario; sin zona usa la del país', () => {
    expect(validarAltaDemo({ nombre: 'Demo', pais: 'MX', moneda: 'USD' })).toEqual({
      ok: true,
      valor: { nombre: 'Demo', pais: 'MX', moneda: 'USD', zonaHoraria: 'America/Mexico_City' },
    });
    const r = validarAltaDemo({ nombre: 'Demo', pais: 'CL', zonaHoraria: 'America/Punta_Arenas' });
    expect(r.ok && [r.valor.moneda, r.valor.zonaHoraria]).toEqual(['CLP', 'America/Punta_Arenas']);
  });
  it('rechaza país o moneda no permitidos', () => {
    expect(validarAltaDemo({ nombre: 'Demo', pais: 'AR' })).toEqual({ ok: false, campos: ['pais'] });
    expect(validarAltaDemo({ nombre: 'Demo', pais: 'CO', moneda: 'EUR' })).toEqual({ ok: false, campos: ['moneda'] });
  });
  it('acepta zonaHoraria opcional y rechaza una inválida', () => {
    const r = validarAltaDemo({ nombre: 'Demo', zonaHoraria: 'America/Lima' });
    expect(r.ok && r.valor.zonaHoraria).toBe('America/Lima');
    expect(validarAltaDemo({ nombre: 'Demo', zonaHoraria: 'nope' }).ok).toBe(false);
  });
});

describe('autorizadoParaAutoservicio', () => {
  it('permite email verificado', () => {
    expect(autorizadoParaAutoservicio({ email_verified: true, firebase: { sign_in_provider: 'password' } })).toBe(true);
  });
  it('permite Google aunque email_verified falte', () => {
    expect(autorizadoParaAutoservicio({ firebase: { sign_in_provider: 'google.com' } })).toBe(true);
  });
  it('rechaza email sin verificar con password', () => {
    expect(autorizadoParaAutoservicio({ email_verified: false, firebase: { sign_in_provider: 'password' } })).toBe(false);
  });
  it('rechaza token ausente o anónimo', () => {
    expect(autorizadoParaAutoservicio(undefined)).toBe(false);
    expect(autorizadoParaAutoservicio({ firebase: { sign_in_provider: 'anonymous' } })).toBe(false);
  });
});

describe('generarSlug', () => {
  it('quita tildes, símbolos y espacios y añade el sufijo', () => {
    expect(generarSlug('García & Asociados, S.L.', 'ab12')).toBe('garcia-asociados-s-l-ab12');
  });
  it('limita la longitud de la base', () => {
    const s = generarSlug('a'.repeat(200), 'zz');
    expect(s.length).toBeLessThanOrEqual(43);
    expect(s.endsWith('-zz')).toBe(true);
  });
  it('usa "despacho" si no queda nada', () => {
    expect(generarSlug('???', 'q1')).toBe('despacho-q1');
  });
});
