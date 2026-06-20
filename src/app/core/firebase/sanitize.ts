/**
 * Limpieza defensiva de payloads antes de escribir en Firestore.
 *
 * Firestore REVIENTA con "Function addDoc() called with invalid data.
 * Unsupported field value: undefined" si cualquier campo es `undefined`.
 * Esta función elimina recursivamente las claves `undefined` SIN tocar
 * valores válidos (null, 0, '', false) ni instancias especiales (Date,
 * sentinels de Firestore como serverTimestamp/FieldValue, etc.).
 *
 * Lógica PURA — testeable y reutilizable en todos los services.
 */

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  // Arrays no son "plain object" para este propósito.
  if (Array.isArray(value)) return false;
  // Sentinels de Firestore (serverTimestamp/FieldValue, arrayUnion, etc.)
  // exponen `_methodName`: se preservan por referencia aunque sean "planos".
  if ('_methodName' in value) return false;
  // Instancias con prototipo propio (Date, Timestamp, FieldValue sentinels,
  // DocumentReference, GeoPoint, Bytes…) NO se deben recorrer ni clonar:
  // se preservan por referencia.
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Devuelve una copia del valor sin claves `undefined` en ningún nivel.
 * No muta la entrada.
 */
export function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedDeep(item)) as unknown as T;
  }

  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      if (val === undefined) continue;
      out[key] = stripUndefinedDeep(val);
    }
    return out as T;
  }

  // Primitivos, null, Date, sentinels, etc. → tal cual.
  return value;
}
