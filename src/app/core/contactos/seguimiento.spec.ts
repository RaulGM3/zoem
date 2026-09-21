import { describe, it, expect } from 'vitest';
import {
  SEGUIMIENTO_SUGERENCIAS,
  fechaLimiteSugerida,
  esSeguimiento,
  esVencido,
  puedeGestionarSeguimiento,
  seguimientoToEvento,
  type SeguimientoDraft,
} from './seguimiento';
import type { Evento } from '../../interfaces/evento.interface';

/** Evento de seguimiento mínimo para los tests. */
function seguimiento(over: Partial<Evento> = {}): Evento {
  return {
    id: 'ev-1',
    companyId: 'c-1',
    titulo: 'Enviar propuesta de honorarios — Ana Ruiz',
    fecha: '2026-09-25',
    todoDia: true,
    estado: 'confirmado',
    recurrencia: 'ninguna',
    prioridad: 'alta',
    color: 'naranja',
    invitados: ['u-abogado'],
    creadoPor: 'u-admin',
    responsableId: 'u-abogado',
    entregable: 'Enviar propuesta de honorarios',
    origen: {
      tipo: 'seguimiento_contacto',
      contactoId: 'ct-1',
      contactoNombre: 'Ana Ruiz',
      statusOrigen: 'potencial',
      statusDestino: 'pendiente_presupuesto',
    },
    createdAt: undefined as never,
    updatedAt: undefined as never,
    ...over,
  };
}

describe('SEGUIMIENTO_SUGERENCIAS', () => {
  it('propone entregable y plazo para los estados que exigen una acción del despacho', () => {
    for (const estado of ['pendiente_presupuesto', 'pendiente_firma_hoja_encargo', 'pendiente_pago'] as const) {
      const sug = SEGUIMIENTO_SUGERENCIAS[estado];
      expect(sug, `falta sugerencia para ${estado}`).toBeDefined();
      expect(sug!.entregable.length).toBeGreaterThan(0);
      expect(sug!.diasPlazo).toBeGreaterThan(0);
    }
  });

  it('no propone nada para estados terminales', () => {
    expect(SEGUIMIENTO_SUGERENCIAS['cerrado_finalizado']).toBeUndefined();
    expect(SEGUIMIENTO_SUGERENCIAS['inactivo']).toBeUndefined();
  });
});

describe('fechaLimiteSugerida', () => {
  it('suma los días de plazo en formato YYYY-MM-DD', () => {
    expect(fechaLimiteSugerida('2026-09-21', 3)).toBe('2026-09-24');
  });

  it('cruza correctamente el cambio de mes', () => {
    expect(fechaLimiteSugerida('2026-09-29', 5)).toBe('2026-10-04');
  });

  it('cruza correctamente el cambio de año', () => {
    expect(fechaLimiteSugerida('2026-12-30', 3)).toBe('2027-01-02');
  });

  it('respeta los años bisiestos', () => {
    expect(fechaLimiteSugerida('2028-02-27', 3)).toBe('2028-03-01');
  });

  it('con plazo 0 devuelve el mismo día', () => {
    expect(fechaLimiteSugerida('2026-09-21', 0)).toBe('2026-09-21');
  });
});

describe('esSeguimiento', () => {
  it('reconoce un evento originado en un cambio de estado de contacto', () => {
    expect(esSeguimiento(seguimiento())).toBe(true);
  });

  it('un evento normal de calendario no es un seguimiento', () => {
    expect(esSeguimiento(seguimiento({ origen: undefined }))).toBe(false);
  });
});

describe('esVencido', () => {
  it('es vencido si la fecha límite ya pasó', () => {
    expect(esVencido(seguimiento({ fecha: '2026-09-20' }), '2026-09-21')).toBe(true);
  });

  it('el mismo día todavía no está vencido', () => {
    expect(esVencido(seguimiento({ fecha: '2026-09-21' }), '2026-09-21')).toBe(false);
  });

  it('un seguimiento completado nunca cuenta como vencido', () => {
    expect(esVencido(seguimiento({ fecha: '2026-09-01', estado: 'completado' }), '2026-09-21')).toBe(false);
  });

  it('un seguimiento cancelado nunca cuenta como vencido', () => {
    expect(esVencido(seguimiento({ fecha: '2026-09-01', estado: 'cancelado' }), '2026-09-21')).toBe(false);
  });
});

describe('puedeGestionarSeguimiento', () => {
  const ev = seguimiento(); // responsableId: 'u-abogado'

  it('el responsable asignado puede gestionarlo', () => {
    expect(puedeGestionarSeguimiento(ev, 'u-abogado', 'Usuario', false)).toBe(true);
  });

  it('un Admin puede gestionarlo aunque no sea el responsable', () => {
    expect(puedeGestionarSeguimiento(ev, 'u-otro', 'Admin', false)).toBe(true);
  });

  it('un Gestor puede gestionarlo aunque no sea el responsable', () => {
    expect(puedeGestionarSeguimiento(ev, 'u-otro', 'Gestor', false)).toBe(true);
  });

  it('un superusuario puede gestionarlo siempre', () => {
    expect(puedeGestionarSeguimiento(ev, 'u-otro', null, true)).toBe(true);
  });

  it('un Usuario que no es el responsable NO puede gestionarlo', () => {
    expect(puedeGestionarSeguimiento(ev, 'u-otro', 'Usuario', false)).toBe(false);
  });

  it('un Viewer NO puede gestionarlo ni siendo el responsable', () => {
    expect(puedeGestionarSeguimiento(ev, 'u-abogado', 'Viewer', false)).toBe(false);
  });

  it('sin usuario identificado no puede gestionarlo', () => {
    expect(puedeGestionarSeguimiento(ev, null, 'Usuario', false)).toBe(false);
  });
});

describe('seguimientoToEvento', () => {
  const draft: SeguimientoDraft = {
    entregable: 'Enviar propuesta de honorarios',
    fechaLimite: '2026-09-25',
    responsableId: 'u-abogado',
  };

  const data = seguimientoToEvento(draft, {
    contactoId: 'ct-1',
    contactoNombre: 'Ana Ruiz',
    statusOrigen: 'potencial',
    statusDestino: 'pendiente_presupuesto',
  });

  it('agenda el evento en la fecha límite y como todo el día', () => {
    expect(data.fecha).toBe('2026-09-25');
    expect(data.todoDia).toBe(true);
  });

  it('el título identifica el entregable y el contacto', () => {
    expect(data.titulo).toContain('Enviar propuesta de honorarios');
    expect(data.titulo).toContain('Ana Ruiz');
  });

  it('invita únicamente al responsable y lo marca como tal', () => {
    expect(data.responsableId).toBe('u-abogado');
    expect(data.invitados).toEqual(['u-abogado']);
  });

  it('guarda la trazabilidad del cambio de estado que lo originó', () => {
    expect(data.origen).toEqual({
      tipo: 'seguimiento_contacto',
      contactoId: 'ct-1',
      contactoNombre: 'Ana Ruiz',
      statusOrigen: 'potencial',
      statusDestino: 'pendiente_presupuesto',
    });
  });

  it('no es recurrente y nace confirmado', () => {
    expect(data.recurrencia).toBe('ninguna');
    expect(data.estado).toBe('confirmado');
  });
});
