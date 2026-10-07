import { describe, it, expect } from 'vitest';
import { evaluarRecalculo } from './recalculo';
import type { DiaRojo } from './dias-rojos';

const sanIsidro: DiaRojo = { fecha: '2026-05-15', nombre: 'San Isidro', ambito: 'local', estado: 'confirmado', origen: 'manual' };
const entrada = { fechaNotificacion: '2026-05-13', cantidad: 3, unidad: 'dias' as const, jurisdiccion: 'civil' as const };

describe('evaluarRecalculo', () => {
  it('sin cambios', () => {
    expect(evaluarRecalculo(entrada, '2026-05-18', new Map())).toEqual({
      cambia: false, vencimientoAnterior: '2026-05-18', vencimientoNuevo: '2026-05-18', seAdelanta: false,
    });
  });
  it('un nuevo festivo retrasa el vencimiento', () => {
    expect(evaluarRecalculo(entrada, '2026-05-18', new Map([[sanIsidro.fecha, sanIsidro]]))).toEqual({
      cambia: true, vencimientoAnterior: '2026-05-18', vencimientoNuevo: '2026-05-19', seAdelanta: false,
    });
  });
  it('quitar un festivo adelanta el vencimiento', () => {
    const r = evaluarRecalculo(entrada, '2026-05-19', new Map());
    expect(r).toEqual({ cambia: true, vencimientoAnterior: '2026-05-19', vencimientoNuevo: '2026-05-18', seAdelanta: true });
  });
  it('respeta los días excluidos por el usuario', () => {
    const r = evaluarRecalculo({ ...entrada, excluidosPorUsuario: ['2026-05-15'] }, '2026-05-18', new Map([[sanIsidro.fecha, sanIsidro]]));
    expect(r.cambia).toBe(false);
  });
});
