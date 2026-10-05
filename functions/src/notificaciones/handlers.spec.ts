import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  handleLlamadaCreated,
  handleCasoWritten,
  handleContactoWritten,
  handleEventoWritten,
  handleHitoWritten,
  type TriggerDeps,
} from './handlers';

let deps: TriggerDeps;
let notify: ReturnType<typeof vi.fn>;

beforeEach(() => {
  notify = vi.fn().mockResolvedValue(undefined);
  deps = {
    notify,
    companyIdForAgent: vi.fn(async (agentId: string) => (agentId === 'ag1' ? 'c1' : undefined)),
    managerIds: vi.fn(async () => ['admin1', 'gestor1']),
    activeMemberIds: vi.fn(async () => ['u1', 'u2', 'u3']),
    isMember: vi.fn(async (_cid: string, uid: string) => uid.startsWith('u')),
  };
});

describe('handleLlamadaCreated', () => {
  it('notifica a Admin/Gestor activos de la empresa del agente', async () => {
    await handleLlamadaCreated(deps, {
      agentId: 'ag1',
      datosCapturados: { nombreCliente: 'Ana', nivelUrgencia: 'alta' },
    });
    expect(notify).toHaveBeenCalledWith({
      companyId: 'c1',
      userIds: ['admin1', 'gestor1'],
      tipo: 'llamadas',
      titulo: 'Nueva llamada',
      cuerpo: 'Ana · urgencia alta',
      route: '/llamadas',
    });
  });

  it('usa Desconocido y omite urgencia si faltan datos', async () => {
    await handleLlamadaCreated(deps, { agentId: 'ag1' });
    expect(notify.mock.calls[0][0].cuerpo).toBe('Desconocido');
  });

  it('agent sin mapping: no notifica', async () => {
    await handleLlamadaCreated(deps, { agentId: 'zzz' });
    expect(notify).not.toHaveBeenCalled();
  });

  it('sin managers: no notifica', async () => {
    deps.managerIds = vi.fn(async () => []);
    await handleLlamadaCreated(deps, { agentId: 'ag1' });
    expect(notify).not.toHaveBeenCalled();
  });
});

describe('handleCasoWritten', () => {
  it('create con encargado notifica al encargado (no al creador)', async () => {
    await handleCasoWritten(deps, {
      cid: 'c1',
      id: 'k1',
      before: undefined,
      after: { titulo: 'Divorcio', encargadoId: 'u1', createdBy: 'u2' },
    });
    expect(notify).toHaveBeenCalledWith({
      companyId: 'c1',
      userIds: ['u1'],
      tipo: 'casos',
      titulo: 'Te han asignado un caso',
      cuerpo: 'Divorcio',
      route: '/casos/k1',
    });
  });

  it('create donde el creador se asigna a sí mismo: no notifica', async () => {
    await handleCasoWritten(deps, {
      cid: 'c1',
      id: 'k1',
      before: undefined,
      after: { titulo: 'X', encargadoId: 'u1', createdBy: 'u1' },
    });
    expect(notify).not.toHaveBeenCalled();
  });

  it('update con cambio de encargado notifica; actor = updatedBy', async () => {
    await handleCasoWritten(deps, {
      cid: 'c1',
      id: 'k1',
      before: { titulo: 'X', encargadoId: 'u1' },
      after: { titulo: 'X', encargadoId: 'u2', updatedBy: 'u3' },
    });
    expect(notify.mock.calls[0][0].userIds).toEqual(['u2']);
  });

  it('update sin cambio de encargado: no notifica', async () => {
    await handleCasoWritten(deps, {
      cid: 'c1',
      id: 'k1',
      before: { titulo: 'X', encargadoId: 'u1' },
      after: { titulo: 'Y', encargadoId: 'u1' },
    });
    expect(notify).not.toHaveBeenCalled();
  });

  it('borrado (after undefined): no notifica', async () => {
    await handleCasoWritten(deps, {
      cid: 'c1',
      id: 'k1',
      before: { titulo: 'X', encargadoId: 'u1' },
      after: undefined,
    });
    expect(notify).not.toHaveBeenCalled();
  });

  it('el encargado se auto-asigna en update: no notifica', async () => {
    await handleCasoWritten(deps, {
      cid: 'c1',
      id: 'k1',
      before: { titulo: 'X' },
      after: { titulo: 'X', encargadoId: 'u1', updatedBy: 'u1' },
    });
    expect(notify).not.toHaveBeenCalled();
  });
});

