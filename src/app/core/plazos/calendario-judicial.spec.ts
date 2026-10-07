import { describe, it, expect } from 'vitest';
import { motivoInhabil, siguienteHabil, sumarDiasHabiles } from './calendario-judicial';
import type { ContextoCalendario } from './calendario-judicial';
import type { DiaRojo } from './dias-rojos';

const rojo = (fecha: string, nombre: string, ambito: DiaRojo['ambito'] = 'nacional'): [string, DiaRojo] =>
  [fecha, { fecha, nombre, ambito, estado: 'confirmado', origen: 'manual' }];

const ctx = (extra: Partial<ContextoCalendario> = {}): ContextoCalendario => ({
  jurisdiccion: 'civil',
  diasRojos: new Map([rojo('2026-12-25', 'Navidad'), rojo('2026-05-15', 'San Isidro', 'autonomico')]),
  ...extra,
});

describe('motivoInhabil', () => {
  it('sábado y domingo', () => {
    expect(motivoInhabil('2026-07-25', ctx())).toEqual({ fecha: '2026-07-25', motivo: 'sabado', etiqueta: 'Sábado' });
    expect(motivoInhabil('2026-07-26', ctx())?.motivo).toBe('domingo');
  });
  it('día laborable normal es hábil', () => {
    expect(motivoInhabil('2026-07-20', ctx())).toBeNull();
  });
  it('agosto inhábil en civil, contencioso y laboral', () => {
    for (const j of ['civil', 'contencioso', 'laboral'] as const)
      expect(motivoInhabil('2026-08-12', ctx({ jurisdiccion: j }))).toEqual({ fecha: '2026-08-12', motivo: 'agosto', etiqueta: 'Agosto inhábil' });
  });
  it('agosto hábil en penal', () => {
    expect(motivoInhabil('2026-08-12', ctx({ jurisdiccion: 'penal' }))).toBeNull();
  });
  it('urgente hace agosto hábil', () => {
    expect(motivoInhabil('2026-08-12', ctx({ urgente: true }))).toBeNull();
  });
  it('24 y 31 de diciembre', () => {
    expect(motivoInhabil('2026-12-24', ctx())).toEqual({ fecha: '2026-12-24', motivo: 'navidad', etiqueta: '24 de diciembre' });
    expect(motivoInhabil('2026-12-31', ctx())?.etiqueta).toBe('31 de diciembre');
  });
  it('festivo viene solo del mapa', () => {
    expect(motivoInhabil('2026-12-25', ctx())).toEqual({ fecha: '2026-12-25', motivo: 'festivo', etiqueta: 'Navidad' });
    expect(motivoInhabil('2026-12-25', ctx({ diasRojos: new Map() }))).toBeNull();
  });
  it('festivo autonómico', () => {
    expect(motivoInhabil('2026-05-15', ctx())).toEqual({ fecha: '2026-05-15', motivo: 'festivo', etiqueta: 'San Isidro' });
  });
  it('días excluidos por el usuario son hábiles', () => {
    expect(motivoInhabil('2026-12-25', ctx({ excluidos: ['2026-12-25'] }))).toBeNull();
    expect(motivoInhabil('2026-07-25', ctx({ excluidos: ['2026-07-25'] }))).toBeNull();
  });
});

describe('siguienteHabil / sumarDiasHabiles', () => {
  it('siguienteHabil salta fin de semana', () => {
    expect(siguienteHabil('2026-07-24', ctx())).toBe('2026-07-27');
  });
  it('sumarDiasHabiles', () => {
    expect(sumarDiasHabiles('2026-07-23', 3, ctx())).toBe('2026-07-28');
  });
});
