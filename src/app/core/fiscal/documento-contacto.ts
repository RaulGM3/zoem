import type { Contact } from '../../interfaces';

/** Etiqueta del documento de identificación de un contacto (el documento español se muestra siempre como NIF). */
export function etiquetaDocumentoContacto(c: Contact): string {
  if (c.type === 'persona_fisica') {
    switch (c.nifType) {
      case 'dni': return 'DNI';
      case 'nie': return 'NIE';
      case 'pasaporte': return 'Pasaporte';
      case 'otro': return 'Otro';
      default: return 'NIF';
    }
  }
  switch (c.cifType) {
    case 'vat': return 'VAT';
    case 'otro': return 'Otro';
    default: return 'NIF';
  }
}
