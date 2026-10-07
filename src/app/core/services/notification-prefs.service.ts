import { inject, Injectable } from '@angular/core';
import { doc, Firestore, getDoc, updateDoc } from '@angular/fire/firestore';

export interface NotificationPrefs {
  llamadas: boolean;
  casos: boolean;
  contactos: boolean;
  eventos: boolean;
  hitos: boolean;
  plazo: boolean;
  push: boolean;
}

export const PREF_KEYS = ['llamadas', 'casos', 'contactos', 'eventos', 'hitos', 'plazo', 'push'] as const;

/** Ausente = true (mismo criterio que el backend notifyUsers). */
export const DEFAULT_PREFS: NotificationPrefs = {
  llamadas: true,
  casos: true,
  contactos: true,
  eventos: true,
  hitos: true,
  plazo: true,
  push: true,
};

/** Normaliza lo guardado: solo claves conocidas, solo booleanos, resto = true. */
export function resolvePrefs(raw: Record<string, unknown> | null | undefined): NotificationPrefs {
  const out = { ...DEFAULT_PREFS };
  for (const key of PREF_KEYS) {
    const v = raw?.[key];
    if (typeof v === 'boolean') out[key] = v;
  }
  return out;
}

/** Preferencias de notificación en users/{uid}.notificationPrefs. */
@Injectable({ providedIn: 'root' })
export class NotificationPrefsService {
  private readonly firestore = inject(Firestore);

  async load(uid: string): Promise<NotificationPrefs> {
    const snap = await getDoc(doc(this.firestore, 'users', uid));
    const data = snap.exists() ? (snap.data() as { notificationPrefs?: Record<string, unknown> }) : undefined;
    return resolvePrefs(data?.notificationPrefs);
  }

  /** Escribe el mapa completo (las rules validan claves y tipos). */
  async save(uid: string, prefs: NotificationPrefs): Promise<void> {
    await updateDoc(doc(this.firestore, 'users', uid), { notificationPrefs: resolvePrefs({ ...prefs }) });
  }
}
