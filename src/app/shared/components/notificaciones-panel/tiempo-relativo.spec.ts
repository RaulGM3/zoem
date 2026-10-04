import { describe, it, expect } from 'vitest';
import { tiempoRelativo } from './tiempo-relativo';

const NOW = new Date('2026-10-04T12:00:00Z');
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const MIN = 60_000;
const H = 60 * MIN;
const D = 24 * H;

describe('tiempoRelativo', () => {
  it('returns empty string for null', () => {
    expect(tiempoRelativo(null, NOW)).toBe('');
  });

  it('under a minute -> "ahora"', () => {
    expect(tiempoRelativo(ago(30_000), NOW)).toBe('ahora');
  });

  it('future dates (clock skew) -> "ahora"', () => {
    expect(tiempoRelativo(new Date(NOW.getTime() + 5 * MIN), NOW)).toBe('ahora');
  });

  it('minutes', () => {
    expect(tiempoRelativo(ago(MIN), NOW)).toBe('hace 1 min');
    expect(tiempoRelativo(ago(59 * MIN), NOW)).toBe('hace 59 min');
  });

  it('hours', () => {
    expect(tiempoRelativo(ago(H), NOW)).toBe('hace 1 h');
    expect(tiempoRelativo(ago(23 * H), NOW)).toBe('hace 23 h');
  });

  it('days up to 6', () => {
    expect(tiempoRelativo(ago(D), NOW)).toBe('hace 1 d');
    expect(tiempoRelativo(ago(6 * D), NOW)).toBe('hace 6 d');
  });

  it('a week or more -> dd/MM/yyyy', () => {
    expect(tiempoRelativo(new Date('2026-09-20T10:00:00Z'), NOW)).toBe('20/09/2026');
  });
});
