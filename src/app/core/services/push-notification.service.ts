import { inject, Injectable } from '@angular/core';
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
import {
  ActionPerformed,
  PushNotificationSchema,
  PushNotifications,
  Token,
} from '@capacitor/push-notifications';
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

  private listenersRegistered = false;
  private savedToken: { uid: string; token: string } | null = null;

  async init(): Promise<void> {
    if (!this.platform.isNative) return;

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
    if (!saved) return;
    this.savedToken = null;
    try {
      await deleteDoc(this.tokenRef(saved.uid, saved.token));
    } catch (err) {
      console.error('[push] no se pudo borrar el device token:', err);
    }
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
