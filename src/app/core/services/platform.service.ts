import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';

@Injectable({ providedIn: 'root' })
export class PlatformService {
  readonly isNative = Capacitor.isNativePlatform();
  readonly platform = Capacitor.getPlatform() as 'web' | 'ios' | 'android';
  readonly isIos = this.platform === 'ios';
  readonly isAndroid = this.platform === 'android';
}
