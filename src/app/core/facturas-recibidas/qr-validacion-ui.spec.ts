import { describe, it, expect } from 'vitest';
import {
  anuncioValidacionQr,
  mensajeErrorValidarQr,
  puedeValidarQr,
  vistaQrValidacion,
} from './qr-validacion-ui';
import { factura } from '../../../testing/facturas-recibidas';

const QR = { url: 'https://x', nif: 'B1', numserie: 'F1', fecha: '01-04-2026', importe: 1 };

describe('vistaQrValidacion', () => {
  it('sin_qr no muestra insignia', () => {
    expect(vistaQrValidacion({ estado: 'sin_qr' })).toBeNull();
  });

  it('cada estado tiene una etiqueta de texto distinta (no depende solo del color)', () => {
    const estados = ['pendiente', 'encontrada', 'no_encontrada', 'no_verificable', 'error'] as const;
    const etiquetas = estados.map((estado) => vistaQrValidacion({ estado })!.etiqueta);
    expect(new Set(etiquetas).size).toBe(5);
    expect(etiquetas.every((e) => e.length > 0)).toBe(true);
  });

  it('error expone el mensaje del servidor y el enlace de consulta manual', () => {
    const v = vistaQrValidacion({ estado: 'error', mensaje: 'La AEAT respondió con HTTP 500.', urlConsulta: 'https://aeat/x' })!;
    expect(v.detalle).toBe('La AEAT respondió con HTTP 500.');
    expect(v.urlConsulta).toBe('https://aeat/x');
    expect(v.tono).toBe('danger');
  });

  it('encontrada es tono success y no_encontrada warning', () => {
    expect(vistaQrValidacion({ estado: 'encontrada' })!.tono).toBe('success');
    expect(vistaQrValidacion({ estado: 'no_encontrada' })!.tono).toBe('warning');
  });
});

describe('puedeValidarQr', () => {
  it('solo registradas con QR en estado pendiente o error', () => {
    expect(puedeValidarQr(factura({ id: 'a', qr: QR, qrValidacion: { estado: 'pendiente' } }))).toBe(true);
    expect(puedeValidarQr(factura({ id: 'a', qr: QR, qrValidacion: { estado: 'error' } }))).toBe(true);
    expect(puedeValidarQr(factura({ id: 'a', qr: QR, qrValidacion: { estado: 'encontrada' } }))).toBe(false);
    expect(puedeValidarQr(factura({ id: 'a', qrValidacion: { estado: 'sin_qr' } }))).toBe(false);
    expect(puedeValidarQr(factura({ id: 'a', qr: QR, qrValidacion: { estado: 'pendiente' }, estado: 'anulada' }))).toBe(false);
  });
});

describe('mensajeErrorValidarQr', () => {
  const m = (code: string) => mensajeErrorValidarQr({ code });
  it('traduce los códigos de HttpsError a mensajes en español', () => {
    expect(m('functions/permission-denied')).toMatch(/permiso/i);
    expect(m('functions/unauthenticated')).toMatch(/sesión/i);
    expect(m('functions/not-found')).toMatch(/no existe|no se encontr/i);
    expect(m('functions/failed-precondition')).toMatch(/QR/);
    expect(m('functions/unavailable')).toMatch(/conexi|inténtalo/i);
  });
  it('cualquier otro error da un mensaje genérico', () => {
    expect(mensajeErrorValidarQr(new Error('boom'))).toMatch(/no se pudo validar/i);
    expect(mensajeErrorValidarQr({ code: 'functions/internal' })).toMatch(/no se pudo validar/i);
  });
});

describe('anuncioValidacionQr', () => {
  it('incluye la referencia y la etiqueta; en error añade el detalle', () => {
    expect(anuncioValidacionQr('F-1', { estado: 'encontrada' })).toMatch(/^F-1: /);
    expect(anuncioValidacionQr('F-1', { estado: 'error', mensaje: 'Fallo' })).toMatch(/Fallo/);
  });
  it('sin_qr no anuncia nada', () => {
    expect(anuncioValidacionQr('F-1', { estado: 'sin_qr' })).toBeNull();
  });
});
