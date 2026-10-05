import { describe, it, expect } from 'vitest';
import { validarRutaEnvio, EXPIRA_ENLACE_MS, DIAS_VALIDEZ_ENLACE } from './accionDocPath';

describe('validarRutaEnvio', () => {
  const ok = 'companies/c1/acciones_envios/AbC123_x-9.docx';

  it('acepta un .docx directamente bajo acciones_envios del tenant', () => {
    expect(validarRutaEnvio('c1', ok)).toBe(true);
  });

  it('rechaza otro tenant', () => {
    expect(validarRutaEnvio('c2', ok)).toBe(false);
  });

  it('rechaza traversal y subcarpetas', () => {
    expect(validarRutaEnvio('c1', 'companies/c1/acciones_envios/../docTemplates/x.docx')).toBe(false);
    expect(validarRutaEnvio('c1', 'companies/c1/acciones_envios/a/b.docx')).toBe(false);
  });

  it('rechaza otras carpetas y extensiones', () => {
    expect(validarRutaEnvio('c1', 'companies/c1/casos/x.docx')).toBe(false);
    expect(validarRutaEnvio('c1', 'companies/c1/acciones_envios/x.pdf')).toBe(false);
  });

  it('rechaza companyId con caracteres peligrosos (no se usa como regex)', () => {
    expect(validarRutaEnvio('.*', ok)).toBe(false);
    expect(validarRutaEnvio('', 'companies//acciones_envios/x.docx')).toBe(false);
  });

  it('rechaza entradas no string', () => {
    expect(validarRutaEnvio('c1', undefined as unknown as string)).toBe(false);
  });
});

describe('validez del enlace', () => {
  it('es el máximo de una URL firmada v4 (7 días)', () => {
    expect(DIAS_VALIDEZ_ENLACE).toBe(7);
    expect(EXPIRA_ENLACE_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });
});
