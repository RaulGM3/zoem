/**
 * Id determinista de una factura recibida: unicidad (NIF emisor, número) por empresa sin colección
 * auxiliar. Un `create` de rules no puede pisar un doc existente y la transacción detecta el duplicado
 * con `tx.get(ref).exists`.
 */

import { normalizarNif } from '../fiscal/nif';

/** Número de factura comparable: sin espacios laterales y en mayúsculas. */
export function normalizarNumeroFactura(numero: string): string {
  return numero.trim().toUpperCase();
}

/** base64url (sin padding) del par `[NIF, NÚMERO]` normalizados, serializado como JSON para que ningún carácter del número pueda colisionar con el NIF. */
export function claveFactura(nif: string, numero: string): string {
  const bytes = new TextEncoder().encode(JSON.stringify([normalizarNif(nif), normalizarNumeroFactura(numero)]));
  let binario = '';
  for (const b of bytes) binario += String.fromCharCode(b);
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
