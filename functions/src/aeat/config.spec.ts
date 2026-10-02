import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DEFAULT_ESPERA_S,
  HTTP_TIMEOUT_MS,
  ID_VERSION,
  MAX_BACKOFF_S,
  SIF_VERSION,
  SISTEMA_INFORMATICO,
  impuestoDeEmpresa,
  numeroInstalacion,
} from './config';
import { validarNif } from './nif';

const CAS_IVA = [
  'andalucia',
  'aragon',
  'asturias',
  'baleares',
  'cantabria',
  'castilla_la_mancha',
  'castilla_y_leon',
  'cataluna',
  'extremadura',
  'galicia',
  'la_rioja',
  'madrid',
  'murcia',
  'navarra',
  'pais_vasco',
  'valencia',
];

describe('constantes', () => {
  it('valores de protocolo y flujo', () => {
    expect(ID_VERSION).toBe('1.0');
    expect(SIF_VERSION).toBe('1.0.0');
    expect(DEFAULT_ESPERA_S).toBe(60);
    expect(HTTP_TIMEOUT_MS).toBe(30000);
    expect(MAX_BACKOFF_S).toBe(3600);
  });
});

describe('SISTEMA_INFORMATICO', () => {
  it('R4.3 trae los datos del productor con los formatos del XSD', () => {
    expect(SISTEMA_INFORMATICO.nombreSistemaInformatico).toBe('Zoem');
    expect(SISTEMA_INFORMATICO.idSistemaInformatico).toMatch(/^[A-Z0-9]{2}$/);
    expect(SISTEMA_INFORMATICO.version).toBe(SIF_VERSION);
    expect(SISTEMA_INFORMATICO.tipoUsoPosibleSoloVerifactu).toBe('S');
    expect(SISTEMA_INFORMATICO.tipoUsoPosibleMultiOT).toBe('S');
    expect(SISTEMA_INFORMATICO.indicadorMultiplesOT).toBe('N');
    expect(SISTEMA_INFORMATICO.nombreRazon.length).toBeGreaterThan(0);
    expect(SISTEMA_INFORMATICO.nif.length).toBeGreaterThan(0);
  });

  it('el productor es Víctor de Frutos con un NIF válido (AEAT rechaza un NIF inventado con 4109)', () => {
    expect(SISTEMA_INFORMATICO.nif).toBe('47287107G');
    expect(SISTEMA_INFORMATICO.nombreRazon).toBe('DE FRUTOS DE FRUTOS VICTOR');
    expect(validarNif(SISTEMA_INFORMATICO.nif).ok).toBe(true);
  });

  it('no quedan valores del productor marcados como provisionales', () => {
    const fuente = readFileSync(join(__dirname, 'config.ts'), 'utf8');
    expect(fuente).not.toContain('PROVISIONAL');
  });
});

describe('numeroInstalacion', () => {
  it('S4.3 es estable para el mismo companyId', () => {
    expect(numeroInstalacion('abc123')).toBe(numeroInstalacion('abc123'));
    expect(numeroInstalacion('abc123')).toBe('ZOEM-abc123');
  });

  it('S4.3 empresas distintas dan valores distintos', () => {
    expect(numeroInstalacion('abc123')).not.toBe(numeroInstalacion('abc124'));
  });

  it('se recorta a 100 caracteres', () => {
    const largo = numeroInstalacion('x'.repeat(300));
    expect(largo).toHaveLength(100);
    expect(largo.startsWith('ZOEM-x')).toBe(true);
  });
});

describe('impuestoDeEmpresa', () => {
  it('S3.6 canarias no soportada (IGIC)', () => {
    const r = impuestoDeEmpresa('canarias');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toMatch(/IGIC/);
  });

  it('S3.7 ceuta y melilla no soportadas (IPSI)', () => {
    for (const ca of ['ceuta', 'melilla']) {
      const r = impuestoDeEmpresa(ca);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.motivo).toMatch(/IPSI/);
    }
  });

  it('el resto de comunidades usa IVA (01)', () => {
    expect(CAS_IVA).toHaveLength(16);
    for (const ca of CAS_IVA) {
      expect(impuestoDeEmpresa(ca)).toEqual({ ok: true, impuesto: '01' });
    }
  });
});
