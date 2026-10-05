import { describe, it, expect } from 'vitest';
import { claveFactura } from './clave-factura';

describe('claveFactura', () => {
  it('es determinista', () => {
    expect(claveFactura('B12345674', 'A-1')).toBe(claveFactura('B12345674', 'A-1'));
  });

  it('normaliza el NIF (mayúsculas, separadores, prefijo ES)', () => {
    expect(claveFactura('es b-1234567.4', 'A-1')).toBe(claveFactura('B12345674', 'A-1'));
  });

  it('normaliza el número (trim y mayúsculas)', () => {
    expect(claveFactura('B12345674', '  fa/2026-1 ')).toBe(claveFactura('B12345674', 'FA/2026-1'));
  });

  it('distingue NIF y números distintos', () => {
    expect(claveFactura('B12345674', 'A-1')).not.toBe(claveFactura('B12345674', 'A-2'));
    expect(claveFactura('B12345674', 'A-1')).not.toBe(claveFactura('A12345674', 'A-1'));
  });

  it('no puede colisionar mezclando separador entre NIF y número', () => {
    expect(claveFactura('B1', '2|3')).not.toBe(claveFactura('B1|2', '3'));
  });

  it('es un id válido de Firestore: base64url sin "/" ni padding', () => {
    const id = claveFactura('B12345674', 'FA/2026/ñ-1');
    expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(id.length).toBeLessThan(1500);
  });
});
