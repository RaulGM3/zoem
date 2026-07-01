import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Auth } from '@angular/fire/auth';
import {
  collection,
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

@Injectable({ providedIn: 'root' })
export class PushNotificationService {
  private readonly platform = inject(PlatformService);
  private readonly auth = inject(Auth);
  private readonly firestore = inject(Firestore);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  async init(): Promise<void> {
    if (!this.platform.isNative) return;

    const permission = await PushNotifications.requestPermissions();
    if (permission.receive !== 'granted') return;

    await PushNotifications.register();
    this.registerListeners();
  }

  private registerListeners(): void {
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

    const ref = doc(
      collection(this.firestore, `users/${uid}/deviceTokens`),
      token,
    );
    await setDoc(ref, {
      token,
      platform: this.platform.platform,
      createdAt: serverTimestamp(),
    });
  }
}