describe('handleContactoWritten', () => {
  const persona = { type: 'persona_fisica', nombre: 'Ana', apellidos: 'Ruiz' };

  it('assignedTo nuevo y miembro existente: notifica', async () => {
    await handleContactoWritten(deps, {
      cid: 'c1',
      id: 'ct1',
      before: undefined,
      after: { ...persona, assignedTo: 'u1', createdBy: 'u2' },
    });
    expect(notify).toHaveBeenCalledWith({
      companyId: 'c1',
      userIds: ['u1'],
      tipo: 'contactos',
      titulo: 'Te han asignado un contacto',
      cuerpo: 'Ana Ruiz',
      route: '/contactos/ct1',
    });
  });

  it('usa razonSocial para personas jurídicas', async () => {
    await handleContactoWritten(deps, {
      cid: 'c1',
      id: 'ct1',
      before: { assignedTo: 'u2' },
      after: { type: 'persona_juridica', razonSocial: 'ACME SL', assignedTo: 'u1', updatedBy: 'u3' },
    });
    expect(notify.mock.calls[0][0].cuerpo).toBe('ACME SL');
  });

  it('assignedTo que no es un uid de miembro (nombre CSV): warn y skip', async () => {
    await handleContactoWritten(deps, {
      cid: 'c1',
      id: 'ct1',
      before: undefined,
      after: { ...persona, assignedTo: 'Maria Lopez' },
    });
    expect(deps.isMember).toHaveBeenCalledWith('c1', 'Maria Lopez');
    expect(notify).not.toHaveBeenCalled();
  });

  it('sin cambio o borrado: no notifica', async () => {
    await handleContactoWritten(deps, {
      cid: 'c1',
      id: 'ct1',
      before: { assignedTo: 'u1' },
      after: { ...persona, assignedTo: 'u1' },
    });
    await handleContactoWritten(deps, { cid: 'c1', id: 'ct1', before: { assignedTo: 'u1' }, after: undefined });
    expect(notify).not.toHaveBeenCalled();
  });

  it('el actor no se notifica a sí mismo', async () => {
    await handleContactoWritten(deps, {
      cid: 'c1',
      id: 'ct1',
      before: undefined,
      after: { ...persona, assignedTo: 'u1', createdBy: 'u1' },
    });
    expect(notify).not.toHaveBeenCalled();
  });
});

describe('handleEventoWritten', () => {
  it('notifica invitados nuevos y responsable, sin creador/actor', async () => {
    await handleEventoWritten(deps, {
      cid: 'c1',
      before: undefined,
      after: { titulo: 'Reunión', invitados: ['u1', 'u2'], responsableId: 'u3', creadoPor: 'u1' },
    });
    expect(notify).toHaveBeenCalledTimes(1);
    const arg = notify.mock.calls[0][0];
    expect(arg.userIds.sort()).toEqual(['u2', 'u3']);
    expect(arg).toMatchObject({
      tipo: 'eventos',
      titulo: 'Nuevo evento',
      cuerpo: 'Reunión',
      route: '/calendario',
    });
  });

  it("expande 'todos' a miembros activos", async () => {
    await handleEventoWritten(deps, {
      cid: 'c1',
      before: undefined,
      after: { titulo: 'Todos', invitados: 'todos', creadoPor: 'u1' },
    });
    expect(notify.mock.calls[0][0].userIds).toEqual(['u2', 'u3']);
  });

  it('update sin nuevos destinatarios: no notifica', async () => {
    await handleEventoWritten(deps, {
      cid: 'c1',
      before: { invitados: ['u1'] },
      after: { titulo: 'Reunión', invitados: ['u1'], creadoPor: 'u9' },
    });
    expect(notify).not.toHaveBeenCalled();
  });

  it('borrado: no notifica', async () => {
    await handleEventoWritten(deps, { cid: 'c1', before: { invitados: ['u1'] }, after: undefined });
    expect(notify).not.toHaveBeenCalled();
  });
});

describe('handleHitoWritten', () => {
  it('notifica nuevos asignados con ruta al caso', async () => {
    await handleHitoWritten(deps, {
      cid: 'c1',
      before: { asignadosA: ['u1'], casoId: 'k1' },
      after: { titulo: 'Presentar demanda', casoId: 'k1', asignadosA: ['u1', 'u2'], updatedBy: 'u3' },
    });
    expect(notify).toHaveBeenCalledWith({
      companyId: 'c1',
      userIds: ['u2'],
      tipo: 'hitos',
      titulo: 'Te han asignado un hito',
      cuerpo: 'Presentar demanda',
      route: '/casos/k1',
    });
  });

  it('soporta el campo legacy asignadoA', async () => {
    await handleHitoWritten(deps, {
      cid: 'c1',
      before: undefined,
      after: { titulo: 'H', casoId: 'k1', asignadoA: 'u1', createdBy: 'u2' },
    });
    expect(notify.mock.calls[0][0].userIds).toEqual(['u1']);
  });

  it('borrado o sin cambios: no notifica', async () => {
    await handleHitoWritten(deps, { cid: 'c1', before: { asignadosA: ['u1'] }, after: undefined });
    await handleHitoWritten(deps, {
      cid: 'c1',
      before: { asignadosA: ['u1'] },
      after: { titulo: 'H', casoId: 'k1', asignadosA: ['u1'] },
    });
    expect(notify).not.toHaveBeenCalled();
  });
});
