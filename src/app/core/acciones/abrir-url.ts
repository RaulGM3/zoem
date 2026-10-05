import type { Canal } from '../../interfaces/accion.interface';

type VentanaMin = { open(url: string, target: string): { opener: unknown } | null };

/**
 * Abre la URL del canal. Devuelve `false` si el navegador la bloqueó (el
 * llamador debe ofrecer el enlace como alternativa manual).
 * - Nativo (Capacitor): `_system` delega en el sistema operativo.
 * - Web `mailto:`: `_self`, el handler de protocolo abre el cliente de correo
 *   sin dejar una pestaña en blanco ni sacar al usuario de la app.
 * - Web resto: pestaña nueva; `noopener` no se pasa como feature porque haría
 *   que `open` devolviera siempre null y no podríamos detectar el bloqueo.
 */
export function abrirUrlCanal(
  win: VentanaMin | null | undefined,
  url: string,
  canal: Canal,
  esNativo: boolean,
): boolean {
  if (!win) return false;
  if (esNativo) {
    win.open(url, '_system');
    return true;
  }
  if (canal === 'mail') {
    win.open(url, '_self');
    return true;
  }
  const popup = win.open(url, '_blank');
  if (!popup) return false;
  popup.opener = null;
  return true;
}
