import { describe, it, expect } from 'vitest';
import {
  EVENTO_ESTADOS,
  EVENTO_ESTADO_LABEL,
  EVENTO_ESTADO_BADGE_CLASS,
} from './evento.interface';

describe('evento-estado: single source of truth', () => {
  it('declares the five canonical estados (estilo Google Calendar + workflow)', () => {
    expect(EVENTO_ESTADOS).toEqual([
      'confirmado', 'tentativo', 'en_progreso', 'completado', 'cancelado',
    ]);
  });

  it('has a human label for every estado, never the raw enum', () => {
    for (const e of EVENTO_ESTADOS) {
      expect(EVENTO_ESTADO_LABEL[e]).toBeTruthy();
      expect(EVENTO_ESTADO_LABEL[e]).not.toBe(e);
    }
  });

  it('maps en_progreso label to the user-facing "En proceso"', () => {
    expect(EVENTO_ESTADO_LABEL['en_progreso']).toBe('En proceso');
  });

  it('has a badge class for every estado', () => {
    for (const e of EVENTO_ESTADOS) {
      expect(EVENTO_ESTADO_BADGE_CLASS[e]).toBeTruthy();
    }
  });
});
