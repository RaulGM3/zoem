import { describe, it, expect } from 'vitest';
import { prefillVariables } from './prefill-variables';

describe('prefillVariables', () => {
  const ctx = { cliente: 'Ana Ruiz', caso: 'Divorcio', hoy: '2026-10-05', vacio: '' };

  it('empareja por clave', () => {
    expect(prefillVariables([{ key: 'cliente', label: 'X' }], ctx)).toEqual({ cliente: 'Ana Ruiz' });
  });
  it('empareja por etiqueta, sin distinguir mayúsculas', () => {
    expect(prefillVariables([{ key: 'v1', label: 'Nombre del CASO' }], ctx)).toEqual({ v1: 'Divorcio' });
  });
  it('coincidencia laxa: la clave de la variable contiene el token', () => {
    expect(prefillVariables([{ key: 'nombre_cliente' }], ctx)).toEqual({ nombre_cliente: 'Ana Ruiz' });
  });
  it('ignora valores vacíos del contexto', () => {
    expect(prefillVariables([{ key: 'vacio' }], ctx)).toEqual({});
  });
  it('la primera coincidencia del contexto gana', () => {
    expect(prefillVariables([{ key: 'cliente_caso' }], ctx)).toEqual({ cliente_caso: 'Ana Ruiz' });
  });
  it('variables sin coincidencia no aparecen', () => {
    expect(prefillVariables([{ key: 'zzz' }], ctx)).toEqual({});
  });
});
