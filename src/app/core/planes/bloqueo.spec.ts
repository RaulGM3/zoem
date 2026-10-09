import { describe, expect, it } from 'vitest';
import { derechosEfectivos } from './derechos';
import { motivoBloqueoPlan, type ContextoBloqueo } from './bloqueo';
import type { Limite, Suscripcion } from './catalogo';
import { CupoAlmacenamientoError } from './almacenamiento-cupo.service';
import { CupoIaAgotadoError } from '../agent/errores-ia';

const ahora = new Date('2026-10-09T12:00:00Z');
const sus = (p: Partial<Suscripcion>): Suscripcion => ({ plan: 'free', complementos: [], estado: 'activa', origen: 'manual', ...p });
const err = (code: string) => Object.assign(new Error('x'), { name: 'FirebaseError', code });
const denegado = err('permission-denied');

function clasificar(error: unknown, ctx: ContextoBloqueo, s: Suscripcion, usos: Partial<Record<Limite, number>> = {}) {
  return motivoBloqueoPlan(error, ctx, { derechos: derechosEfectivos(s, ahora), suscripcion: s }, (l) => usos[l] ?? 0, ahora);
}

describe('motivoBloqueoPlan · cupos', () => {
  it('permission-denied con el cupo agotado => cupo con usado y límite', () => {
    expect(clasificar(denegado, { limite: 'casosActivos' }, sus({}), { casosActivos: 50 }))
      .toEqual({ tipo: 'cupo', recurso: 'casosActivos', usado: 50, limite: 50 });
  });
  it('también si el contador se pasó (límite blando)', () => {
    expect(clasificar(denegado, { limite: 'plantillas' }, sus({}), { plantillas: 7 }))
      .toEqual({ tipo: 'cupo', recurso: 'plantillas', usado: 7, limite: 5 });
  });
  it('con cupo disponible es un error de rol/otra cosa => null', () => {
    expect(clasificar(denegado, { limite: 'casosActivos' }, sus({}), { casosActivos: 10 })).toBeNull();
  });
  it('plan ilimitado (contactos free) nunca es un cupo', () => {
    expect(clasificar(denegado, { limite: 'contactos' }, sus({}), { contactos: 100_000 })).toBeNull();
  });
  it('cubre cada recurso con cupo', () => {
    const casos: Array<[Limite, number]> = [['usuarios', 1], ['plantillas', 5], ['accionesMes', 15], ['iaMensajesMes', 30], ['documentosMB', 500], ['casosActivos', 50]];
    for (const [l, lim] of casos) {
      expect(clasificar(denegado, { limite: l }, sus({}), { [l]: lim })?.recurso, l).toBe(l);
    }
  });
  it('sin contexto no adivina el cupo', () => {
    expect(clasificar(denegado, {}, sus({}), { casosActivos: 50 })).toBeNull();
  });
});

describe('motivoBloqueoPlan · funciones de pago', () => {
  it('permission-denied en una función que el plan no incluye => funcion', () => {
    expect(clasificar(denegado, { funcion: 'tesoreria' }, sus({}))).toEqual({ tipo: 'funcion', recurso: 'tesoreria' });
  });
  it('si el plan sí la incluye => null (es un error de rol)', () => {
    expect(clasificar(denegado, { funcion: 'tesoreria' }, sus({ plan: 'pro' }))).toBeNull();
  });
  it('un complemento la desbloquea', () => {
    expect(clasificar(denegado, { funcion: 'tesoreria' }, sus({ complementos: ['tesoreria'] }))).toBeNull();
  });
  it('la función manda sobre el cupo si ambas aplican', () => {
    expect(clasificar(denegado, { funcion: 'facturacion', limite: 'casosActivos' }, sus({}), { casosActivos: 50 })?.tipo).toBe('funcion');
  });
});

describe('motivoBloqueoPlan · demo terminada', () => {
  const demoVencida = sus({ plan: 'demo', periodoFin: new Date('2026-10-01T00:00:00Z') });
  it('cualquier permission-denied en una demo vencida => demoTerminada, sin necesitar contexto', () => {
    expect(clasificar(denegado, {}, demoVencida)).toEqual({ tipo: 'demoTerminada', recurso: 'demo' });
  });
  it('tiene prioridad sobre función y cupo', () => {
    expect(clasificar(denegado, { funcion: 'tesoreria', limite: 'casosActivos' }, demoVencida, { casosActivos: 99 })?.tipo).toBe('demoTerminada');
  });
  it('demo vigente no es demoTerminada', () => {
    const vigente = sus({ plan: 'demo', periodoFin: new Date('2026-10-20T00:00:00Z') });
    expect(clasificar(denegado, {}, vigente)).toBeNull();
  });
});

describe('motivoBloqueoPlan · qué errores cuentan', () => {
  it('storage/unauthorized se trata como permission-denied', () => {
    expect(clasificar(err('storage/unauthorized'), { limite: 'documentosMB' }, sus({}), { documentosMB: 500 })?.tipo).toBe('cupo');
  });
  it('errores que no son de permisos (red, validación, desconocidos) => null', () => {
    for (const e of [err('unavailable'), err('invalid-argument'), new Error('boom'), null, undefined, 'texto']) {
      expect(clasificar(e, { limite: 'casosActivos' }, sus({}), { casosActivos: 50 })).toBeNull();
    }
  });
  it('CupoAlmacenamientoError => cupo de documentos aunque el contador esté desfasado', () => {
    expect(clasificar(new CupoAlmacenamientoError(2, 5 * 1_048_576), {}, sus({}), { documentosMB: 499 }))
      .toEqual({
        tipo: 'cupo', recurso: 'documentosMB', usado: 499, limite: 500,
        detalle: 'No queda espacio: te quedan 2 MB y el archivo ocupa 5 MB.', // el modal conserva las cifras exactas del error
      });
  });
  it('CupoIaAgotadoError y functions/resource-exhausted (IA) => cupo de IA', () => {
    expect(clasificar(new CupoIaAgotadoError(), {}, sus({}), { iaMensajesMes: 30 }))
      .toEqual({ tipo: 'cupo', recurso: 'iaMensajesMes', usado: 30, limite: 30 });
    expect(clasificar(err('functions/resource-exhausted'), { limite: 'iaMensajesMes' }, sus({}), { iaMensajesMes: 30 })?.recurso).toBe('iaMensajesMes');
  });
  it('resource-exhausted de otra cosa (cuota de Firestore) sin contexto de IA => null', () => {
    expect(clasificar(err('resource-exhausted'), {}, sus({}))).toBeNull();
  });
});
