import { describe, it, expect } from 'vitest';
import { calcularVencimiento } from './computo-plazo';
import type { EntradaPlazo } from './computo-plazo';
import type { DiaRojo } from './dias-rojos';

const rojo = (fecha: string, nombre: string, ambito: DiaRojo['ambito'] = 'nacional'): [string, DiaRojo] =>
  [fecha, { fecha, nombre, ambito, estado: 'confirmado', origen: 'manual' }];

const NACIONALES_2026 = new Map<string, DiaRojo>([
  rojo('2026-01-01', 'Año Nuevo'), rojo('2026-01-06', 'Epifanía del Señor'), rojo('2026-04-03', 'Viernes Santo'),
  rojo('2026-05-01', 'Fiesta del Trabajo'), rojo('2026-08-15', 'Asunción de la Virgen'), rojo('2026-10-12', 'Fiesta Nacional de España'),
  rojo('2026-12-08', 'Inmaculada Concepción'), rojo('2026-12-25', 'Natividad del Señor'),
  rojo('2027-01-01', 'Año Nuevo'), rojo('2027-01-06', 'Epifanía del Señor'),
]);

const base = (extra: Partial<EntradaPlazo>): EntradaPlazo => ({
  fechaNotificacion: '2026-07-20', cantidad: 20, unidad: 'dias', jurisdiccion: 'civil', diasRojos: NACIONALES_2026, ...extra,
});

describe('calcularVencimiento — días', () => {
  it('20 días civil notificado 2026-07-20 cruza agosto', () => {
    const r = calcularVencimiento(base({ aniosConCalendario: [2026] }));
    expect(r.inicio).toBe('2026-07-21');
    expect(r.vencimiento).toBe('2026-09-15');
    expect(r.diaGracia).toBe('2026-09-16');
    expect(r.advertencias).toEqual([]);
    expect(r.diasInhabiles.find((d) => d.fecha === '2026-08-17')?.motivo).toBe('agosto');
    expect(r.diasInhabiles.find((d) => d.fecha === '2026-07-25')?.motivo).toBe('sabado');
    expect(r.diasInhabiles.every((d) => d.fecha > '2026-07-20' && d.fecha < '2026-09-15')).toBe(true);
  });
  it('notificación en viernes: cuenta desde el lunes', () => {
    const r = calcularVencimiento(base({ fechaNotificacion: '2026-03-06', cantidad: 5 }));
    expect(r.vencimiento).toBe('2026-03-13');
    expect(r.diaGracia).toBe('2026-03-16');
    expect(r.diasInhabiles.map((d) => d.fecha)).toEqual(['2026-03-07', '2026-03-08']);
  });
  it('Navidad: 24 y 31 dic, 25 dic festivo, 1 y 6 ene', () => {
    const r = calcularVencimiento(base({ fechaNotificacion: '2026-12-22', cantidad: 5 }));
    expect(r.vencimiento).toBe('2027-01-04');
    const motivos = Object.fromEntries(r.diasInhabiles.map((d) => [d.fecha, d.motivo]));
    expect(motivos['2026-12-24']).toBe('navidad');
    expect(motivos['2026-12-25']).toBe('festivo');
    expect(motivos['2026-12-31']).toBe('navidad');
    expect(motivos['2027-01-01']).toBe('festivo');
    const r2 = calcularVencimiento(base({ fechaNotificacion: '2027-01-04', cantidad: 2 }));
    expect(r2.vencimiento).toBe('2027-01-07');
    expect(r2.diasInhabiles.map((d) => d.fecha)).toEqual(['2027-01-06']);
  });
  it('festivo autonómico alarga el plazo', () => {
    const e = base({ fechaNotificacion: '2026-05-13', cantidad: 3 });
    expect(calcularVencimiento(e).vencimiento).toBe('2026-05-18');
    const conFestivo = new Map(NACIONALES_2026).set(...rojo('2026-05-15', 'San Isidro', 'autonomico'));
    const r = calcularVencimiento({ ...e, diasRojos: conFestivo });
    expect(r.vencimiento).toBe('2026-05-19');
    expect(r.diasInhabiles.find((d) => d.fecha === '2026-05-15')?.etiqueta).toBe('San Isidro');
  });
  it('excluidoPorUsuario convierte un festivo en hábil y acorta el vencimiento', () => {
    const conFestivo = new Map(NACIONALES_2026).set(...rojo('2026-05-15', 'San Isidro', 'autonomico'));
    const r = calcularVencimiento({ ...base({ fechaNotificacion: '2026-05-13', cantidad: 3 }), diasRojos: conFestivo, excluidosPorUsuario: ['2026-05-15'] });
    expect(r.vencimiento).toBe('2026-05-18');
    expect(r.diasInhabiles.some((d) => d.fecha === '2026-05-15')).toBe(false);
  });
  it('penal cuenta agosto', () => {
    expect(calcularVencimiento(base({ fechaNotificacion: '2026-08-03', cantidad: 3, jurisdiccion: 'penal' })).vencimiento).toBe('2026-08-06');
    expect(calcularVencimiento(base({ fechaNotificacion: '2026-08-03', cantidad: 3, jurisdiccion: 'civil' })).vencimiento).toBe('2026-09-03');
  });
  it('urgente cuenta agosto', () => {
    expect(calcularVencimiento(base({ fechaNotificacion: '2026-08-03', cantidad: 3, urgente: true })).vencimiento).toBe('2026-08-06');
  });
  it('año sin calendario genera advertencia', () => {
    const r = calcularVencimiento(base({ fechaNotificacion: '2026-12-22', cantidad: 5, aniosConCalendario: [2026] }));
    expect(r.advertencias).toEqual(['No hay días inhábiles confirmados para 2027']);
  });
  it('sin aniosConCalendario no hay advertencia de año', () => {
    expect(calcularVencimiento(base({ fechaNotificacion: '2026-12-22', cantidad: 5 })).advertencias).toEqual([]);
  });
  it('cantidad inválida lanza RangeError', () => {
    for (const c of [0, -3, 1.5]) expect(() => calcularVencimiento(base({ cantidad: c }))).toThrow(RangeError);
  });
});

