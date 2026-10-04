import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Auth } from '@angular/fire/auth';
import {
  collection,
  deleteDoc,
  doc,
  Firestore,
  serverTimestamp,
  setDoc,
} from '@angular/fire/firestore';
import { deleteToken, getToken, Messaging, onMessage } from '@angular/fire/messaging';
import {
  ActionPerformed,
  PushNotificationSchema,
  PushNotifications,
  Token,
} from '@capacitor/push-notifications';
import { environment } from '../../../environments/environment';
import { PlatformService } from './platform.service';
import { ToastService } from './toast.service';

/** Debe coincidir con default_notification_channel_id en AndroidManifest.xml. */
const DEFAULT_CHANNEL_ID = 'general';

@Injectable({ providedIn: 'root' })
export class PushNotificationService {
  private readonly platform = inject(PlatformService);
  private readonly auth = inject(Auth);
  private readonly firestore = inject(Firestore);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  /** Solo existe en web (app.config lo provee condicionalmente). */
  private readonly messaging = this.injectMessaging();

  private listenersRegistered = false;
  private savedToken: { uid: string; token: string } | null = null;

  private readonly permission = signal<NotificationPermission | null>(this.readPermission());
  private readonly enabledWeb = signal(false);
  private vapidWarned = false;
  private stopForeground: (() => void) | null = null;

  /** true si este navegador ya tiene un token web guardado en esta sesión. */
  readonly webEnabled = this.enabledWeb.asReadonly();
  /** true si se puede mostrar el CTA de activar (permiso aún sin decidir). */
  readonly canPromptWeb = computed(() => this.webSupported() && this.permission() === 'default');

  /** Web push disponible: web (no nativo), Messaging provisto, SW, Notification y VAPID key. */
  webSupported(): boolean {
    if (this.platform.isNative || !this.messaging) return false;
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return false;
    if (typeof Notification === 'undefined') return false;
    if (!this.vapidKey()) {
      if (!this.vapidWarned) {
        this.vapidWarned = true;
        console.warn('[push] vapidKey no configurada en environment: web push desactivado.');
      }
      return false;
    }
    return true;
  }

  /**
   * Activa push en el navegador. Llamar SOLO desde un gesto del usuario: pide
   * permiso (si aún no se decidió), registra el SW y guarda el token FCM.
   */
  async enableWeb(): Promise<boolean> {
    if (!this.webSupported()) return false;
    try {
      let permission = Notification.permission;
      if (permission === 'default') {
        permission = await Notification.requestPermission();
      }
      this.permission.set(permission);
      if (permission !== 'granted') return false;
      return await this.obtainWebToken();
    } catch (err) {
      console.error('[push] no se pudo activar web push:', err);
      this.toast.fromError(err, { title: 'No se pudieron activar las notificaciones' });
      return false;
    }
  }

  async init(): Promise<void> {
    if (!this.platform.isNative) {
      // Web: NUNCA pedimos permiso al cargar. Si ya estaba concedido, solo refrescamos el token.
      if (this.webSupported() && Notification.permission === 'granted') {
        try {
          await this.obtainWebToken();
        } catch (err) {
          console.error('[push] no se pudo refrescar el token web:', err);
        }
      }
      return;
    }

    const permission = await PushNotifications.requestPermissions();
    if (permission.receive !== 'granted') return;

    if (this.platform.isAndroid) {
      await PushNotifications.createChannel({
        id: DEFAULT_CHANNEL_ID,
        name: 'General',
        description: 'Notificaciones generales de Vertey',
        importance: 4,
        visibility: 1,
        vibration: true,
      });
    }

    await PushNotifications.register();
    this.registerListeners();
  }

  /**
   * Borra el token de este dispositivo en Firestore. Debe llamarse ANTES de
   * cerrar sesión (las rules exigen request.auth.uid == uid). Nunca lanza:
   * un fallo de red no debe bloquear el logout.
   */
  async unregister(): Promise<void> {
    const saved = this.savedToken;
    this.stopForeground?.();
    this.stopForeground = null;
    if (this.enabledWeb() && this.messaging) {
      this.enabledWeb.set(false);
      try {
        await deleteToken(this.messaging);
      } catch (err) {
        console.error('[push] no se pudo borrar el token web de FCM:', err);
      }
    }
    if (!saved) return;
    this.savedToken = null;
    try {
      await deleteDoc(this.tokenRef(saved.uid, saved.token));
    } catch (err) {
      console.error('[push] no se pudo borrar el device token:', err);
    }
  }

  /** getMessaging() lanza en navegadores no soportados: eso no debe romper la app. */
  private injectMessaging(): Messaging | null {
    try {
      return inject(Messaging, { optional: true });
    } catch (err) {
      console.warn('[push] Firebase Messaging no disponible en este navegador:', err);
      return null;
    }
  }

  private vapidKey(): string {
    const env = environment as unknown as { vapidKey?: string; firebase?: { vapidKey?: string } };
    return env.firebase?.vapidKey || env.vapidKey || '';
  }

  private async obtainWebToken(): Promise<boolean> {
    const messaging = this.messaging;
    if (!messaging) return false;
    // La config viaja por query params: el SW no puede leer environment.
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(environment.firebase)) {
      if (typeof v === 'string' && v) params.set(k, v);
    }
    params.delete('databaseId');
    const serviceWorkerRegistration = await navigator.serviceWorker.register(
      `/firebase-messaging-sw.js?${params.toString()}`,
    );
    const token = await getToken(messaging, { vapidKey: this.vapidKey(), serviceWorkerRegistration });
    if (!token) return false;
    await this.saveToken(token);
    this.enabledWeb.set(true);
    this.stopForeground ??= onMessage(messaging, (payload) => {
      this.toast.info(
        payload.notification?.body ?? '',
        payload.notification?.title ?? 'Nueva notificación',
      );
    });
    return true;
  }

  private readPermission(): NotificationPermission | null {
    return typeof Notification === 'undefined' ? null : Notification.permission;
  }

  private registerListeners(): void {
    if (this.listenersRegistered) return;
    this.listenersRegistered = true;

    PushNotifications.addListener('registration', (token: Token) => {
      this.saveToken(token.value);
    });

    PushNotifications.addListener(
      'pushNotificationReceived',
      (notification: PushNotificationSchema) => {
        this.toast.info(
          notification.body ?? '',
          notification.title ?? 'Nueva notificación',
        );
      },
    );

    PushNotifications.addListener(
      'pushNotificationActionPerformed',
      (action: ActionPerformed) => {
        const route = action.notification.data?.['route'] as string | undefined;
        if (route) {
          this.router.navigateByUrl(route);
        }
      },
    );
  }

  private async saveToken(token: string): Promise<void> {
    const uid = this.auth.currentUser?.uid;
    if (!uid) return;

    this.savedToken = { uid, token };
    // merge: refresca lastSeenAt sin perder el doc si ya existía.
    await setDoc(
      this.tokenRef(uid, token),
      {
        token,
        platform: this.platform.platform,
        lastSeenAt: serverTimestamp(),
      },
      { merge: true },
    );
  }

  private tokenRef(uid: string, token: string) {
    return doc(collection(this.firestore, `users/${uid}/deviceTokens`), token);
  }
}
