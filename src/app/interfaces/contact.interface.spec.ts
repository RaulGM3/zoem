import { describe, it, expect } from 'vitest';
import {
  CONTACT_STATUS_LABELS,
  CONTACT_STATUS_OPTIONS,
  getContactStatusStyle,
  type ContactStatus,
} from './contact.interface';

const TODOS_LOS_ESTADOS = Object.keys(CONTACT_STATUS_LABELS) as ContactStatus[];

describe('CONTACT_STATUS_OPTIONS', () => {
  it('cubre exactamente los estados de CONTACT_STATUS_LABELS', () => {
    expect(CONTACT_STATUS_OPTIONS.map(o => o.value)).toEqual(TODOS_LOS_ESTADOS);
  });

  it('usa CONTACT_STATUS_LABELS como única fuente de labels', () => {
    for (const { value, label } of CONTACT_STATUS_OPTIONS) {
      expect(label).toBe(CONTACT_STATUS_LABELS[value]);
    }
  });
});

describe('getContactStatusStyle', () => {
  it('devuelve background y color para todos los estados', () => {
    for (const estado of TODOS_LOS_ESTADOS) {
      const style = getContactStatusStyle(estado);
      expect(style.background).toBeTruthy();
      expect(style.color).toBeTruthy();
    }
  });

  it('usa tokens CSS semánticos, no colores hardcodeados', () => {
    for (const estado of TODOS_LOS_ESTADOS) {
      expect(getContactStatusStyle(estado).color).toContain('var(--');
    }
  });

  it('cae en un estilo neutro para un estado desconocido', () => {
    const style = getContactStatusStyle('inventado' as ContactStatus);
    expect(style.background).toBeTruthy();
    expect(style.color).toBeTruthy();
  });
});
