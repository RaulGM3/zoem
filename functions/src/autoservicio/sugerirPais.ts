import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { esCodigoPais, type CodigoPais } from '../paises/catalogo-paises';

type Cabeceras = Record<string, string | string[] | undefined>;

/**
 * País del visitante según la cabecera de geolocalización de Google (`x-appengine-country`, ISO-3166 alfa-2).
 * `null` si falta, es `ZZ` (desconocido) o no está en el catálogo: el cliente decide con otro plan B.
 */
export function paisDesdeCabeceras(headers: Cabeceras | undefined): CodigoPais | null {
  const bruto = headers?.['x-appengine-country'];
  const valor = (Array.isArray(bruto) ? bruto[0] : bruto)?.trim().toUpperCase();
  return valor && esCodigoPais(valor) ? valor : null;
}

/**
 * Sugerencia de país para el alta (el usuario siempre puede cambiarla).
 *
 * PENDIENTE DE VERIFICAR en un despliegue real: App Engine documenta `x-appengine-country`, pero no está
 * garantizado que Cloud Functions v2 (Cloud Run) la reenvíe. Si no llega, el callable devuelve `null` y el
 * cliente cae en la zona horaria del navegador. Plan B si hace falta: GeoIP con `x-forwarded-for`
 * (medir antes el efecto en el arranque en frío).
 *
 * Exige sesión y App Check, igual que `crearEmpresaAutoservicio`.
 */
export const sugerirPais = onCall<unknown, Promise<{ pais: CodigoPais | null }>>(
  { enforceAppCheck: true },
  async (request) => {
    if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Debes iniciar sesión');
    return { pais: paisDesdeCabeceras(request.rawRequest?.headers) };
  },
);
