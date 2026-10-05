import { describe, it, expect } from 'vitest';
import {
  normalizarTelefono,
  construirUrlCanal,
  excedeLimiteUrl,
  canalDisponible,
} from './url-canal';

describe('normalizarTelefono', () => {
  it('añade prefijo por defecto a un móvil español de 9 dígitos', () => {
    expect(normalizarTelefono('612 34 56 78')).toBe('34612345678');
  });
  it('respeta +prefijo', () => {
    expect(normalizarTelefono('+44 7911 123456')).toBe('447911123456');
  });
  it('convierte 00 inicial en prefijo internacional', () => {
    expect(normalizarTelefono('0034 612345678')).toBe('34612345678');
  });
  it('limpia guiones, paréntesis y puntos', () => {
    expect(normalizarTelefono('(612)-345.678')).toBe('34612345678');
  });
  it('usa un prefijo por defecto distinto', () => {
    expect(normalizarTelefono('612345678', '52')).toBe('52612345678');
  });
  it('devuelve null para vacío, undefined o basura', () => {
    expect(normalizarTelefono('')).toBeNull();
    expect(normalizarTelefono(undefined)).toBeNull();
    expect(normalizarTelefono('abc')).toBeNull();
  });
  it('devuelve null si es demasiado corto o largo para E.164', () => {
    expect(normalizarTelefono('12345')).toBeNull();
    expect(normalizarTelefono('+1234567890123456')).toBeNull();
  });
  it('no duplica el prefijo si ya empieza por él sin +', () => {
    expect(normalizarTelefono('34612345678')).toBe('34612345678');
  });
});

describe('construirUrlCanal', () => {
  const base = { to: ['a@x.com', 'b@y.com'], asunto: 'Hola & adiós', cuerpo: 'Línea 1\nLínea 2 ñ' };

  it('mailto con destinatarios separados por coma y texto codificado', () => {
    const url = construirUrlCanal('mail', base);
    expect(url.startsWith('mailto:a@x.com,b@y.com?')).toBe(true);
    expect(url).toContain('subject=Hola%20%26%20adi%C3%B3s');
    expect(url).toContain('body=L%C3%ADnea%201%0AL%C3%ADnea%202%20%C3%B1');
  });

  it('gmail compose', () => {
    const url = construirUrlCanal('gmail', base);
    expect(url.startsWith('https://mail.google.com/mail/?view=cm&fs=1&to=')).toBe(true);
    expect(url).toContain('to=a%40x.com%2Cb%40y.com');
    expect(url).toContain('&su=Hola%20%26%20adi%C3%B3s');
    expect(url).toContain('&body=');
  });

  it('outlook deeplink', () => {
    const url = construirUrlCanal('outlook', base);
    expect(url.startsWith('https://outlook.office.com/mail/deeplink/compose?to=')).toBe(true);
    expect(url).toContain('&subject=Hola%20%26%20adi%C3%B3s');
    expect(url).toContain('&body=');
  });

  it('whatsapp: asunto en negrita como primera línea', () => {
    const url = construirUrlCanal('whatsapp', { ...base, telefono: '34612345678' });
    expect(url.startsWith('https://wa.me/34612345678?text=')).toBe(true);
    const texto = decodeURIComponent(url.split('text=')[1]);
    expect(texto).toBe('*Hola & adiós*\n\nLínea 1\nLínea 2 ñ');
  });

  it('whatsapp sin asunto no añade línea de negrita', () => {
    const url = construirUrlCanal('whatsapp', { to: [], asunto: '', cuerpo: 'Hola', telefono: '34612345678' });
    expect(decodeURIComponent(url.split('text=')[1])).toBe('Hola');
  });

  it('whatsapp sin teléfono lanza error', () => {
    expect(() => construirUrlCanal('whatsapp', base)).toThrow();
  });
});

describe('excedeLimiteUrl', () => {
  it('usa 2000 por defecto', () => {
    expect(excedeLimiteUrl('x'.repeat(2000))).toBe(false);
    expect(excedeLimiteUrl('x'.repeat(2001))).toBe(true);
  });
  it('admite límite personalizado', () => {
    expect(excedeLimiteUrl('abcdef', 5)).toBe(true);
  });
});

describe('canalDisponible', () => {
  const conEmail = { email: 'a@x.com', mobile: '612345678' };
  const sinNada = { email: '', mobile: '' };

  it('canales de correo requieren email', () => {
    expect(canalDisponible('gmail', [conEmail])).toEqual({ ok: true });
    const r = canalDisponible('outlook', [sinNada]);
    expect(r.ok).toBe(false);
    expect(r.motivo).toBeTruthy();
  });
  it('correo ok si al menos uno tiene email', () => {
    expect(canalDisponible('mail', [sinNada, conEmail]).ok).toBe(true);
  });
  it('whatsapp requiere móvil válido', () => {
    expect(canalDisponible('whatsapp', [conEmail]).ok).toBe(true);
    expect(canalDisponible('whatsapp', [{ email: 'a@x.com', mobile: '123' }]).ok).toBe(false);
  });
  it('whatsapp admite un único destinatario', () => {
    const r = canalDisponible('whatsapp', [conEmail, conEmail]);
    expect(r.ok).toBe(false);
    expect(r.motivo).toMatch(/uno/i);
  });
  it('sin contactos no está disponible', () => {
    expect(canalDisponible('gmail', []).ok).toBe(false);
  });
});
