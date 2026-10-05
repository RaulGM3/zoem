import { describe, it, expect, vi } from 'vitest';
import { abrirUrlCanal } from './abrir-url';

const win = (ret: unknown = {}) => ({ open: vi.fn().mockReturnValue(ret) });

describe('abrirUrlCanal', () => {
  it('web + canal web: pestaña nueva y corta el vínculo con el opener', () => {
    const popup = { opener: 'x' as unknown };
    const w = win(popup);
    const abierto = abrirUrlCanal(w, 'https://wa.me/1', 'whatsapp', false);
    expect(w.open).toHaveBeenCalledWith('https://wa.me/1', '_blank');
    expect(popup.opener).toBeNull();
    expect(abierto).toBe(true);
  });

  it('web: si el navegador bloquea el popup devuelve false', () => {
    expect(abrirUrlCanal(win(null), 'https://mail.google.com/x', 'gmail', false)).toBe(false);
  });

  it('web + mailto: se abre en la misma pestaña (no deja pestaña en blanco)', () => {
    const w = win(null);
    const abierto = abrirUrlCanal(w, 'mailto:a@x.com', 'mail', false);
    expect(w.open).toHaveBeenCalledWith('mailto:a@x.com', '_self');
    expect(abierto).toBe(true);
  });

  it('nativo: usa _system para delegar en el sistema', () => {
    const w = win(null);
    const abierto = abrirUrlCanal(w, 'https://wa.me/1', 'whatsapp', true);
    expect(w.open).toHaveBeenCalledWith('https://wa.me/1', '_system');
    expect(abierto).toBe(true);
  });

  it('sin window devuelve false', () => {
    expect(abrirUrlCanal(null, 'https://x', 'gmail', false)).toBe(false);
  });
});
