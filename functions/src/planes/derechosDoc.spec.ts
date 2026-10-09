import { describe, expect, it } from 'vitest';
import { derechosParaDoc, igualesDerechos, vigentesEn } from './derechosDoc';
import type { Suscripcion } from './catalogo';

const ahora = new Date('2026-10-09T12:00:00Z');
const manana = new Date('2026-10-10T12:00:00Z');
const ayer = new Date('2026-10-08T12:00:00Z');
const sus = (p: Partial<Suscripcion>): Suscripcion => ({ plan: 'free', complementos: [], estado: 'activa', origen: 'manual', ...p });

describe('derechosParaDoc', () => {
  it('sin suscripcion (empresa legada) => null: no se restringe nada', () => {
    expect(derechosParaDoc(undefined, ahora)).toBeNull();
  });

  it('free activa: funciones y cupos, sin transición', () => {
    const d = derechosParaDoc(sus({ plan: 'free' }), ahora)!;
    expect(d.funciones.tesoreria).toBe(false);
    expect(d.funciones.contactos).toBe(true);
    expect(d.limites).toMatchObject({ usuarios: 1, plantillas: 5, accionesMes: 15, contactos: null });
    expect(d.soloLectura).toBe(false);
    expect(d.hasta).toBeNull();
    expect(d.despues).toBeNull();
  });

  it('prueba vigente: todo abierto hasta periodoFin y luego el plan declarado', () => {
    const d = derechosParaDoc(sus({ plan: 'free', estado: 'prueba', periodoFin: manana }), ahora)!;
    expect(d.funciones.tesoreria).toBe(true);
    expect(d.hasta).toEqual(manana);
    expect(d.despues!.funciones.tesoreria).toBe(false);
    expect(d.despues!.limites.usuarios).toBe(1);
    expect(d.despues!.soloLectura).toBe(false);
  });

  it('prueba vencida aún sin persistir: ya es free', () => {
    const d = derechosParaDoc(sus({ plan: 'free', estado: 'prueba', periodoFin: ayer }), ahora)!;
    expect(d.funciones.tesoreria).toBe(false);
    expect(d.hasta).toBeNull();
  });

  it('demo vigente: todo abierto, cupos bajos, y a partir de periodoFin solo lectura', () => {
    const d = derechosParaDoc(sus({ plan: 'demo', periodoFin: manana }), ahora)!;
    expect(d.funciones.informes).toBe(true);
    expect(d.limites).toMatchObject({ usuarios: 1, contactos: 10, casosActivos: 10 });
    expect(d.soloLectura).toBe(false);
    expect(d.hasta).toEqual(manana);
    expect(d.despues!.soloLectura).toBe(true);
  });

  it('demo vencida: solo lectura ya', () => {
    const d = derechosParaDoc(sus({ plan: 'demo', periodoFin: ayer }), ahora)!;
    expect(d.soloLectura).toBe(true);
    expect(d.hasta).toBeNull();
  });

  it('periodoUso: mes en la zona de la empresa (por defecto Europe/Madrid)', () => {
    const d = derechosParaDoc(sus({ plan: 'free' }), ahora)!;
    expect(d.periodoUso!.clave).toBe('2026-10');
    expect(d.periodoUso!.inicio).toEqual(new Date('2026-09-30T22:00:00Z'));
    expect(d.periodoUso!.fin).toEqual(new Date('2026-10-31T23:00:00Z'));
    const bog = derechosParaDoc(sus({ plan: 'free' }), new Date('2026-11-01T03:00:00Z'), 'America/Bogota')!;
    expect(bog.periodoUso!.clave).toBe('2026-10'); // en Bogotá (UTC-5) aún son las 22:00 del 31/10
    expect(bog.periodoUso!.fin).toEqual(new Date('2026-11-01T05:00:00Z'));
  });

  it('ajustes: ilimitado (null) y cupos manuales se respetan', () => {
    const d = derechosParaDoc(sus({ plan: 'free', ajustes: { limites: { usuarios: null, plantillas: 9 }, funciones: { tesoreria: true } } }), ahora)!;
    expect(d.limites.usuarios).toBeNull();
    expect(d.limites.plantillas).toBe(9);
    expect(d.funciones.tesoreria).toBe(true);
  });
});