describe('calcularVencimiento — meses y años', () => {
  it('31 de enero + 1 mes = 28 feb (sábado) → siguiente hábil', () => {
    const r = calcularVencimiento(base({ fechaNotificacion: '2026-01-31', cantidad: 1, unidad: 'meses' }));
    expect(r.vencimiento).toBe('2026-03-02');
    expect(r.diasInhabiles.map((d) => [d.fecha, d.motivo])).toEqual([['2026-02-28', 'sabado'], ['2026-03-01', 'domingo']]);
    expect(r.diaGracia).toBe('2026-03-03');
  });
  it('bisiesto: 2028-01-31 + 1 mes = 2028-02-29', () => {
    const r = calcularVencimiento(base({ fechaNotificacion: '2028-01-31', cantidad: 1, unidad: 'meses' }));
    expect(r.vencimiento).toBe('2028-02-29');
    expect(r.diasInhabiles).toEqual([]);
  });
  it('2 meses contencioso que cae en agosto: agosto no corre (se pausa el cómputo)', () => {
    const r = calcularVencimiento(base({ fechaNotificacion: '2026-06-15', cantidad: 2, unidad: 'meses', jurisdiccion: 'contencioso' }));
    expect(r.vencimiento).toBe('2026-09-15');
    expect(r.diasInhabiles.filter((d) => d.motivo === 'agosto')).toHaveLength(31);
  });
  it('2 meses contencioso notificado 2026-07-15: agosto se descuenta como un mes completo (vence 15/10, no 16/10)', () => {
    const r = calcularVencimiento(base({ fechaNotificacion: '2026-07-15', cantidad: 2, unidad: 'meses', jurisdiccion: 'contencioso' }));
    expect(r.vencimiento).toBe('2026-10-15');
    expect(r.diaGracia).toBe('2026-10-16');
    expect(r.diasInhabiles.filter((d) => d.motivo === 'agosto').map((d) => d.fecha)).toHaveLength(31);
    expect(r.advertencias).toContain(
      'Agosto no computa en este plazo (art. 128.2 LJCA / art. 130 LEC): se ha añadido 1 mes. Verifica el cómputo.',
    );
  });
  it('1 mes civil notificado 2026-07-31: agosto no computa, vence el último día de septiembre', () => {
    const r = calcularVencimiento(base({ fechaNotificacion: '2026-07-31', cantidad: 1, unidad: 'meses', jurisdiccion: 'civil' }));
    expect(r.vencimiento).toBe('2026-09-30');
  });
  it('1 mes civil notificado 2026-07-20: vence 20/09 (domingo) → lunes 21/09', () => {
    const r = calcularVencimiento(base({ fechaNotificacion: '2026-07-20', cantidad: 1, unidad: 'meses', jurisdiccion: 'civil' }));
    expect(r.vencimiento).toBe('2026-09-21');
  });
  it('1 año contencioso desde 2026-07-15 descuenta los dos agostos que atraviesa', () => {
    const r = calcularVencimiento(base({ fechaNotificacion: '2026-07-15', cantidad: 1, unidad: 'anios', jurisdiccion: 'contencioso' }));
    expect(r.vencimiento).toBe('2027-09-15');
    expect(r.advertencias[0]).toContain('se han añadido 2 meses');
  });
  it('mismo plazo en penal: fecha a fecha, sin aviso de agosto', () => {
    const r = calcularVencimiento(base({ fechaNotificacion: '2026-07-15', cantidad: 2, unidad: 'meses', jurisdiccion: 'penal' }));
    expect(r.vencimiento).toBe('2026-09-15');
    expect(r.advertencias).toEqual([]);
  });
  it('urgente: no hay prórroga por agosto', () => {
    const r = calcularVencimiento(base({ fechaNotificacion: '2026-07-15', cantidad: 2, unidad: 'meses', jurisdiccion: 'contencioso', urgente: true }));
    expect(r.vencimiento).toBe('2026-09-15');
    expect(r.advertencias).toEqual([]);
  });
  it('notificado dentro de agosto: surte efecto desde el 1 de septiembre (fecha a fecha desde el 31/08)', () => {
    const r = calcularVencimiento(base({ fechaNotificacion: '2026-08-10', cantidad: 2, unidad: 'meses', jurisdiccion: 'contencioso' }));
    expect(r.diasInhabiles.filter((d) => d.motivo === 'agosto')).toHaveLength(21);
    expect(r.vencimiento).toBe('2026-11-02');
    expect(r.advertencias[0]).toContain('la notificación en agosto surte efecto el 1 de septiembre');
  });
  it('notificado dentro de agosto, 1 mes: 31/08 + 1 mes = 30/09', () => {
    const r = calcularVencimiento(base({ fechaNotificacion: '2026-08-20', cantidad: 1, unidad: 'meses', jurisdiccion: 'civil' }));
    expect(r.vencimiento).toBe('2026-09-30');
  });
  it('plazo que no toca agosto no cambia', () => {
    const r = calcularVencimiento(base({ fechaNotificacion: '2026-09-02', cantidad: 2, unidad: 'meses', jurisdiccion: 'contencioso' }));
    expect(r.vencimiento).toBe('2026-11-02');
    expect(r.advertencias).toEqual([]);
  });
  it('un día de agosto desmarcado por el usuario no se añade', () => {
    const agosto = Array.from({ length: 31 }, (_, i) => `2026-08-${String(i + 1).padStart(2, '0')}`);
    const r = calcularVencimiento(base({ fechaNotificacion: '2026-07-15', cantidad: 2, unidad: 'meses', jurisdiccion: 'contencioso', excluidosPorUsuario: agosto }));
    expect(r.vencimiento).toBe('2026-09-15');
    expect(r.advertencias).toEqual([]);
  });
  it('años: 2028-02-29 + 1 año = 2029-02-28', () => {
    const r = calcularVencimiento(base({ fechaNotificacion: '2028-02-29', cantidad: 1, unidad: 'anios', jurisdiccion: 'penal' }));
    expect(r.vencimiento).toBe('2029-02-28');
  });
  it('advertencia de año aplica también a meses', () => {
    const r = calcularVencimiento(base({ fechaNotificacion: '2026-11-10', cantidad: 3, unidad: 'meses', aniosConCalendario: [2026] }));
    expect(r.advertencias).toEqual(['No hay días inhábiles confirmados para 2027']);
  });
});
