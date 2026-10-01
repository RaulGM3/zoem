import { describe, it, expect } from 'vitest';
import type { InvoiceStatus } from '../services/invoice.service';
import type { VerifactuEstado } from '../../interfaces/verifactu.interface';
import {
  formatoAntiguedad,
  motivoBloqueoVerifactu,
  tipoReintento,
  verifactuBloqueada,
  vistaVerifactu,
} from './verifactu-ui';

const AHORA = Date.parse('2026-10-01T10:00:00Z');

function inv(verifactu?: VerifactuEstado, status: InvoiceStatus = 'pendiente') {
  return { status, verifactu };
}

describe('verifactuBloqueada / motivoBloqueoVerifactu (R9.4, S9.6)', () => {
  it.each(['pendiente', 'en_cola', 'enviado'] as const)('bloquea la edición en estado %s', (estado) => {
    const factura = inv({ estado, tipoRegistro: 'alta' });
    expect(verifactuBloqueada(factura)).toBe(true);
    expect(motivoBloqueoVerifactu(factura)).toEqual(expect.stringContaining('Verifactu'));
  });

  it.each([undefined, 'error', 'no_aplica'] as const)('permite editar con estado %s', (estado) => {
    const factura = inv(estado ? { estado, tipoRegistro: 'alta' } : undefined);
    expect(verifactuBloqueada(factura)).toBe(false);
    expect(motivoBloqueoVerifactu(factura)).toBeNull();
  });

  it('el motivo distingue un registro en curso de uno ya registrado', () => {
    const enCurso = motivoBloqueoVerifactu(inv({ estado: 'en_cola', tipoRegistro: 'alta' }));
    const registrado = motivoBloqueoVerifactu(inv({ estado: 'enviado', tipoRegistro: 'alta' }));
    expect(enCurso).toMatch(/pendiente|en curso/i);
    expect(registrado).toMatch(/ya registrada/i);
    expect(enCurso).not.toBe(registrado);
  });
});

describe('tipoReintento (R9.3)', () => {
  it.each(['error', 'pendiente', 'en_cola'] as const)('alta en %s -> reintenta alta', (estado) => {
    expect(tipoReintento(inv({ estado, tipoRegistro: 'alta' }))).toBe('alta');
  });

  it.each([undefined, 'enviado', 'no_aplica'] as const)('alta en %s -> no hay reintento', (estado) => {
    expect(tipoReintento(inv(estado ? { estado, tipoRegistro: 'alta' } : undefined))).toBeNull();
  });

  it('factura anulada cuya anulación falló -> reintenta anulación (el alta sigue enviado)', () => {
    const factura = inv(
      { estado: 'enviado', tipoRegistro: 'alta', anulacion: { estado: 'error', errorMessage: 'x' } },
      'anulada',
    );
    expect(tipoReintento(factura)).toBe('anulacion');
  });

  it('factura anulada con la anulación ya enviada -> sin reintento', () => {
    const factura = inv({ estado: 'enviado', tipoRegistro: 'alta', anulacion: { estado: 'enviado' } }, 'anulada');
    expect(tipoReintento(factura)).toBeNull();
  });
});

describe('formatoAntiguedad', () => {
  it.each([
    ['2026-10-01T09:59:40Z', 'hace menos de 1 min'],
    ['2026-10-01T09:55:00Z', 'hace 5 min'],
    ['2026-10-01T07:00:00Z', 'hace 3 h'],
    ['2026-09-28T10:00:00Z', 'hace 3 d'],
  ])('%s -> %s', (iso, esperado) => {
    expect(formatoAntiguedad(iso, AHORA)).toBe(esperado);
  });

  it('fecha inválida -> cadena vacía', () => {
    expect(formatoAntiguedad('no-es-fecha', AHORA)).toBe('');
  });
});

