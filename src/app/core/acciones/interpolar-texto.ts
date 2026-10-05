import { PLACEHOLDER_REGEX } from '../services/doc-generation.service';

/**
 * Interpolación para TEXTO PLANO (asunto/cuerpo de una acción): a diferencia de
 * `DocGenerationService.interpolate`, no escapa HTML — el destino es un
 * `mailto:`/URL de canal, no un documento. Las claves sin valor definido se
 * dejan tal cual (`{{clave}}`) para que el usuario las vea y las complete.
 */
export function interpolarTexto(texto: string, valores: Record<string, string>): string {
  return texto.replace(PLACEHOLDER_REGEX, (match, key: string) => {
    const valor = valores[key];
    return valor === undefined ? match : valor;
  });
}

/** Claves `{{x}}` de uno o varios textos que no tienen valor (ausente o vacío), sin duplicados. */
export function clavesFaltantes(textos: string | string[], valores: Record<string, string>): string[] {
  const lista = Array.isArray(textos) ? textos : [textos];
  const faltan = new Set<string>();
  for (const texto of lista) {
    for (const m of texto.matchAll(new RegExp(PLACEHOLDER_REGEX.source, 'g'))) {
      if (!valores[m[1]]) faltan.add(m[1]);
    }
  }
  return [...faltan];
}
