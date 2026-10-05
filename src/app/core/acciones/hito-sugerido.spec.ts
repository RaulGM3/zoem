import { describe, it, expect } from 'vitest';
import { hitoSugerido } from './hito-sugerido';
import type { Hito } from '../../interfaces/caso.interface';

const h = (id: string, orden: number, estado: Hito['estado']) => ({ id, orden, estado });

describe('hitoSugerido', () => {
  it('devuelve null sin hitos', () => {
    expect(hitoSugerido([])).toBeNull();
  });
  it('último completado por orden', () => {
    const hitos = [h('c', 3, 'completado'), h('a', 1, 'completado'), h('b', 2, 'pendiente')];
    expect(hitoSugerido(hitos)?.id).toBe('c');
  });
  it('si no hay completados, primer no completado por orden', () => {
    const hitos = [h('b', 2, 'pendiente'), h('a', 1, 'en_progreso')];
    expect(hitoSugerido(hitos)?.id).toBe('a');
  });
  it('ignora cancelados en el fallback', () => {
    const hitos = [h('a', 1, 'cancelado'), h('b', 2, 'pendiente')];
    expect(hitoSugerido(hitos)?.id).toBe('b');
  });
  it('si todo está cancelado devuelve null', () => {
    expect(hitoSugerido([h('a', 1, 'cancelado')])).toBeNull();
  });
  it('no muta la entrada', () => {
    const hitos = [h('b', 2, 'completado'), h('a', 1, 'completado')];
    hitoSugerido(hitos);
    expect(hitos[0].id).toBe('b');
  });
});
