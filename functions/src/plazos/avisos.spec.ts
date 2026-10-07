import { describe, expect, it } from 'vitest';
import type { DiaRojo } from './dominio/dias-rojos';
import { diasHabilesRestantes, hoyMadrid, seleccionarAvisos, textoAviso } from './avisos';
import type { PlazoDoc } from './tipos';

const rojo = (fecha: string): DiaRojo => ({ fecha, nombre: 'Fiesta', ambito: 'local', estado: 'confirmado', origen: 'manual' });
const plazo = (id: string, vencimiento: string, extra: Partial<PlazoDoc['origen']> = {}): PlazoDoc => ({
  id,
  cid: 'c1',
  titulo: `Vence plazo: P${id}`,
  origen: {
    casoId: 'caso1',
    capas: { ca: 'ca-madrid', partido: 'pj-28-79' },
    entrada: { fechaNotificacion: '2026-09-01', cantidad: 10, unidad: 'dias', jurisdiccion: 'civil' },
    aceptacion: { excluidosPorUsuario: [], vencimiento },
    estadoPlazo: 'vigente',
    ...extra,
  },
});
const sinRojos = new Map<string, ReadonlyMap<string, DiaRojo>>();

describe('hoyMadrid', () => {
  it('usa la fecha de Madrid, no la UTC', () => {
    expect(hoyMadrid(new Date('2026-10-06T22:30:00Z'))).toBe('2026-10-07'); // CEST = UTC+2
    expect(hoyMadrid(new Date('2026-12-31T23:30:00Z'))).toBe('2027-01-01'); // CET = UTC+1
  });
});

describe('diasHabilesRestantes', () => {
  const ctx = { jurisdiccion: 'civil' as const, diasRojos: new Map<string, DiaRojo>() };
  it('0 el mismo día, cuenta solo hábiles (sin sáb/dom)', () => {
    expect(diasHabilesRestantes('2026-10-09', '2026-10-09', ctx)).toBe(0);
    expect(diasHabilesRestantes('2026-10-09', '2026-10-16', ctx)).toBe(5);
  });
  it('los festivos no cuentan', () => {
    const conRojo = { ...ctx, diasRojos: new Map([['2026-10-12', rojo('2026-10-12')]]) };
    expect(diasHabilesRestantes('2026-10-09', '2026-10-16', conRojo)).toBe(4);
  });
  it('negativo si ya pasó', () => {
    expect(diasHabilesRestantes('2026-10-16', '2026-10-09', ctx)).toBeLessThan(0);
  });
});

describe('seleccionarAvisos', () => {
  // Vencimiento viernes 2026-10-16. 5 hábiles antes = vie 09; 2 = mié 14; 0 = vie 16.
  it.each([
    ['2026-10-09', 5],
    ['2026-10-14', 2],
    ['2026-10-16', 0],
  ])('avisa el %s (%i días hábiles)', (hoy, n) => {
    const { avisos } = seleccionarAvisos([plazo('1', '2026-10-16')], hoy, sinRojos);
    expect(avisos).toEqual([{ plazo: expect.objectContaining({ id: '1' }), diasHabiles: n, marca: `${hoy}:${n}` }]);
  });

  it('no avisa otros días', () => {
    for (const hoy of ['2026-10-08', '2026-10-13', '2026-10-15']) {
      expect(seleccionarAvisos([plazo('1', '2026-10-16')], hoy, sinRojos).avisos).toEqual([]);
    }
  });

  it('un festivo de capa desplaza el aviso de 5 días', () => {
    const rojos = new Map([['pj-28-79', new Map([['2026-10-12', rojo('2026-10-12')]])]]);
    expect(seleccionarAvisos([plazo('1', '2026-10-16')], '2026-10-09', rojos).avisos).toEqual([]);
    expect(seleccionarAvisos([plazo('1', '2026-10-16')], '2026-10-08', rojos).avisos).toHaveLength(1);
  });

  it('sin capas cargadas cae a fines de semana (más agosto/navidad del motor)', () => {
    expect(seleccionarAvisos([plazo('1', '2026-10-16', { capas: { ca: 'ca-x' } })], '2026-10-09', sinRojos).avisos).toHaveLength(1);
  });

  it('no duplica el aviso del mismo día', () => {
    const p = plazo('1', '2026-10-16', { ultimoAviso: '2026-10-09:5' });
    expect(seleccionarAvisos([p], '2026-10-09', sinRojos).avisos).toEqual([]);
  });

  it('ignora plazos cumplidos o vencidos', () => {
    const ps = [plazo('1', '2026-10-16', { estadoPlazo: 'cumplido' }), plazo('2', '2026-10-16', { estadoPlazo: 'vencido' })];
    expect(seleccionarAvisos(ps, '2026-10-09', sinRojos)).toEqual({ avisos: [], vencidos: [] });
  });

  it('en requiere_revision que se adelanta usa el vencimiento más cercano', () => {
    const p = plazo('1', '2026-10-16', {
      estadoPlazo: 'requiere_revision',
      revision: { vencimientoNuevo: '2026-10-14', seAdelanta: true, detectadoAt: 't' },
    });
    expect(seleccionarAvisos([p], '2026-10-14', sinRojos).avisos[0]?.diasHabiles).toBe(0);
  });

  it('marca como vencido solo tras el día de gracia (siguiente hábil) y si estaba vigente', () => {
    const p = plazo('1', '2026-10-16');
    expect(seleccionarAvisos([p], '2026-10-19', sinRojos).vencidos).toEqual([]);
    expect(seleccionarAvisos([p], '2026-10-20', sinRojos).vencidos.map((x) => x.id)).toEqual(['1']);
    const enRev = plazo('2', '2026-10-16', { estadoPlazo: 'requiere_revision' });
    expect(seleccionarAvisos([enRev], '2026-10-20', sinRojos).vencidos).toEqual([]);
  });

  it('el día de gracia tiene en cuenta festivos', () => {
    const rojos = new Map([['ca-madrid', new Map([['2026-10-19', rojo('2026-10-19')]])]]);
    const p = plazo('1', '2026-10-16');
    expect(seleccionarAvisos([p], '2026-10-20', rojos).vencidos).toEqual([]);
    expect(seleccionarAvisos([p], '2026-10-21', rojos).vencidos).toHaveLength(1);
  });
});

describe('textoAviso', () => {
  it('hoy vence, con día de gracia', () => {
    const t = textoAviso(plazo('1', '2026-10-16'), 0);
    expect(t.titulo).toBe('Hoy vence el plazo «P1»');
    expect(t.cuerpo).toContain('15:00');
  });
  it('plural', () => {
    expect(textoAviso(plazo('1', '2026-10-16'), 5).titulo).toBe('El plazo «P1» vence en 5 días hábiles (16/10/2026)');
  });
});
