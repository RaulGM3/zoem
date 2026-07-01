import { Component, inject, OnInit } from '@angular/core';
import { Location } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { ToastContainerComponent } from './core/ui/toast-container/toast-container';
import { UploadProgressComponent } from './core/ui/upload-progress/upload-progress';
import { PlatformService } from './core/services/platform.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastContainerComponent, UploadProgressComponent],
  template: `
    <router-outlet />
    <app-toast-container />
    <app-upload-progress />
  `,
  styles: [],
})
export class App implements OnInit {
  private readonly platform = inject(PlatformService);
  private readonly location = inject(Location);

  async ngOnInit(): Promise<void> {
    if (!this.platform.isNative) return;
    await this.initNative();
  }

  private async initNative(): Promise<void> {
    const [{ StatusBar, Style }, { App }] = await Promise.all([
      import('@capacitor/status-bar'),
      import('@capacitor/app'),
    ]);

    if (this.platform.isIos) {
      await StatusBar.setStyle({ style: Style.Default });
      document.body.classList.add('native-ios');
    }

    if (this.platform.isAndroid) {
      await StatusBar.setBackgroundColor({ color: '#ffffff' });
      await StatusBar.setStyle({ style: Style.Default });

      let backPressedOnce = false;
      App.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack) {
          this.location.back();
          return;
        }
        if (backPressedOnce) {
          App.exitApp();
          return;
        }
        backPressedOnce = true;
        setTimeout(() => { backPressedOnce = false; }, 2000);
      });
    }
  }
}
