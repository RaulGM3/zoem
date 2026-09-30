import { describe, it, expect } from 'vitest';
import { movTipoStyle } from './mov-tipo-style';

describe('movTipoStyle', () => {
  it('asigna a cada tipo de movimiento su color semántico', () => {
    expect(movTipoStyle('ingreso').color).toBe('var(--success)');
    expect(movTipoStyle('suplido').color).toBe('var(--warning)');
    expect(movTipoStyle('honorario').color).toBe('var(--accent-ia)');
    expect(movTipoStyle('gasto').color).toBe('var(--danger)');
  });

  it('el fondo es el mismo color atenuado', () => {
    expect(movTipoStyle('gasto').background).toBe('color-mix(in srgb,var(--danger) 12%,transparent)');
  });

  it('los tipos neutros usan la superficie secundaria', () => {
    expect(movTipoStyle('otro')).toEqual({ background: 'var(--surface-2)', color: 'var(--text-muted)' });
    expect(movTipoStyle('ajuste')).toEqual(movTipoStyle('otro'));
  });
});
