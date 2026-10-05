import { describe, it, expect } from 'vitest';
import { validarFacturaRecibida, type DatosFacturaRecibida } from './validar-factura-recibida';

const base = (): DatosFacturaRecibida => ({
  tipoFactura: 'F1',
  claveOperacion: '01',
  proveedor: { nombre: 'Proveedor SL', nif: 'B12345674' },
  numero: 'FA-1',
  fechaExpedicion: '2026-04-02',
  fechaRegistro: '2026-04-05',
  periodo303: { ejercicio: 2026, trimestre: 2 },
  lineasIva: [{ base: 100, tipo: 21, cuota: 21 }],
  total: 121,
});

const campos = (r: ReturnType<typeof validarFacturaRecibida>) => r.errores.map((e) => e.campo);

describe('validarFacturaRecibida', () => {
  it('acepta una factura correcta y aplica porcentajeDeducible 100 por defecto', () => {
    const r = validarFacturaRecibida(base());
    expect(r.ok).toBe(true);
    expect(r.errores).toEqual([]);
    expect(r.porcentajeDeducible).toBe(100);
  });

  it('exige NIF, número, fechas y líneas', () => {
    const r = validarFacturaRecibida({
      ...base(),
      proveedor: { nombre: '', nif: '' },
      numero: '  ',
      fechaExpedicion: '',
      fechaRegistro: '',
      lineasIva: [],
    });
    expect(r.ok).toBe(false);
    expect(campos(r)).toEqual(
      expect.arrayContaining(['proveedor.nif', 'proveedor.nombre', 'numero', 'fechaExpedicion', 'fechaRegistro', 'lineasIva']),
    );
  });

  it('rechaza un NIF con dígito de control erróneo', () => {
    expect(campos(validarFacturaRecibida({ ...base(), proveedor: { nombre: 'X', nif: 'B12345670' } }))).toContain('proveedor.nif');
  });

  it('solo admite F1/F2 con clave 01 (v1)', () => {
    const r = validarFacturaRecibida({ ...base(), tipoFactura: 'R1' as never, claveOperacion: '09' as never });
    expect(campos(r)).toEqual(expect.arrayContaining(['tipoFactura', 'claveOperacion']));
  });

  describe('cuota', () => {
    it('tolera +-0.01 entre cuota y base*tipo', () => {
      const r = validarFacturaRecibida({ ...base(), lineasIva: [{ base: 100.5, tipo: 21, cuota: 21.1 }], total: 121.6 });
      expect(r.ok).toBe(true);
    });

    it('señala la línea con cuota inconsistente', () => {
      const r = validarFacturaRecibida({
        ...base(),
        lineasIva: [
          { base: 100, tipo: 21, cuota: 21 },
          { base: 100, tipo: 10, cuota: 12 },
        ],
        total: 233,
      });
      expect(campos(r)).toContain('lineasIva.1.cuota');
      expect(campos(r)).not.toContain('lineasIva.0.cuota');
    });

    it('acepta tipos fuera de TipoIva (5 %) y rechaza fuera de 0..100', () => {
      expect(validarFacturaRecibida({ ...base(), lineasIva: [{ base: 100, tipo: 5, cuota: 5 }], total: 105 }).ok).toBe(true);
      expect(campos(validarFacturaRecibida({ ...base(), lineasIva: [{ base: 100, tipo: 101, cuota: 101 }], total: 201 }))).toContain(
        'lineasIva.0.tipo',
      );
    });

    it('una línea exenta exige causa y cuota 0', () => {
      const sinCausa = validarFacturaRecibida({ ...base(), lineasIva: [{ base: 100, tipo: 0, cuota: 0, exento: true }], total: 100 });
      expect(campos(sinCausa)).toContain('lineasIva.0.causaExencion');
      const conCausa = validarFacturaRecibida({
        ...base(),
        lineasIva: [{ base: 100, tipo: 0, cuota: 0, exento: true, causaExencion: 'E1' }],
        total: 100,
      });
      expect(conCausa.ok).toBe(true);
      const cuotaEnExenta = validarFacturaRecibida({
        ...base(),
        lineasIva: [{ base: 100, tipo: 21, cuota: 21, exento: true, causaExencion: 'E1' }],
        total: 121,
      });
      expect(campos(cuotaEnExenta)).toContain('lineasIva.0.cuota');
    });

    it('rechaza importes negativos (rectificativas fuera de v1)', () => {
      expect(campos(validarFacturaRecibida({ ...base(), lineasIva: [{ base: -100, tipo: 21, cuota: -21 }], total: -121 }))).toContain(
        'lineasIva.0.base',
      );
    });
  });

  describe('total', () => {
    it('debe ser la suma de base+cuota de todas las líneas (+-0.01)', () => {
      expect(campos(validarFacturaRecibida({ ...base(), total: 130 }))).toContain('total');
      expect(validarFacturaRecibida({ ...base(), total: 121.01 }).ok).toBe(true);
    });
  });

  describe('porcentajeDeducible', () => {
    it('acepta 0..100 y lo conserva', () => {
      const r = validarFacturaRecibida({ ...base(), porcentajeDeducible: 50 });
      expect(r.ok).toBe(true);
      expect(r.porcentajeDeducible).toBe(50);
      expect(validarFacturaRecibida({ ...base(), porcentajeDeducible: 0 }).ok).toBe(true);
    });

    it('rechaza fuera de rango o no numérico', () => {
      expect(campos(validarFacturaRecibida({ ...base(), porcentajeDeducible: 101 }))).toContain('porcentajeDeducible');
      expect(campos(validarFacturaRecibida({ ...base(), porcentajeDeducible: -1 }))).toContain('porcentajeDeducible');
      expect(campos(validarFacturaRecibida({ ...base(), porcentajeDeducible: Number.NaN }))).toContain('porcentajeDeducible');
    });
  });

  describe('periodo 303 y fechas', () => {
    it('error si el periodo es anterior al trimestre de la fecha de expedición', () => {
      const r = validarFacturaRecibida({ ...base(), periodo303: { ejercicio: 2026, trimestre: 1 } });
      expect(campos(r)).toContain('periodo303');
    });

    it('advertencia (no error) si es anterior al trimestre de la fecha de registro', () => {
      const r = validarFacturaRecibida({
        ...base(),
        fechaExpedicion: '2026-03-30',
        fechaRegistro: '2026-04-05',
        periodo303: { ejercicio: 2026, trimestre: 1 },
      });
      expect(r.ok).toBe(true);
      expect(r.advertencias.map((a) => a.campo)).toContain('periodo303');
    });

    it('sin avisos cuando coincide con el trimestre de registro', () => {
      expect(validarFacturaRecibida(base()).advertencias).toEqual([]);
    });

    it('permite aplazar la deducción a un trimestre posterior', () => {
      expect(validarFacturaRecibida({ ...base(), periodo303: { ejercicio: 2026, trimestre: 3 } }).ok).toBe(true);
    });

    it('rechaza un periodo mal formado', () => {
      expect(campos(validarFacturaRecibida({ ...base(), periodo303: { ejercicio: 2026, trimestre: 5 as never } }))).toContain('periodo303');
    });

    it('la fecha de registro no puede ser anterior a la de expedición', () => {
      expect(campos(validarFacturaRecibida({ ...base(), fechaRegistro: '2026-04-01' }))).toContain('fechaRegistro');
    });

    it('rechaza fechas con formato inválido', () => {
      expect(campos(validarFacturaRecibida({ ...base(), fechaExpedicion: '02/04/2026' }))).toContain('fechaExpedicion');
    });
  });
});
