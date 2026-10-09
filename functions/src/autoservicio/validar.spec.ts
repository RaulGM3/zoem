import { describe, expect, it } from 'vitest';
import { autorizadoParaAutoservicio, generarSlug, validarAlta, validarAltaDemo } from './validar';

const valida = { nombre: '  García & Asociados ', tipoPersona: 'juridica', ca: 'madrid' };

describe('validarAlta', () => {
  it('normaliza nombre y aplica rubro por defecto', () => {
    const r = validarAlta(valida);
    expect(r).toEqual({ ok: true, valor: { nombre: 'García & Asociados', tipoPersona: 'juridica', ca: 'madrid', rubro: 'abogados', zonaHoraria: 'Europe/Madrid' } });
  });

  it('zonaHoraria: usa la indicada si es IANA válida, Europe/Madrid si falta', () => {
    const r = validarAlta({ ...valida, zonaHoraria: 'America/Bogota' });
    expect(r.ok && r.valor.zonaHoraria).toBe('America/Bogota');
    const sin = validarAlta({ ...valida, zonaHoraria: '' });
    expect(sin.ok && sin.valor.zonaHoraria).toBe('Europe/Madrid');
    const nula = validarAlta({ ...valida, zonaHoraria: null });
    expect(nula.ok && nula.valor.zonaHoraria).toBe('Europe/Madrid');
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
    [{ ...valida, ca: 'narnia' }, 'ca'],
    [{ ...valida, especialidad: 'x'.repeat(81) }, 'especialidad'],
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
  it('solo exige un nombre de despacho', () => {
    expect(validarAltaDemo({ nombre: ' Mi Despacho ' })).toEqual({ ok: true, valor: { nombre: 'Mi Despacho', zonaHoraria: 'Europe/Madrid' } });
    expect(validarAltaDemo({ nombre: '' }).ok).toBe(false);
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
