import { describe, expect, it } from 'vitest';
import { construirEventoPlazo, construirOrigenPlazo, formatearFechaEs, puedeVerPlazo } from './plazo-evento';
import type { ResultadoPlazo } from './computo-plazo';
import type { Evento } from '../../interfaces/evento.interface';

const resultado: ResultadoPlazo = {
  inicio: '2026-10-08',
  vencimiento: '2026-10-21',
  diaGracia: '2026-10-22',
  diasInhabiles: [
    { fecha: '2026-10-10', motivo: 'sabado', etiqueta: 'Sábado' },
    { fecha: '2026-10-12', motivo: 'festivo', etiqueta: 'Fiesta Nacional' },
  ],
  advertencias: [],
};
const entrada = { fechaNotificacion: '2026-10-07', cantidad: 10, unidad: 'dias', jurisdiccion: 'civil', tipoPlazoId: 'contestacion-verbal' } as const;
const base = {
  casoId: 'caso1', casoTitulo: 'Pérez vs. Gómez', etiqueta: 'Contestación a la demanda', entrada,
  capas: { ca: 'ca-madrid', partido: 'pj-28-21' }, resultado, excluidosPorUsuario: ['2026-10-12'],
  uid: 'u1', ahoraIso: '2026-10-07T10:00:00.000Z',
};

describe('formatearFechaEs', () => {
  it('formatea ISO a dd/mm/yyyy', () => expect(formatearFechaEs('2026-10-21')).toBe('21/10/2026'));
});

describe('construirOrigenPlazo', () => {
  it('guarda entrada, capas y aceptación; estado vigente; sin undefined', () => {
    const o = construirOrigenPlazo(base);
    expect(o).toMatchObject({
      tipo: 'plazo_procesal', casoId: 'caso1', capas: { ca: 'ca-madrid', partido: 'pj-28-21' }, estadoPlazo: 'vigente',
      aceptacion: {
        diasInhabiles: [{ fecha: '2026-10-10', motivo: 'sabado' }, { fecha: '2026-10-12', motivo: 'festivo' }],
        excluidosPorUsuario: ['2026-10-12'], aceptadoPor: 'u1', aceptadoAt: '2026-10-07T10:00:00.000Z', vencimiento: '2026-10-21',
      },
    });
    expect(o.entrada).toEqual({ ...entrada });
    expect('revision' in o).toBe(false);
  });
});

describe('construirEventoPlazo', () => {
  it('crea un evento de todo el día, rojo, prioridad alta, con día de gracia en la descripción', () => {
    const e = construirEventoPlazo(base);
    expect(e).toMatchObject({
      titulo: 'Vence plazo: Contestación a la demanda · Pérez vs. Gómez',
      fecha: '2026-10-21', todoDia: true, prioridad: 'alta', color: 'rojo', recurrencia: 'ninguna', invitados: 'todos',
    });
    expect(e.descripcion).toContain('22/10/2026');
    expect(e.descripcion).toContain('15:00');
    expect(e.origen?.tipo).toBe('plazo_procesal');
  });
  it('sin título de caso no añade sufijo', () => {
    expect(construirEventoPlazo({ ...base, casoTitulo: undefined }).titulo).toBe('Vence plazo: Contestación a la demanda');
  });
});

describe('construirEventoPlazo — visibilidad', () => {
  it('invitados por defecto es todo el despacho; se puede sobrescribir', () => {
    expect(construirEventoPlazo(base).invitados).toBe('todos');
    expect(construirEventoPlazo({ ...base, invitados: ['u2'] }).invitados).toEqual(['u2']);
  });
});

describe('puedeVerPlazo', () => {
  const normal = { id: 'e1', titulo: 'Reunión' } as Evento;
  const plazo = { id: 'e2', titulo: 'Plazo', origen: construirOrigenPlazo(base) } as Evento;
  it('eventos normales: siempre visibles', () => {
    expect(puedeVerPlazo(false, normal)).toBe(true);
    expect(puedeVerPlazo(true, normal)).toBe(true);
  });
  it('plazos: solo si el usuario puede ver Casos', () => {
    expect(puedeVerPlazo(false, plazo)).toBe(false);
    expect(puedeVerPlazo(true, plazo)).toBe(true);
  });
});
