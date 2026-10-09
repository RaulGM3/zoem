import { describe, expect, it } from 'vitest';
import { claveDia, debeMostrarAvisoPrueba } from './aviso-prueba';

const base = { enPrueba: true, dias: 3, descartadoEl: null as string | null, hoy: '2026-10-09' };

describe('debeMostrarAvisoPrueba', () => {
  it('se muestra en prueba con 3 días o menos', () => {
    expect(debeMostrarAvisoPrueba(base)).toBe(true);
    expect(debeMostrarAvisoPrueba({ ...base, dias: 1 })).toBe(true);
  });
  it('no se muestra con más de 3 días', () => {
    expect(debeMostrarAvisoPrueba({ ...base, dias: 4 })).toBe(false);
  });
  it('no se muestra fuera de la prueba', () => {
    expect(debeMostrarAvisoPrueba({ ...base, enPrueba: false })).toBe(false);
  });
  it('descartado hoy: oculto; descartado otro día: vuelve a salir', () => {
    expect(debeMostrarAvisoPrueba({ ...base, descartadoEl: '2026-10-09' })).toBe(false);
    expect(debeMostrarAvisoPrueba({ ...base, descartadoEl: '2026-10-08' })).toBe(true);
  });
});

describe('claveDia', () => {
  it('formatea yyyy-mm-dd en hora local', () => {
    expect(claveDia(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });
});
