import { describe, it, expect } from 'vitest';
import { interpolarTexto, clavesFaltantes } from './interpolar-texto';

describe('interpolarTexto', () => {
  it('reemplaza variables sin escapar HTML', () => {
    expect(interpolarTexto('Hola {{nombre}}', { nombre: 'Ana & <Co>' })).toBe('Hola Ana & <Co>');
  });

  it('tolera espacios dentro de las llaves', () => {
    expect(interpolarTexto('Hola {{ nombre }}', { nombre: 'Ana' })).toBe('Hola Ana');
  });

  it('deja intactas las claves desconocidas', () => {
    expect(interpolarTexto('Hola {{nombre}}, caso {{caso}}', { nombre: 'Ana' })).toBe(
      'Hola Ana, caso {{caso}}',
    );
  });

  it('una clave presente pero vacía se sustituye por cadena vacía', () => {
    expect(interpolarTexto('Hola{{ x }}!', { x: '' })).toBe('Hola!');
  });

  it('reemplaza todas las apariciones y es repetible (regex global sin estado)', () => {
    const t = '{{a}}-{{a}}';
    expect(interpolarTexto(t, { a: '1' })).toBe('1-1');
    expect(interpolarTexto(t, { a: '2' })).toBe('2-2');
  });

  it('no interpreta $ especiales del valor', () => {
    expect(interpolarTexto('{{a}}', { a: '$& $1' })).toBe('$& $1');
  });
});

describe('clavesFaltantes', () => {
  it('lista claves sin valor, sin duplicados y en orden de aparición', () => {
    expect(clavesFaltantes('{{a}} {{b}} {{a}} {{c}}', { a: 'x', c: '' })).toEqual(['b', 'c']);
  });

  it('devuelve vacío si todo está resuelto', () => {
    expect(clavesFaltantes('{{a}}', { a: 'x' })).toEqual([]);
  });

  it('combina varias plantillas con un solo contexto', () => {
    expect(clavesFaltantes(['{{a}}', '{{b}}'], { a: 'x' })).toEqual(['b']);
  });
});
