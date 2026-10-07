import { describe, it, expect } from 'vitest';
import { SECCIONES_CONFIG, seccionDesdeUrl } from './secciones';

describe('SECCIONES_CONFIG', () => {
  it('orden e ids', () => {
    expect(SECCIONES_CONFIG.map((s) => s.id)).toEqual(['empresa', 'usuarios', 'facturacion', 'tesoreria', 'dias-inhabiles']);
  });
  it('rutas bajo /configuracion', () => {
    expect(SECCIONES_CONFIG.map((s) => s.ruta)).toEqual([
      '/configuracion/empresa', '/configuracion/usuarios', '/configuracion/facturacion', '/configuracion/tesoreria',
      '/configuracion/dias-inhabiles',
    ]);
  });
  it('label y descripción presentes', () => {
    for (const s of SECCIONES_CONFIG) {
      expect(s.label.length).toBeGreaterThan(0);
      expect(s.descripcion.length).toBeGreaterThan(0);
    }
  });
});

describe('seccionDesdeUrl', () => {
  it('detecta sección ignorando query y fragmento', () => {
    expect(seccionDesdeUrl('/configuracion/empresa')).toBe('empresa');
    expect(seccionDesdeUrl('/configuracion/empresa?x=1')).toBe('empresa');
    expect(seccionDesdeUrl('/configuracion/tesoreria#a')).toBe('tesoreria');
    expect(seccionDesdeUrl('/configuracion/dias-inhabiles')).toBe('dias-inhabiles');
  });
  it('raíz y desconocidas -> null', () => {
    expect(seccionDesdeUrl('/configuracion')).toBeNull();
    expect(seccionDesdeUrl('/configuracion/')).toBeNull();
    expect(seccionDesdeUrl('/configuracion/otra')).toBeNull();
    expect(seccionDesdeUrl('/casos')).toBeNull();
  });
});
