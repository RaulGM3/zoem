import { describe, it, expect } from 'vitest';
import {
  destinatariosAsignacion,
  asignadosHito,
  invitadosEvento,
  destinatariosEvento,
  actorDe,
  nuevoValor,
} from './asignacion';

describe('destinatariosAsignacion', () => {
  it('devuelve solo los ids nuevos', () => {
    expect(destinatariosAsignacion(['a'], ['a', 'b'])).toEqual(['b']);
  });
  it('undefined antes = todos nuevos', () => {
    expect(destinatariosAsignacion(undefined, ['a', 'b'])).toEqual(['a', 'b']);
  });
  it('excluye al actor', () => {
    expect(destinatariosAsignacion([], ['a', 'b'], 'a')).toEqual(['b']);
  });
  it('sin after devuelve vacío', () => {
    expect(destinatariosAsignacion(['a'], undefined)).toEqual([]);
  });
  it('sin cambios devuelve vacío', () => {
    expect(destinatariosAsignacion(['a'], ['a'])).toEqual([]);
  });
  it('deduplica', () => {
    expect(destinatariosAsignacion([], ['a', 'a'])).toEqual(['a']);
  });
  it('ignora ids vacíos', () => {
    expect(destinatariosAsignacion([], ['', 'a'])).toEqual(['a']);
  });
});

describe('asignadosHito', () => {
  it('prefiere asignadosA', () => {
    expect(asignadosHito({ asignadosA: ['a', 'b'], asignadoA: 'z' })).toEqual(['a', 'b']);
  });
  it('cae al legacy asignadoA', () => {
    expect(asignadosHito({ asignadoA: 'z' })).toEqual(['z']);
  });
  it('sin nada devuelve []', () => {
    expect(asignadosHito({})).toEqual([]);
    expect(asignadosHito(undefined)).toEqual([]);
  });
  it('asignadosA vacío cae al legacy', () => {
    expect(asignadosHito({ asignadosA: [], asignadoA: 'z' })).toEqual(['z']);
  });
});

describe('invitadosEvento', () => {
  it("'todos' se expande a los miembros activos", () => {
    expect(invitadosEvento({ invitados: 'todos' }, ['m1', 'm2'])).toEqual(['m1', 'm2']);
  });
  it('lista explícita se respeta', () => {
    expect(invitadosEvento({ invitados: ['a'] }, ['m1'])).toEqual(['a']);
  });
  it('sin invitados devuelve []', () => {
    expect(invitadosEvento(undefined, ['m1'])).toEqual([]);
    expect(invitadosEvento({}, ['m1'])).toEqual([]);
  });
});

describe('destinatariosEvento', () => {
  it('une invitados nuevos y responsable nuevo, sin actor ni creador', () => {
    const r = destinatariosEvento(
      { invitados: ['a'], responsableId: 'r0' },
      { invitados: ['a', 'b', 'c'], responsableId: 'r1', creadoPor: 'c' },
      ['a', 'b', 'c', 'r1'],
      'x',
    );
    expect(r.sort()).toEqual(['b', 'r1']);
  });
  it('en creación (before undefined) notifica a todos los invitados', () => {
    expect(
      destinatariosEvento(undefined, { invitados: ['a', 'b'], creadoPor: 'a' }, [], undefined),
    ).toEqual(['b']);
  });
  it('expande todos solo para los nuevos', () => {
    expect(
      destinatariosEvento(
        { invitados: ['m1'] },
        { invitados: 'todos' },
        ['m1', 'm2'],
        undefined,
      ),
    ).toEqual(['m2']);
  });
  it('el actor se excluye', () => {
    expect(
      destinatariosEvento(undefined, { invitados: ['a', 'b'] }, [], 'a'),
    ).toEqual(['b']);
  });
});

describe('actorDe', () => {
  it('en update usa updatedBy', () => {
    expect(actorDe({ updatedBy: 'u', createdBy: 'c' }, true)).toBe('u');
  });
  it('en create usa createdBy y luego creadoPor', () => {
    expect(actorDe({ createdBy: 'c' }, false)).toBe('c');
    expect(actorDe({ creadoPor: 'p' }, false)).toBe('p');
  });
  it('update sin updatedBy no asume actor', () => {
    expect(actorDe({ createdBy: 'c' }, true)).toBeUndefined();
  });
  it('sin datos devuelve undefined', () => {
    expect(actorDe(undefined, false)).toBeUndefined();
  });
});

describe('nuevoValor', () => {
  it('devuelve after si cambió', () => {
    expect(nuevoValor('a', 'b')).toBe('b');
    expect(nuevoValor(undefined, 'b')).toBe('b');
  });
  it('undefined si no cambió o se vació', () => {
    expect(nuevoValor('a', 'a')).toBeUndefined();
    expect(nuevoValor('a', undefined)).toBeUndefined();
    expect(nuevoValor('a', '')).toBeUndefined();
  });
});
