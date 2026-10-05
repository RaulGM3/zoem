import type { Canal } from '../../interfaces/accion.interface';

export interface DatosCanal {
  to: string[];
  asunto: string;
  cuerpo: string;
  /** E.164 sin `+` (ver `normalizarTelefono`). Obligatorio para WhatsApp. */
  telefono?: string;
}

export interface Disponibilidad {
  ok: boolean;
  motivo?: string;
}

export interface ContactoCanal {
  email?: string;
  mobile?: string;
}

/** Límite prudente de longitud de URL (navegadores/clientes de correo). */
export const LIMITE_URL = 2000;

/**
 * Normaliza un teléfono a dígitos E.164 (sin `+`). Acepta `+prefijo`, `00prefijo`
 * o un número nacional de hasta 9 dígitos (se le antepone `prefijoDefecto`).
 * Devuelve null si no es plausible (8–15 dígitos).
 */
export function normalizarTelefono(raw: string | null | undefined, prefijoDefecto = '34'): string | null {
  if (!raw) return null;
  const limpio = raw.replace(/[^\d+]/g, '');
  let digitos = limpio.replace(/\+/g, '');
  if (!digitos) return null;
  if (limpio.startsWith('+')) {
    // ya internacional
  } else if (digitos.startsWith('00')) {
    digitos = digitos.slice(2);
  } else if (digitos.length <= 9) {
    digitos = prefijoDefecto + digitos;
  }
  return digitos.length >= 8 && digitos.length <= 15 ? digitos : null;
}

const enc = encodeURIComponent;

/** URL que abre el canal con el mensaje precargado. */
export function construirUrlCanal(canal: Canal, datos: DatosCanal): string {
  const { to, asunto, cuerpo } = datos;
  switch (canal) {
    case 'mail': {
      const dest = to.map((t) => enc(t).replace('%40', '@')).join(',');
      return `mailto:${dest}?subject=${enc(asunto)}&body=${enc(cuerpo)}`;
    }
    case 'gmail':
      return `https://mail.google.com/mail/?view=cm&fs=1&to=${enc(to.join(','))}&su=${enc(asunto)}&body=${enc(cuerpo)}`;
    case 'outlook':
      return `https://outlook.office.com/mail/deeplink/compose?to=${enc(to.join(','))}&subject=${enc(asunto)}&body=${enc(cuerpo)}`;
    case 'whatsapp': {
      if (!datos.telefono) throw new Error('WhatsApp requiere un teléfono');
      const texto = asunto ? `*${asunto}*\n\n${cuerpo}` : cuerpo;
      return `https://wa.me/${datos.telefono}?text=${enc(texto)}`;
    }
  }
}

export function excedeLimiteUrl(url: string, limite = LIMITE_URL): boolean {
  return url.length > limite;
}

/** Emails no vacíos de los contactos (en orden). */
export function emailsDe(contactos: readonly ContactoCanal[]): string[] {
  return contactos.map((c) => c.email?.trim() ?? '').filter(Boolean);
}

/** Teléfono WhatsApp (E.164) del único contacto, o null. */
export function telefonoWhatsappDe(contactos: readonly ContactoCanal[]): string | null {
  return contactos.length === 1 ? normalizarTelefono(contactos[0].mobile) : null;
}

/** ¿Puede usarse este canal con estos destinatarios? Si no, `motivo` explica por qué. */
export function canalDisponible(canal: Canal, contactos: readonly ContactoCanal[]): Disponibilidad {
  if (contactos.length === 0) return { ok: false, motivo: 'No hay destinatarios' };
  if (canal === 'whatsapp') {
    if (contactos.length > 1) {
      return { ok: false, motivo: 'WhatsApp solo permite enviar a uno a la vez' };
    }
    return telefonoWhatsappDe(contactos)
      ? { ok: true }
      : { ok: false, motivo: 'El contacto no tiene un móvil válido' };
  }
  return emailsDe(contactos).length
    ? { ok: true }
    : { ok: false, motivo: 'Ningún destinatario tiene email' };
}
