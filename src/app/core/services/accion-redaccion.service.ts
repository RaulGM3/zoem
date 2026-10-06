import { inject, Injectable } from '@angular/core';
import { Schema } from 'firebase/ai';
import { AiService } from './ai.service';
import {
  construirPromptRedaccion, normalizarRedaccion, type SolicitudRedaccion, type TextoRedactado,
} from '../acciones/redaccion-ia';

export type ResultadoRedaccion = { ok: true; texto: TextoRedactado } | { ok: false; mensaje: string };

const SCHEMA = Schema.object({
  properties: { asunto: Schema.string(), cuerpo: Schema.string() },
});

const MENSAJE_FALLO = 'No se pudo redactar el mensaje. Inténtalo de nuevo o escríbelo a mano.';

/** Redacción asistida de acciones (email/WhatsApp) a partir de unas instrucciones del usuario. */
@Injectable({ providedIn: 'root' })
export class AccionRedaccionService {
  private readonly ai = inject(AiService);

  /** Nunca lanza: el usuario siempre puede seguir escribiendo a mano. */
  async redactar(s: SolicitudRedaccion): Promise<ResultadoRedaccion> {
    if (!s.instrucciones.trim()) return { ok: false, mensaje: 'Explica qué quieres que diga el mensaje.' };
    try {
      const model = this.ai.getJsonModel(SCHEMA);
      const result = await model.generateContent(construirPromptRedaccion(s));
      const texto = normalizarRedaccion(JSON.parse(result.response.text()));
      return texto ? { ok: true, texto } : { ok: false, mensaje: MENSAJE_FALLO };
    } catch {
      return { ok: false, mensaje: MENSAJE_FALLO };
    }
  }
}
