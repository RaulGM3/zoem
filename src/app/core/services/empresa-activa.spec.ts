import { describe, expect, it } from 'vitest';
import { elegirEmpresaInicial } from './empresa-activa';

const ms = [{ companyId: 'a' }, { companyId: 'b' }];

describe('elegirEmpresaInicial', () => {
  it('respeta la empresa guardada si sigue siendo membresía', () => {
    expect(elegirEmpresaInicial(ms, 'b')).toBe('b');
  });
  it('si la guardada ya no es membresía, usa la primera', () => {
    expect(elegirEmpresaInicial(ms, 'zzz')).toBe('a');
  });
  it('sin guardada usa la primera', () => {
    expect(elegirEmpresaInicial(ms, null)).toBe('a');
  });
  it('sin membresías devuelve null', () => {
    expect(elegirEmpresaInicial([], 'a')).toBeNull();
  });
});