describe('vistaVerifactu (R9.2)', () => {
  it('sin verifactu -> null', () => {
    expect(vistaVerifactu(inv(undefined), AHORA)).toBeNull();
  });

  it('en_cola: etiqueta visible, espera al registro anterior y antigüedad (S9.4)', () => {
    const v = vistaVerifactu(
      inv({ estado: 'en_cola', tipoRegistro: 'alta', encoladoAt: '2026-10-01T09:57:00Z' }),
      AHORA,
    )!;
    expect(v.estado).toBe('en_cola');
    expect(v.etiqueta).toBe('En cola');
    expect(v.detalle).toBe('Esperando al registro anterior · hace 3 min');
    expect(v.reintentable).toBe(true);
  });

  it('pendiente: intentos y antigüedad desde generadoAt', () => {
    const v = vistaVerifactu(
      inv({ estado: 'pendiente', tipoRegistro: 'alta', attempts: 3, generadoAt: '2026-10-01T09:30:00Z' }),
      AHORA,
    )!;
    expect(v.etiqueta).toBe('Pendiente de AEAT');
    expect(v.detalle).toBe('Intento 3 · hace 30 min');
    expect(v.reintentable).toBe(true);
  });

  it('pendiente sin intentos ni fecha -> sin detalle', () => {
    const v = vistaVerifactu(inv({ estado: 'pendiente', tipoRegistro: 'alta' }), AHORA)!;
    expect(v.detalle).toBeNull();
  });

  it('enviado con CSV, sin aviso', () => {
    const v = vistaVerifactu(inv({ estado: 'enviado', tipoRegistro: 'alta', csv: 'CSV123' }), AHORA)!;
    expect(v.etiqueta).toBe('Registrada en AEAT');
    expect(v.csv).toBe('CSV123');
    expect(v.aviso).toBeNull();
    expect(v.reintentable).toBe(false);
    expect(v.tono).toBe('success');
  });

  it('enviado con aceptadoConErrores -> aviso con código y descripción (S9.3)', () => {
    const v = vistaVerifactu(
      inv({
        estado: 'enviado',
        tipoRegistro: 'alta',
        aceptadoConErrores: true,
        codigoError: '4102',
        descripcionError: 'El XML no cumple el esquema',
        csv: 'C1',
      }),
      AHORA,
    )!;
    expect(v.etiqueta).toBe('Aceptada con errores');
    expect(v.aviso).toBe('AEAT 4102: El XML no cumple el esquema');
    expect(v.tono).toBe('warning');
  });

  it('error de precondición: muestra el mensaje y permite reintentar (S9.1)', () => {
    const v = vistaVerifactu(
      inv({ estado: 'error', tipoRegistro: 'alta', errorKind: 'precondicion', errorMessage: 'Falta el NIF del cliente' }),
      AHORA,
    )!;
    expect(v.etiqueta).toBe('Error');
    expect(v.detalle).toBe('Falta el NIF del cliente');
    expect(v.reintentable).toBe(true);
    expect(v.tono).toBe('danger');
  });

  it('error AEAT: código y descripción', () => {
    const v = vistaVerifactu(
      inv({ estado: 'error', tipoRegistro: 'alta', errorKind: 'aeat', codigoError: '1100', descripcionError: 'Valor incorrecto' }),
      AHORA,
    )!;
    expect(v.detalle).toBe('AEAT 1100: Valor incorrecto');
  });

  it('error con mensaje y código -> ambos', () => {
    const v = vistaVerifactu(
      inv({ estado: 'error', tipoRegistro: 'alta', errorMessage: 'Rechazada', codigoError: '1100', descripcionError: 'Valor incorrecto' }),
      AHORA,
    )!;
    expect(v.detalle).toBe('Rechazada · AEAT 1100: Valor incorrecto');
  });

  it('error sin datos -> mensaje genérico', () => {
    const v = vistaVerifactu(inv({ estado: 'error', tipoRegistro: 'alta' }), AHORA)!;
    expect(v.detalle).toBe('No se pudo registrar en la AEAT');
  });

  it('no_aplica', () => {
    const v = vistaVerifactu(inv({ estado: 'no_aplica', tipoRegistro: 'alta' }), AHORA)!;
    expect(v.etiqueta).toBe('No aplica');
    expect(v.reintentable).toBe(false);
  });

  it('factura anulada con anulación en curso: muestra el estado de la anulación', () => {
    const v = vistaVerifactu(
      inv(
        { estado: 'enviado', tipoRegistro: 'alta', csv: 'ALTA', anulacion: { estado: 'pendiente', attempts: 2 } },
        'anulada',
      ),
      AHORA,
    )!;
    expect(v.tipo).toBe('anulacion');
    expect(v.etiqueta).toBe('Anulación pendiente de AEAT');
    expect(v.detalle).toBe('Intento 2');
    expect(v.csv).toBeNull();
  });

  it('factura anulada con anulación enviada: etiqueta de anulación registrada y CSV de la anulación', () => {
    const v = vistaVerifactu(
      inv(
        { estado: 'enviado', tipoRegistro: 'alta', csv: 'ALTA', anulacion: { estado: 'enviado', csv: 'BAJA' } },
        'anulada',
      ),
      AHORA,
    )!;
    expect(v.etiqueta).toBe('Anulación registrada');
    expect(v.csv).toBe('BAJA');
  });
});
