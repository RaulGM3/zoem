import { describe, it, expect } from 'vitest';
import { translateFirebaseError } from './firebase-error';

/** Helper: fabrica un error tipo FirebaseError con un code concreto. */
function fbError(code: string, message = 'algo falló'): Error & { code: string } {
  const err = new Error(message) as Error & { code: string };
  err.name = 'FirebaseError';
  err.code = code;
  return err;
}

describe('translateFirebaseError (lógica pura de traducción)', () => {
  it('permission-denied → mensaje de permisos, NO reintentable', () => {
    const r = translateFirebaseError(fbError('permission-denied'));
    expect(r.code).toBe('permission-denied');
    expect(r.message.toLowerCase()).toContain('permiso');
    expect(r.retriable).toBe(false);
  });

  it('acepta el code con prefijo "firestore/" y lo normaliza', () => {
    const r = translateFirebaseError(fbError('firestore/permission-denied'));
    expect(r.code).toBe('permission-denied');
    expect(r.retriable).toBe(false);
  });

  it('unavailable → reintentable (problema de red/servidor transitorio)', () => {
    const r = translateFirebaseError(fbError('unavailable'));
    expect(r.retriable).toBe(true);
    expect(r.message.toLowerCase()).toContain('conexión');
  });

  it('deadline-exceeded y aborted → reintentables', () => {
    expect(translateFirebaseError(fbError('deadline-exceeded')).retriable).toBe(true);
    expect(translateFirebaseError(fbError('aborted')).retriable).toBe(true);
  });

  it('invalid-argument → datos inválidos, NO reintentable', () => {
    const r = translateFirebaseError(fbError('invalid-argument'));
    expect(r.code).toBe('invalid-argument');
    expect(r.message.toLowerCase()).toContain('datos');
    expect(r.retriable).toBe(false);
  });

  it('detecta el "called with invalid data / Unsupported field value: undefined" aunque no traiga code', () => {
    const raw = new Error(
      'Function addDoc() called with invalid data. Unsupported field value: undefined (found in field nif)'
    );
    const r = translateFirebaseError(raw);
    expect(r.code).toBe('invalid-argument');
    expect(r.retriable).toBe(false);
  });

  it('unauthenticated → sesión expirada, NO reintentable', () => {
    const r = translateFirebaseError(fbError('unauthenticated'));
    expect(r.message.toLowerCase()).toContain('sesión');
    expect(r.retriable).toBe(false);
  });

  it('code desconocido → mensaje genérico y reintentable (dejamos volver a intentar)', () => {
    const r = translateFirebaseError(fbError('some-weird-code'));
    expect(r.retriable).toBe(true);
    expect(r.message.length).toBeGreaterThan(0);
  });

  it('un error que no es de Firebase (sin code) → genérico reintentable', () => {
    const r = translateFirebaseError(new Error('boom'));
    expect(r.message.length).toBeGreaterThan(0);
    expect(r.retriable).toBe(true);
  });

  it('null/undefined no rompe → genérico', () => {
    expect(() => translateFirebaseError(null)).not.toThrow();
    expect(() => translateFirebaseError(undefined)).not.toThrow();
    expect(translateFirebaseError(null).message.length).toBeGreaterThan(0);
  });

  it('siempre devuelve technicalDetail con el code original para debug', () => {
    const r = translateFirebaseError(fbError('permission-denied', 'Missing or insufficient permissions.'));
    expect(r.technicalDetail).toContain('permission-denied');
  });
});
