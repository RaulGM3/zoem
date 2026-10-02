import { describe, it, expect, vi, afterEach } from 'vitest';
import { cuentaServicioVerifactu } from './config';

describe('cuentaServicioVerifactu', () => {
  it('construye el email completo del proyecto', () => {
    expect(cuentaServicioVerifactu('vertey-b924b')).toBe('verifactu-sender@vertey-b924b.iam.gserviceaccount.com');
  });

  it('sin proyecto conocido devuelve la forma corta (solo tests/emulador)', () => {
    expect(cuentaServicioVerifactu(undefined)).toBe('verifactu-sender@');
    expect(cuentaServicioVerifactu('')).toBe('verifactu-sender@');
  });
});

// Cableado: las funciones que LEEN el certificado corren con la cuenta dedicada (la de cómputo por defecto no puede leer secrets).
// El email va COMPLETO: firebase-tools solo expande la forma corta `nombre@` para la función, no para el job de
// Cloud Scheduler de verifactuDrain (400 "invalid argument" al desplegar con `verifactu-sender@`).
describe('cuenta de servicio de Verifactu', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it.each(['verifactuSubmit', 'verifactuDrain'] as const)('%s usa verifactu-sender del proyecto desplegado', async (nombre) => {
    vi.stubEnv('GCLOUD_PROJECT', 'vertey-b924b');
    vi.resetModules();
    const modulo = nombre === 'verifactuSubmit' ? await import('./verifactuSubmit') : await import('./verifactuDrain');
    const fn = nombre === 'verifactuSubmit' ? (modulo as typeof import('./verifactuSubmit')).verifactuSubmit : (modulo as typeof import('./verifactuDrain')).verifactuDrain;
    expect(fn.__endpoint.serviceAccountEmail).toBe('verifactu-sender@vertey-b924b.iam.gserviceaccount.com');
  });
});
