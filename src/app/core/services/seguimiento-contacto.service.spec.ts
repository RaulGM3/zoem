import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { SeguimientoContactoService } from './seguimiento-contacto.service';
import { ContactService } from './contact.service';
import { EventosService } from './eventos.service';
import type { Contact } from '../../interfaces/contact.interface';

const CONTACTO = {
  id: 'ct-1',
  companyId: 'c-1',
  type: 'persona_fisica',
  nombre: 'Ana',
  apellidos: 'Ruiz',
  nifType: 'dni',
  email: 'ana@example.com',
  status: 'potencial',
} as Contact;

describe('SeguimientoContactoService', () => {
  let service: SeguimientoContactoService;
  let updateContact: ReturnType<typeof vi.fn>;
  let createEvento: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    updateContact = vi.fn().mockResolvedValue(undefined);
    createEvento = vi.fn().mockResolvedValue('ev-1');

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        SeguimientoContactoService,
        { provide: ContactService, useValue: { updateContact } },
        { provide: EventosService, useValue: { createEvento } },
      ],
    });
    service = TestBed.inject(SeguimientoContactoService);
  });

  it('sin compromiso sólo actualiza el estado del contacto', async () => {
    await service.cambiarEstado(CONTACTO, 'inactivo');

    expect(updateContact).toHaveBeenCalledWith('ct-1', { status: 'inactivo' });
    expect(createEvento).not.toHaveBeenCalled();
  });

  it('con compromiso actualiza el estado y programa el evento', async () => {
    await service.cambiarEstado(CONTACTO, 'pendiente_presupuesto', {
      entregable: 'Enviar propuesta de honorarios',
      fechaLimite: '2026-09-24',
      responsableId: 'u-abogado',
    });

    expect(updateContact).toHaveBeenCalledWith('ct-1', { status: 'pendiente_presupuesto' });
    expect(createEvento).toHaveBeenCalledTimes(1);

    const evento = createEvento.mock.calls[0][0];
    expect(evento.fecha).toBe('2026-09-24');
    expect(evento.todoDia).toBe(true);
    expect(evento.responsableId).toBe('u-abogado');
    expect(evento.invitados).toEqual(['u-abogado']);
    expect(evento.entregable).toBe('Enviar propuesta de honorarios');
    expect(evento.origen).toEqual({
      tipo: 'seguimiento_contacto',
      contactoId: 'ct-1',
      contactoNombre: 'Ana Ruiz',
      statusOrigen: 'potencial',
      statusDestino: 'pendiente_presupuesto',
    });
  });

  it('no programa el evento si falla el cambio de estado', async () => {
    updateContact.mockRejectedValueOnce(new Error('offline'));

    await expect(
      service.cambiarEstado(CONTACTO, 'pendiente_pago', {
        entregable: 'Emitir factura',
        fechaLimite: '2026-09-28',
        responsableId: 'u-abogado',
      }),
    ).rejects.toThrow('offline');

    expect(createEvento).not.toHaveBeenCalled();
  });

  it('programa un compromiso suelto sin tocar el estado del contacto', async () => {
    await service.programarSeguimiento(CONTACTO, {
      entregable: 'Contactar y agendar primera reunión',
      fechaLimite: '2026-09-23',
      responsableId: 'u-abogado',
    });

    expect(updateContact).not.toHaveBeenCalled();
    expect(createEvento).toHaveBeenCalledTimes(1);
    expect(createEvento.mock.calls[0][0].origen.statusOrigen).toBe('potencial');
    expect(createEvento.mock.calls[0][0].origen.statusDestino).toBe('potencial');
  });
});
