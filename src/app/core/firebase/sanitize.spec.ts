import { describe, it, expect } from 'vitest';
import { stripUndefinedDeep } from './sanitize';

describe('stripUndefinedDeep (mata el "addDoc invalid data")', () => {
  it('elimina claves con valor undefined en el nivel raíz', () => {
    const out = stripUndefinedDeep({ a: 1, b: undefined, c: 'x' });
    expect(out).toEqual({ a: 1, c: 'x' });
    expect('b' in out).toBe(false);
  });

  it('preserva null, 0, "" y false (son valores VÁLIDOS en Firestore)', () => {
    const out = stripUndefinedDeep({ a: null, b: 0, c: '', d: false });
    expect(out).toEqual({ a: null, b: 0, c: '', d: false });
  });

  it('limpia undefined en objetos anidados', () => {
    const out = stripUndefinedDeep({
      direccion: { calle: 'Mayor', numero: undefined, cp: '28001' },
    });
    expect(out).toEqual({ direccion: { calle: 'Mayor', cp: '28001' } });
  });

  it('limpia undefined dentro de arrays de objetos', () => {
    const out = stripUndefinedDeep({
      items: [{ x: 1, y: undefined }, { x: 2, y: 3 }],
    });
    expect(out).toEqual({ items: [{ x: 1 }, { x: 2, y: 3 }] });
  });

  it('NO toca instancias especiales (Date) — las deja intactas por referencia', () => {
    const d = new Date('2026-01-01');
    const out = stripUndefinedDeep({ when: d });
    expect(out.when).toBe(d);
  });

  it('NO toca sentinels de Firestore (objetos con _methodName, p.ej. serverTimestamp)', () => {
    const sentinel = { _methodName: 'serverTimestamp' };
    const out = stripUndefinedDeep({ createdAt: sentinel });
    expect(out.createdAt).toBe(sentinel);
  });

  it('objeto vacío resultante se conserva (no lo borra)', () => {
    const out = stripUndefinedDeep({ meta: { onlyUndef: undefined } });
    expect(out).toEqual({ meta: {} });
  });

  it('no muta el objeto original', () => {
    const original = { a: 1, b: undefined };
    stripUndefinedDeep(original);
    expect('b' in original).toBe(true);
  });
});
