import { inject, Injectable } from '@angular/core';

import { ContactService } from './contact.service';
import { EventosService } from './eventos.service';
import { seguimientoToEvento, type SeguimientoDraft } from '../contactos/seguimiento';
import {
  getContactDisplayName, type Contact, type ContactStatus,
} from '../../interfaces/contact.interface';

/**
 * Orquesta el cambio de estado de un contacto y el compromiso que lo acompaña.
 *
 * El compromiso se materializa como un `Evento` de calendario, así que el
 * calendario, el feed ICS y el dashboard lo muestran sin conocer el concepto.
 */
@Injectable({ providedIn: 'root' })
export class SeguimientoContactoService {
  private readonly contactService = inject(ContactService);
  private readonly eventosService = inject(EventosService);

  /**
   * Cambia el estado y, si hay compromiso, lo programa.
   * El evento se crea después del cambio de estado a propósito: si el update
   * falla no queda un seguimiento huérfano apuntando a una fase que no ocurrió.
   */
  async cambiarEstado(
    contacto: Contact,
    status: ContactStatus,
    seguimiento?: SeguimientoDraft,
  ): Promise<void> {
    await this.contactService.updateContact(contacto.id, { status });
    if (!seguimiento) return;

    await this.crearEvento(contacto, contacto.status, status, seguimiento);
  }

  /** Programa un compromiso sin mover al contacto de fase (alta de contacto). */
  async programarSeguimiento(contacto: Contact, seguimiento: SeguimientoDraft): Promise<void> {
    await this.crearEvento(contacto, contacto.status, contacto.status, seguimiento);
  }

  private crearEvento(
    contacto: Contact,
    statusOrigen: ContactStatus,
    statusDestino: ContactStatus,
    seguimiento: SeguimientoDraft,
  ): Promise<unknown> {
    return this.eventosService.createEvento(
      seguimientoToEvento(seguimiento, {
        contactoId: contacto.id,
        contactoNombre: getContactDisplayName(contacto),
        statusOrigen,
        statusDestino,
      }),
    );
  }
}