describe('igualesDerechos', () => {
  it('compara fechas por valor y detecta cambios', () => {
    const a = derechosParaDoc(sus({ plan: 'demo', periodoFin: manana }), ahora)!;
    const b = derechosParaDoc(sus({ plan: 'demo', periodoFin: new Date(manana) }), ahora)!;
    expect(igualesDerechos(a, b)).toBe(true);
    expect(igualesDerechos(a, derechosParaDoc(sus({ plan: 'pro' }), ahora)!)).toBe(false);
    expect(igualesDerechos(null, a)).toBe(false);
    expect(igualesDerechos(undefined, null)).toBe(true);
  });
  it('no depende del orden de las claves (Firestore las devuelve ordenadas: evita bucles de reescritura)', () => {
    const a = derechosParaDoc(sus({ plan: 'demo', periodoFin: manana }), ahora)!;
    const reordenado = JSON.parse(JSON.stringify({ despues: a.despues, soloLectura: a.soloLectura, limites: Object.fromEntries(Object.entries(a.limites).reverse()), funciones: a.funciones, hasta: manana, periodoUso: a.periodoUso }));
    reordenado.hasta = { toDate: () => manana };
    reordenado.periodoUso.inicio = { toDate: () => a.periodoUso!.inicio };
    reordenado.periodoUso.fin = { toDate: () => a.periodoUso!.fin };
    expect(igualesDerechos(reordenado, a)).toBe(true);
  });
  it('detecta cambio de zona o de mes en periodoUso', () => {
    const base = derechosParaDoc(sus({ plan: 'free' }), ahora)!;
    expect(igualesDerechos(base, derechosParaDoc(sus({ plan: 'free' }), new Date('2026-10-20T00:00:00Z'))!)).toBe(true);
    expect(igualesDerechos(base, derechosParaDoc(sus({ plan: 'free' }), ahora, 'America/Bogota')!)).toBe(false);
    expect(igualesDerechos(base, derechosParaDoc(sus({ plan: 'free' }), new Date('2026-11-05T00:00:00Z'))!)).toBe(false);
    // un doc guardado antes de existir periodoUso se reescribe
    const { periodoUso: _omitido, ...sinPeriodo } = base;
    expect(igualesDerechos(sinPeriodo, base)).toBe(false);
  });
  it('acepta hasta como Timestamp de Firestore', () => {
    const a = derechosParaDoc(sus({ plan: 'demo', periodoFin: manana }), ahora)!;
    const guardado = { ...a, hasta: { toDate: () => manana } };
    expect(igualesDerechos(guardado, a)).toBe(true);
  });
});

describe('vigentesEn', () => {
  const demo = () => derechosParaDoc(sus({ plan: 'demo', periodoFin: manana }), ahora)!;
  it('sin derechos (legada) => null', () => {
    expect(vigentesEn(null, ahora)).toBeNull();
    expect(vigentesEn(undefined, ahora)).toBeNull();
  });
  it('antes de hasta rige el actual; desde hasta, el siguiente', () => {
    const d = demo();
    expect(vigentesEn(d, ahora)!.soloLectura).toBe(false);
    expect(vigentesEn(d, manana)!.soloLectura).toBe(true);
    expect(vigentesEn(d, new Date(manana.getTime() + 1000))!.soloLectura).toBe(true);
  });
  it('acepta hasta como Timestamp', () => {
    const d = { ...demo(), hasta: { toDate: () => manana } };
    expect(vigentesEn(d, manana)!.soloLectura).toBe(true);
  });
});
