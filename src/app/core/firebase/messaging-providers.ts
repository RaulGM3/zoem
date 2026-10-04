/**
 * Firebase Messaging web solo se provee en navegador con Service Worker.
 * En nativo (Capacitor) se usa el plugin push; en SSR/tests no hay navigator.
 */
export function shouldProvideWebMessaging(isNative: boolean, nav: object | undefined): boolean {
  return !isNative && !!nav && 'serviceWorker' in nav;
}
