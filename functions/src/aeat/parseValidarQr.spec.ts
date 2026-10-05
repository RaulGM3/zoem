import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { parseValidarQr } from './parseValidarQr';

const fixture = (nombre: string): string => readFileSync(join(__dirname, 'testing', nombre), 'utf8');

describe('parseValidarQr', () => {
  describe('capturas reales (2026-10-05, parámetros ficticios)', () => {
    it.each([
      ['validarqr-sandbox-nif-invalido.html'],
      ['validarqr-prod-nif-invalido.html'],
      ['validarqr-novf-sandbox-nif-invalido.html'],
    ])('%s -> error con el mensaje de la AEAT', (nombre) => {
      const r = parseValidarQr(fixture(nombre));
      expect(r.estado).toBe('error');
      expect(r.mensaje).toContain('El NIF tiene un formato erróneo o no es válido');
    });
  });

  // SYNTHETIC — replace with real capture (pending-user 7.1)
  describe('fixtures sintéticas (redacción del resultado NO observada)', () => {
    it('encontrada', () => {
      expect(parseValidarQr(fixture('validarqr-sintetica-encontrada.html')).estado).toBe('encontrada');
    });
    it('no encontrada (no se confunde con encontrada)', () => {
      expect(parseValidarQr(fixture('validarqr-sintetica-no-encontrada.html')).estado).toBe('no_encontrada');
    });
    it('no verificable', () => {
      expect(parseValidarQr(fixture('validarqr-sintetica-no-verificable.html')).estado).toBe('no_verificable');
    });
    it('ignora el texto fuera de <main> (pie de página)', () => {
      const html = '<html><main><p>Resultado desconocido</p></main><footer>Factura encontrada</footer></html>';
      expect(parseValidarQr(html).estado).toBe('error');
    });
  });

  describe('entradas no reconocidas -> error', () => {
    it('vacío', () => {
      expect(parseValidarQr('').estado).toBe('error');
    });
    it('sin <main>', () => {
      expect(parseValidarQr('<html><body>Factura encontrada</body></html>').estado).toBe('error');
    });
    it('mantenimiento', () => {
      const r = parseValidarQr('<main><p>Servicio no disponible temporalmente</p></main>');
      expect(r.estado).toBe('error');
      expect(r.mensaje).toBeTruthy();
    });
    it('un error con "no" y "encontrar" no se toma por encontrada', () => {
      expect(parseValidarQr('<main><p>No se ha encontrado</p></main>').estado).toBe('no_encontrada');
    });
  });
});
