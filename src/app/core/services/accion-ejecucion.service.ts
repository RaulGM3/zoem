import { inject, Injectable } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { DocTemplateService } from './doc-template.service';
import { DocGenerationService } from './doc-generation.service';
import { AccionDocService } from './accion-doc.service';
import { AccionRegistrosService, type AccionRegistroInput } from './accion-registros.service';
import { PlatformService } from './platform.service';
import type { Accion, Canal } from '../../interfaces/accion.interface';
import type { Contact } from '../../interfaces/contact.interface';
import { abrirUrlCanal } from '../acciones/abrir-url';
import {
  canalDisponible,
  construirUrlCanal,
  emailsDe,
  excedeLimiteUrl,
  telefonoWhatsappDe,
} from '../acciones/url-canal';

export interface EjecutarAccionInput {
  accion: Accion;
  contactos: Contact[];
  canal: Canal;
  /** Asunto y cuerpo FINALES (ya interpolados y editados por el usuario). */
  asunto: string;
  cuerpo: string;
  /** Valores de las variables de la plantilla de documento (solo si la acción tiene `docTemplateId`). */
  valoresDoc?: Record<string, string>;
  casoId?: string;
  hitoId?: string;
}

export interface EjecutarAccionResultado {
  registroId: string;
  url: string;
  cuerpoFinal: string;
  docPath?: string;
  docUrl?: string;
  /** La URL supera ~2000 caracteres: algunos clientes pueden truncar el cuerpo. */
  excedeLimite: boolean;
  /** `false` si el navegador bloqueó la apertura: ofrecer `url` como enlace manual. */
  abierto: boolean;
}

/**
 * Orquesta una acción: [documento -> docx -> Storage -> URL firmada] ->
 * cuerpo final -> URL del canal -> registro -> abrir la app.
 *
 * El registro se escribe ANTES de abrir: si las rules/red lo rechazan no se
 * envía nada sin dejar rastro. Ojo con los navegadores: tras awaits largos
 * (generar el docx) `window.open` puede bloquearse como popup; por eso se
 * devuelve `abierto` y `url` para mostrar un enlace de respaldo.
 */
@Injectable({ providedIn: 'root' })
export class AccionEjecucionService {
  private readonly templates = inject(DocTemplateService);
  private readonly docGen = inject(DocGenerationService);
  private readonly docService = inject(AccionDocService);
  private readonly registros = inject(AccionRegistrosService);
  private readonly platform = inject(PlatformService);
  private readonly document = inject(DOCUMENT);

  async ejecutar(input: EjecutarAccionInput): Promise<EjecutarAccionResultado> {
    const { accion, contactos, canal, asunto, cuerpo } = input;

    const disp = canalDisponible(canal, contactos);
    if (!disp.ok) throw new Error(disp.motivo);

    const registroId = this.registros.nuevoId();

    let docPath: string | undefined;
    let docUrl: string | undefined;
    if (accion.docTemplateId) {
      const template = await this.templates.getTemplate(accion.docTemplateId);
      if (!template) throw new Error('La plantilla de documento de esta acción ya no está disponible');
      const html = this.docGen.interpolate(template.html, input.valoresDoc ?? {});
      const blob = await this.docGen.generateDocxBlob(html, template.name);
      ({ path: docPath, url: docUrl } = await this.docService.subirYFirmar(registroId, blob));
    }

    const cuerpoFinal = docUrl ? `${cuerpo}\n\nDocumento: ${docUrl}` : cuerpo;
    const url = construirUrlCanal(canal, {
      to: emailsDe(contactos),
      asunto,
      cuerpo: cuerpoFinal,
      telefono: canal === 'whatsapp' ? (telefonoWhatsappDe(contactos) ?? undefined) : undefined,
    });

    const registro: AccionRegistroInput = {
      accionId: accion.id,
      accionNombre: accion.nombre,
      contactoIds: contactos.map((c) => c.id),
      canal,
      ...(input.casoId ? { casoId: input.casoId } : {}),
      ...(input.hitoId ? { hitoId: input.hitoId } : {}),
      ...(docPath ? { docPath } : {}),
    };
    await this.registros.crear(registroId, registro);

    const abierto = abrirUrlCanal(this.document.defaultView, url, canal, this.platform.isNative);

    return {
      registroId,
      url,
      cuerpoFinal,
      ...(docPath ? { docPath, docUrl } : {}),
      excedeLimite: excedeLimiteUrl(url),
      abierto,
    };
  }
}
