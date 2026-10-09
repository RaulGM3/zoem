import { describe, expect, it } from 'vitest';
import { periodoAvanzado } from './avanzar';

const ts = (d: Date) => ({ toDate: () => d });
const periodo = (clave: string, inicio: string, fin: string) => ({ clave, inicio: ts(new Date(inicio)), fin: ts(new Date(fin)) });

describe('periodoAvanzado', () => {
  const sep = periodo('2026-09', '2026-08-31T22:00:00Z', '2026-09-30T22:00:00Z');

  it('periodo vigente => null (nada que escribir)', () => {
    expect(periodoAvanzado({ derechos: { periodoUso: sep } }, new Date('2026-09-15T00:00:00Z'))).toBeNull();
  });

  it('al llegar `fin` (inclusive) pasa al mes siguiente en la zona de la empresa', () => {
    const r = periodoAvanzado({ zonaHoraria: 'Europe/Madrid', derechos: { periodoUso: sep } }, new Date('2026-09-30T22:00:00Z'));
    expect(r!.clave).toBe('2026-10');
    expect(r!.inicio).toEqual(new Date('2026-09-30T22:00:00Z'));
    expect(r!.fin).toEqual(new Date('2026-10-31T23:00:00Z'));
  });

  it('si la zona cambió y el periodo guardado ya no coincide, lo corrige aunque no haya vencido', () => {
    const r = periodoAvanzado({ zonaHoraria: 'America/Bogota', derechos: { periodoUso: sep } }, new Date('2026-09-15T00:00:00Z'));
    expect(r!.clave).toBe('2026-09');
    expect(r!.fin).toEqual(new Date('2026-10-01T05:00:00Z'));
  });

  it('empresa con derechos pero sin periodoUso => lo crea', () => {
    expect(periodoAvanzado({ derechos: {} }, new Date('2026-09-15T00:00:00Z'))!.clave).toBe('2026-09');
  });

  it('empresa legada (sin derechos) => null: no se toca', () => {
    expect(periodoAvanzado({}, new Date('2026-09-15T00:00:00Z'))).toBeNull();
  });

  it('salta varios meses si el scheduler estuvo parado', () => {
    expect(periodoAvanzado({ derechos: { periodoUso: sep } }, new Date('2026-12-10T00:00:00Z'))!.clave).toBe('2026-12');
  });
});
