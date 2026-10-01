import { describe, it, expect } from 'vitest';
import { normalizarNif, validarNif } from './nif';

// Los caracteres de control se calculan AQUÍ con el algoritmo oficial (no se pegan a mano):
// así el test no depende de números que no podamos verificar.
const LETRAS_DNI = 'TRWAGMYFPDXBNJZSQVHLCKE';
const LETRAS_CONTROL_ENTIDAD = 'JABCDEFGHI';

function letraDni(n: number): string {
  return LETRAS_DNI[n % 23];
}

function controlEntidad(digitos: string): { digito: string; letra: string } {
  const d = digitos.split('').map(Number);
  const pares = d[1] + d[3] + d[5];
  const impares = [d[0], d[2], d[4], d[6]].reduce((acc, x) => {
    const doble = 2 * x;
    return acc + Math.floor(doble / 10) + (doble % 10);
  }, 0);
  const c = (10 - ((pares + impares) % 10)) % 10;
  return { digito: String(c), letra: LETRAS_CONTROL_ENTIDAD[c] };
}

function otraLetraDni(correcta: string): string {
  return correcta === 'A' ? 'B' : 'A';
}

describe('normalizarNif', () => {
  it('pasa a mayúsculas y quita espacios, guiones, puntos y barras', () => {
    expect(normalizarNif(' 12.345.678-z ')).toBe('12345678Z');
    expect(normalizarNif('b 12/345-674')).toBe('B12345674');
  });

  it('quita el prefijo ES cuando quedan 9 caracteres', () => {
    expect(normalizarNif('ES12345678Z')).toBe('12345678Z');
    expect(normalizarNif('es-B12345674')).toBe('B12345674');
  });

  it('no quita ES si no deja 9 caracteres', () => {
    expect(normalizarNif('ESX')).toBe('ESX');
    expect(normalizarNif('ES1234')).toBe('ES1234');
  });
});

describe('validarNif', () => {
  it('S1.1 DNI con la letra calculada es válido (12345678 -> Z)', () => {
    expect(letraDni(12345678)).toBe('Z');
    expect(validarNif(`12345678${letraDni(12345678)}`)).toEqual({ ok: true, clase: 'dni', valor: '12345678Z' });
    expect(validarNif('00000000T')).toEqual({ ok: true, clase: 'dni', valor: '00000000T' });
  });

  it('S1.2 DNI con otra letra -> control', () => {
    const mala = otraLetraDni(letraDni(12345678));
    expect(validarNif(`12345678${mala}`)).toEqual({ ok: false, motivo: 'control' });
    const mala2 = otraLetraDni(letraDni(87654321));
    expect(validarNif(`87654321${mala2}`)).toEqual({ ok: false, motivo: 'control' });
  });

  it('S1.3 normaliza antes de validar', () => {
    const r = validarNif(' 12.345.678-z ');
    expect(r).toEqual({ ok: true, clase: 'dni', valor: '12345678Z' });
  });

  it('S1.4 NIE X, Y y Z con la letra calculada son válidos', () => {
    const casos: [string, number][] = [
      ['X', 0],
      ['Y', 1],
      ['Z', 2],
    ];
    for (const [pref, n] of casos) {
      const cuerpo = '1234567';
      const letra = letraDni(Number(`${n}${cuerpo}`));
      expect(validarNif(`${pref}${cuerpo}${letra}`)).toEqual({ ok: true, clase: 'nie', valor: `${pref}${cuerpo}${letra}` });
      expect(validarNif(`${pref}${cuerpo}${otraLetraDni(letra)}`)).toEqual({ ok: false, motivo: 'control' });
    }
  });

  it('S1.5 entidad: control calculado con la fórmula', () => {
    // B (A,B,E,H: solo dígito)
    const b = controlEntidad('1234567');
    expect(validarNif(`B1234567${b.digito}`)).toEqual({ ok: true, clase: 'entidad', valor: `B1234567${b.digito}` });
    expect(validarNif(`B1234567${b.letra}`)).toEqual({ ok: false, motivo: 'control' });
    // Q y P (letra obligatoria)
    const q = controlEntidad('7654321');
    expect(validarNif(`Q7654321${q.letra}`)).toEqual({ ok: true, clase: 'entidad', valor: `Q7654321${q.letra}` });
    expect(validarNif(`Q7654321${q.digito}`)).toEqual({ ok: false, motivo: 'control' });
    const p = controlEntidad('2810001');
    expect(validarNif(`P2810001${p.letra}`)).toEqual({ ok: true, clase: 'entidad', valor: `P2810001${p.letra}` });
    // C: admite ambas formas
    const c = controlEntidad('5555555');
    expect(validarNif(`C5555555${c.digito}`)).toMatchObject({ ok: true, clase: 'entidad' });
    expect(validarNif(`C5555555${c.letra}`)).toMatchObject({ ok: true, clase: 'entidad' });
    // control equivocado
    const malo = String((Number(b.digito) + 1) % 10);
    expect(validarNif(`B1234567${malo}`)).toEqual({ ok: false, motivo: 'control' });
  });

  it('S1.6 prefijo ES + NIF válido -> ok sin prefijo', () => {
    const b = controlEntidad('1234567');
    expect(validarNif(`ES B1234567${b.digito}`)).toEqual({ ok: true, clase: 'entidad', valor: `B1234567${b.digito}` });
    expect(validarNif('ES12345678Z')).toEqual({ ok: true, clase: 'dni', valor: '12345678Z' });
  });

  it('S1.7 vacío y formato', () => {
    expect(validarNif('')).toEqual({ ok: false, motivo: 'vacio' });
    expect(validarNif('   ')).toEqual({ ok: false, motivo: 'vacio' });
    expect(validarNif('ABC')).toEqual({ ok: false, motivo: 'formato' });
    expect(validarNif('1234567Z')).toEqual({ ok: false, motivo: 'formato' });
    expect(validarNif('PAA123456')).toEqual({ ok: false, motivo: 'formato' });
  });

  it('S1.8 NIF especial K/L/M: letra sobre los 7 dígitos', () => {
    for (const pref of ['K', 'L', 'M']) {
      const letra = letraDni(1234567);
      expect(validarNif(`${pref}1234567${letra}`)).toEqual({ ok: true, clase: 'nif-especial', valor: `${pref}1234567${letra}` });
      expect(validarNif(`${pref}1234567${otraLetraDni(letra)}`)).toEqual({ ok: false, motivo: 'control' });
    }
  });
});
